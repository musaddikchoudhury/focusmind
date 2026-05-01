import { useState } from "react";

const ACCENT = "#00e5ff";
const APP_NAME = "FocusMind";
const CONTACT_EMAIL = "privacy@focusmind.app"; // update this
const LAST_UPDATED = "May 1, 2026";

// ── Section component ────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16,
        letterSpacing: "0.06em", color: ACCENT, marginBottom: 10 }}>
        {title}
      </h3>
      <div style={{ fontSize: 13, color: "var(--text2,#94a3b8)",
        lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ── PRIVACY POLICY ────────────────────────────────────────────────────────
function PrivacyPolicy() {
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted,#64748b)", marginBottom: 20,
        fontFamily: "'Space Mono',monospace" }}>Last updated: {LAST_UPDATED}</p>

      <Section title="1. Information We Collect">
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Account Information:</strong> When
        you sign in with Google, we receive your name, email address, and profile photo from
        Google OAuth. We do not receive or store your Google password.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Study Data:</strong> We store your
        Pomodoro session history (material studied, duration, frequency mode, focus ratings),
        quiz results, and learning progress metrics in our Supabase database.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Voice Input:</strong> The Voice
        Companion uses your browser's built-in Speech Recognition API. Your voice is processed
        locally by your browser and/or by Google's speech recognition service depending on your
        browser. We do not record, store, or transmit raw audio to our servers. Only the
        transcribed text of your questions is sent to the Gemini AI API for responses.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Local Storage:</strong> Guest
        sessions are stored in your browser's localStorage. This data never leaves your device
        unless you sign in, at which point it is migrated to your account.</p>
      </Section>

      <Section title="2. How We Use Your Data">
        <p>We use your information to: provide and improve the {APP_NAME} service; generate
        personalized quiz questions and AI coaching insights; track your learning progress over
        time; calculate study streaks and performance metrics; and migrate guest data when you
        create an account.</p>
        <p>We do not sell your personal data to third parties. We do not use your data for
        advertising purposes.</p>
      </Section>

      <Section title="3. Third-Party Services">
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Google OAuth:</strong> Authentication
        is handled by Google. Subject to Google's Privacy Policy.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Supabase:</strong> Our database and
        authentication infrastructure provider. Data is stored in encrypted PostgreSQL databases.
        Subject to Supabase's Privacy Policy.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Google Gemini AI:</strong> Your study
        material descriptions and quiz questions are sent to Google's Gemini API to generate
        responses. Subject to Google's AI Terms of Service.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Browser Speech Recognition:</strong> Voice
        input is processed by your browser (typically Chrome's Web Speech API, powered by
        Google). We do not control how this data is processed by your browser vendor.</p>
      </Section>

      <Section title="4. Data Retention">
        <p>Your account data is retained for as long as your account is active. You may request
        deletion of your data at any time by contacting us at {CONTACT_EMAIL}.</p>
        <p>Guest data stored in localStorage is automatically cleared when you clear your browser
        data, or when you sign in and the data is migrated to your account.</p>
      </Section>

      <Section title="5. Your Rights">
        <p>You have the right to access, correct, or delete your personal data. You may also
        request a copy of all data we hold about you. To exercise these rights, contact us at
        {" "}{CONTACT_EMAIL}.</p>
        <p>If you are in the European Economic Area (EEA), you have additional rights under
        GDPR including the right to data portability and the right to object to processing.</p>
      </Section>

      <Section title="6. Security">
        <p>All data is transmitted over HTTPS. Database access is protected by Row Level Security
        (RLS) policies — each user can only access their own data. Authentication tokens are
        stored securely in localStorage under a namespaced key.</p>
      </Section>

      <Section title="7. Children's Privacy">
        <p>{APP_NAME} is not directed at children under 13. We do not knowingly collect personal
        information from children under 13. If you believe we have inadvertently collected such
        data, contact us immediately at {CONTACT_EMAIL}.</p>
      </Section>

      <Section title="8. Contact">
        <p>For privacy-related questions, contact: <strong style={{ color: ACCENT }}>{CONTACT_EMAIL}</strong></p>
      </Section>
    </div>
  );
}

