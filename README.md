# Advanced Expense Manager (SplitAdvanced)

A production-grade, highly-aesthetic, mobile-first group and personal expense-splitting application (Splitwise-style, but advanced) built with **Next.js (App Router)**, **React**, **Tailwind CSS**, and **Supabase**.

---

## 🚀 Stack & Features

- **Frontend/Framework**: Next.js (App Router), React, Tailwind CSS
- **Backend (Cloud)**: Supabase (Postgres, Auth, Storage, Realtime, Publications)
- **Backend (Offline/Sandbox)**: Guest Mode (Bypasses auth, reads/writes to `localStorage` with pre-populated interactive Goa Trip and Flatmate data)
- **Charts**: Spend analysis pie chart via Recharts
- **PDF Export**: jsPDF + autoTable (Smart Settle instructions, complete logs)
- **Recurring Bills**: Advanced recurring processor that auto-generates expense splits on-the-fly when due

---

## 📂 Project Structure

```
/app                    → Next.js App Router features & layouts
  ├── (auth)/           → Login & Signup screens
  ├── dashboard/        → Spending analysis, charts, filters, alerts
  ├── groups/           → Groups listing & dynamic group detail workspace
  ├── borrow/           → Group-independent bidirectional lend/borrow logs
  ├── personal/         → Private expense logger
  ├── documents/        → Standalone documents vault
  ├── layout.tsx        → Centered mobile layout container + Toast context wrapper
  └── globals.css       → Tailwind CSS v4 imports
/components             → Reusable UI components grouped by feature area
  ├── ui/               → Modal dialogs, Toast popups
  ├── layout/           → Bottom mobile nav, Top brand header (bell alerts)
  └── groups/           → Debt settle visualizer cards
/lib/supabase           → Supabase client & Domain-driven DB operations
  ├── client.ts         → Supabase init & Guest Mode detection helpers
  ├── groups.ts         → Group creation, listing, invitations, sandbox seed data
  ├── expenses.ts       → Group expense logs, settlements, and splits CRUD
  ├── splits.ts         → Individual splits marking
  ├── borrow.ts         → Bidirectional loan tracking
  ├── personalExpenses.ts → Private expense operations
  ├── recurring.ts      → Recurring bill configurations & auto-processing due items
  ├── notifications.ts  → In-app notifications CRUD & helpers
  └── storage.ts        → Storage bucket file uploads (MIME checked) & listings
/lib/utils              → Core helper utilities
  ├── simplifyDebts.ts  → Pure greedy debt simplification algorithm
  ├── pdfGenerator.ts   → jsPDF report assembler
  ├── format.ts         → Currency, dates, and category styling helpers
  └── sync.ts           → Online/offline browser connection status hook
/types                  → Type-safe database & application TS definitions
/supabase/migrations    → SQL migration scripts (table schemas + RLS + triggers)
```

---

## 🛠️ Local Setup (Supabase)

### 1. Initialize Supabase Local Environment
Ensure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed.
```bash
supabase init
```

### 2. Configure Database Schema
Apply the schema, row level security policies, triggers, and storage bucket settings in the migration file:
```bash
# Apply the versioned migration inside /supabase/migrations/
supabase db start
supabase db reset
```

The database schema includes automatic triggers on `auth.users` that instantiate user records inside `public.profiles` on first registration.

---

## 🔑 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Resend API Key (Used for Email notifications)
RESEND_API_KEY=re_your_api_key_here
```

*Note: If these variables are not present, the app will gracefully default to **Guest Sandbox Mode** on load, so you can explore the entire app client-side immediately without setting up accounts.*

---

## 💻 Running the App Locally

First, install dependencies:
```bash
npm install
```

Then, run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚡ Deployment to Vercel

1. Create a new project on **Vercel** and connect it to your Git repository.
2. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY`
3. Deploy the project. Vercel automatically configures the Next.js production build using App Router routes.

---

## 🤝 Smart Debt Simplification Algorithm

The settle-up calculations are implemented as a pure function:
$$\text{Net Balance} = \text{Total Paid} - \text{Total Owed}$$

- **Debtors** (negative net balances) and **Creditors** (positive net balances) are separated.
- The largest debtor is greedily matched with the largest creditor.
- A transaction is logged for $\text{min}(\text{debtor.balance}, \text{creditor.balance})$.
- The balances are adjusted, and pointers advance until all group debts are cleared.
- This resolves circular loops (e.g., A owes B, B owes C, C owes A) in the minimal number of payments.
