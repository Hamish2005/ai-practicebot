"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSession } from "../server/presentation";

type Phase = "idle" | "permission" | "recording" | "transcribing";

export function VoiceControls({
  session,
  disabled,
  hasDraft,
  onTranscript,
  onBusy,
}: {
  session: PublicSession;
  disabled: boolean;
  hasDraft: boolean;
  onTranscript: (text: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [speechLoading, setSpeechLoading] = useState(false);
  const [timing, setTiming] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const resources = useRef({
    stream: null as MediaStream | null,
    recorder: null as MediaRecorder | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    captureToken: 0,
    playbackToken: 0,
    transcription: null as AbortController | null,
    speech: null as AbortController | null,
    url: "",
    player: null as HTMLAudioElement | null,
  });
  const callbacks = useRef({ onTranscript, onBusy });
  useEffect(() => {
    callbacks.current = { onTranscript, onBusy };
  }, [onTranscript, onBusy]);
  useEffect(() => {
    onBusy(phase !== "idle");
  }, [phase, onBusy]);

  const stopPlayback = useCallback(() => {
    const r = resources.current;
    r.playbackToken++;
    r.speech?.abort();
    r.speech = null;
    const player = r.player ?? audio.current;
    player?.pause();
    if (player) {
      player.removeAttribute("src");
      player.load();
    }
    if (r.url) URL.revokeObjectURL(r.url);
    r.url = "";
  }, []);

  const releaseCapture = useCallback(() => {
    const r = resources.current;
    r.captureToken++;
    clearTimeout(r.timer);
    r.transcription?.abort();
    if (r.recorder) {
      r.recorder.onstop = null;
      r.recorder.ondataavailable = null;
      if (r.recorder.state !== "inactive") r.recorder.stop();
    }
    r.stream?.getTracks().forEach((track) => track.stop());
    r.stream = null;
    r.recorder = null;
  }, []);

  useEffect(
    () => () => {
      releaseCapture();
      stopPlayback();
      callbacks.current.onBusy(false);
    },
    [releaseCapture, stopPlayback],
  );

  const latestIndex = session.transcript.length - 1;
  const playReply = useCallback(async () => {
    stopPlayback();
    const r = resources.current;
    const token = r.playbackToken;
    const controller = new AbortController();
    r.speech = controller;
    setSpeechLoading(true);
    setError("");
    setStatus("Preparing spoken reply...");
    const start = performance.now();
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          revision: session.revision,
          messageIndex: latestIndex,
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error ?? "Could not prepare speech.",
        );
      const blob = await response.blob();
      if (token !== r.playbackToken) return;
      r.url = URL.createObjectURL(blob);
      const player = audio.current;
      if (!player) return;
      r.player = player;
      player.src = r.url;
      setTiming(
        `Audio ready in ${((performance.now() - start) / 1000).toFixed(1)}s after the text reply.`,
      );
      try {
        await player.play();
        if (token === r.playbackToken)
          setStatus(
            "Practice Bot is speaking. Use the player to pause or replay.",
          );
      } catch {
        if (token === r.playbackToken)
          setStatus(
            "Your browser paused autoplay. Press Play in the audio player.",
          );
      }
    } catch (e) {
      if (token === r.playbackToken && !controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Audio playback failed. You can keep typing.",
        );
        setStatus("");
      }
    } finally {
      if (token === r.playbackToken) setSpeechLoading(false);
    }
  }, [session.id, session.revision, latestIndex, stopPlayback]);

  useEffect(() => {
    // Start after the audio element is mounted; cancel queued playback on a session change.
    const timer =
      enabled && !disabled
        ? window.setTimeout(() => void playReply(), 0)
        : undefined;
    return () => {
      clearTimeout(timer);
      stopPlayback();
    };
  }, [enabled, disabled, playReply, stopPlayback]);

  async function record() {
    if (disabled || hasDraft || phase !== "idle") return;
    stopPlayback();
    setSpeechLoading(false);
    setError("");
    setStatus("");
    const r = resources.current;
    const token = ++r.captureToken;
    setPhase("permission");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Microphone recording needs a supported browser on localhost or HTTPS. You can still type.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (token !== r.captureToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      r.stream = stream;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      r.recorder = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
        }
        if (bytes > 5 * 1024 * 1024 && recorder.state !== "inactive")
          recorder.stop();
      };
      recorder.onerror = () => {
        releaseCapture();
        setPhase("idle");
        setError("Recording failed. Please try again or type your reply.");
      };
      recorder.onstop = async () => {
        clearTimeout(r.timer);
        stream.getTracks().forEach((track) => track.stop());
        r.stream = null;
        if (token !== r.captureToken) return;
        setPhase("transcribing");
        const controller = new AbortController();
        r.transcription = controller;
        const start = performance.now();
        try {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || mimeType || "audio/webm",
          });
          if (!blob.size || blob.size > 5 * 1024 * 1024)
            throw new Error(
              "Recording was empty or too large. Please record a shorter message.",
            );
          const form = new FormData();
          const ext = blob.type.includes("mp4")
            ? "mp4"
            : blob.type.includes("ogg")
              ? "ogg"
              : "webm";
          form.append("audio", blob, `reply.${ext}`);
          form.append("sessionId", session.id);
          form.append("revision", String(session.revision));
          const response = await fetch("/api/voice", {
            method: "POST",
            body: form,
            signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error ?? "Transcription failed.");
          if (token !== r.captureToken) return;
          callbacks.current.onTranscript(data.text);
          setTiming(
            `Transcribed in ${((performance.now() - start) / 1000).toFixed(1)}s.`,
          );
          setStatus(
            "Review your words below, then press Send. Only sent replies are scored.",
          );
        } catch (e) {
          if (token === r.captureToken && !controller.signal.aborted)
            setError(
              e instanceof Error
                ? e.message
                : "Transcription failed. Please try again.",
            );
        } finally {
          if (token === r.captureToken) setPhase("idle");
        }
      };
      recorder.start(1000);
      setPhase("recording");
      r.timer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60_000);
    } catch (e) {
      if (token !== r.captureToken) return;
      releaseCapture();
      setPhase("idle");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings, or type your reply."
          : e instanceof Error
            ? e.message
            : "Microphone is unavailable. You can still type.",
      );
    }
  }

  return (
    <div className="voice-controls" aria-label="Voice practice controls">
      <label className="voice-toggle">
        <input
          type="checkbox"
          checked={enabled}
          disabled={phase !== "idle"}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Hear Practice Bot replies
      </label>
      <p className="voice-note">
        Practice Bot uses a computer-generated voice. Record up to 60 seconds,
        review the transcript, then send. Recordings are processed to transcribe
        your reply.
      </p>
      <div className="voice-buttons">
        {phase === "recording" ? (
          <button
            type="button"
            className="primary"
            onClick={() => {
              const recorder = resources.current.recorder;
              if (recorder?.state === "recording") recorder.stop();
            }}
          >
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={disabled || hasDraft || phase !== "idle"}
            onClick={() => void record()}
          >
            {phase === "permission"
              ? "Waiting for microphone..."
              : phase === "transcribing"
                ? "Transcribing..."
                : "Record reply"}
          </button>
        )}
        {phase !== "idle" && (
          <button
            type="button"
            onClick={() => {
              releaseCapture();
              setPhase("idle");
              setStatus("Recording cancelled.");
            }}
          >
            Cancel recording
          </button>
        )}
        {enabled && phase === "idle" && (
          <button
            type="button"
            disabled={disabled || speechLoading}
            onClick={() => void playReply()}
          >
            Hear latest reply
          </button>
        )}
        {enabled && (
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              setSpeechLoading(false);
              setStatus("Playback stopped.");
            }}
          >
            Stop playback
          </button>
        )}
      </div>
      {hasDraft && phase === "idle" && (
        <p className="voice-note">
          Send or clear your draft before recording another reply.
        </p>
      )}
      <p role="status">
        {phase === "recording" ? "Recording... microphone is on." : status}
      </p>
      {enabled && (
        <audio
          ref={audio}
          controls
          preload="none"
          aria-label="Practice Bot spoken reply"
          onEnded={() => setStatus("Reply finished. Your turn.")}
        />
      )}
      {timing && <small>{timing}</small>}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
