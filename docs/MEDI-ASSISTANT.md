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

Local API 4340 and isolated QA API 4356 load this configuration. Expo on port 8081 points to API 4340, while the actual app web QA preview on 4357 points to isolated API 4356. These environments do not share test accounts or test writes.

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

## Focused conversation — 2026-09-21, app 1.0.0.11.2

Clear literal medication-name and quantified-today hydration requests bypass the model. Ambiguous speech still uses the planner; known domains/current drafts skip its separate classification pass. Assistant-only low reasoning is opt-in: clinical defaults remain medium. No doses, times, glass volumes or treatment start dates are invented. Server validation, consent, owner isolation and signed idempotent execution remain authoritative.

Partial actions open one focused card, with missing related inputs together and optional fields collapsed. Full-width choices and time selection support voice or direct editing. The visible filled form's Save button prepares and executes without a second confirmation screen; voice-completed plans still receive one readback/confirmation. History is expandable. Success, errors and the keyboard footer are concise; native handoffs no longer wait for spoken playback, and canonical refreshes run after successful save without blocking the next request.

Medication addition accepts optional courseDays/startDate/endDate. A stated duration needs an explicit start; the end date is inclusive and conflicting values fail validation. Persistence uses existing medication config, without a database migration. Home, calendar and medication lists honor course dates. Finite reminders use one-off local dates; a bounded upcoming queue (up to 48 medication slots subject to other scheduled notifications) is replenished on medication load/app return. No automatic notification permission request; physical-device delivery remains to be checked.

Local synthetic measurements: literal plan 7.912s before / 0.016s after; natural course request 4.209s; grouped follow-up 1.935s; correction 6.283s; prepare/save 15/29ms. Synthesized Georgian audio transcribed in 2.831s, then planned in 19ms. These are individual measurements, not latency guarantees or real-person microphone tests. Unit/HTTP, TypeScript, web rendering and full iOS Expo bundle checked separately.

Design basis: GOV.UK question-pages/check-answers patterns and Google's conversational confirmations. The concrete task-card layout is our product design choice, not a claim of clinical or usability validation.
## App knowledge and discovery — 2026-09-21, app 1.0.0.11.3

assistantKnowledge.js is the reviewed source for 62 native entry destinations, Georgian labels, seven groups and factual feature descriptions. The same registry drives the planner guide, public scoped catalog, allowed open targets, directory search and literal navigation. Wizard completion/result routes, legacy Companion and retired district competition are not entry destinations. New feature work must update this registry and its route-resolution/coverage tests. New destinations are not implicit automation privileges.

The directory replaces the long flat action list: topic tiles, scoped search, distinct in-assistant forms and native page entries. A page tap prepares/executes navigation directly; health mutations keep explicit review/save. Native returns reload owner choices. Enum schemas remain authoritative when server-provided labels are incomplete; pet destinations cannot borrow human profile labels. Choosing a different pet clears its selected product. Optional patch forms initially expose a few useful fields, with more on demand.

Added record_open, medication_open and visit_open with ownership checks before review and execution; existing medication/visit writes and dose events now share those checks. Cycle deep links redirect to the cycle entry when privacy is enabled, preserving the local unlock gate. Pet navigation excludes human-health destinations at catalog and validation layers. Context includes allowlisted medication course configuration, canonical MedipulsiSession totals without GPS coordinates, and bounded owned pet care/product records. It remains a relevant recent window, never a claim to know all historical or device-only data.

32 action types include 25 write/update types and 7 handoff types. File/camera selection, OS permission approval, real GPS tracking, sharing/exporting, reward redemption and account deletion continue in existing native user-operated flows. No database migration. No new paid service or secret in the client. Unknown/scope-invalid actions return a controlled 400. One action is reviewed at a time.

Validation: 63 focused server/mobile regressions plus 4 selector regressions, TypeScript, 8 synthetic HTTP scenarios and all 72 scope/destination combinations. Actual phone-sized Expo web UI checked in light/dark, with search, form selection, native handoff and return. Literal navigation measured 18ms locally; model tasks around 2.5–5s, not guarantees. Physical iPhone microphone/haptics/keyboard remain device checks.


## Unified conversation — 2026-09-21, app 1.0.0.11.4

This entry supersedes the earlier scope-tab and automatically expanded form UX. The global assistant has one voice-first canvas, no human/pet tabs, concise current reply and an opt-in manual editor. Capability directory, history and alternate tap recording are behind the conversation menu. Hold/release, cancellation, voice interruption, keyboard handling and accessible tap recording remain supported. Short date choices appear when relevant; all state-changing actions still require explicit review/confirmation.

`scope:auto` is resolved against an owner-filtered pet identity directory before loading health context. Exact names/Georgian suffixes select a pet; duplicate names offer owner-checked choices, personal requests leave the pet subject, and a short answer preserves the pending task. Matched pet context is limited to that pet. Existing explicit human/pet clients remain compatible; execution always signs a concrete human/pet scope. Pet vaccination planning uses the canonical personal care schedule, not a completed vaccination or an external clinic booking. No medicine/vaccine dose is inferred.

The assistant model boundary validates visible JSON and action schemas, checks truncation, retries one malformed/empty response without mutation, and bounds each model attempt at 25 seconds. It never parses hidden provider reasoning as an answer. Transport/quota errors are not blindly replayed. Failed planning preserves the utterance and draft. Transcription and planning have independent rate limits. The clinical model default is unchanged; assistant preparation uses minimal effort.

Validation: 78 focused tests; seven synthetic local HTTP scenarios including canonical pet-plan save/replay and human/pet switching; real Azure-generated Georgian audio through transcription/planning; TypeScript; native iOS bundle and separate live/QA web exports. Actual phone-sized web UI verified in both themes and through review/save. Physical iPhone microphone/haptics/system keyboard still need device acceptance. Live provider latency varies; a transient stall was observed and led to the bounded request change. No real-user test writes, DB migration, cloud deployment or store submission.

Reference: [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). Model formatting does not replace authorization, context checks or canonical API validation.

Final audio follow-up: Azure synthesis plus Georgian transcription produced the joined vocative `მედილუნა`. Subject resolution now splits the address only for an exact owned-name match; a repeat end-to-end test resolved Luna and returned the date question (STT1.961s, plan2.171s, spoken reply0.880s). Final iOS development bundle is21,389,726bytes/version1.0.0.11.4; API4340.
