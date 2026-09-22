# App Review corrections — September 22, 2026

Prepared for the rejection of iOS 1.10.9 (16), submission 65e4ff40-56ce-4be3-8a76-b6ad689968d7. Corrected source version: 1.0.0.11.6; iOS marketing version: 1.11.6. This document does not certify App Store approval or a completed signed build.

## Privacy and AI sharing

- Replaced the absolute-positioned consent overlay with a native `Modal` using the app's over-full-screen presentation. It has a bounded scrolling body, a maximum 560-point card width, safe-area spacing, and fixed accept/decline controls. The disclosure is readable on smaller phones and iPad-sized layouts.
- Named recipients appear first: OpenRouter, Google Cloud Vertex AI, Novita AI, Microsoft Azure (including Azure Speech), and EvidenceMD. The disclosure specifies messages/history, relevant health context, selected images/document text, permitted cycle information, pet information and voice data, depending on the chosen feature.
- Recording audio goes through OpenRouter to Google Vertex AI for transcription. Enabled spoken replies send response text to Azure Speech. The general privacy-policy acceptance does not authorize AI processing.
- Consent is voluntary. A declined or closed prompt stops the pending request; non-AI features remain available. The user can revoke consent under **პროფილი → AI მონაცემების გაზიარება**. A changed disclosure requires a fresh decision. The server independently checks consent before provider transport.
- The existing provider boundary rejects undisclosed routes and redirects. OpenRouter is restricted to disclosed hosts with collection disabled, a ZDR routing filter and no automatic provider fallback. Direct Azure Speech and EvidenceMD processing is described separately; no blanket zero-retention claim is made.
- Fixed an additional usability bug found during QA: Medi no longer calls a declined AI consent decision a network failure or offers an automatic retry. Voice capture returns an explanatory notice without starting/uploading a recording.
- Updated the single privacy source and regenerated both the in-app policy and public HTML. The policy states the equal-or-better protection requirement for third-party processing, purpose limits, confidentiality, security and deletion cooperation. This is a policy commitment, not an independently audited certification or evidence of a signed provider agreement. The operator must keep applicable provider terms/settings consistent with it.

## Free access

- All consumer features and registration are free. Runtime flags and historical billing configurations cannot enable purchases, commercial quotas or paid feature gates.
- Removed the consumer profile's tier badge and package card, retired usage/upgrade cards, and replaced the old package page with a profile redirect so existing links remain safe.
- Removed upgrade language and old FREE/STANDARD/ULTIMATE comparisons from the public landing page and updated the terms and relevant app guidance.
- Historical database billing rows and administrator authorization roles were preserved. Historical plan data no longer determines consumer access; this release does not destructively rewrite accounting history.

## Verification

- 40 focused automated checks passed: consent versioning/ownership/failure handling, provider routing, Azure Speech, free access, version metadata, native-storage/location regression checks, and voice-capture/dialog behavior.
- 14 isolated PostgreSQL/HTTP checks passed: missing/stale/revoked consent, blocked provider transport, consented saved results, cross-account access protection, free access for historical paid/exhausted accounts and technical concurrency controls. Synthetic local fixtures only; no patient test writes.
- TypeScript passed.
- Actual React Native Web screens checked at 390×640 and iPad 834×1194, light and dark: fixed choice buttons, disclosure scrolling, named recipients, saved consent, revocation, decline and navigation back to normal app use. A real request attempt after revocation opened consent first and declining it left a usable assistant with no false connection-error message.
- Expo returned the complete iOS JavaScript bundle successfully, version 1.0.0.11.6, using the correct development API. Both web exports were verified to use their separate intended real-account and isolated QA APIs.
- Browser sizing and Expo bundling do not replace a signed TestFlight build on a physical iPad. No App Store Connect submission or review response was made by this task.

## Publication order

1. Deploy this server/landing/privacy revision and verify the public privacy URL contains the September 22 revision and Azure Speech disclosure. The repository's existing Render blueprint deploys `main` commits and runs the idempotent consent installer; do not replace it with a destructive schema push.
2. Create a fresh **production iOS** EAS build from this source. The production profile uses `https://medicard.ge` and remote automatic build-number incrementing. The rejected binary 1.10.9 (16) cannot be repaired by a server restart alone.
3. On the signed build, test first-time consent, decline, allow, revoke and a subsequent AI attempt on iPhone and iPad, including native microphone permission after explicit consent. Confirm a normal non-AI feature still works after decline.
4. Check App Store privacy answers against the actual data practices and current provider agreements/settings; keep the public policy URL accurate. Select the new binary for review.
5. Use [the prepared English reply](./APP-REVIEW-REPLY-2026-09-22.md) after the corrected server and binary are in place. Do not say those changes are live before verifying deployment.

## Sources

- [Apple App Review Guidelines — privacy and data use](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage): separate in-app disclosure/permission and an accurate privacy policy are both required; policy text alone is insufficient.
- [OpenRouter provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging): routing and provider-retention controls.
- [Google Vertex AI data retention](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention): service-specific training and retention qualifications.
- [Azure Speech text-to-speech privacy](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security): real-time TTS processing, distinct from custom-voice products.
- [EvidenceMD privacy](https://evidencemd.ai/privacy-policy) and [Novita privacy](https://novita.ai/legal/privacy-policy): provider-specific processing and retention terms.
