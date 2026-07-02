# GitHub Pages deployment

This repository now includes a browser-only app in `docs/`.

The browser app is intended for GitHub Pages:

- Code is served from GitHub.
- Data is read from and written to Google Sheets.
- Patient folders are created in Google Drive.
- There is no local server in the production path.

## Required Google setting

Create a Google OAuth client for a web application and add the final GitHub Pages URL as an authorized JavaScript origin.

Then open the app, go to `הגדרות`, and fill:

- `Google Client ID`
- `Google Sheets ID`
- `תיקיית Drive ראשית`

The current non-secret defaults are in `docs/config.js`.

## GitHub setting

In the repository settings, set Pages to deploy from a branch:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`