// ── TERMS OF SERVICE ─────────────────────────────────────────────────────
function TermsOfService() {
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted,#64748b)", marginBottom: 20,
        fontFamily: "'Space Mono',monospace" }}>Last updated: {LAST_UPDATED}</p>

      <Section title="1. Acceptance">
        <p>By using {APP_NAME}, you agree to these Terms of Service. If you do not agree,
        please discontinue use of the application.</p>
      </Section>

      <Section title="2. Description of Service">
        <p>{APP_NAME} is an AI-powered study tool that provides brainwave frequency audio,
        Pomodoro timers, a voice study companion, quiz generation, and learning analytics.
        The service is provided free of charge and is built for educational purposes.</p>
      </Section>

      <Section title="3. User Responsibilities">
        <p>You agree to: use the service for lawful educational purposes only; not attempt to
        reverse engineer, scrape, or exploit the service; not submit harmful, illegal, or
        offensive content as study material; maintain the confidentiality of your account.</p>
      </Section>

      <Section title="4. AI-Generated Content">
        <p>Quiz questions, coaching insights, and voice companion responses are generated by
        artificial intelligence (Google Gemini). This content may contain errors and should
        not be relied upon as a substitute for professional educational or medical advice.
        Always verify AI-generated content against authoritative sources.</p>
      </Section>

      <Section title="5. Audio and Voice Features">
        <p>The frequency audio features generate isochronic tones for study focus. These are
        not medical devices and make no therapeutic claims. If you have hearing sensitivities
        or a medical condition affected by audio stimulation, consult a healthcare professional
        before use.</p>
        <p>Voice features require microphone access. You grant {APP_NAME} permission to access
        your microphone solely for speech recognition. Audio is not recorded by {APP_NAME}.</p>
      </Section>

      <Section title="6. Data and Privacy">
        <p>Your use of the service is also governed by our Privacy Policy, which is incorporated
        into these Terms by reference.</p>
      </Section>

      <Section title="7. Disclaimers">
        <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT
        THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI-GENERATED CONTENT WILL
        BE ACCURATE.</p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>To the fullest extent permitted by law, {APP_NAME} shall not be liable for any
        indirect, incidental, or consequential damages arising from your use of the service.</p>
      </Section>

      <Section title="9. Changes to Terms">
        <p>We may update these Terms at any time. Continued use of the service after changes
        constitutes acceptance of the new Terms.</p>
      </Section>

      <Section title="10. Contact">
        <p>Questions about these Terms: <strong style={{ color: ACCENT }}>{CONTACT_EMAIL}</strong></p>
      </Section>
    </div>
  );
}

