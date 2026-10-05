# MEDICARD — Privacy Policy

This is an English translation. If it differs from the Georgian version, the Georgian version prevails.

**Last updated:** October 5, 2026
**Effective date:** September 20, 2026

This policy explains how account, health and activity information is processed in MEDICARD. The amount of data depends on the features you use and the permissions you grant. Reading this policy does not mean you consent to sharing with AI — the app offers you a separate choice for that.

## Summary (App Review)

MEDICARD is a free consumer health app. There are no paid digital subscriptions, unlocks or in-app purchases for app features. Before any personal data is sent to a third-party AI service, the app asks on a dedicated AI & Privacy screen. That screen names what may be sent and who receives it: OpenRouter, Inc.; Google Cloud Vertex AI; Novita AI; Microsoft Azure, including Azure Speech; and EvidenceMD Inc. The user must tap Allow AI Processing. Not Now, closing, registration, or accepting this policy does not authorize AI sharing. The choice is stored on the account. It is not asked again on later AI requests unless the user withdraws it in Profile → Privacy & Data, or the consent version changes. MEDICOACH (optional): a user may connect to an admin-verified fitness trainer. The trainer always sees the user's name, photo, age, sex, height and their shared session schedule; activity and workouts (including data read from Apple Health / Health Connect), nutrition, weight and progress photos are shared only if the user switches each category on, can be changed or stopped at any time, and stop the moment the connection ends. Health data is never used for advertising or sold. The full policy follows below.

# 1. Operator and contact

MEDICARD is operated by George Shengelia (გიორგი შენგელია), a natural person who is responsible for the processing of personal data described in this policy. "MEDICARD" is a product name and does not indicate registration as a company.

**Country and city of operation:** Georgia, Tbilisi
**Contact email:** support@medicard.ge
**Website:** https://medicard.ge

# 2. Account and records you add in the app

For registration and sign-in, we process your email, name, account identifier and, where applicable, your phone number. Passwords are stored on the server in hashed form. If you sign in with Apple or Google, Apple / Google send us a permanent account identifier, your email (with Apple, possibly a private relay address) and, if you share it, your name; no health data is sent to them. When an account created with Apple is deleted, we also revoke the access Apple granted. Your date of birth, sex and photo may be added to your profile.

The data you enter in health features may include symptoms, conditions, allergies, medications, family history, goals, lab tests, images, visits, cycle records and health metrics. This information may be a special category of personal data concerning health.

In your cycle records you may voluntarily mark sexual activity and sex drive. These fields are stored as the most sensitive category: they are not passed to AI recipients, a trainer, the women's space, analytics or notifications, and they are visible only to you. You can delete such a record at any time.

Account records are stored on the server for synchronization and history; some are also stored on the device. If you decline AI, you keep your account and the use of features that do not need external AI processing.

# 3. Device permissions

Camera and photo access is used to add a document, image or pet photo that you choose. The microphone is used in the relevant voice feature. Granting a permission is not, in itself, consent to sending anything to external AI.

Access to Apple Health / HealthKit and Android Health Connect data is managed by separate system permissions. The relevant metrics are used on the activity and health screens; the relevant metrics stored in your account may be included in the health profile context only after separate consent to AI.

The notifications permission is used for reminders. A calendar entry is added only by an action you choose. You can change permissions in your phone's settings. Delivery of notifications is not guaranteed in every background state.

# 4. City, weather and MEDIRUN

When your city is determined, we process GPS coordinates, accuracy and the time of the fix. The device's geocoding is used to obtain the city and country; where needed, the coordinates are sent to OpenStreetMap's Nominatim service. To obtain the weather, the coordinates are sent to Open-Meteo.

During an active MEDIRUN session, we process the route travelled, distance, time, speed and game progress. Mapbox is used to display the map. The game route and the home city in your profile are stored for different purposes; walking does not automatically change your profile city. A session you start keeps recording your path while the screen is locked or another app is open (a blue indicator on iPhone, a notification on Android) until you pause or finish it; outside a session, location is not collected in the background. On iPhone, the session’s distance and time appear on the lock screen as a Live Activity, which is created on the phone and not sent to Apple.

# 5. Data shared with AI and the purpose

