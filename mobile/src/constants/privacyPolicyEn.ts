import type { LegalSection } from './privacyPolicyKa';

/**
 * Medicard.GE — Privacy Policy (English translation of PRIVACY_POLICY_KA).
 * The Georgian text is the legal record; keep sections and numbering in step with privacyPolicyKa.ts.
 */
export const PRIVACY_POLICY_EN: { title: string; effectiveDate: string; intro: string; highlight: string; sections: LegalSection[] } = {
  "title": "Privacy Policy",
  "effectiveDate": "September 28, 2026",
  "intro": "This is an English translation. If it differs from the Georgian version, the Georgian version applies.\n\nThis policy explains how account, health and activity information is processed in MEDICARD. How much data is processed depends on the features you use and the permissions you grant. Reading this policy does not mean you agree to sharing with AI — the app offers you a separate choice for that.",
  "highlight": "MEDICARD does not sell your health data. Full policy: medicard.ge/privacy.",
  "sections": [
    {
      "title": "English summary (App Review)",
      "intro": "MEDICARD is a free consumer health app. There are no paid digital subscriptions, unlocks or in-app purchases for app features. Before any personal data is sent to a third-party AI service, the app asks on a dedicated AI & Privacy screen. That screen names what may be sent and who receives it: OpenRouter, Inc.; Google Cloud Vertex AI; Novita AI; Microsoft Azure, including Azure Speech; and EvidenceMD Inc. The user must tap Allow AI Processing. Not Now, closing, registration, or accepting this policy does not authorize AI sharing. The choice is stored on the account. It is not asked again on later AI requests unless the user withdraws it in Profile → Privacy & Data, or the consent version changes. MEDI COACH (optional): a user may connect to an admin-verified fitness trainer. The trainer always sees the user's name, photo, age, sex, height and their shared session schedule; activity and workouts (including data read from Apple Health / Health Connect), nutrition, weight and progress photos are shared only if the user switches each category on, can be changed or stopped at any time, and stop the moment the connection ends. Health data is never used for advertising or sold. The full policy follows below."
    },
    {
      "title": "1. Operator and contact",
      "intro": "MEDICARD is run by George Shengelia (გიორგი შენგელია), an individual who is responsible for the processing of personal data described in this policy. “MEDICARD” is a product name and does not indicate a registered company.",
      "bullets": [
        "Country and city of operation: Tbilisi, Georgia",
        "Contact email: support@medicard.ge",
        "Website: https://medicard.ge"
      ]
    },
    {
      "title": "2. Your account and the records you add in the app",
      "intro": "To register and sign you in, we process your email, name, account identifier and, where relevant, your phone number. Your password is stored on the server in hashed form. If you sign in with Apple or Google, Apple / Google send us a permanent account identifier, your email (with Apple, possibly a private relay address) and, if you share it, your name; no health data is sent to them. When an account created with Apple is deleted, we also revoke the access Apple granted. You can add your date of birth, sex and a photo to your profile.",
      "paragraphs": [
        "The data you enter in the health features may include symptoms, conditions, allergies, medications, family history, goals, lab results, images, visits, cycle records and health metrics. This information may be special category personal data concerning health.",
        "In your cycle records you can choose to log sexual activity and sex drive. These fields are stored in the most sensitive category: they are not passed to AI recipients, a trainer, the women's space, analytics or notifications, and only you can see them. You can delete such a record at any time.",
        "Account records are stored on the server for syncing and history; some are also stored on your device. If you decline AI, you can still use your account and the features that do not need external AI processing."
      ]
    },
    {
      "title": "3. Device permissions",
      "intro": "Camera and photo access is used to add a document, image or pet photo that you choose. The microphone is used in the matching voice feature. Granting a permission is not, by itself, consent to send anything to an external AI.",
      "paragraphs": [
        "Access to Apple Health / HealthKit and Android Health Connect data is controlled by separate system permissions. The relevant metrics are used on the activity and health screens; the relevant metrics stored in your account may become part of your health profile context only after you give separate consent to AI.",
        "Notification permission is used for reminders. A calendar entry is added only through an action you choose. You can change permissions in your phone's settings. Notifications are not guaranteed to arrive in every background state."
      ]
    },
    {
      "title": "4. City, weather and MEDIRUN",
      "intro": "When your city is determined, we process GPS coordinates, accuracy and the time of the fix. Device geocoding is used to get the city and country; when needed, coordinates are sent to OpenStreetMap's Nominatim service. To get the weather, coordinates are sent to Open-Meteo.",
      "paragraphs": [
        "During an active MEDIRUN session we process the route you cover, distance, time, speed and game progress. Mapbox is used to display the map. The game route and the home city in your profile are stored for different purposes; walking does not change your profile city automatically. This version does not continuously collect GPS in the background."
      ]
    },
    {
      "title": "5. Data that may be shared with AI, and why",
      "intro": "AI is used to prepare answers to your requests, explain health information, assess symptoms and give care tips. Before anything is sent, the app shows the categories, the recipients and a choice to agree or decline.",
      "paragraphs": [
        "In the symptom checker, adding your health profile is a separate choice. Your own health profile is not included in Medi Vet requests. Your name is not automatically added for AI from your account context, but a name you type or one that appears in a document may be part of the request itself. Before uploading, you can cover identifying details that are not needed."
      ],
      "bullets": [
        "your message, the relevant conversation history and the symptoms you describe;",
        "age and sex; in the relevant feature, your health profile, conditions, allergies, medications, family history, goals and latest metrics;",
        "images or documents you choose for analysis, or text extracted from them;",
        "the relevant cycle context for AI cycle tips;",
        "for Medi Vet, the pet's profile, care information and the conversation;",
        "for voice Medi, audio recorded with the button — sent through OpenRouter to Google Vertex AI to be turned into text; for spoken answers, the answer text — sent to Microsoft Azure Speech to be read aloud in real time."
      ]
    },
    {
      "title": "6. Recipients of AI data",
      "paragraphs": [
        "Not every request is sent to every recipient at once. The recipient used depends on the selected model and feature; if a request fails, it may be retried with one of the listed alternative recipients.",
        "OpenRouter requests specify particular hosts, automatic fallback to other hosts is turned off, and data_collection=deny and the ZDR filter are requested. This is our sending configuration and is not a claim that no record of any kind is ever stored in the MEDICARD account or with every provider. A provider's processing terms and international transfers are subject to its applicable agreement and the rules in force.",
        "For every third party, MEDICARD's data protection requirement is protection equal to or higher than that described in this policy and in Apple's rules: processing only for the agreed purpose, confidentiality, encrypted transfer, restricted access and cooperation on deletion requests. Before adding a recipient, we check its public terms and its relevant data processing terms. Sharing with a recipient that does not meet these requirements is not allowed. This requirement is not a claim that any provider is certified or that data is fully anonymous.",
        "Voice recordings are not kept in MEDICARD's permanent storage. Temporary audio on the device is deleted when processing or playback ends. According to Microsoft's public terms, the real-time text-to-speech API does not store the input text or the output audio; this does not apply to other kinds of voice products. OpenRouter's ZDR filter does not apply directly to Azure Speech or EvidenceMD."
      ],
      "bullets": [
        "OpenRouter, Inc. — routes the request to the selected model host; policy: https://openrouter.ai/privacy",
        "Google — Google Cloud Vertex AI — processes Gemini answers; policy: https://cloud.google.com/terms/cloud-privacy-notice",
        "Novita AI — processes Ling model answers; policy: https://novita.ai/legal/privacy-policy",
        "Microsoft — Azure — supporting AI requests and Azure Speech real-time text-to-speech; policy: https://privacy.microsoft.com/privacystatement",
        "EvidenceMD Inc. — selected clinical AI, or a fallback answer when another model fails; not used in Medi Vet; policy: https://evidencemd.ai/privacy-policy"
      ]
    },
    {
      "title": "7. Consent, declining and withdrawal",
      "intro": "Registering and reading the privacy policy do not mean you consent to sharing with AI. On a new account, this choice is on its own screen — “AI & Privacy” — after the notification permission and before any AI request. The screen shows the data categories, the recipient companies and links to their policies. Consent is not pre-selected. “Allow AI Processing” means consent. “Not Now” or closing the screen sends no request. After you consent, the same screen does not appear again with every message.",
      "paragraphs": [
        "Your choice is stored on the server together with your account and the consent version. A material change to the recipients, categories or purposes requires new consent. This also applies to users who have already registered: an earlier choice does not carry over to a new version automatically.",
        "Manage it in: Profile → Privacy & Data. Withdrawing stops further sending, including further automatic retries. Your account and the features that do not use AI remain. It does not recall a request that has already been sent or automatically delete data held by an external recipient. For a request like that, contact us."
      ]
    },
    {
      "title": "8. Infrastructure and other services",
      "intro": "The app's server and database are used to store and sync account records; the project uses Render and Neon PostgreSQL. Depending on the configuration in use, files are stored in server storage or in object storage. Whether a pet photo or other file is available depends on the storage in use.",
      "paragraphs": [
        "When needed, notifications are processed through Expo Push and Apple/Google systems, SMS through SMSOffice.ge, and email through the relevant mail service, including Resend. These recipients receive the address/token and the message needed for that service. Your full chat health history is not sent automatically for this purpose.",
        "Authorized administrators may process information needed for account, support and technical checks. AI requests and answers stored in the app may be accessible within these permissions. No additional external AI review of medical texts stored in the app takes place automatically.",
        "Support emails. The text, sender address and subject of an email sent to support@medicard.ge are processed by our automated assistant, which uses an Anthropic PBC model through OpenRouter, Inc. — to categorize the email and to prepare or send a reply. Requests specify data_collection=deny. The assistant replies on its own only to general questions about the app; emails about accounts, data requests, medical, financial and partnership matters are reviewed by a person. Health data stored in the app is not used in this processing. If you want only a person to answer your email, say so in the email.",
        "Product analytics. To improve the app, we record product events: install, registration, onboarding steps, first action and return visits. We store the event name, small technical values (e.g. onboarding step, platform, app version), a hash of a random install identifier and, after sign-in, the account identifier. Health values and free text are not recorded in analytics. The data is not passed to third parties and is not used for advertising or for tracking across other apps.",
        "Error diagnostics. For app stability, when an error or crash happens in the app, a technical report is sent to our server: the error type and a shortened message, the place in the code, the screen route (without identifiers), platform, app version and, after sign-in, a hash of the account identifier. Before sending, emails, long numbers and tokens are removed from the text; health values and text you entered are not sent. Reports are kept for 30 days, are not passed to third parties and are not used for advertising or tracking."
      ]
    },
    {
      "title": "9. Retention and account deletion",
      "intro": "Account records and AI answers are kept for history and syncing until you delete them or your account. In this version there is no single automatic expiry promise for all records. Some local caches may change or be deleted sooner.",
      "paragraphs": [
        "You can delete your account from the profile settings in the app. This deletes the main records linked to the account, your health profile, conversations, pet data and AI consent records. Notification texts linked to the account are deleted or redacted; deletion of uploaded files is also processed in the relevant storage. Financial or security history that must be kept may remain within the relevant obligation.",
        "Step-by-step instructions, deletion without the app, and an exact list of what is deleted and what remains: https://medicard.ge/delete-account",
        "Deletion does not mean immediate automatic deletion of third-party backups or of data that has already been sent. For a request about such information, use the support email. You can also manage an entry you previously added to your device's system calendar from that calendar."
      ]
    },
    {
      "title": "10. Security and international processing",
      "intro": "We use authentication, account ownership checks and transport encryption in the published HTTPS services. Technical limits protect the system from abuse. No system can guarantee absolute security.",
      "paragraphs": [
        "Because of cloud services and AI recipients, data may be processed outside your country. In this text we do not claim unverified full anonymity, zero retention or certified compliance with any legal standard."
      ]
    },
    {
      "title": "11. Your choices and requests",
      "intro": "You can change your profile, delete the relevant records or your account, manage device permissions and withdraw your consent to AI. For access, correction, deletion and other data requests, write to us at support@medicard.ge. We may need to verify your identity securely to prevent access to someone else's data.",
      "paragraphs": [
        "Declining AI is not grounds for a registration fee or a paid plan. In this release, access to all existing consumer features is free; AI features still need the relevant consent. We do not sell data for advertising."
      ]
    },
    {
      "title": "12. Medical information and changes to this policy",
      "intro": "MEDICARD and Medi Vet do not replace an assessment by a doctor or a veterinarian. AI answers may be wrong or incomplete. In an emergency, contact your local emergency services.",
      "paragraphs": [
        "A new version of the policy is published in the app and on the website. A material change to AI sharing requires separate, renewed consent."
      ]
    },
    {
      "title": "13. Women's space — posts and anonymity",
      "intro": "Joining the women's space is voluntary. We process the public nickname you choose, post text, uploaded photos, comments, reactions, reports, blocks and notification read status. This information comes from your actions. Access is checked against the sex you entered in your account. Your health history and private cycle records are not published to the feed automatically.",
      "paragraphs": [
        "The name, email and account identifier of the author of an anonymous post are not shown to other members. For safety, managing your own records and reviewing reports, the operator keeps the link between a post and an account. Anonymity does not mean your identity is hidden from the operator. Published material is available to the space's other authorized members, who can take screenshots of it. Do not publish identifying details about yourself or others, or another person's photo without their permission.",
        "EXIF and location metadata are removed from photos before publishing. Posts and comments are published directly; moderators can review violations, hide records and restrict members. Content is not sent to AI providers for this purpose. For push notifications, Expo and the relevant device notification service receive the device token, a general activity text and a technical link to the post; the post text and the author's name are not included in the push.",
        "You can delete your own posts and comments from the space; when you delete your account, the community records linked to it are deleted too. A minimal moderation history is kept for safety and accountability for decisions. You can turn off push notifications, send a report, and block or unblock an author using the space's management buttons. For questions: support@medicard.ge."
      ]
    },
    {
      "title": "14. MEDI COACH — sharing with a trainer",
      "intro": "MEDI COACH is an optional feature. You can connect with a fitness trainer whose profile and certificates MEDICARD checks. Trainers are independent professionals, not MEDICARD employees. A connection is made only through your action — with a trainer's code, by sending a request from search or by accepting a trainer's invitation — and until then the trainer cannot see your data.",
      "paragraphs": [
        "Once connected, the trainer always sees your name, profile photo, age, sex, height and your shared session schedule. The other categories are off by default and are visible to the trainer only if you switch them on yourself: workouts and activity (steps, active minutes, heart rate, sleep and workouts, including those read from Apple Health or Health Connect), nutrition (diary, calories, macros, plan adherence), weight and goal, and progress photos. Reading workouts from Apple Health / Health Connect is switched on separately, only with your own button.",
        "You can change the shared categories or end the connection at any time from “My trainer”. A category you switch off disappears for the trainer at once, including its history; when the connection ends, access stops completely and future sessions are cancelled. The trainer cannot see your medical records, lab results, medications, cycle or conversations with Medi. Health data is not used for advertising and is not sold.",
        "Workout notes and meal plans written by the trainer, your short message to the trainer, progress photos, your profile photo and your personal QR code are stored with your account. EXIF and location metadata are removed from photos. When a QR code is scanned, the camera image does not leave the phone — only the code's text is used. For a trainer application, we process the certificate photo, gyms, experience and the contact link you provide; only an administrator sees this, for verification, and a verified profile appears in trainer search.",
        "You can report a trainer or client for a violation and block them from the relevant screen; an administrator reviews the report. When you delete your account, connections, photos, certificates and session records are deleted; the trainer keeps only an anonymous record that a session took place, without your name or notes."
      ]
    },
    {
      "title": "Meal plan and diet",
      "intro": "The meal plan stores the age, height, weight and activity details you confirm, your food choices, allergens and your answers to the eligibility questions, so it can set a starting target or suggest talking to a specialist. The history of daily targets and planned meals is stored; a meal is marked as eaten only through your action. This data is not published. When you talk about nutrition with Medi, and only with valid consent to AI sharing, the relevant AI recipients receive your daily totals, progress over the last 7 days, weight goal, diet and food choices; protected cycle details are not shared. Creating a plan does not use AI by itself. You can change or pause the plan on the nutrition page; when you delete your account, this personal data is deleted too."
    }
  ]
};
