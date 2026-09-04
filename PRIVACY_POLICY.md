# Privacy Policy — Mya

**Last updated: 4 September 2026**

Mya is a personal health companion for people living with ME/CFS. This policy explains what data we collect, why we collect it, how it is stored, and your rights over it.

---

## 1. Who we are

Mya is operated by Joseph Brockbank ("we", "us"). If you have any questions about this policy, contact us at joseph.brockbank@gmail.com.

---

## 2. What data we collect and why

### 2a. Account data
- **Email address** — used to create and authenticate your account.
- **Name / preferred name** — optional, used to personalise the app.

We collect this when you sign up with email/password, Apple Sign In, or Google Sign In.

### 2b. Health profile data
You provide this voluntarily during onboarding and can update it at any time:
- Age range, biological sex
- Diagnosis criteria used (e.g. Canadian Consensus Criteria, IOM/SEID) and years since diagnosis
- Baseline functional score (Bell's CFS Disability Scale)
- Typical post-exertional malaise onset delay and duration
- Mobility status (e.g. use of mobility aids, wheelchair, housebound, bedbound)
- Primary symptoms and comorbidities (e.g. POTS, MCAS, fibromyalgia, EDS, IBS, migraine, anxiety/depression, mould illness)
- Current medications, lifestyle challenges

This data is used solely to personalise your experience and generate relevant AI insights.

### 2c. Daily tracking data
Logged by you each day:
- Functional score (Bell's scale), brain fog score, pain score
- Whether you woke rested
- Medication adherence (taken / partial / not taken, and time of day)
- Free-text notes

### 2d. Exertion logs
Physical, cognitive, emotional, or social exertion events you log, with intensity, duration, and notes.

### 2e. Energy envelope
Your daily energy budget and the energy spend calculated from your logged exertion.

### 2f. Crash (PEM) logs
Start date, end date, severity, symptoms present (e.g. fatigue, PEM, brain fog, pain, orthostatic intolerance, sensory sensitivity), and notes for any crash you record, along with a link back to the exertion event that likely triggered it, when you provide one.

### 2g. DSQ-SF assessment responses
Your answers to the DePaul Symptom Questionnaire — Short Form (DSQ-SF), a validated ME/CFS research instrument developed by Leonard A. Jason, PhD, DePaul University. Used to track your symptom profile over time and to generate relevant AI insights.

### 2h. Weather data
Local temperature, "feels like" temperature, UV index, and air quality index, fetched automatically once a day and stored alongside your logs so it can be correlated against crashes over time. Your location for this is approximate only, derived from your device's IP address via a third-party geolocation lookup (see Section 5), never from GPS or your device's precise location.

### 2i. Apple Health and Android Health Connect data (optional)
If you connect Apple Health (iOS) or Health Connect (Android), we read, and only read, the following:
- Step count
- Sleep duration and sleep stages (Core, Deep, REM)
- Resting heart rate
- Heart rate variability (HRV)
- Active calories burned
- Workouts / exercise sessions (count per day)
- Blood oxygen saturation (SpO2)
- Respiratory rate
- Mindfulness minutes

We **never write anything to Apple Health or Health Connect**. We do not access any other health categories (e.g. weight, blood glucose, reproductive health) even if they exist in your Health app. Orthostatic/POTS-specific heart rate monitoring is not yet collected by Mya.

Health data is read on your device and stored in our secure database linked to your account. It is used solely to surface patterns relevant to your ME/CFS symptoms.

### 2j. Notification preferences
The time you set for your daily log reminder. No notification content is stored on our servers.

---

## 3. How we use your data

We use your data for the following purposes only:

| Purpose | Data used |
|---|---|
| Displaying your tracking history and trends | All tracking data you enter |
| Generating personalised AI insights and chat responses | Health profile + tracking data + health app data + weather data |
| Sending your daily log reminder notification | Notification time preference |
| Processing subscription payments | Handled by RevenueCat (see below) — we do not see your card details |
| Deleting your account when requested | All data is deleted |

**We do not sell your data. We do not use your data for advertising. We do not share your data with third parties except as described in Section 5.**

---

## 4. AI processing

Mya uses Claude, an AI model made by Anthropic, to generate personalised insights, a welcome message during onboarding, and responses in the AI chat.

When you trigger an AI feature, relevant portions of your health profile and recent tracking data are sent to Anthropic's API via our secure server-side proxy. This data is used only to generate your response and is not used to train Anthropic's models (we use the API under Anthropic's standard terms, which prohibit training on customer data).

Your data is sent over an encrypted connection (TLS) and is not stored by Anthropic beyond the duration of the API call.

---

## 5. Third-party services

| Service | Purpose | Data shared | Their privacy policy |
|---|---|---|---|
| Supabase | Database and authentication | All account and tracking data (encrypted at rest) | supabase.com/privacy |
| Anthropic | AI insights and chat | Health profile excerpt + recent tracking data | anthropic.com/privacy |
| RevenueCat | Subscription management | User ID, subscription status | revenuecat.com/privacy |
| Apple HealthKit / Android Health Connect | Health data reading | None, data flows from Apple Health or Health Connect to us, not the other way | apple.com/privacy, developer.android.com/privacy |
| Open-Meteo | Weather and air quality data | Approximate location (derived from your IP address) | open-meteo.com |
| ipapi.co / ipwho.is | Approximate location lookup (for weather) | Your IP address | ipapi.co/privacy, ipwho.is |
| Firebase | Product analytics (which features are used) | Anonymised usage events; no health or symptom data | firebase.google.com/support/privacy |
| Sentry | Crash and error reporting | Technical error details; no health or symptom data | sentry.io/privacy |

---

## 6. Data storage and security

- All data is stored in a Supabase database hosted in the EU West (Ireland) region.
- Data is encrypted at rest and in transit.
- Row-level security policies ensure each user can only read and write their own data — no user can access another user's records.
- Your authentication session is stored securely in your device's encrypted secure storage (not in plain AsyncStorage).

---

## 7. Data retention

We retain your data for as long as your account is active. If you delete your account (via Profile → Delete Account), all data associated with your account, including your profile, all logs, exertion events, crashes, health app data, weather data, assessment responses, and AI context, is permanently deleted from our database within 24 hours. This is irreversible.

---

## 8. Your rights

Under GDPR and applicable data protection law, you have the right to:

- **Access** — request a copy of the data we hold about you
- **Rectification** — correct inaccurate data (you can do this directly in the app)
- **Erasure** — delete your account and all associated data (available in the app under Profile → Delete Account)
- **Portability** — request your data in a machine-readable format
- **Restriction** — ask us to restrict processing of your data
- **Objection** — object to certain types of processing

To exercise any of these rights, contact us at joseph.brockbank@gmail.com. We will respond within 30 days.

---

## 9. Children

Mya is not directed at children under 13 and we do not knowingly collect data from children under 13. If you believe a child under 13 has provided us with personal data, please contact us and we will delete it.

---

## 10. Changes to this policy

We may update this policy as the app evolves. If we make material changes, we will notify you within the app. The "Last updated" date at the top reflects the current version.

---

## 11. Contact

Joseph Brockbank
joseph.brockbank@gmail.com