AI is used to prepare answers to your requests, explanations of health information, symptom assessments and care tips. Before anything is sent, the app shows the categories, the recipients and the choice to consent or decline.

* your message, the relevant conversation history and the symptoms you describe;
* age and sex; in the relevant feature, your health profile, conditions, allergies, medications, family history, goals and latest metrics;
* images or documents you select for analysis, or text extracted from them;
* the relevant cycle context for cycle AI tips;
* for MEDIVET, the pet's profile, care information and the conversation;
* for voice Medi, audio recorded with the button — sent through OpenRouter to Google Vertex AI for conversion to text; for spoken replies, the text of the reply — sent to Microsoft Azure Speech for real-time voicing.

Adding your health profile to the symptom check is a separate choice. A person's health profile is not included in a MEDIVET request. The user's name is not added automatically from the account context to what is sent to AI, although a name you write or one contained in a document may be part of the request itself. Before uploading, you can cover identifying details that are not needed.

# 6. Recipients of AI data

* OpenRouter, Inc. — routing of the request to the selected model host; policy: https://openrouter.ai/privacy
* Google — Google Cloud Vertex AI — processing of Gemini responses; policy: https://cloud.google.com/terms/cloud-privacy-notice
* Novita AI — processing of Ling model responses; policy: https://novita.ai/legal/privacy-policy
* Microsoft — Azure — auxiliary AI requests and real-time text-to-speech with Azure Speech; policy: https://privacy.microsoft.com/privacystatement
* EvidenceMD Inc. — an alternative response when the selected clinical AI or another model fails; not used in MEDIVET; policy: https://evidencemd.ai/privacy-policy

Not every request is sent to all recipients at once. The recipient used depends on the selected model and feature; if it fails, the request may be retried with one of the alternative recipients listed.

OpenRouter requests specify particular hosts, automatic fallback to other hosts is switched off, and data_collection=deny and the ZDR filter are requested. This is our sending configuration and is not a claim that no record of any kind is ever stored in the MEDICARD account or with every provider. A provider's processing terms and international transfers are subject to its relevant agreement and the applicable rules.

MEDICARD's data protection requirement for every third party is protection equal to or higher than that described in this policy and in Apple's rules: processing only for the agreed purpose, confidentiality, encrypted transfer, restricted access and cooperation on deletion requests. Before adding a recipient, we review its public terms and the relevant data processing terms. Sharing with a recipient that does not meet these requirements is not permitted. This requirement is not a claim that any provider is certified or that the data is fully anonymous.

Voice recordings are not kept in MEDICARD's permanent storage. Temporary audio on the device is deleted when processing or playback finishes. According to Microsoft's public terms, the real-time text-to-speech API does not store the input text or the output audio; this does not apply to other kinds of speech products. OpenRouter's ZDR filter does not apply directly to Azure Speech or EvidenceMD.

# 7. Consent, declining and withdrawal

Registering and reading the privacy policy do not mean consent to sharing with AI. On a new account, this choice is on a separate screen — "AI & Privacy" — after the notifications permission and before any AI request. The screen shows the data categories, the recipient companies and links to their policies. Consent is not pre-selected. "Allow AI Processing" means consent. "Not Now" or closing the screen sends no request. After you consent, the same screen does not appear again with every message.

Your choice is stored on the server together with your account and the consent version. A material change to the recipients, categories or purposes requires new consent. This also applies to users who are already registered: an earlier choice does not carry over automatically to a new version.

Management: Profile → Privacy & Data. Withdrawal stops further sending, including further automatic retried requests. Your account and the features that work without AI remain. Withdrawal does not mean that a request already sent is recalled or that the data is automatically deleted by an external recipient. For such a request, contact us.

# 8. Infrastructure and other services

The app server and database are used to store account records and for synchronization; the project uses Render and Neon PostgreSQL. Depending on the configuration in use, files are stored in server storage or in object storage. The availability of a pet photo or another file depends on the storage in use.

Where needed, notifications are processed through Expo Push and Apple/Google systems, SMS through SMSOffice.ge, and email through the relevant mail service, including Resend. These recipients receive the address/token and message needed for the relevant service. The full health history of a chat is not sent automatically for this purpose.

Authorized administrators may process information needed for account, support and technical review. AI requests and responses stored in the app may be accessible within the limits of these rights. No additional external AI assessment of medical texts stored in the app is carried out automatically.

