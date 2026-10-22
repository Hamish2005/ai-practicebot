import { test, expect, type Page } from "@playwright/test";
import {
  startSession,
  submitTurn,
  finishSession,
} from "../../src/engine/session";
import { duplicateCharge } from "../../src/scenarios/duplicate-charge";
import { fakeProvider } from "../../src/providers/fake";
import { presentSession } from "../../src/server/presentation";

async function prepare(page: Page, denied = false, failTranscription = false) {
  let state = startSession(duplicateCharge, "browser-voice", Date.now());
  let turns = 0,
    recordings = 0,
    speeches = 0;
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { session: null } });
    const command = route.request().postDataJSON();
    if (command.action === "turn") {
      turns++;
      state = await submitTurn(
        duplicateCharge,
        state,
        command.message,
        fakeProvider,
      );
    }
    if (command.action === "end")
      state = finishSession(
        duplicateCharge,
        state,
        "complete_user",
        Date.now(),
      );
    await route.fulfill({ json: { session: presentSession(state) } });
  });
  await page.route("**/api/voice", async (route) => {
    if (route.request().headers()["content-type"]?.startsWith("multipart")) {
      recordings++;
      await route.fulfill({
        status: failTranscription ? 502 : 200,
        json: failTranscription
          ? { error: "Voice is temporarily unavailable." }
          : {
              text: "That is frustrating, I can give you your money back",
              durationMs: 20,
            },
      });
    } else {
      speeches++;
      await route.fulfill({
        contentType: "audio/mpeg",
        body: Buffer.from([1, 2, 3]),
      });
    }
  });
  await page.addInitScript(
    ({ denied }) => {
      const stats = { stops: 0, plays: 0, pauses: 0 };
      Object.defineProperty(window, "voiceStats", { value: stats });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          if (denied) throw new DOMException("denied", "NotAllowedError");
          return {
            getTracks: () => [
              {
                stop: () => {
                  stats.stops++;
                },
              },
            ],
          };
        },
      });
      class Recorder {
        static isTypeSupported() {
          return true;
        }
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob(["synthetic audio"], { type: this.mimeType }),
          });
          queueMicrotask(() => this.onstop?.());
        }
      }
      Object.defineProperty(window, "MediaRecorder", { value: Recorder });
      HTMLMediaElement.prototype.play = async function () {
        stats.plays++;
      };
      HTMLMediaElement.prototype.pause = function () {
        stats.pauses++;
      };
      HTMLMediaElement.prototype.load = function () {};
    },
    { denied },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start conversation" }).click();
  return {
    turns: () => turns,
    recordings: () => recordings,
    speeches: () => speeches,
  };
}

test("record, review, send, hear the reply and stop audio on ending", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const counts = await prepare(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("checkbox", { name: "Hear Practice Bot replies" })
    .check();
  await expect.poll(counts.speeches).toBe(1);
  await expect(
    page.getByText("Practice Bot is speaking.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record reply", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End Session" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  const draft = page.getByRole("textbox", {
    name: "Your response to Practice Bot",
  });
  await expect(draft).toHaveValue(
    "That is frustrating, I can give you your money back",
  );
  expect(counts.turns()).toBe(0);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect.poll(counts.turns).toBe(1);
  await expect.poll(counts.speeches).toBe(2);
  await expect(page.getByRole("log")).toContainText("That is frustrating");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/voice-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "End Session" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".category-scores li")).toHaveCount(5);
  expect(counts.speeches()).toBe(2);
  expect(errors).toEqual([]);
});

test("microphone denial keeps text practice available", async ({ page }) => {
  const counts = await prepare(page, true);
  await page.getByRole("button", { name: "Record reply", exact: true }).click();
  await expect(
    page.getByText("Microphone access was blocked.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toBeEnabled();
  await page.getByRole("textbox").fill("I am sorry about that.");
  expect(counts.recordings()).toBe(0);
});

test("cancel discards recording and releases microphone", async ({ page }) => {
  const counts = await prepare(page);
  await page.getByRole("button", { name: "Record reply", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel recording" }).click();
  await expect(page.getByRole("textbox")).toBeEnabled();
  await expect(page.getByRole("textbox")).toHaveValue("");
  expect(counts.recordings()).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { voiceStats: { stops: number } }).voiceStats
          .stops,
    ),
  ).toBeGreaterThan(0);
});

test("transcription error never submits a learner turn", async ({ page }) => {
  const counts = await prepare(page, false, true);
  await page.getByRole("button", { name: "Record reply", exact: true }).click();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByText("Voice is temporarily unavailable."),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toBeEnabled();
  expect(counts.turns()).toBe(0);
});
