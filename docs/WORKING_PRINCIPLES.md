# Working Principles

This file is the compact operating contract for future work on this project. Read it before non-trivial changes, then inspect only the files touched by the requested feature or bug.

## Token Budget

- Start from this file, `README.md`, and `docs/PRODUCT_NOTES.md`; do not rescan the whole project unless the change crosses module boundaries.
- Prefer targeted searches with `rg` over broad file reads.
- Summarize new architectural decisions here in 1-3 bullets instead of repeating them across chat, README, and code comments.
- Keep examples and investigation notes out of committed docs unless they become a reusable rule.

## Active Surface

- The active browser app is `docs/`.
- `docs/app.js` is currently the main UI, Google integration, storage, and workflow layer.
- There is no other app surface: the former Next.js `src/` implementation and its password scripts were removed.
- `scripts/serve-docs.mjs` serves the active app locally with `npm.cmd run demo`.
- `googleClientId` comes only from `docs/config.js`; localStorage, the shared Drive settings file and the Settings form may override only the keys in `WorkflowCore.OVERRIDABLE_CONFIG_KEYS`.
- The CSP allows no inline styles or remote images: generated markup must not carry `style=` attributes (set CSS custom properties through `element.style` after render), and URLs from the sheet or Drive reach an `href` only through `safeHref()`.
- JSON backups never include `audit_log`, and a restore never replaces the live audit log.
- The static browser app stores Google access tokens in `sessionStorage` only; remembered consent is used for automatic reconnection on later visits.
- An empty Google-account allowlist denies access. Authorized accounts must be configured explicitly.
- Static hosting cannot protect data with server-side sessions; Google resource permissions remain the hard security boundary until the active surface moves behind a private server.
- Every authorized data load audits the configured clinic Sheet and Drive folders plus any publicly shared file under them, removes `anyone` permissions before business data is displayed, and reports domain or non-allowlisted user shares as warnings in Settings.

## SSOT

SSOT means single source of truth: one owner for each business fact, and every screen or workflow reads from and writes through that owner.

- Google Sheets is the persisted SSOT for business records: `patients`, `contacts`, `sessions`, `payments`, `tasks`, `files`, and `schedule_exceptions`.
- The `SHEETS` constant at the top of `docs/app.js` is the schema SSOT for those persisted tables.
- Google Drive is the persisted SSOT for patient folders, uploaded files, generated documents, templates, backups, and shared settings files.
- Google Calendar is the external SSOT for synced calendar events, but the app record keeps the linkage by storing `calendar_event_id`.
- Runtime state in `state` is only an in-memory projection. It must be refreshed or updated after persisted writes.
- Browser localStorage is only local configuration/cache. It is not the business-data SSOT.
- The local sync queue stores only retry instructions for external side effects; it never replaces the Google Sheets business record.

## Root Cause First

Root Cause First means fix the structural cause before patching the visible symptom.

- If a screen fails, identify whether the cause is schema, storage, auth, state projection, UI rendering, or external API behavior before changing the UI.
- Do not duplicate update logic in a page just to make the current button work.
- If the same action can happen from more than one screen, create or use one workflow function and call it from both places.
- If a fix touches one stored table, check linked tables and external side effects before finishing.

## Consistency Rules

- A task update must go through one task workflow that also handles reminders, audit entries, undo snapshots, and derived UI state.
- A session update must handle the stored session, linked calendar event, linked document status, payment linkage, and recurring-calendar projections together.
- A patient update must preserve folder linkage and avoid creating a second folder unless that is an explicit migration.
- Parent and professional contacts belong to the `contacts` sheet and always reference one patient by `patient_id`.
- Calendar events must remain private and generic: no patient name, treatment notes, session type, or location may be sent to Google Calendar.
- File uploads use Google Drive resumable sessions and must expose progress and cancellation in the UI.
- A schedule exception must be stored in `schedule_exceptions`; calendar projections should derive from it instead of copying exception truth elsewhere.
- Israel holiday dates are derived from Hebcal and cached locally; only events marked `yomtov` block recurring projections, while private closures remain in `schedule_exceptions`.
- Audit and undo should record the same persisted operation boundary, not a partial UI state.
- Any local repair should be idempotent: running it twice should not create duplicate rows, duplicate folders, or contradictory external state.

## Change Checklist

Before editing:

- Name the SSOT for the thing being changed.
- Find every workflow that can update that thing.
- Decide whether the bug is a root cause or a symptom.

Before finishing:

- Run the narrowest useful checks: usually `npm.cmd run check:static` and `npm.cmd run lint`.
- Verify secrets stay out of Git: `node_modules/`, `work/`, backup files, and local build artifacts remain ignored.
- Commit only the files needed for the change.