**Support emails.** The text of an email sent to support@medicard.ge, the sender's address and the subject are processed by our automated assistant, which uses a model from Anthropic PBC through OpenRouter, Inc. — to categorize the email and to prepare or send a reply. The requests specify data_collection=deny. The assistant itself answers only general questions about the app; emails about accounts, data requests, medical, financial and partnership matters are reviewed by a person. Health data stored in the app is not used in this processing. If you want only a person to reply to your email, say so in the email.

**Product analytics.** To improve the app, we record product events: installation, registration, onboarding steps, first action and return visits. We store the event name, a few technical values (e.g. onboarding step, platform, app version), a hash of a random installation identifier and, after sign-in, the account identifier. Health values and free text are not recorded in analytics. The data is not passed to third parties and is not used for advertising or for tracking across other apps.

**Error diagnostics.** For app stability, when an error or crash occurs in the app, a technical report is sent to our server: the error type and a shortened message, the code location, the screen route (without identifiers), the platform, the app version and, after sign-in, a hash of the account identifier. Before sending, emails, long numbers and tokens are removed from the text; health values and text you entered are not sent. Reports are kept for 30 days, are not passed to third parties and are not used for advertising or tracking.

# 9. Retention and account deletion

Account records and AI responses are kept for history and synchronization until you delete them or your account. In this version there is no promise of a single automatic expiry period for all records. Individual local caches may be changed or deleted sooner.

You can delete your account from the profile settings in the app. The main records linked to the account, the health profile, conversations, pet data and AI consent records are deleted. The texts of notifications linked to the account are deleted or redacted; deletion of uploaded files is also processed in the relevant storage. Financial or security history that must be kept may remain within the scope of the relevant obligation.

Step-by-step instructions, deletion without the app and an exact list of what is deleted and what remains: https://medicard.ge/delete-account

Deletion does not mean immediate automatic deletion of third-party backups or of data that has already been sent. To make a request about such information, use the support email. You can also manage an entry you previously added to your device's system calendar from that calendar.

# 10. Security and international processing

We use authentication, account ownership checks and transport encryption in published HTTPS services. Technical limits protect the system from abuse. No system can guarantee absolute security.

Because of cloud services and AI recipients, data may be processed outside your country. In this text we do not claim unverified full anonymity, zero retention or certified compliance with any legal standard.

# 11. Your choices and requests

You can change your profile, delete the relevant records or your account, manage device permissions and withdraw your consent to AI. For access, correction, deletion and other data requests, write to us at support@medicard.ge. Secure verification of your identity may be needed to avoid giving access to someone else's data.

Declining AI is not grounds for a registration fee or a paid plan. In this release, access to all existing consumer features is free; an AI feature still requires the relevant consent. We do not sell data for advertising.

# 12. Medical information and changes to this policy

MEDICARD and MEDIVET do not replace the assessment of a doctor or a veterinarian. An AI answer may be wrong or incomplete. In an emergency, contact your local emergency services.

A new version of the policy is published in the app and on the website. A material change to AI sharing requires separate, renewed consent.


# 13. Women's space — posts and anonymity

Joining the women's space is voluntary. We process the public nickname you choose, the text of your posts, uploaded photos, comments, reactions, reports, blocks and notification read status. This information comes from your actions. Access is checked against the sex you specified in your account. Your health history and private cycle records are not published to the feed automatically.

The name, email and account identifier of the author of an anonymous post are not shown to other members. For safety, for managing your own records and for reviewing reports, the operator keeps the link between the post and the account. Anonymity does not mean your identity is hidden from the operator. Published material is available to other authorized members of the space, who can take screenshots of it. Do not publish your own or anyone else's identifying details, or someone else's photo without their permission.

EXIF and location metadata are removed from photos before publication. Posts and comments are published directly; moderators can review violations, hide records and restrict members. Content is not sent to AI providers for this purpose. For push notifications, Expo and the relevant device notification service receive the device token, a general activity text and a technical link to the post; the post text and the author's name are not included in the push.

You can delete your own posts and comments in the space; when an account is deleted, the community records linked to it are deleted too. A minimal moderation history is kept for safety and for accountability of decisions. Turning off push notifications, sending a report, and blocking and unblocking an author are possible from the space's relevant management buttons. Questions: support@medicard.ge.


