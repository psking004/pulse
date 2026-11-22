# PULSE

**Your business. Your cashflow. Your next move.**

PULSE is a lightweight financial management and cashflow intelligence platform designed for solo entrepreneurs and small businesses. It brings invoicing, GST calculations, payment tracking, expense management and cashflow forecasting into one simple workspace.

Instead of just recording transactions, PULSE helps business owners understand where their money is going, what payments are pending and how payment delays may affect their future cashflow.

## Why PULSE?

Small business owners often manage their finances across spreadsheets, billing applications and manual records. This makes it difficult to get a clear picture of their financial position or anticipate cashflow problems.

PULSE brings these essential financial workflows together in one place.

### Features

- **GST Invoicing:** Create and manage invoices with GST calculations, including CGST, SGST and IGST.
- **Customer Management:** Maintain customer details and manage customer records.
- **Payment Tracking:** Track received payments, outstanding balances and invoice payment status.
- **Expense Management:** Record business expenses and track unpaid bills.
- **Cashflow Forecasting:** Visualize expected income, expenses and projected cash balances.
- **Payment Delay Simulation:** Explore how delayed customer payments can affect projected cashflow.
- **AI Payment Reminders:** Generate personalized payment reminder drafts.
- **Financial Dashboard:** View key financial indicators in a centralized dashboard.

## What makes PULSE different?

PULSE isn't designed to be just another invoice generator.

It connects invoices, expenses, payments and projected cash movements to help small business owners understand their financial position. Its cashflow forecasting and payment delay simulation allow users to explore potential financial outcomes before they become problems.

The goal is to make financial visibility and everyday business decisions easier without requiring complex accounting software.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style components
- Lucide React
- Recharts
- Supabase
- Google Gemini API

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22+
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/psking004/pulse.git
cd pulse
```

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
copy .env.example .env.local
```

Configure the following environment variables in `.env.local` using your Supabase project credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use only the public Supabase URL and anon key. Never expose service-role keys or private credentials in frontend code.

### Running locally

Start the development server:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

### Production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Project Structure

```text
src/
├── app/          # Root component and routing
├── components/
│   ├── ui/       # Reusable UI primitives
│   ├── shared/   # Shared components
│   └── layout/   # Application layout
├── features/     # Product features
├── services/     # External services and integrations
├── lib/          # Utilities
├── types/        # Shared TypeScript types
└── styles/       # Global styles and theme
```

## Security

Environment files, including `.env`, `.env.local` and other private configuration files, are excluded from Git.

Never commit private credentials, service-role keys or secrets.

## Built for small businesses

PULSE aims to make financial management simpler, more understandable and more proactive for small businesses that don't have dedicated finance teams.

**Manage today. Understand tomorrow.**
