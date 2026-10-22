# Voice prototype verification

The first live synthetic-audio test on October 16, 2026 used GPT-4o mini Transcribe, GPT-6 Luna (existing low-reasoning scoring) and GPT-4o mini TTS with Coral.

Input: "I understand how frustrating this is. I can request a refund for the duplicate payment."

The transcript matched those words. Luna returned a continuing-session reply asking about timing and confirmation, and TTS returned a playable MP3 payload.

| Stage                   | Time   |
| ----------------------- | ------ |
| Transcription           | 1.018s |
| Scoring and reply       | 4.991s |
| Spoken reply generation | 2.877s |
| Total service chain     | 8.886s |

This is one synthetic input, not a measurement of a user's microphone-to-first-sound latency. It excludes recording, human review, browser upload, playback decoding and user network conditions. Actual microphone hardware and human speech recognition still need user testing. Speech waits for existing session checks, then the whole audio file is fetched before playback.

The UI supports microphone permission errors, editable drafts, cancellation, a 60-second recording cap, speech opt-in, native playback controls and text fallback. Browser tests use mocked media devices/services; API tests verify session ownership/revision, input limits, no turn commit during transcription, and stale/terminal playback rejection. `npm run test:voice` repeats the paid synthetic service test without opening the microphone.

Audio implementation follows the official [transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text) and [speech generation guide](https://developers.openai.com/api/docs/guides/text-to-speech).
