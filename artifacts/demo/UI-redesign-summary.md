# PULSE UI redesign — summary

## Commit
`f5da933` on `main`: "Redesign PULSE UI: new SVG logo and favicon, refined teal design tokens, sidebar navigation groups, and polished dashboard, invoice, payment, customer, expense, forecast and settings screens".

## Brand
- Teal primary colour (`#0f766e`) kept as the core colour.
- New mark: `public/pulse-mark.svg` (also used as `public/pulse.svg`, the favicon). A teal rounded tile with a white vertical stem and three rising bars, reading as a cashflow chart. No heart, waveform, sparkles or gradients.
- React component: `src/components/brand/PulseLogo.tsx` (variants `full` and `mark`).
- `index.html` sets the SVG favicon and a theme colour.

## Design system
- Colour tokens in `src/styles/index.css`: warning and success tokens added; text, border and muted colours tuned for contrast.
- Reduced-motion rule added; transitions limited to colour changes.
- Shared components updated: `PageHeader`, `EmptyState`, `Card`, `Badge` (new success, warning and destructive variants).

## Layout
- Sidebar grouped into Overview, Billing, Records and Account. All routes and labels unchanged.
- Header and app shell spacing tightened; auth pages use the new brand block.

## Screens
- Dashboard: key figures strip, cash position with ACTUAL and ESTIMATE labels, alerts, receivables table, two charts.
- Invoices: status summary, improved toolbar, status badges, clearer create/edit form with a totals panel, detail page with action grouping, redesigned printable preview.
- Payments, customers, expenses and bills, forecast, settings: summary cards, grouped form sections, clearer status indicators.

## Verification
- `npm run build` passed (exit 0) after the redesign, with no TypeScript errors. The bundle exceeds 500 kB, which Vite reports as a warning only.
- No sparkle or emoji icons and no secret values found in `src`, `public` or `index.html` (text search).
- **Not verified:** visual appearance in a browser, responsive behaviour at 390 px, 768 px and 1440 px, and the signed-in screens. The screens have not been viewed or clicked through.
