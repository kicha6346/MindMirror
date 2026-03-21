<div align="center">

<img src="https://img.shields.io/badge/MindMirror-AI%20Burnout%20Prevention-6366f1?style=for-the-badge&logo=google-chrome&logoColor=white" alt="MindMirror" />

# 🧠 MindMirror

### *An AI-Powered Chrome Extension That Protects Developer Mental Health — Before Burnout Happens.*

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/Google-Gemini%20Pro-4285F4?style=flat-square&logo=google)](https://deepmind.google/technologies/gemini/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-yellow?style=flat-square&logo=google-chrome)](https://developer.chrome.com/docs/extensions/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)

<br/>

> **MindMirror** passively observes your digital footprint (browser habits, GitHub commits, calendar meetings, doomscrolling volume) and uses AI-powered interventions — like monochrome mode and breathing exercises — to protect your mental health without you lifting a finger.

<br/>

[🚀 **Try It Live**](https://mindmirror-amber.vercel.app) · [📦 **Download Extension**](https://mind-mirror-starter.vercel.app/MindMirrorExtension.zip) · [💻 **GitHub**](https://github.com/kicha6346) · [⚙️ **View Architecture**](#%EF%B8%8F-architecture)

</div>

---

## 📸 Screenshots

<div align="center">

| 📊 Dashboard | 🍅 Pomodoro Timer | 🤖 AI Mirror Mode |
|:---:|:---:|:---:|
| Live Burnout Risk Score | Focus Session Tracker | Gemini-Powered Insights |

</div>

---

## 🎯 The Problem

> **Burnout is invisible until it's too late.**

Developers don't notice they're burning out — they just feel "tired" or "stuck". Traditional solutions ask you to fill out mood surveys or manually track your time. **Nobody does that.**

MindMirror solves this by **watching your digital behavior silently** and intervening *before* you hit a wall.

---

## ✨ Core Features

### 🔥 1. Ambient Burnout Score Algorithm
A live **Burnout Risk Score (0–100)** calculated dynamically from 5 weighted real-world signals:

```
┌─────────────────────────────────────────────────────────────┐
│              BURNOUT RISK ENGINE  (lib/scoring.ts)          │
├───────────────────────────┬────────────┬────────────────────┤
│ Signal                    │ Weight     │ Source             │
├───────────────────────────┼────────────┼────────────────────┤
│ 📅 Work Intensity         │   40%      │ Calendar + GitHub  │
│ 😴 Recovery Deficit       │   25%      │ Break tracking     │
│ 🔀 Distraction Penalty    │   15%      │ Browser habits     │
│ 🌙 Night Activity         │   10%      │ Late browsing      │
│ 💤 Sleep Debt             │   10%      │ Session gaps       │
└───────────────────────────┴────────────┴────────────────────┘
```

---

### 🖥️ 2. Browser Tracking Engine

The Chrome Extension silently tracks every tab you visit — how long you stay, what category it falls into — and pushes it securely to the backend every 60 seconds.

- ✅ Tab time tracking (`chrome.tabs.onActivated`)
- ✅ Smart domain categorization (`work`, `social`, `entertainment`, `learning`)
- ✅ **Custom category overrides** — tell MindMirror that `reddit.com` is actually `Work` for you
- ✅ Tab hoarding detection (max concurrent tabs logged)

---

### 🚦 3. Predictive Interventions

MindMirror doesn't just show you data — it **actively steps in** to protect you.

#### 🎨 A. Dynamic Monochrome Mode
When you visit an addictive site while burned out, MindMirror gradually **drains the color** from the page to reduce dopamine stimulation. It makes the site look gray and boring on purpose — so you naturally want to leave.

```
Burnout Score ≥ 75  →  Blocklisted site visited
        ↓
content.js injects: filter: grayscale(100%)
        ↓
Page turns completely gray — user loses interest
```

#### 🧟 B. Doomscroll Intervention
When the extension's algorithm detects you're trapped in a **passive scrolling loop** (same scroll velocity, 3+ repeated cycles), it interrupts with a full-screen **Breathing Exercise overlay** — once per hour so it never spams you.

#### 🚫 C. Anti-Doomscroll Blocklist
Users can add any domain to their custom blocklist. If they visit it, they get redirected to a custom blocked page with a **calming breathing exercise GIF**.

---

### 🍅 4. Smart Pomodoro Timer

A built-in Focus Tracker built right into the extension popup.

- ⏱️ Configurable focus + break duration
- 📉 **Focus Score Engine** — every distraction deducts points:
  - `-5` per social media visit during focus
  - `-15` per doomscroll cycle detected  
  - `-2` per tab switch
- 📋 Full action log for every session (what you visited, when, how it hurt your score)
- 💤 **Sleep Debt Override** — if Sleep Debt is detected, break time is automatically forced to 15 minutes

---

### 🤖 5. Mirror Mode — Gemini AI Insights

Powered by **Google Gemini Pro**, the AI generates hyper-personalized coaching messages based on your actual week of data.

> *"You pushed 14 commits to GitHub this week but logged 6 hours of work past midnight. You're entering a dangerous Sleep Debt cycle — enable Monochrome mode earlier tonight."*

The AI is given your real data: GitHub commits, work hours, distractions, night activity — so every insight is **unique to you**.

---

### ⚙️ 6. Third-Party Integrations

MindMirror automatically pulls data from the tools you already use:

| Integration | What it tracks | Method |
|---|---|---|
| **Google Calendar** | Meeting minutes vs. deep focus | OAuth 2.0 |
| **GitHub** | Daily commit volume | GraphQL API |
| **LeetCode** | Problem-solving exhaustion | GraphQL (Reverse-Engineered) |

---

### 📊 7. The Analytics Dashboard

A full `Next.js` + `Recharts` dashboard with glassmorphism dark-mode UI:

- 📈 **7-Day Burnout Trendline** — Visualizes your exhaustion over time
- 📊 **30-Day Focus Breakdown** — Stacked bar chart of Work vs Social vs Entertainment (renders `"1h 15m"` cleanly on hover)
- 🎨 Fully dark-mode, Tailwind-styled, premium aesthetic

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MINDMIRROR SYSTEM                            │
│                                                                     │
│  ┌──────────────────────┐      ┌──────────────────────────────┐    │
│  │  Chrome Extension    │      │     Next.js Dashboard        │    │
│  │  (Manifest V3)       │      │     (Vercel)                 │    │
│  │                      │      │                              │    │
│  │  background.js  ─────┼─────►│  /api/ingest/browser        │    │
│  │  content.js          │      │  /api/score                  │    │
│  │  popup/popup.js      │      │  /api/insights (Gemini)      │    │
│  │  newtab/blocked.html │      │  /api/pomodoro/sync          │    │
│  └──────────────────────┘      │  /api/blocklist              │    │
│                                └──────────┬───────────────────┘    │
│                                           │                         │
│                                ┌──────────▼───────────────────┐    │
│                                │       Supabase               │    │
│                                │  (PostgreSQL + Auth)         │    │
│                                │                              │    │
│                                │  browser_events              │    │
│                                │  pomodoro_sessions           │    │
│                                │  burnout_scores              │    │
│                                │  user_blocklist              │    │
│                                │  user_custom_categories      │    │
│                                └──────────────────────────────┘    │
│                                                                     │
│  External Data Sources:                                             │
│  Google Calendar API  ──► Meeting minutes                          │
│  GitHub API (GraphQL) ──► Daily commits                             │
│  LeetCode API         ──► Problems solved                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation (For Judges)

> ⚠️ **Please read the Judge Notes section below before starting!**

### Step 1 — Download the Extension
Download the `MindMirrorExtension.zip` file directly: **[⬇️ Download Extension ZIP](https://mind-mirror-starter.vercel.app/MindMirrorExtension.zip)**

### Step 2 — Extract the ZIP
Unzip the downloaded file to a folder on your computer.

### Step 3 — Open Chrome Extensions
Navigate to `chrome://extensions/` in your Chrome browser.

### Step 4 — Enable Developer Mode
Toggle on **"Developer mode"** in the top-right corner of the extensions page.

### Step 5 — Load the Extension
Click **"Load unpacked"** and select the extracted `extension` folder.

### Step 6 — Sign In
Click the MindMirror icon in your toolbar and sign in with your Google account via the dashboard.

---

## 🏁 Judge Notes

> Please read this section carefully for the best evaluation experience.

---

### ⚠️ Google Login / VPN Notice

> **If the Google account login does not connect or returns an error, please try enabling a VPN.**
>
> This is a known issue caused by regional database connection limits on our Supabase instance during testing/hackathon review. A VPN resolves this instantly.

---

### 🕐 Experience Notice — Please Allow Time!

> **MindMirror is a *behavioral* extension. It needs to observe you to work.**
>
> Please keep the extension installed and **browse normally for at least 5–10 minutes**. Visit some YouTube, scroll through Twitter/X, check GitHub — the extension is silently profiling your habits in the background.
>
> The AI interventions (doomscroll popup, monochrome mode, Pomodoro score) will only trigger when it detects a pattern. You won't see the magic by just opening it and closing it. **The experience IS the evaluation.**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Dashboard** | Next.js 15, React, Tailwind CSS, Recharts |
| **Backend API** | Next.js API Routes (Edge Functions) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth + Google OAuth 2.0 |
| **AI Engine** | Google Gemini Pro API |
| **Browser Extension** | Chrome Extension Manifest V3 |
| **Deployment** | Vercel |

---

## 📁 Project Structure

```
mindmirrorpro/
├── app/
│   ├── page.tsx                  # Main Dashboard UI
│   ├── auth/page.tsx             # Authentication screen
│   ├── globals.css               # Global styles
│   └── api/
│       ├── ingest/browser/       # Browser usage ingestion
│       ├── score/                # Burnout score calculator
│       ├── insights/             # Gemini AI insights
│       ├── pomodoro/sync/        # Pomodoro session sync
│       ├── blocklist/            # User blocklist management
│       └── categories/           # Custom category overrides
├── extension/
│   ├── manifest.json             # Chrome Extension config (MV3)
│   ├── background.js             # Service Worker (core brain)
│   ├── content.js                # Injected scripts (interventions)
│   ├── popup/                    # Extension toolbar popup
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── newtab/                   # Blocked site redirect page
│       └── blocked.html
├── lib/
│   └── scoring.ts                # Burnout algorithm engine
├── supabase/                     # DB schema migrations
└── landing/                      # Judge landing page
    └── index.html
```

---

## 🔐 Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/kicha6346/mindmirrorpro.git
cd mindmirrorpro

# Install dependencies
npm install

# Add environment variables
cp .env.example .env.local
# Fill in your Supabase + Gemini keys

# Start the development server
npm run dev
```

Then load the `extension/` folder in Chrome via `chrome://extensions/` → **Load unpacked**.

---

## 🤝 Made With

<div align="center">

Built for the hackathon with ❤️ using **Google Gemini**, **Supabase**, **Next.js**, and too much `console.log` debugging.

<br/>

*"The best health app is the one you never have to open."*

</div>
