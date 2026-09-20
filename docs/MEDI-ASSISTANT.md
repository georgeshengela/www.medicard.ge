# Medi — app-wide Georgian assistant

The owner requested spoken control across the whole app, including weight goals, health history, cycle tracking, pets and consilium. This work extends the existing authenticated workflows. The assistant must never claim success before the corresponding operation succeeds.

## Implementation contract

- A native assistant accessible from the app shell, with text and microphone input, an editable transcript, compact action previews, conversation context, cancellation and a manual continuation path.
- A server-owned catalog covers profiles, daily health metrics, hydration, weight/step goals, medication schedules and dose logs, appointments, cycle observations/periods/settings, pregnancy observations/care plans, pets/health/care, Quest, MEDIRUN, saved records and consultations. Device-dependent capture and permissions open their existing native workflow.
- The planner reads bounded, relevant, authenticated account data; user notes are data, never instructions. Pet context is isolated from human health context. Intimate cycle fields remain excluded from general AI context under existing classification rules.
- The planner cannot emit arbitrary URLs, SQL, account IDs or unrestricted settings. Server validation and the original domain endpoints remain authoritative. Mutations require a reviewable action; voice can confirm that displayed action. Ambiguous quantities, identities, medication doses and dates require clarification.
- The same action ID must not produce duplicate writes after transport retries. Account changes cancel pending audio, plans and responses. No microphone request on mount. No background listening.
- Use the existing disclosed/pinned OpenRouter provider for text and supported audio input. Do not bypass consent or provider restrictions to use a new voice endpoint. Speech playback requires a configured, disclosed provider; availability must be honest.
- Weight targets are user goals, not medical recommendations. Consilium launches the existing clinical flow, including its safety handling. Voice cannot fabricate medical scans, GPS trails, HealthKit readings, verified appointments or prize eligibility.

## Verification requirements

Validate Georgian planning examples, date/quantity resolution, all catalog actions, cross-account access, malformed/unknown tools, prompt injection, consent refusal/revocation, duplicate operations, recording interruption, keyboard/safe-area behavior and native type/build checks. Real Georgian speech quality and physical iOS/Android microphone behavior must be reported separately from mocked or web tests.

## Voice interaction — 2026-09-21, app 1.0.0.11.1

The initial screen and fine teal waveform follow the supplied Figma frames 8856:142096 and 8856:150213. Light mode uses an open white canvas; dark mode uses the MEDICARD navy palette. Actual transcript text replaces the prompt after recording, and the existing chat/action review follows. No fabricated live transcript is shown.

- Hold the microphone, speak, then release. Release sends the recording automatically. A short tap is discarded; slide left or use Cancel to discard. Recordings stop at 60 seconds.
- A permission dialog never causes recording to continue after the finger was released. The user explicitly starts again after permission is granted.
- Start/end/save/error have distinct native haptic feedback. VoiceOver users and people who prefer it can use tap-to-start/tap-to-finish instead of holding. Reduced Motion is respected.
- Medi reads the validated action details, asks for confirmation, and accepts an exact Georgian yes/no. Corrections such as “კი, მაგრამ 200 მლ” create a revised review instead of executing the previous one. The domain API remains the authority on whether an action succeeded.
- Starting a new recording stops Medi's reply to avoid recording its own voice. Mute and stop controls are available in voice and keyboard modes. Leaving the screen, backgrounding or changing accounts stops playback and invalidates pending results.
- Temporary recording/reply files are removed on completion or cancellation. There is no background listening. Current AI sharing consent is checked before every speech request; refusal leaves manual app features available.

## Azure Speech configuration

The server's private `.env` is configured with the owner-supplied key, region `westeurope` and Georgian voice `ka-GE-EkaNeural`. The actual key is not in this document, Git, Expo configuration, the app bundle, API catalog or Render blueprint. `ka-GE-GiorgiNeural` is also supported as a server setting.

Authenticated `POST /api/assistant/speak` accepts plain text, rechecks AI consent and calls the fixed regional Azure endpoint. SSML text is escaped; redirects are rejected. Replies are bounded MP3 audio with `Cache-Control: no-store`. Timeouts, invalid audio and provider errors become concise Georgian fallback messages.

Local API 4000 and isolated QA API 4356 load this configuration. Expo on port 8081 points to API 4000, while the actual app web QA preview on 4357 points to isolated API 4356. These environments do not share test accounts or test writes.

For the public Render service, configure `AZURE_SPEECH_KEY` as a secret environment variable, `AZURE_SPEECH_REGION=westeurope`, and `AZURE_SPEECH_VOICE=ka-GE-EkaNeural`, then deploy the reviewed server changes. The blueprint declares these settings without a credential. Local configuration does not update Render automatically; the public service has not been deployed by this work. EAS does not need the Azure key because the app calls the authenticated server.

AI disclosure revision `2026-09-21.2` identifies Microsoft Azure Speech and explains that the generated reply text is sent to synthesize a voice. Direct Azure speech processing is distinct from OpenRouter provider restrictions. Human/pet context isolation remains unchanged.

## Verification evidence

- TypeScript check passed and production iOS Hermes export completed locally. No store submission or EAS build was made for this voice iteration.
- 63 backend/domain/version regression tests and 10 voice capture/dialog tests passed. Capture tests cover early release, cancellation, background/owner change, short recording rejection and one-time dispatch.
- Six isolated HTTP checks passed before configuration: authentication, unavailable catalog, consent refusal, honest missing-key error, malformed input and silent audio returning an empty transcript without hallucination.
- After configuration, the real authenticated and consented Azure call generated a 50,688-byte Georgian MP3 in 841 ms for a synthetic greeting; the catalog reported voice output available. This is an actual external synthesis, not a mocked response.
- Actual app UI was exercised with synthetic QA data: 250 ml water review → “კი, მაგრამ 200 მლ” correction → exact confirmation → 200 ml saved. Both light and dark voice screens were inspected.
- Physical iPhone microphone levels, hold gestures, haptic feel and Georgian pronunciation quality still require device acceptance testing. Successful synthesis alone does not establish audio quality on every device.

## References

- [Azure Speech language/voice support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
- [Azure text-to-speech REST interface](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [Requested Figma voice screen](https://www.figma.com/design/UvO6dfZRJH8SjUj8D0mB8N/SH-nightingale-UI-Kit--v3.0-?node-id=8856-142096&m=dev)
- [Requested Figma recording reference](https://www.figma.com/design/UvO6dfZRJH8SjUj8D0mB8N/SH-nightingale-UI-Kit--v3.0-?node-id=8856-150213&m=dev)

Final follow-up: keyboard mode includes stop/mute and focuses the text field. Actual browser playback entered speaking state and stopped on command without muting subsequent replies; no new startup errors remained after the root live-presence import fix. Final TypeScript and iOS Hermes export passed. Azure transport tests also cover interrupted/oversized streams. The planner now receives the exact hold/release, tap-mode and cancellation behavior so it does not describe silence as automatic submission.

Deployment schema: the release command now runs server/scripts/install-assistant.mjs, which applies only the additive AssistantOperation table/index migration and preserves existing receipts. The installer is safe to rerun.