# 14. MEDICOACH — sharing with a trainer

MEDICOACH is a voluntary feature. You can connect with a fitness trainer whose profile and certificates MEDICARD verifies. Trainers are independent professionals, not MEDICARD employees. A connection is created only by your action — with a trainer's code, by a request from search or by accepting a trainer's invitation — and until then the trainer cannot see your data.

Once connected, the trainer always sees your name, profile photo, age, sex, height and your shared session schedule. The other categories are off by default and are visible to the trainer only if you switch them on yourself: workouts and activity (steps, active minutes, heart rate, sleep and workouts, including those read from Apple Health or Health Connect), nutrition (diary, calories, macros, plan adherence), weight and goal, and progress photos. You switch on reading workouts from Apple Health / Health Connect separately, only with your own button.

You can change a shared category or end the connection at any time from "My trainer". A category you switch off disappears for the trainer at once, including its history; when the connection ends, access is cut off completely and future sessions are cancelled. The trainer cannot see medical records, lab tests, medications, your cycle or your conversations with Medi. Health data is not used for advertising and is not sold.

Workout notes and meal plans written by the trainer, your short message to the trainer, progress photos, your profile photo and your personal QR code are stored with your account. EXIF and location metadata are removed from photos. When a QR code is scanned, the camera image does not leave the phone — only the text of the code is used. For a trainer application, we process the certificate photo, the gyms where the trainer works, experience and the contact link you provide; only an administrator sees this, for verification, and a verified profile appears in trainer search.

Reporting a trainer or a client for a violation, and blocking, are possible from the relevant screen; reports are reviewed by an administrator. When an account is deleted, connections, photos, certificates and session records are deleted; the trainer keeps only an anonymous record of a completed session, without your name or notes.

## Meal plan and diet

The meal plan stores the age, height, weight and activity data you confirm, your food preferences, allergens and your answers to the suitability questions, in order to set a starting target or to suggest that you discuss it with a specialist. The history of daily targets and planned meals is stored; a meal is marked as eaten only by your action. This data is not published. When you talk about nutrition with Medi, and only with valid consent to AI sharing, your daily totals, progress over the last 7 days, weight goal, diet and food preferences are passed to the relevant AI recipients; protected cycle details are not passed. Creating a plan does not in itself use AI. You can change or pause the plan on the nutrition page; when your account is deleted, this personal data is deleted as well.

# 15. Website cookies, Google Analytics and the Meta Pixel

On the public pages of medicard.ge — not in the app, not in the signed-in web version at /app and not on the health calculator pages — we use the Meta Pixel of Meta Platforms, Inc. and its affiliates, and only after you tap "Accept" in the cookie banner. It then sets Meta cookies (_fbp) and sends Meta the address of the page you opened, the time, technical data about your browser and device, your IP address and whether you tapped an App Store button, so that we can measure our ads on Facebook and Instagram and show them to people who visited the site. Health data, data from the app, names, emails and phone numbers are never sent; automatic collection of buttons and forms is turned off. Meta processes this data under its own policy (facebook.com/privacy/policy), possibly outside Georgia.

With the same consent and on the same pages we turn on Google Analytics 4 of Google LLC, so that we can see how many people visit the site, which pages they open and where they come from. It sets Google Analytics cookies (_ga, _ga_*) and sends Google the address of the page you opened, the previous page (referrer), the time, technical data about your browser and device, an approximate location derived from your IP address (city level; Google Analytics 4 does not store IP addresses) and whether you tapped an App Store or Google Play button. Google Signals and ad personalisation are turned off; health data, data from the app, names, emails and phone numbers are not sent. Google processes this data under its own policy (policies.google.com/privacy), possibly outside Georgia.

Without consent nothing is loaded from Meta. The Google Analytics tag is on the page before consent too, in Consent Mode: it sets no cookies and sends Google only an anonymous, cookieless signal (page address, time, browser type, country/city derived from the IP address) that cannot recognise you on later visits. A browser that sends Global Privacy Control is treated as a refusal. Your choice is kept in your browser for 12 months. You can change it at any time with the "Cookies" link at the bottom of the site; after you withdraw, the Pixel and Google Analytics stop and their cookies are deleted.
