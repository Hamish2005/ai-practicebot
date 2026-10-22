import { test, expect, type Page } from "@playwright/test";
import {
  startSession,
  submitTurn,
  finishSession,
} from "../../src/engine/session";
import { duplicateCharge } from "../../src/scenarios/duplicate-charge";
import { fakeProvider } from "../../src/providers/fake";
import { presentSession } from "../../src/server/presentation";

async function prepare(page: Page, denied = false, failOnce = false) {
  let state = startSession(duplicateCharge, "browser-live", Date.now());
  let saved = 0,
    calls = 0;
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { session: presentSession(state) } }),
  );
  await page.route("**/api/live", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "connect")
      return route.fulfill({ json: { sdp: "answer", liveId: "live" } });
    calls++;
    if (failOnce) {
      failOnce = false;
      return route.fulfill({
        status: 502,
        json: { error: "Scoring unavailable. Retry finishing." },
      });
    }
    for (const item of body.events.slice(saved)) {
      if (item.role === "user")
        state = await submitTurn(
          duplicateCharge,
          state,
          item.content,
          fakeProvider,
          Date.now,
          true,
        );
      else
        state = {
          ...state,
          transcript: [
            ...state.transcript,
            { role: item.role, content: item.content },
          ],
        };
    }
    saved = body.events.length;
    if (body.action === "end")
      state = finishSession(
        duplicateCharge,
        state,
        "complete_user",
        Date.now(),
      );
    return route.fulfill({
      json: { session: presentSession(state), shouldStop: false },
    });
  });
  await page.addInitScript(
    ({ denied }) => {
      const stats = { stops: 0, closed: 0, sent: [] as unknown[] };
      const track = {
        enabled: true,
        stop: () => {
          stats.stops++;
        },
      };
      Object.defineProperty(window, "liveStats", { value: stats });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          if (denied)
            throw new DOMException(
              "Microphone permission denied",
              "NotAllowedError",
            );
          return { getTracks: () => [track], getAudioTracks: () => [track] };
        },
      });
      const dc = {
        readyState: "open",
        onopen: null as (() => void) | null,
        onmessage: null as ((e: { data: string }) => void) | null,
        send: (data: string) => {
          stats.sent.push(JSON.parse(data));
        },
        close: () => {
          stats.closed++;
        },
      };
      Object.defineProperty(window, "voiceEvent", {
        value: (event: unknown) =>
          dc.onmessage?.({ data: JSON.stringify(event) }),
      });
      class Peer {
        addTrack() {}
        createDataChannel() {
          return dc;
        }
        async createOffer() {
          return { sdp: "offer" };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {
          setTimeout(() => dc.onopen?.(), 0);
        }
        close() {
          stats.closed++;
        }
      }
      Object.defineProperty(window, "RTCPeerConnection", { value: Peer });
      HTMLMediaElement.prototype.play = async () => {};
      HTMLMediaElement.prototype.pause = () => {};
    },
    { denied },
  );
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Live conversation mode" }).check();
  await page.getByRole("button", { name: "Start live conversation" }).click();
  return { state: () => state, calls: () => calls };
}
async function emit(page: Page, event: unknown) {
  await page.evaluate(
    (event) =>
      (
        window as unknown as { voiceEvent: (event: unknown) => void }
      ).voiceEvent(event),
    event,
  );
}

test("live ending waits for final transcription and releases microphone", async ({
  page,
}) => {
  const counts = await prepare(page);
  await expect(
    page.getByRole("button", { name: "Mute microphone", exact: true }),
  ).toBeEnabled();
  await emit(page, {
    type: "input_audio_buffer.speech_started",
    item_id: "u1",
  });
  await page
    .getByRole("button", { name: "End live session & show scores" })
    .click();
  await expect(page.getByRole("button", { name: "Finishing…" })).toBeDisabled();
  expect(counts.state().endedAt).toBeNull();
  await emit(page, {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "u1",
    transcript: "That is frustrating, I can give you your money back",
  });
  await expect(
    page.getByText("Session complete", { exact: true }),
  ).toBeVisible();
  expect(counts.state().feedback?.assessments).toHaveLength(5);
  expect(counts.state().turns).toBe(1);
  const stats = await page.evaluate(
    () =>
      (window as unknown as { liveStats: { stops: number; closed: number } })
        .liveStats,
  );
  expect(stats.stops).toBeGreaterThan(0);
  expect(stats.closed).toBeGreaterThan(0);
});

test("live scoring failure can be retried without losing the reply", async ({
  page,
}) => {
  const counts = await prepare(page, false, true);
  await expect(
    page.getByRole("button", { name: "Mute microphone", exact: true }),
  ).toBeEnabled();
  await emit(page, {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "u1",
    transcript: "That is frustrating, I can give you your money back",
  });
  await expect(page.locator(".live-controls [role=alert]")).toContainText(
    "Scoring unavailable",
  );
  await page
    .getByRole("button", { name: "Retry finishing and show scores" })
    .click();
  await expect(
    page.getByText("Session complete", { exact: true }),
  ).toBeVisible();
  expect(counts.state().turns).toBe(1);
});

test("microphone denial returns to text controls", async ({ page }) => {
  await prepare(page, true);
  await expect(page.locator(".live-controls [role=alert]")).toContainText(
    "Microphone permission denied",
  );
  await page
    .getByRole("checkbox", { name: "Live conversation mode" })
    .uncheck();
  await expect(
    page.getByRole("textbox", { name: "Your response to Practice Bot" }),
  ).toBeEnabled();
});
