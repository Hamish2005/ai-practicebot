"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicSession } from "../server/presentation";
import { LiveTranscript, type LiveItem } from "./live-transcript";
import {
  practiceVoices,
  defaultPracticeVoice,
  type PracticeVoice,
} from "../engine/voice-options";

type VoiceItem = {
  id: string;
  role: string;
  content?: { transcript?: string; text?: string }[];
};
type VoiceEvent = {
  type: string;
  item_id: string;
  previous_item_id?: string;
  item?: VoiceItem;
  transcript?: string;
  response?: { output?: VoiceItem[] };
  error?: { code?: string };
};

async function post(body: unknown) {
  const response = await fetch("/api/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Live conversation failed.");
  return data;
}

export function LiveConversation({
  session,
  disabled,
  onSession,
  onBusy,
}: {
  session: PublicSession;
  disabled: boolean;
  onSession: (session: PublicSession) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [phase, setPhase] = useState<
    "idle" | "connecting" | "live" | "finishing" | "error"
  >("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<LiveItem[]>([]);
  const [muted, setMuted] = useState(false);
  const [voice, setVoice] = useState<PracticeVoice>(defaultPracticeVoice);
  const audio = useRef<HTMLAudioElement>(null);
  const callbacks = useRef({ onSession, onBusy });
  useEffect(() => {
    callbacks.current = { onSession, onBusy };
  }, [onSession, onBusy]);
  const r = useRef({
    pc: null as RTCPeerConnection | null,
    dc: null as RTCDataChannel | null,
    stream: null as MediaStream | null,
    player: null as HTMLAudioElement | null,
    transcript: new LiveTranscript(),
    liveId: "",
    mounted: true,
    generation: 0,
    syncing: null as Promise<void> | null,
    saved: 0,
    finishing: false,
    speaking: false,
    opening: true,
    ignored: new Set<string>(),
    timer: null as ReturnType<typeof setTimeout> | null,
  });
  function stopMedia() {
    const state = r.current;
    state.stream?.getTracks().forEach((t) => t.stop());
    state.stream = null;
    state.player?.pause();
    if (state.player) state.player.srcObject = null;
    state.dc?.close();
    state.pc?.close();
    state.dc = null;
    state.pc = null;
    if (state.timer) clearTimeout(state.timer);
  }
  useEffect(() => {
    const state = r.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.generation++;
      stopMedia();
      callbacks.current.onBusy(false);
    };
  }, []);
  function publish() {
    if (r.current.mounted)
      setItems(r.current.transcript.items.map((i) => ({ ...i })));
  }
  function send(event: unknown) {
    if (r.current.dc?.readyState === "open")
      r.current.dc.send(JSON.stringify(event));
  }
  function fail(message: string) {
    if (!r.current.mounted) return;
    // Stop capture on errors, but retain the transcript for a scoring retry.
    r.current.stream?.getTracks().forEach((t) => {
      t.stop();
    });
    r.current.player?.pause();
    send({ type: "response.cancel" });
    setError(message);
    setPhase("error");
  }
  async function sync() {
    const state = r.current;
    if (state.syncing) return state.syncing;
    state.syncing = (async () => {
      while (state.mounted && state.liveId) {
        const events = state.transcript.prefix();
        if (events.length === state.saved) return;
        setStatus("Scoring in the background…");
        const data = await post({
          action: "sync",
          sessionId: session.id,
          liveId: state.liveId,
          events,
        });
        state.saved = events.length;
        if (!state.mounted) return;
        callbacks.current.onSession(data.session);
        setStatus("Listening — you can interrupt Practice Bot.");
        if (data.shouldStop && !state.finishing) {
          // Schedule after this scoring promise has settled, avoiding self-await.
          setTimeout(() => void finish(), 0);
          return;
        }
      }
    })();
    try {
      await state.syncing;
    } finally {
      state.syncing = null;
    }
  }
  function changed() {
    publish();
    if (!r.current.finishing) void sync().catch((e) => fail(e.message));
  }
  function receive(event: VoiceEvent) {
    const state = r.current;
    if (!state.mounted) return;
    const type = event.type;
    if (type === "input_audio_buffer.speech_started") {
      state.speaking = true;
      state.transcript.add(event.item_id, "user");
      setStatus("Listening…");
      publish();
    }
    if (type === "input_audio_buffer.speech_stopped") state.speaking = false;
    if (
      type === "conversation.item.added" ||
      type === "conversation.item.created"
    ) {
      const item = event.item;
      if (item?.role === "user")
        state.transcript.add(item.id, "user", event.previous_item_id);
    }
    if (
      type === "response.output_item.added" &&
      event.item?.role === "assistant"
    ) {
      if (state.opening) {
        state.ignored.add(event.item.id);
        state.opening = false;
      } else state.transcript.add(event.item.id, "assistant");
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      state.transcript.complete(event.item_id, "user", event.transcript ?? "");
      changed();
    }
    if (type === "conversation.item.input_audio_transcription.failed") {
      fail(
        "A reply could not be transcribed. Enter the missing words below, then finish scoring.",
      );
      publish();
    }
    if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done"
    ) {
      if (!state.ignored.has(event.item_id)) {
        state.transcript.complete(
          event.item_id,
          "assistant",
          event.transcript ?? "",
        );
        changed();
      }
    }
    if (type === "response.done") {
      for (const item of event.response?.output ?? []) {
        if (item.role !== "assistant" || state.ignored.has(item.id)) continue;
        const text = (item.content ?? [])
          .map(
            (part: { transcript?: string; text?: string }) =>
              part.transcript ?? part.text ?? "",
          )
          .join(" ");
        const existing = state.transcript.items.find((i) => i.id === item.id);
        if (!existing?.ready)
          state.transcript.complete(item.id, "assistant", text);
      }
      changed();
    }
    if (
      type === "error" &&
      ![
        "response_cancel_not_active",
        "input_audio_buffer_commit_empty",
      ].includes(event.error?.code ?? "")
    )
      fail(
        "The live voice connection reported an error. Finish scoring or retry the session.",
      );
  }
  async function start() {
    const state = r.current;
    const generation = ++state.generation;
    setError("");
    setPhase("connecting");
    callbacks.current.onBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!state.mounted || state.generation !== generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      state.stream = stream;
      const pc = new RTCPeerConnection();
      state.pc = pc;
      state.player = audio.current;
      pc.ontrack = (event) => {
        if (state.player) {
          state.player.srcObject =
            event.streams[0] ?? new MediaStream([event.track]);
          void state.player
            .play()
            .catch(() => setError("Press Play below to hear Practice Bot."));
        }
      };
      pc.onconnectionstatechange = () => {
        if (
          ["failed", "disconnected"].includes(pc.connectionState) &&
          !state.finishing
        )
          fail("Voice disconnected. Finish scoring to save your conversation.");
      };
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const dc = pc.createDataChannel("oai-events");
      state.dc = dc;
      dc.onmessage = (event) => {
        try {
          receive(JSON.parse(event.data));
        } catch {
          fail("Could not read a voice event.");
        }
      };
      dc.onopen = () => {
        if (state.timer) clearTimeout(state.timer);
        setPhase("live");
        setStatus("Listening — you can interrupt Practice Bot.");
        send({
          type: "response.create",
        });
        state.timer = setTimeout(() => void finish(), 15 * 60_000);
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const data = await post({
        action: "connect",
        sessionId: session.id,
        revision: session.revision,
        sdp: offer.sdp,
        voice,
      });
      state.liveId = data.liveId;
      if (!state.mounted || state.generation !== generation) {
        stopMedia();
        return;
      }
      if (data.session) callbacks.current.onSession(data.session);
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      if (dc.readyState !== "open")
        state.timer = setTimeout(() => {
          stopMedia();
          fail(
            "Voice connection timed out. Finish scoring, then restart to try again.",
          );
        }, 25_000);
    } catch (e) {
      stopMedia();
      if (!state.mounted) return;
      if (state.liveId)
        fail(
          "Could not start audio. Finish scoring, then restart to try again.",
        );
      else {
        setPhase("idle");
        callbacks.current.onBusy(false);
        setError(
          e instanceof Error
            ? e.message
            : "Microphone or live voice unavailable.",
        );
      }
    }
  }
  async function finish() {
    const state = r.current;
    if (state.finishing || !state.liveId) return;
    state.finishing = true;
    setPhase("finishing");
    setError("");
    setStatus("Finishing transcription and scoring…");
    state.stream?.getTracks().forEach((t) => t.stop());
    state.player?.pause();
    send({
      type: "session.update",
      session: { type: "realtime", audio: { input: { turn_detection: null } } },
    });
    send({ type: "input_audio_buffer.commit" });
    state.speaking = false;
    send({ type: "response.cancel" });
    try {
      // Let the final commit/item events cross the data channel before checking
      // the pending set; a click can precede the speech-started event.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const deadline = Date.now() + 15_000;
      while (
        state.transcript.pendingUsers().length &&
        Date.now() < deadline &&
        state.mounted
      )
        await new Promise((resolve) => setTimeout(resolve, 100));
      if (!state.mounted) return;
      if (state.transcript.pendingUsers().length)
        throw new Error(
          "Some words have not arrived. Enter the missing reply below, then retry finishing.",
        );
      // Cancelled assistant output can be empty. It must not block learner scoring.
      state.transcript.items
        .filter((i) => i.role === "assistant" && !i.ready)
        .forEach((i) => {
          i.ready = true;
        });
      await state.syncing;
      await sync();
      const data = await post({
        action: "end",
        sessionId: session.id,
        liveId: state.liveId,
        events: state.transcript.prefix(),
      });
      stopMedia();
      if (state.mounted) {
        callbacks.current.onBusy(false);
        callbacks.current.onSession(data.session);
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : "Could not finish scoring. Retry.");
    } finally {
      state.finishing = false;
    }
  }
  return (
    <div className="voice-controls live-controls">
      <strong>Live conversation</strong>
      <label className="voice-choice">
        Practice Bot voice
        <select
          value={voice}
          disabled={disabled || phase !== "idle"}
          onChange={(event) => setVoice(event.target.value as PracticeVoice)}
        >
          {practiceVoices.map((option) => (
            <option key={option} value={option}>
              {option[0].toUpperCase() + option.slice(1)}
              {option === defaultPracticeVoice ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p>
        Choose a voice before connecting. Start a new live session to change it.
      </p>
      {session.liveRecovery && (
        <p>
          Reconnect to continue from the saved transcript. Repeat any words
          missing from it before ending for a score.
        </p>
      )}
      <p>
        Speak naturally and interrupt when you need to. Practice Bot uses a
        computer-generated voice; audio is processed to support the
        conversation.
      </p>
      {phase === "idle" ? (
        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={() => void start()}
        >
          Start live conversation
        </button>
      ) : (
        <>
          <p role="status">
            {phase === "connecting" ? "Connecting microphone…" : status}
          </p>
          <button
            type="button"
            disabled={phase !== "live"}
            onClick={() => {
              r.current.stream?.getAudioTracks().forEach((t) => {
                t.enabled = muted;
              });
              setMuted(!muted);
            }}
          >
            {muted ? "Unmute microphone" : "Mute microphone"}
          </button>
          <button
            type="button"
            disabled={phase === "connecting" || phase === "finishing"}
            onClick={() => void finish()}
          >
            {phase === "finishing"
              ? "Finishing…"
              : phase === "error"
                ? "Retry finishing and show scores"
                : "End live session & show scores"}
          </button>
        </>
      )}
      <audio
        ref={audio}
        autoPlay
        controls
        hidden={phase === "idle"}
        aria-label="Practice Bot live voice"
      />
      {error && <p role="alert">{error}</p>}
      {items.length > 0 && (
        <details open>
          <summary>Live transcript</summary>
          <div className="live-transcript">
            {items.map((item) => (
              <div key={item.id}>
                <strong>{item.role === "user" ? "You" : "Practice Bot"}</strong>
                <p>{item.ready ? item.content : "Transcribing…"}</p>
                {phase === "error" && item.role === "user" && !item.ready && (
                  <textarea
                    aria-label="Missing reply"
                    maxLength={4000}
                    placeholder="Type the words you spoke"
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        r.current.transcript.complete(
                          item.id,
                          "user",
                          e.target.value,
                        );
                        publish();
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