// ── VOICE CONSENT ─────────────────────────────────────────────────────────
function VoiceConsent() {
  return (
    <div>
      <div style={{ padding: "14px 16px", borderRadius: 12, marginBottom: 20,
        background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)" }}>
        <p style={{ fontSize: 13, color: ACCENT, fontWeight: 500 }}>
          This disclosure explains how your voice and microphone are used in {APP_NAME}.
        </p>
      </div>

      <Section title="What happens when you use the Voice Companion">
        <p>When you tap the microphone button, your browser requests access to your
        device's microphone. You will see a browser permission prompt the first time.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Speech Recognition:</strong> Your
        voice is captured and processed by your browser's built-in Speech Recognition API
        (in Chrome, this is powered by Google's speech service). The audio stream is sent
        to Google for transcription. {APP_NAME} receives only the resulting text — not the
        audio itself.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>No audio recording:</strong> {APP_NAME}
        does not record, store, or transmit your voice audio to our servers. The raw audio
        never leaves your browser's speech recognition pipeline.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Text is sent to AI:</strong> The
        transcribed text of your question is sent to Google's Gemini AI API to generate a
        study response. This text may be retained by Google subject to their privacy policy.</p>
      </Section>

      <Section title="Microphone Usage">
        <p>Your microphone is only active while the Voice Companion panel is open and you
        have started listening (tap the microphone button). When you close the Voice Companion
        panel, the microphone is fully released — your browser's microphone indicator light
        will turn off.</p>
        <p><strong style={{ color: "var(--text1,#f1f5f9)" }}>Frequency audio:</strong> To
        prevent audio feedback, the brainwave frequency tones are automatically paused while
        your microphone is active, and resume when you close the voice panel.</p>
      </Section>

      <Section title="Your Controls">
        <p>• You can deny microphone access at any time in your browser settings.</p>
        <p>• The text input fallback in the Voice Companion panel allows you to type questions
        instead of speaking — no microphone required.</p>
        <p>• You can use the full app (Pomodoro timer, frequency audio, quizzes, debrief)
        without ever using the voice features.</p>
      </Section>

      <Section title="Third-party processing">
        <p>Speech recognition is subject to your browser vendor's privacy policy (e.g.,
        Google Chrome Privacy Notice). AI responses are subject to Google's Gemini API
        Terms of Service and Privacy Policy.</p>
        <p>Contact: <strong style={{ color: ACCENT }}>{CONTACT_EMAIL}</strong></p>
      </Section>
    </div>
  );
}

// ── MAIN LEGAL MODAL ─────────────────────────────────────────────────────
const TABS = [
  { id: "privacy",  label: "Privacy Policy" },
  { id: "terms",    label: "Terms of Service" },
  { id: "voice",    label: "Voice Consent" },
];

export default function LegalModal({ onClose, initialTab = "privacy" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
        zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(12px)", padding: 16,
        fontFamily: "'DM Sans', sans-serif" }}>

      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 580, maxHeight: "88vh",
          display: "flex", flexDirection: "column",
          background: "var(--bg2, rgba(4,12,24,0.98))",
          border: "1px solid var(--border, rgba(255,255,255,0.09))",
          borderRadius: 22, color: "var(--text1, #e2e8f0)",
          animation: "legalIn 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500&display=swap');
          @keyframes legalIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
          .ltab{background:transparent;border:none;cursor:pointer;font-family:'Space Mono',monospace;
            font-size:10px;letter-spacing:0.08em;padding:8px 14px;border-radius:999px;
            transition:all 0.2s;white-space:nowrap;}
        `}</style>

        {/* Header */}
        <div style={{ padding: "18px 20px 0", display: "flex",
          alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20,
            letterSpacing: "0.08em", color: "var(--text1,#f1f5f9)" }}>
            FOCUS<span style={{ color: ACCENT }}>MIND</span>
            <span style={{ fontSize: 12, color: "var(--muted,#64748b)",
              fontFamily: "'Space Mono',monospace", letterSpacing: "0.06em",
              marginLeft: 10, fontWeight: 400 }}>Legal</span>
          </div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%",
              border: "1px solid var(--border,rgba(255,255,255,0.1))",
              background: "transparent", cursor: "pointer",
              color: "var(--text3,#64748b)", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0",
          overflowX: "auto", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} className="ltab"
              onClick={() => setTab(t.id)}
              style={{
                color: tab === t.id ? ACCENT : "var(--text3,#64748b)",
                background: tab === t.id ? "rgba(0,229,255,0.1)" : "transparent",
                border: tab === t.id ? "1px solid rgba(0,229,255,0.3)" : "1px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border,rgba(255,255,255,0.07))",
          margin: "10px 0 0", flexShrink: 0 }} />

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "20px 24px 24px", flex: 1 }}>
          {tab === "privacy" && <PrivacyPolicy />}
          {tab === "terms"   && <TermsOfService />}
          {tab === "voice"   && <VoiceConsent />}
        </div>
      </div>
    </div>
  );
}

// ── Convenience trigger button ────────────────────────────────────────────
export function LegalLinks({ style = {} }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("privacy");

  const open_ = (t) => { setTab(t); setOpen(true); };

  return (
    <>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", ...style }}>
        {[
          { label: "Privacy Policy",   tab: "privacy" },
          { label: "Terms of Service", tab: "terms"   },
          { label: "Voice Consent",    tab: "voice"   },
        ].map(l => (
          <button key={l.tab} onClick={() => open_(l.tab)}
            style={{ background: "transparent", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--muted,#64748b)",
              fontFamily: "'Space Mono',monospace", letterSpacing: "0.06em",
              textDecoration: "underline", textDecorationColor: "transparent",
              transition: "all 0.2s", padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--text2,#94a3b8)"; e.currentTarget.style.textDecorationColor = "currentColor"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--muted,#64748b)"; e.currentTarget.style.textDecorationColor = "transparent"; }}>
            {l.label}
          </button>
        ))}
      </div>
      {open && <LegalModal initialTab={tab} onClose={() => setOpen(false)} />}
    </>
  );
}
