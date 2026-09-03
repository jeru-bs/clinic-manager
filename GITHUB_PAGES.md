# GitHub Pages deployment

This repository now includes a browser-only app in `docs/`.

The browser app is intended for GitHub Pages:

- Code is served from GitHub.
- Data is read from and written to Google Sheets.
- Patient folders are created in Google Drive.
- There is no local server in the production path.

## Required Google setting

Create a Google OAuth client for a web application and add the final GitHub Pages URL as an authorized JavaScript origin.

In the same Google Cloud project, enable Google Sheets API, Google Drive API, Google Calendar API, Google Docs API and Google Forms API. Existing users must disconnect and reconnect once after version 1.1.0 so Google can grant the Forms response-reading scope.

Then open the app, go to `הגדרות`, and fill:

- `Google Client ID`
- `Google Sheets ID`
- `תיקיית Drive ראשית`

The current non-secret defaults are in `docs/config.js`.

## Release verification

Before publishing, run from the repository root:

```powershell
npm.cmd run release:check
```

The production entry point is `docs/index.html`. The release must not include local secrets, access tokens, questionnaire responses, clinical reports, backup files, or patient data.

## GitHub setting

In the repository settings, set Pages to deploy from a branch:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`
