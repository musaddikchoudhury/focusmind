# FocusMind — AI-Powered Adaptive Study System

> Study smarter. Not longer.

**Live Demo:** [focusmind-five.vercel.app](https://focusmind-five.vercel.app)

Built for the **Handshake × Codex Challenge** using a two-AI workflow — Claude (Anthropic) for architecture and prompt engineering, Codex for implementation and debugging.

---

## What It Does

FocusMind wraps an entire study session in a single intelligent experience:

1. **Describe what you're studying** → AI picks your optimal brainwave frequency
2. **Focus with isochronic tones** playing in the background while a Pomodoro timer runs
3. **Ask questions hands-free** via the real-time Voice Companion while studying
4. **Get debriefed after each session** — adaptive quiz, AI coaching insight, and a personalized learning dashboard

---

## Features

### 🧠 AI Frequency Matching
Gemini 2.5 Flash analyzes your study material and recommends one of four brainwave modes:
- **Gamma 40Hz** — peak cognition, math and coding
- **Beta 18Hz** — active focus, research and writing  
- **Alpha 10Hz** — calm reading and comprehension
- **Theta 6Hz** — creative work and deep rest

Isochronic tones and pink noise are generated entirely in-browser via the **Web Audio API** with a real-time 48-bar FFT spectrum analyzer and morphing blob canvas animation.

### ⏱ Adaptive Pomodoro Timer
- 25/5/15 minute focus/break cycles
- Frequency mode auto-switches per phase
- Session progress tracked with dot indicators

### 🎤 Voice Study Companion
- Ask questions out loud while studying — AI responds via text-to-speech
- **Continuous mic mode** keeps the microphone open across multiple utterances
- Silence detection, utterance queuing, and echo cancellation prevention via isolated AudioContext
- Text input fallback for environments where speech isn't available
- Automatically tracks weak areas from every question asked

### 📝 Smart Debrief + Adaptive Quiz
- Rate your focus after each session
- AI generates quiz questions from your exact material
- **Adaptive difficulty** adjusts round-by-round: ≥80% → hard, 50–79% → medium, <50% → easy
- Per-topic mastery tracking with spaced repetition scheduling in PostgreSQL
- AI coaching insight personalized to your focus rating, quiz history, and weak areas

### 📊 Learning Dashboard
Five custom SVG data visualizations (no chart library):
- 12-week activity heatmap
- Session bar chart (duration by frequency)
- Frequency usage donut chart
- Focus rating sparkline
- Per-topic mastery bars with accuracy percentages

### 🔐 Authentication + Data Sync
- Google OAuth via Supabase (redirect flow, avoids COOP issues)
- Guest mode with localStorage — data migrates to account on sign-in
- Row Level Security on all database tables
- Automatic streak tracking and profile aggregation

### 🎨 Theme System
Three themes with 15 CSS custom properties injected at the document root:
- 🌙 Dark (default)
- ☀️ Light
- 🌿 Warm/Beige

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite |
| AI | Google Gemini 2.5 Flash |
| Auth | Supabase Auth, Google OAuth |
| Database | Supabase PostgreSQL with RLS |
| Audio | Web Audio API (isochronic tones + pink noise) |
| Voice | Web Speech API (continuous recognition) |
| Math Rendering | KaTeX (lazy-loaded from CDN) |
| Deployment | Vercel |
| Dev Workflow | Claude (architecture) + Codex (implementation) |

---

## Architecture Highlights

**Voice + Audio Conflict Prevention**
The Web Speech API and Web Audio API cannot run simultaneously without the browser's Acoustic Echo Cancellation suppressing audio output. Solution: pause frequency audio when the mic opens, use a separate `AudioContext` for mic analysis, and set `echoCancellation: false`. Audio resumes 200ms after the mic closes.

**Continuous Voice Recognition**
Chrome's Web Speech API kills the recognition session after ~7 seconds of silence. Solved with: proactive 5-second restart via `silenceTimerRef`, stale closure prevention via `recogSessionRef`, utterance queuing in `pendingUtterRef`, and handling of all error states (`no-speech`, `not-allowed`, `aborted`, `InvalidStateError`).

**Session Duration Tracking**
The naive `totalSecs - timeLeft` approach always returned zero because timer state resets before the DB write. Fixed with `sessionStartRef` recording `Date.now()` on start and `sessionDurationRef` capturing actual elapsed seconds in `triggerDebrief` before any state resets.

**Adaptive Quiz Engine**
`computeDifficulty(history)` reads the last round's score percentage and adjusts: ≥80% → hard, 50–79% → medium, <50% → easy. `testedTopics` accumulates topic tags to prevent repetition across continued rounds. Topic mastery computes automatically in PostgreSQL via a trigger on every write.

---

## Database Schema

```
profiles           — user account + aggregated stats (streak, totals)
study_sessions     — every Pomodoro session with AI insight
quiz_results       — per-round scores linked to sessions
learning_progress  — per-user per-topic mastery with spaced repetition
```

All tables have Row Level Security enabled. Users can only access their own data regardless of what the frontend sends.

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/musaddikchoudhury/focusmind.git
cd focusmind

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Fill in your keys (see below)

# Start dev server
npm run dev
```

**Required environment variables:**
```
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_KEY=your_gemini_api_key
```

**Database setup:**
1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable Google as an Auth provider in Supabase dashboard
4. Add your Supabase callback URL to Google Cloud Console

---

## Project Structure

```
src/
├── App.jsx                  — main app, all core logic (~1800 lines)
├── LandingPage.jsx          — marketing landing page
├── Root.jsx                 — routing between landing and app
├── main.jsx                 — entry point, provider tree
├── auth/AuthContext.jsx     — Google OAuth, session management
├── db/
│   ├── supabase.js          — singleton client with safe mock
│   └── userService.js       — all DB operations, input sanitization
├── hooks/useStudyDataSync.js — bridges App state to Supabase
├── theme/ThemeContext.jsx   — 3 themes, CSS variable injection
├── i18n/                    — react-i18next, 4 locales (en/es/fr/pt)
└── components/
    ├── UserDashboard.jsx    — dashboard modal with SVG charts
    ├── LegalModal.jsx       — Privacy Policy, Terms, Voice Consent
    ├── MathRenderer.jsx     — KaTeX LaTeX rendering
    ├── ThemeToggle.jsx      — theme cycle button
    └── LanguageSelector.jsx — 4-language dropdown
supabase/
└── schema.sql               — full schema with RLS, triggers, RPCs
```

---

## Legal

This project includes a Privacy Policy, Terms of Service, and Voice Recording Consent Disclosure accessible from the landing page footer and sign-in modal.

Voice input is processed by the browser's built-in Speech Recognition API. Raw audio is never recorded or stored by FocusMind.

---

## Author

**Musaddik Choudhury**
Computer Science — BMCC (CUNY) | GPA: 4.00 | PTK Honor Society
[GitHub](https://github.com/musaddikchoudhury) · [LinkedIn](https://linkedin.com/in/musaddikchoudhury) · musaddikchoudhury99@gmail.com

---

*Built with Claude (Anthropic) + OpenAI Codex | Handshake × Codex Challenge 2026*
