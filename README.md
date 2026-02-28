# Bevy Attendee Importer

CLI to import attendees from CSV or Google Sheet into Bevy via Playwright.

## Prerequisites
- Node.js 18+
- Playwright browsers installed (done on first install)

## Setup

1. **Clone the repo** (if you haven’t already).

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `BEVY_EMAIL` – your Bevy login email  
   - `BEVY_PASSWORD` – your Bevy password  
   - `BEVY_EVENT_URL` – (optional) default event attendees URL  
   - `GOOGLE_SHEET_URL` – (optional) if using Google Sheets  

3. **Install dependencies:**
   ```bash
   npm install
   ```
   This will also install Playwright browsers on first run if needed.

## Usage
Build and run:

```bash
npm run build
node dist/index.js --event "https://bevy.com/...event.../attendees" --csv attendees.csv
```

Or with Google Sheet:

```bash
node dist/index.js --event "https://bevy.com/...event.../attendees" --sheet "https://docs.google.com/spreadsheets/d/.../edit#gid=0"
```

Dev mode:

```bash
npm run dev -- --event "<event url>" --csv attendees.csv
```

Options:
- `--event` Bevy event URL (required if not set in `.env`)
- `--csv` Path to CSV (with headers: First Name, Last Name, Email, Checked In)
- `--sheet` Google Sheet URL (public or accessible)
- `--headless` true/false
- `--slow` SlowMo ms
- `--auth` Path to auth state JSON (default `.auth/bevy-auth.json`)

## Notes
- First run may require logging in to Bevy manually. The script will reuse the saved session state on subsequent runs.
- Update selectors in `src/runner.ts:addAttendee` to match Bevy's DOM. 