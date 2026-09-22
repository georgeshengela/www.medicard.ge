# Reply for App Review

**Preparation note — remove this heading and note when sending:** Use the message below only after the corrected server/privacy page is deployed and a new production iOS build from version 1.11.6 is attached for review. This draft has not been sent. The prior reviewed binary was 1.10.9 (16).

Hello App Review Team,

Thank you for identifying these issues. We have revised MEDICARD's AI disclosure and consent experience and clarified that MEDICARD is free for all consumer users.

**Guidelines 5.1.1(i) and 5.1.2(i)**

Before personal data is sent for AI processing, the app presents a separate disclosure with two explicit choices: consent to AI sharing or continue without AI. This permission is separate from registration and acceptance of our general privacy policy. Closing or declining the prompt prevents the pending AI transmission. Users can continue using non-AI functions and can withdraw consent under Profile → AI data sharing (Georgian: პროფილი → AI მონაცემების გაზიარება).

The disclosure names the recipients and explains what is shared for the selected feature: the user's messages and relevant conversation history; relevant health-profile information and symptoms; selected photos and text extracted from documents; permitted cycle data; or pet-care context. Voice transcription sends the recorded audio through OpenRouter to Google Cloud Vertex AI. When spoken replies are enabled, response text is sent to Microsoft Azure Speech.

The named AI recipients are OpenRouter, Inc.; Google Cloud Vertex AI; Novita AI; Microsoft Azure, including Azure Speech; and EvidenceMD Inc. The disclosure explains their roles and links their privacy policies. The app does not send every category to every provider for every request. Provider routing is restricted to the disclosed services, and the server checks the user's current consent before sending data. A changed disclosure requires renewed consent.

The in-app and public privacy policies explain the collected data, collection methods, purposes, third-party sharing, retention and deletion, and our requirement for third parties to provide protection equal to or greater than our stated protections. The public policy is available at https://medicard.ge/privacy.html.

To verify the consent flow: sign in, open Medi, select text input and send a message. The AI disclosure appears before processing. Choose “გაგრძელება AI-ის გარეშე” to decline, or “ვეთანხმები AI-სთან გაზიარებას” to allow. In Profile → AI data sharing, consent can subsequently be withdrawn with “თანხმობის გაუქმება”.

**Guideline 2.1(b): business model**

1. **Who uses paid subscriptions, features or services?** There are no paid consumer subscriptions, tiers or digital features. All registered users have the same free feature access. AI features require voluntary data-sharing consent, not payment.

2. **Where can users purchase subscriptions, features or services accessed in the app?** There is no place to purchase digital access to MEDICARD, either inside the app or on our website. The app does not direct users to external payments for digital feature access.

3. **What previously purchased subscriptions, features or services can users access?** None. Users do not need a prior purchase, subscription or paid account to use the app.

4. **What paid content or features are unlocked without In-App Purchase?** None. There are no paid digital unlocks. We removed the obsolete consumer tier and upgrade interfaces and the outdated package descriptions from our website.

5. **How do users obtain an account, and is there an account-creation fee?** Users register through the app's account-registration flow. Account creation and use of the app are free.

Thank you for reviewing the updated build.
