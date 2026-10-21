# Windows setup

## Use the included build

Install Node.js **24 LTS**, then close and reopen your terminal. Confirm:

```powershell
node --version
```

The version should begin with `v24.` (the release was checked with v24.19.0). Extract all files before starting. Do not run from inside the ZIP viewer.

Double-click `START-WINDOWS.cmd`. Wait for `Gleam is ready: http://localhost:4000`, then open that address. Both frontend and API are served by the same Node process. No package installation is required for this route.

To run from PowerShell:

```powershell
cd "G:\projects\gleam-car-wash"
node scripts/start.mjs
```

Your actual folder may differ. Paths containing spaces are supported. Keep the terminal open; Ctrl+C stops the server.

## Edit the source

Run `SETUP-WINDOWS.cmd` once. It uses `npm ci`, builds the app and runs the integration suite. Internet access is needed to download development dependencies the first time. Then run `DEV-WINDOWS.cmd` and visit http://localhost:4173.

Manual commands from Command Prompt:

```bat
npm ci
npm run dev
```

If PowerShell reports that `npm.ps1` cannot run, use `npm.cmd` or run the provided `.cmd` scripts. No execution-policy change is needed.

## Common issues

| Symptom                                            | Fix                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node` is not recognised                           | Install Node 24 LTS with PATH enabled, then reopen your terminal.                                                                                                        |
| `node:sqlite` cannot be found                      | An older Node is active. Run `where node` and `node --version`, then use Node 24.                                                                                        |
| SQLite experimental warning                        | Some Node 24 versions print a warning for the built-in SQLite API. This is not itself a startup error.                                                                   |
| Port 4000 is busy                                  | Stop the other Gleam terminal. Or copy `.env.example` to `.env` and change `PORT`, then use that port in the browser. Development mode intentionally reserves port 4000. |
| Page does not update after editing                 | The normal launcher serves `dist`. Rebuild with `npm run build`, or use development mode on port 4173.                                                                   |
| `vite` is not recognised / missing module          | Run `SETUP-WINDOWS.cmd` or `npm ci` inside this project.                                                                                                                 |
| npm timeout                                        | Check the network and retry `npm ci`. The included compiled build can still run without it.                                                                              |
| `EBADPLATFORM` / Rollup or Rolldown platform error | Do not copy another computer's `node_modules`. Keep this lockfile and run `npm ci` on Windows to install the correct platform packages.                                  |
| Cannot write database                              | Extract to a writable user/project folder, not Program Files or a read-only archive.                                                                                     |
| Location not available                             | Use the area picker or coordinates. Geolocation requires browser permission and a supported secure context.                                                              |
| OTP never reaches phone                            | Demo mode deliberately displays a local code and sends no SMS.                                                                                                           |
| No times today                                     | Choose a future day; elapsed times and times outside opening hours are disabled.                                                                                         |
| FIRST20 rejected                                   | It is only for an account's first non-cancelled booking. Use another eligible offer or remove the code.                                                                  |
| Admin revenue is zero                              | Revenue counts completed visits whose payment has been manually recorded as paid.                                                                                        |
| Login details no longer work                       | You may have changed the demo account password. Use that updated password; the database persists.                                                                        |

## Data and backups

The default database is `data/gleam.sqlite`. Stop the application before copying the complete `data` directory for a backup. SQLite may keep `-wal` and `-shm` files while open; copying only the main database during a write is not a consistent backup strategy.

To start a new local demo **while retaining the old one**, stop the server and rename `data` to `data-backup-YYYY-MM-DD`. The next start creates a fresh demo database. The release does not contain an automatic data-deletion script.

## Optional settings

Copy `.env.example` to `.env` and edit values. The application loads this file at startup. Never put secrets in frontend JavaScript, commit `.env` publicly or share a real database.

For an alternative local port, set both:

```dotenv
PORT=4100
APP_ORIGIN=http://localhost:4100
```

Open http://localhost:4100. Restart after configuration changes.
