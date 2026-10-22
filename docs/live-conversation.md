# Live conversation implementation

The browser negotiates WebRTC through `/api/live`, using the unified OpenAI calls endpoint. Session instructions come from the server's scenario snapshot. Semantic VAD controls turn-taking; the Realtime service handles interruptions. The default voice model is `gpt-realtime-2.1`, with Marin voice and mini Transcribe input transcripts. Luna's low-reasoning evaluator remains unchanged.

The data channel records items in conversation order, independently of when their transcriptions complete. Only a finalized prefix is sent to the scoring API. Each user message passes through the existing evidence-grounding and controller logic, with actor generation disabled. The server atomically commits each batch and its event cursor, checks unchanged history and unique IDs, and rejects stale connection IDs. Replayed batches cannot double-score. Text requests cannot modify a live session. Reconnection rotates the live ID under the session lock.

Automatic controller decisions request stopping rather than closing immediately. End stops microphone tracks, cancels spoken output, drains pending user transcriptions, awaits scoring, and finalizes every category. An empty session scores zero. Errors leave the saved state intact; retrying can finish scoring. Missing transcription exposes a manual correction field. In-memory state and unsaved browser events are not durable across server/page restarts.

The browser sees the SDP answer and a session-bound random ID, never the API key. Like the existing app, this is a local practice prototype. Browser-originated transcripts are not independently authenticated provider evidence. Production assessments would need server-side event ingestion and durable jobs. Generated assistant transcripts are contextual, not a guaranteed record of the audio actually heard after interruption.

Tests cover transcript order, duplicate events, transactional failure, ownership/history checks, zero-turn endings, and early endings with every category. Browser tests cover permission denial, end during pending transcription, scoring retry, and microphone/connection cleanup. A separate optional smoke script uses synthetic silence; real-microphone latency and turn-taking still require human testing.

References: [OpenAI WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc), [turn detection](https://developers.openai.com/api/docs/guides/realtime-vad), and [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations).

## Verification on October 21, 2026

128 offline tests passed, along with seven focused voice browser tests. TypeScript and focused lint checks passed. A real WebRTC smoke test received audible opening audio and returned five zero-score categories when ended before speaking. A second test sent locally synthesized learner speech through WebRTC, received its transcription, scored one learner turn with Luna, and ended with five categories and an overall score of 60. This is a plumbing check, not human validation of scoring quality.

The spoken test took 6.45 seconds from clicking Connect to observing completed opening-transcript output and nonzero received audio energy. This includes connection setup and is **not** end-of-speech-to-first-audio latency. Real-microphone conversational timing still needs user testing. The initial development server had restricted outbound networking; restarting it with network access resolved the real connection failure.

Use `node scripts/test-realtime.mjs --spoken-turn` for the paid complete-flow check. It uses `test-results/realtime-input.wav` or `.mp3` if present; otherwise it generates a synthetic clip using TTS. The test never accesses a real microphone.
