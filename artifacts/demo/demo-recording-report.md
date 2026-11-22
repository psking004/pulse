# PULSE demo: recording report

## Current status
- **No new demonstration video exists.** The next recording should happen only after the AI reminder is deployed and the forecast simulation is re-verified.
- **artifacts/demo/pulse-product-demo.mp4 is superseded.** It is the earlier two-segment recording (about 1:52, 1920x1080, H.264) that was judged to look robotic. Do not publish it. It is git-ignored (artifacts/demo/*.mp4).
- **artifacts/demo/pulse-demo-thumbnail.png was extracted from that superseded video** (frame at 3 s). It has not been visually reviewed in this session and is not a clean thumbnail for a new demo. It is not part of the Git checkpoint.
- Raw captures are in artifacts/demo/raw/, which is git-ignored.

## Forecast 15-day delay simulation: fixed and verified in the UI
- **Bug:** the "With 15-day delay" column and the Change column read the base forecast, not the simulated one, so the delayed lowest balance always equalled the base.
- **Fix:** src/lib/forecast.ts now returns simulated_horizon30 and simulated_horizon90 alongside the base horizons. src/features/forecast/ForecastPage.tsx reads those fields for the delayed column (falling back to base when no simulation is selected).
- **Verified in the running app (demo account, read-only, after the fix):** artifacts/demo/raw/audit-forecast-delay-after-cleanup.txt and audit-forecast-delay-90-after-cleanup.txt.
  - Selected invoice INV-0002 (Bluebird Clinics LLP, balance 23,926.00, due 26 Nov 2026).
  - Projected in 30 days: base 3,45,226.00, with delay 3,45,226.00, change 0.00.
  - Projected in 90 days: base 3,45,226.00, with delay 3,45,226.00, change 0.00.
  - Lowest balance (90 days): base 3,45,226.00, with delay 3,21,300.00, change -23,926.00.
  - New expected date: 11 Dec 2026.
  - The baseline forecast is unchanged, and nothing is saved.
- **Known gap, not fixed:** when a delay is selected, the "Expected cash movements" table still lists the base date (26 Nov). The delayed date appears only in the summary line and the comparison table.
- Build: the user ran npm run build and reported it passed. It was not re-run in this session.

## Dashboard audit against the demo records (read-only)
Checked by hand against the records, using the post-cleanup dump artifacts/demo/raw/audit-dashboard-after-cleanup.txt.

| Figure | Shown | Hand calculation from records |
|---|---|---|
| Outstanding receivables | 23,926.00 | INV-0002: total 53,926.00 less 30,000.00 paid |
| Overdue receivables | 0.00 ("None overdue") | INV-0002 due 26 Nov 2026, not yet due |
| Collected this month | 1,00,800.00 | 30,000.00 + 70,800.00 |
| Unpaid bills | 25,000.00 (1 bill, 0 overdue) | Brigade Towers Property, single bill |
| Due in 30 days | 25,000.00 | Same bill, due 27 Nov 2026 |
| Starting cash | 2,50,000.00 (as of 23 Oct 2026) | Profile setting |
| Current cash | 3,46,300.00 | 2,50,000.00 + 1,00,800.00 - 4,500.00 (one paid expense) |
| Projected in 30 days | 3,45,226.00 | 3,46,300.00 + 23,926.00 - 25,000.00 |
| Alert | "1 bill due within 7 days" | Bill due 27 Nov, today 22 Nov |

Invoice totals used above: INV-0002 (Karnataka to Karnataka, so CGST and SGST) has taxable value 45,700.00, GST 8,226.00 (CGST 4,113.00, SGST 4,113.00), total 53,926.00. INV-0001 (Maharashtra customer, so IGST) totals 70,800.00 and is Paid. INV-0003 is a draft (11,800.00) and is correctly excluded from receivables.

**Discrepancies found in the figures above: none.** Earlier readings of 1,25,000 and 50,000 for the bill came from duplicate records created by overlapping recording runs. The duplicates were removed through the Delete button, so the bill now shows 25,000.00.

## AI payment reminder: not working, not deployed
- The repository contains the function source at supabase/functions/generate-payment-reminder/index.ts (confirmed present).
- There is **no supabase/config.toml** in the repository, so the project has not been initialised or linked locally.
- The last UI attempt showed: "Reminder generation is not available. Check that the Edge Function is deployed." That message is generic: it is shown for any error from the function, not only for a missing deployment.
- Correction: earlier reports said the endpoint returned 404 NOT_FOUND and that the Supabase CLI was not installed. Those statements came from a probe whose output was not confirmed in this session. Treat them as unverified. The CLI installation has not been checked.
- Verified in this session: the function file exists, there is no config.toml, and the UI failure above.
- Not verified: CLI presence, login status, project link, deployed state, whether the Gemini key is set, and whether a reminder can be generated.
- Required from the user (do not paste keys into chat):
  1. Rotate the Google API key that was printed in a process command line during an earlier session. Do not reuse it.
  2. Install the Supabase CLI and run `supabase login`.
  3. From C:\pulse, run `supabase link --project-ref itmrklkcqtokkexcrqfy`. This creates supabase/config.toml, which is local and should not be committed.
  4. Run `supabase secrets set GEMINI_API_KEY=<new key>` with the new key.
  5. Run `supabase functions deploy generate-payment-reminder`.
  6. Generate a reminder on an unpaid sent invoice through the UI and record the result.

## Security notes
- The Google API key printed earlier must be treated as exposed and rotated.
- The demo email appears in the header account menu and in the Settings account card. Blur it before any publishing.
- Supabase publishable key values were printed in session output. The publishable key is designed to be public, but keep it out of recordings and reports.

## Git
- Included in the checkpoint: src/lib/forecast.ts, src/features/forecast/ForecastPage.tsx, .gitignore (ignores artifacts/demo/*.mp4, *.webm and artifacts/demo/raw/), and this report.
- Excluded: the MP4, the thumbnail and all raw captures.
- The MP4 should not be committed to normal history. If a video is later published, use Git LFS or a release asset.
