# PULSE

**Your business. Your cashflow. Your next move.**

PULSE is a lightweight financial management and cashflow intelligence app for solo entrepreneurs and small businesses with 1–5 people. It helps you manage invoices, payments, expenses and cashflow without needing complicated accounting software.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style components
- Lucide React (icons)
- Recharts (charts)
- Supabase (backend services)

## Getting started

### Prerequisites

- Node.js 20.19+ or 22+
- npm

### Setup

```bash
npm install
```

Copy the example environment file and fill in your Supabase project values:

```bash
copy .env.example .env.local
```

Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Use only the public URL and anon key from Supabase > Project Settings > API.

### Scripts

```bash
npm run dev       # start the Vite dev server (http://localhost:5173)
npm run build     # type-check and produce a production build in dist/
npm run preview   # serve the production build locally
```

## Project structure

```
src/
├── app/          # root component and routing
├── components/
│   ├── ui/       # shadcn/ui-style primitives (button, card, input, ...)
│   ├── shared/   # reusable components used across features
│   └── layout/   # app shell (sidebar, header, page frame)
├── features/     # one folder per product area (e.g. invoices, expenses, cashflow)
├── services/     # external services, e.g. the Supabase client
├── lib/          # small utilities and environment variable access
├── types/        # shared TypeScript types
└── styles/       # global CSS and theme tokens
```

Environment files (`.env`, `.env.local`, and any `.env.*` except `.env.example`) and credentials are excluded from Git and must never be committed.
