# DMS Student Council

A responsive student-council workspace built with React, TypeScript, Vite, and Tailwind CSS.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Current prototype behavior

- Sign in by selecting one of the 14 roster members and entering the shared code `StudentCouncil2627`.
- The code check is intentionally performed in the browser for this prototype. This is only a convenience gate and is not authentication or a security boundary.
- The selected member is kept in `sessionStorage` for the current browser tab session. Sign out from the bottom of the sidebar to switch users.
- Events, event comments, chat messages, tasks, meeting agenda items, member email edits, and theme preference are saved to this browser's `localStorage`.
- Local data is not shared or synchronized with other members, browsers, or devices. Clearing browser storage removes that local data.
- Event proposal approvals are an interface prototype only; they are not reviewed or synchronized by a server.

There is no database or backend configured in the project. Do not use this prototype to store confidential information. For shared use, connect a database and server-side endpoints, replace the client-side shared-code check with server-validated sessions, and enforce authorization on every data request. Never use a client-side code check to protect private data.

## Checks

```sh
npm run lint
npm run build
```
