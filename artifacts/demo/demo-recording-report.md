# PULSE product demo — recording report

## Status
**The product demonstration video has NOT been produced.** A signed-in demo could not be recorded in this run. No video file exists under artifacts/demo/ other than a raw browser capture of a failed signup attempt (see "Raw capture" below), which is not a product demonstration.

## Demo account
- Creation through the real signup UI: **attempted, not completed.**
- Result: the Supabase project returned `email rate limit exceeded` on signup. No account was created.
- No account was created directly in the database, no demo data was seeded, and no authentication was bypassed or changed. Email confirmation settings were not touched.
- Next step: retry signup through `/signup` once the rate limit resets, using a fictional address and a password kept outside the repository. If email confirmation is enabled, the confirmation link must be opened by the account owner; this cannot be automated here.

## Recording method
- Tools: Playwright (`playwright-core`) driving the system Google Chrome, installed in a folder outside the repository (`C:\pulse-demo-tools`). Playwright's own ffmpeg build was installed to the user cache for video capture.
- ffmpeg was not available on PATH, so the MP4 conversion has not been performed. Playwright produces WebM natively.
- No screen-capture of the desktop was used; no screenshots were stitched together.

## Raw capture
- `artifacts/demo/raw/` holds a WebM recording (about 220 KB) of the signup attempt above, showing the rate-limit error. It is excluded from Git. It is evidence of a real browser run, not a product demo.

## What was tested in this run
| Check | Result |
|---|---|
| Git state before resuming | Clean working tree. Redesign commit `f5da933` already present on `main`. |
| Production build (after the redesign, earlier in the session) | Passed (exit 0). |
| Dev server serves `/login` | HTTP 200. |
| Real-browser signup attempt | Blocked by Supabase email rate limit. |
| Real-browser smoke test of redesigned public pages | **Not run** (agent limits reached in this run). |
| Authentication flow, customer, invoice, payment, expense, dashboard, forecast, 15-day simulation, settings, AI reminder in a browser | **Not tested in this run.** |

## Features that could not be demonstrated
Everything that requires a signed-in account: dashboard figures, invoices, payments, expenses and bills, forecast, 15-day simulation, settings, and AI reminders. The AI reminder also requires the Gemini secret and the Edge Function to be deployed; neither was verified here.

## Video location
None produced. Planned final path: `artifacts/demo/pulse-product-demo.mp4`. The thumbnail `pulse-demo-thumbnail.png` was not created.
