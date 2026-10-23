# DMS Student Council

An existing React, TypeScript, and Vite workspace for the DMS Student Council executive board. It uses Firebase Authentication and Cloud Firestore for approved-member sign-in and shared workspace data.

## Run locally in VS Code

Requirements: Node.js 20.19+ or 22.12+. The Firestore Emulator test also requires Java 21+ and downloads the emulator the first time it runs.

1. Copy `.env.example` to `.env.local` and fill in the Firebase web-app values (setup below).
2. In the integrated terminal, run:

   ```sh
   npm install
   npm run dev
   ```

3. Open the local URL printed by Vite. The app requires an HTTP development server; opening `index.html` through Live Server does not provide Vite's module/build behavior.

## Firebase setup (Spark plan)

The repository already initializes the Firebase SDK, but no Firebase web-app configuration values are present locally. The Firebase web app `dms-studentcouncil` is already registered, so use its existing settings rather than registering a duplicate app. Do not link a billing account or upgrade from the Spark plan.

1. In the Firebase Console, open the project containing `dms-studentcouncil` and keep it on the **Spark (no-cost)** plan.
2. In **Project settings → General → Your apps → dms-studentcouncil**, copy the web-app configuration's `apiKey`, `authDomain`, `projectId`, and `appId` into `.env.local`, using the names in `.env.example`. The app registration name is not necessarily the Firebase project ID. These Firebase web-app values are public client configuration, not service-account credentials. Never add service-account JSON, private keys, or admin SDK credentials to this frontend.
3. Open **Authentication → Sign-in method**, enable **Google**, and save. Under **Authentication → Settings → Authorized domains**, add `localhost` for local development and `dog-king3.github.io` for the Pages site.
4. Open **Firestore Database → Create database** and keep the project on Spark. Deploy the restrictive rules in `firestore.rules` from a terminal after signing in to the Firebase CLI:

   ```sh
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
   ```

   Replace `YOUR_FIREBASE_PROJECT_ID` with the real ID shown in Firebase Project settings; no project ID is configured or assumed in this repository. Do not use test mode or replace these rules with public read/write rules.
5. For the hosted build, open the GitHub repository's **Settings → Secrets and variables → Actions → Variables** and add these repository variables using the same four values from the Firebase Web app: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`.
6. In GitHub **Settings → Pages**, set the build/deployment source to **GitHub Actions**. Push to `main` (or run the workflow manually). The deployment job stays skipped until all four Firebase variables are set.

Google sign-in accepts only verified Firebase Google accounts whose email exactly matches the member roster. Firestore independently checks the verified email against the approved roster on every operation. All approved members can create, edit, approve, and comment on shared events. Comment authors can edit or delete only their own comments; message authors can edit or delete only their own chat messages. Students can delete only events they created; Erin Copple can delete any event. Recurrence is stored on the shared event record and expanded into stable date-based occurrences in each calendar view, so clients do not create duplicate event documents. Monthly recurrence supports same-date and weekday-pattern schedules, with an explicit last-day-or-skip choice for dates absent from shorter months. The canonical roster is readable and initialized in Firestore but cannot be changed through the client; no member can grant a permission or change an approved email through client data.

The member names, roles, and email addresses are included in the frontend and Firestore rules to support the public Pages client and exact-email authorization. Treat the deployed directory and repository contents as visible to anyone; do not add non-roster personal information or credentials.

The approved roster contains **14 entries (13 students plus Erin Copple)**. Sitaara's surname is **Jorden**, matching `sitjorden@dunlapstudents.net`.

## Shared data

Firestore collections are `events` (including event comments and approval status), `chatMessages`, `tasks`, `agendaItems`, and `members`. Realtime snapshots keep approved members' browsers in sync. Theme preference alone remains local to the browser.

## Checks

```sh
npm run lint
npm run build
npm run test:calendar
npm run test:roster
npm run test:rules
```

The recurrence tests verify daily, weekly, date-based and weekday-pattern monthly occurrences, missing-date behavior, exclusions, overrides, and stable occurrence IDs. The roster test verifies the approved members and alignment with the Firestore allowlist. The Firestore rules tests run against the local Firestore Emulator using a demo-only project ID and cover author-only message/comment edits and deletes as well as event-deletion permissions. Google provider sign-in and real multi-device behavior require the Firebase setup above and must be verified against the configured project.

After reviewing local changes and confirming the intended Firebase project, publish only the rules or only the frontend with:

```sh
firebase deploy --only firestore:rules --project dms-studentcouncil
firebase deploy --only hosting --project dms-studentcouncil
```
