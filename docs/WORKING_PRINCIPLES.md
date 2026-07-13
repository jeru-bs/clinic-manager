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
- `src/` is a Next.js app surface and should not be treated as the live product unless a task explicitly moves work there.
- `scripts/serve-docs.mjs` serves the active app locally with `npm.cmd run demo`.

## SSOT

SSOT means single source of truth: one owner for each business fact, and every screen or workflow reads from and writes through that owner.

- Google Sheets is the persisted SSOT for business records: `patients`, `sessions`, `payments`, `tasks`, `files`, and `schedule_exceptions`.
- The `SHEETS` constant at the top of `docs/app.js` is the schema SSOT for those persisted tables.
- Google Drive is the persisted SSOT for patient folders, uploaded files, generated documents, templates, backups, and shared settings files.
- Google Calendar is the external SSOT for synced calendar events, but the app record keeps the linkage by storing `calendar_event_id`.
- Runtime state in `state` is only an in-memory projection. It must be refreshed or updated after persisted writes.
- Browser localStorage is only local configuration/cache. It is not the business-data SSOT.

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
- A schedule exception must be stored in `schedule_exceptions`; calendar projections should derive from it instead of copying exception truth elsewhere.
- Audit and undo should record the same persisted operation boundary, not a partial UI state.
- Any local repair should be idempotent: running it twice should not create duplicate rows, duplicate folders, or contradictory external state.

## Change Checklist

Before editing:

- Name the SSOT for the thing being changed.
- Find every workflow that can update that thing.
- Decide whether the bug is a root cause or a symptom.

Before finishing:

- Run the narrowest useful checks: usually `npm.cmd run check:static` and `npm.cmd run lint`.
- Verify secrets stay out of Git: `.env.local`, `.next/`, `node_modules/`, `work/`, and local build artifacts remain ignored.
- Commit only the files needed for the change.
