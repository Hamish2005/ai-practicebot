// Opt-in paid smoke test against a running Practice Bot workspace; never accesses a real mic.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import env from "@next/env";
import OpenAI from "openai";
let spokenAudio = "";
if (process.argv.includes("--spoken-turn")) {
  env.loadEnvConfig(process.cwd());
  try {
    let bytes = await readFile("test-results/realtime-input.wav").catch(() =>
      readFile("test-results/realtime-input.mp3").catch(() => null),
    );
    if (!bytes) {
      const client = new OpenAI({ timeout: 60_000, maxRetries: 1 });
      const speech = await client.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input:
          "I understand how frustrating this is. I can request a refund for the duplicate payment.",
        response_format: "mp3",
      });
      bytes = Buffer.from(await speech.arrayBuffer());
      await mkdir("test-results", { recursive: true });
      await writeFile("test-results/realtime-input.mp3", bytes);
    }
    spokenAudio = bytes.toString("base64");
  } catch (error) {
    console.error(
      "Synthetic speech setup failed:",
      error.name,
      error.status ?? "no HTTP status",
    );
    process.exit(1);
  }
}
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
let page;
try {
  const context = await browser.newContext({ permissions: ["microphone"] });
  page = await context.newPage();
  await page.addInitScript((spokenAudio) => {
    navigator.mediaDevices.getUserMedia = async () => {
      // Generate silence in the browser; do not depend on OS microphone devices.
      const context = new AudioContext();
      const source = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0;
      const destination = context.createMediaStreamDestination();
      window.smokeSpeak = async () => {
        const bytes = Uint8Array.from(atob(spokenAudio), (c) =>
          c.charCodeAt(0),
        );
        const buffer = await context.decodeAudioData(bytes.buffer);
        const speech = context.createBufferSource();
        speech.buffer = buffer;
        speech.connect(destination);
        speech.start();
      };
      source.connect(gain).connect(destination);
      source.start();
      await context.resume();
      return destination.stream;
    };
    const OriginalPeer = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends OriginalPeer {
      constructor(...args) {
        super(...args);
        window.smokePeer = this;
      }
      createDataChannel(...args) {
        const dc = super.createDataChannel(...args);
        window.smokeEvents = [];
        dc.addEventListener("message", (e) => {
          const event = JSON.parse(e.data);
          if (
            event.type === "response.output_audio_transcript.done" &&
            !window.smokeOpening
          )
            window.smokeOpening = event.transcript;
          window.smokeEvents.push({
            type: event.type,
            code: event.error?.code,
          });
        });
        return dc;
      }
    };
  }, spokenAudio);
  await page.goto(process.env.VOICE_TEST_URL || "http://127.0.0.1:3000");
  if (
    !(await page.getByText("Practice Bot workspace", { exact: true }).count())
  )
    throw new Error("Needs a running OpenPractice Bot workspace");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await page.getByRole("checkbox", { name: "Live conversation mode" }).check();
  const start = Date.now();
  await page.getByRole("button", { name: "Start live conversation" }).click();
  await page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .waitFor({ timeout: 45_000 });
  const deadline = Date.now() + 45_000;
  let received = false;
  while (Date.now() < deadline) {
    const failure = await page
      .locator(".live-controls [role=alert]")
      .textContent({ timeout: 200 })
      .catch(() => "");
    if (failure) throw new Error(failure);
    received = await page.evaluate(async () => {
      const stats = await window.smokePeer?.getStats();
      return (
        stats &&
        [...stats.values()].some(
          (s) =>
            s.type === "inbound-rtp" &&
            s.kind === "audio" &&
            s.totalAudioEnergy > 0,
        ) &&
        window.smokeEvents.some(
          (e) => e.type === "response.output_audio_transcript.done",
        )
      );
    });
    if (received) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!received)
    throw new Error("No completed audible reply within 45 seconds");
  const connectedAudioMs = Date.now() - start;
  const opening = await page.evaluate(() => window.smokeOpening);
  if (!/^Hello[,!]?\s+how are you\??$/i.test(opening?.trim() ?? ""))
    throw new Error("Live opening did not match the configured greeting");
  if (spokenAudio) {
    await page.evaluate(() => window.smokeSpeak());
    const turnDeadline = Date.now() + 45_000;
    let scored = false;
    while (Date.now() < turnDeadline) {
      const snapshot = await page.evaluate(
        async () => (await (await fetch("/api/session")).json()).session,
      );
      if (snapshot.turns > 0) {
        scored = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!scored)
      throw new Error(
        "Synthetic learner speech was not transcribed and scored",
      );
  }
  await page
    .getByRole("button", { name: "End live session & show scores" })
    .click();
  await page
    .getByText("Session complete", { exact: true })
    .waitFor({ timeout: 30_000 });
  const session = await page.evaluate(
    async () => (await (await fetch("/api/session")).json()).session,
  );
  const report = {
    testedAt: new Date().toISOString(),
    connectedAudioMs,
    opening,
    syntheticSpokenTurn: Boolean(spokenAudio),
    assessedTurns: session.turns,
    categories: session.feedback.assessments.length,
    overallScore: session.feedback.overallScore,
  };
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/realtime-smoke.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (error) {
  if (page)
    console.error(
      JSON.stringify({
        controls: await page
          .locator(".live-controls")
          .innerText()
          .catch(() => "unavailable"),
        events: await page.evaluate(() => window.smokeEvents).catch(() => []),
      }),
    );
  console.error(
    "Realtime smoke test failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
