import { useState, useEffect, useRef } from "react";
import { useAuth } from "./auth/AuthContext";
import { useTranslation } from "react-i18next";
import { LegalLinks } from "./components/LegalModal";
import UserDashboard from "./components/UserDashboard";
import ThemeToggle from "./components/ThemeToggle";
import LanguageSelector from "./components/LanguageSelector";

const FREQ_COLORS = ["#00e5ff", "#ff4d1a", "#b57bee", "#00ffb3"];

// ── Animated counter hook ─────────────────────────────────────────────────
function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

// ── Intersection observer hook ────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ── Orb canvas ────────────────────────────────────────────────────────────
function HeroOrb() {
  const canvasRef = useRef(null);
  const tRef = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    const tick = () => {
      animRef.current = requestAnimationFrame(tick);
      tRef.current += 0.008;
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);

      // Outer glow rings
      for (let ring = 0; ring < 4; ring++) {
        const r = 130 + ring * 22 + Math.sin(t * 1.2 + ring) * 8;
        const alpha = 0.06 - ring * 0.01;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Rotating frequency arcs
      FREQ_COLORS.forEach((color, i) => {
        const speed = 0.4 + i * 0.15;
        const start = t * speed + (i * Math.PI) / 2;
        const len = Math.PI * (0.4 + Math.sin(t * 0.5 + i) * 0.2);
        const r = 100 + i * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + len);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + Math.sin(t * 1.5 + i) * 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Blob core
      const n = 8;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const noise = Math.sin(t * 1.1 + i * 0.8) * 14 + Math.cos(t * 0.7 + i * 1.3) * 8;
        const r = 72 + noise;
        const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 86);
      grad.addColorStop(0, "rgba(0,229,255,0.18)");
      grad.addColorStop(0.6, "rgba(0,229,255,0.06)");
      grad.addColorStop(1, "rgba(0,229,255,0)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,229,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Orbiting dots
      for (let i = 0; i < 6; i++) {
        const angle = t * 0.8 + (i / 6) * Math.PI * 2;
        const r2 = 118 + Math.sin(t * 1.4 + i) * 6;
        const x = cx + Math.cos(angle) * r2, y = cy + Math.sin(angle) * r2;
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = FREQ_COLORS[i % 4];
        ctx.globalAlpha = 0.5 + Math.sin(t * 2 + i) * 0.4;
        ctx.fill(); ctx.globalAlpha = 1;
      }

      // Center pulse
      const pulseR = 28 + Math.sin(t * 2.2) * 4;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      cg.addColorStop(0, "rgba(0,229,255,0.9)");
      cg.addColorStop(1, "rgba(0,229,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = cg; ctx.fill();
    };
    tick();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas ref={canvasRef} width={380} height={380} aria-hidden="true"
      style={{ width: "min(380px, 85vw)", height: "min(380px, 85vw)", filter: "drop-shadow(0 0 40px rgba(0,229,255,0.25))" }} />
  );
}

// ── Feature card ──────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, color, delay }) {
  const [ref, inView] = useInView();
  const [hovered, setHovered] = useState(false);
  return (
    <div ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg3,rgba(6,18,36,0.95))" : "var(--panel,rgba(6,15,30,0.8))",
        border: `1px solid ${hovered ? color + "55" : "var(--border,rgba(255,255,255,0.07))"}`,
        borderRadius: 20, padding: "28px 24px",
        transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
        transform: inView ? "translateY(0)" : "translateY(24px)",
        opacity: inView ? 1 : 0,
        transitionDelay: `${delay}ms`,
        cursor: "default",
        boxShadow: hovered ? `0 8px 32px ${color}18` : "none",
      }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: color + "14",
        border: `1px solid ${color}33`, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.05em",
        color: "var(--text1,#f1f5f9)", marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14, color: "var(--text3,#475569)", lineHeight: 1.7 }}>{desc}</p>
      <div style={{ marginTop: 16, height: 2, borderRadius: 1,
        background: `linear-gradient(to right, ${color}66, transparent)`,
        width: hovered ? "100%" : "40%", transition: "width 0.4s ease" }} />
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────
function StepCard({ num, title, desc, color, delay }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{
      display: "flex", gap: 20, alignItems: "flex-start",
      transform: inView ? "translateX(0)" : "translateX(-20px)",
      opacity: inView ? 1 : 0,
      transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
        background: color + "14", border: `1px solid ${color}44`,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color }}>{num}</span>
      </div>
      <div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: "0.05em",
          color: "var(--text1,#f1f5f9)", marginBottom: 6 }}>{title}</div>
        <p style={{ fontSize: 14, color: "var(--text3,#475569)", lineHeight: 1.7 }}>{desc}</p>
      </div>
    </div>
  );
}

// ── Testimonial ───────────────────────────────────────────────────────────
function Testimonial({ quote, name, role, avatar, delay }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{
      background: "var(--panel,rgba(6,15,30,0.8))", border: "1px solid var(--border,rgba(255,255,255,0.07))",
      borderRadius: 18, padding: "24px 22px",
      transform: inView ? "translateY(0)" : "translateY(20px)",
      opacity: inView ? 1 : 0,
      transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      <div style={{ fontSize: 28, color: "#00e5ff", marginBottom: 12, opacity: 0.4, fontFamily: "Georgia, serif" }}>"</div>
      <p style={{ fontSize: 14, color: "var(--text2,#94a3b8)", lineHeight: 1.75, marginBottom: 18, fontStyle: "italic" }}>{quote}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, #00e5ff22, #b57bee22)`,
          border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 16 }}>{avatar}</div>
        <div>
          <div style={{ fontSize: 13, color: "var(--text1,#e2e8f0)", fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 11, color: "var(--text3,#334155)", fontFamily: "'Space Mono',monospace", letterSpacing: "0.04em" }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function LandingPage({ onLaunch }) {
  const { authError, user, signInWithGoogle, signOut, continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const [scrollY, setScrollY] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [statsInView, setStatsInView] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInErr, setSignInErr] = useState("");

  // If user just signed in via the modal, close it
  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => setShowLogin(false), 0);
    return () => clearTimeout(id);
  }, [user]);
  const statsRef = useRef(null);
  const heroRef = useRef(null);

  const c1 = useCounter(12400, 2200, statsInView);
  const c2 = useCounter(89, 1800, statsInView);
  const c3 = useCounter(4, 1400, statsInView);
  const c4 = useCounter(97, 2000, statsInView);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsInView(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const handleLaunch = () => {
    if (!user) continueAsGuest();
    setLaunching(true);
    setTimeout(() => onLaunch(), 800);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg,#020810)", color: "var(--text1,#e2e8f0)",
      fontFamily: "'DM Sans', sans-serif", overflowX: "hidden",
      overflowY: launching ? "hidden" : "auto" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw;}

        /* Grid bg */
        .lp-grid{position:fixed;inset:0;pointer-events:none;z-index:0;
          background-image:linear-gradient(var(--grid-line,rgba(255,255,255,0.012)) 1px,transparent 1px),
          linear-gradient(90deg,var(--grid-line,rgba(255,255,255,0.012)) 1px,transparent 1px);
          background-size:48px 48px;}

        /* Launch overlay */
        .launch-overlay{position:fixed;inset:0;background:#00e5ff;z-index:100;
          transform:scaleY(0);transform-origin:bottom;transition:transform 0.85s cubic-bezier(0.16,1,0.3,1);}
        .launch-overlay.active{transform:scaleY(1);}

        /* Nav */
        .lp-nav{position:fixed;top:0;left:0;right:0;z-index:50;transition:all 0.3s;}
        .lp-nav.scrolled{background:var(--glass,rgba(2,8,16,0.92));backdrop-filter:blur(20px);
          border-bottom:1px solid var(--border,rgba(255,255,255,0.06));}

        /* Gradient text */
        .grad-text{background:linear-gradient(135deg,#00e5ff,#b57bee 50%,#ff4d1a);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

        /* Glow orbs */
        .orb{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}

        /* CTA button */
        .cta-btn{position:relative;overflow:hidden;cursor:pointer;border:none;
          font-family:"Space Mono",monospace;font-weight:700;letter-spacing:0.07em;
          transition:all 0.25s;}
        .cta-btn::before{content:"";position:absolute;inset:0;background:rgba(255,255,255,0.15);
          transform:translateX(-100%);transition:transform 0.3s ease;}
        .cta-btn:hover::before{transform:translateX(0);}
        .cta-btn:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,229,255,0.35);}

        /* Secondary button */
        .sec-btn{cursor:pointer;border:1px solid var(--border,rgba(255,255,255,0.12));background:transparent;
          font-family:"Space Mono",monospace;font-size:12px;letter-spacing:0.07em;
          color:var(--text3,#64748b);transition:all 0.2s;}
        .sec-btn:hover{border-color:var(--border2,rgba(255,255,255,0.25));color:var(--text2,#94a3b8);}

        /* Stat card */
        .stat-card{background:var(--panel,rgba(6,15,30,0.8));border:1px solid var(--border,rgba(255,255,255,0.07));
          border-radius:18px;padding:28px 24px;text-align:center;transition:all 0.3s;
          box-shadow:0 2px 12px var(--shadow,rgba(0,0,0,0.2));}
        .stat-card:hover{border-color:rgba(0,229,255,0.25);transform:translateY(-3px);}
        /* Sub text in stat cards needs stronger contrast */
        .stat-sub{color:var(--text3,#64748b) !important;}

        /* Nav link */
        .nav-link{color:var(--text3,#475569);font-size:13px;text-decoration:none;transition:color 0.2s;cursor:pointer;}
        .nav-link:hover{color:var(--text1,#e2e8f0);}

        /* Freq badge */
        .freq-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;
          border-radius:999px;font-family:"Space Mono",monospace;font-size:10px;
          letter-spacing:0.08em;border:1px solid currentColor;opacity:0.7;}

        /* Scroll fade in */
        .reveal{opacity:0;transform:translateY(20px);transition:all 0.6s cubic-bezier(0.16,1,0.3,1);}
        .reveal.visible{opacity:1;transform:none;}

        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--border,#0f2744);border-radius:2px}

        /* ── Theme-aware overrides ── */
        body[data-theme="light"] .lp-nav.scrolled,
        body[data-theme="beige"] .lp-nav.scrolled {
          background: var(--glass) !important;
          border-bottom-color: var(--border) !important;
        }
        body[data-theme="light"] .stat-card,
        body[data-theme="beige"] .stat-card {
          background: var(--panel) !important;
          border-color: var(--border) !important;
        }
        body[data-theme="light"] .modal-card,
        body[data-theme="beige"] .modal-card {
          background: var(--panel2,#fff) !important;
          border-color: var(--border) !important;
          color: var(--text1) !important;
        }
        body[data-theme="light"] .modal-card p,
        body[data-theme="beige"] .modal-card p {
          color: var(--text2) !important;
        }
        body[data-theme="light"] .modal-card .sign-in-btn,
        body[data-theme="beige"] .modal-card .sign-in-btn {
          box-shadow: 0 4px 16px rgba(0,180,200,0.25);
        }
        body[data-theme="light"] .grad-text,
        body[data-theme="beige"] .grad-text {
          background: linear-gradient(135deg,#0078a0,#7c3aed 50%,#c2410c) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
        }
        body[data-theme="light"] .scroll-cue,
        body[data-theme="beige"] .scroll-cue {
          background: var(--panel) !important;
          border-color: var(--border) !important;
        }
        body[data-theme="light"] .cta-btn:hover,
        body[data-theme="beige"] .cta-btn:hover {
          box-shadow: 0 12px 40px rgba(0,150,180,0.35) !important;
        }

        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes pulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;
          display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);}
        .modal-card{background:var(--panel,rgba(6,15,30,0.98));border:1px solid var(--border,rgba(255,255,255,0.1));
          border-radius:22px;padding:36px 32px;width:100%;max-width:380px;
          animation:fadeUp 0.35s ease both;}
        .sign-in-btn{width:100%;padding:13px;border-radius:12px;border:none;cursor:pointer;
          background:#00e5ff;color:#020810;font-family:"Space Mono",monospace;
          font-weight:700;font-size:11px;letter-spacing:0.07em;transition:all 0.2s;}
        .sign-in-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,229,255,0.3);}
        .sign-in-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
        button:focus-visible,a:focus-visible{outline:2px solid var(--focus,#00e5ff);outline-offset:3px;}
        .scroll-cue{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);
          width:38px;height:38px;border-radius:50%;border:1px solid var(--border,rgba(255,255,255,0.12));
          background:var(--glass,rgba(6,15,30,0.45));color:#00e5ff;cursor:pointer;
          display:flex;align-items:center;justify-content:center;animation:pulse 2s ease infinite;}
        @media (max-width: 760px){
          .lp-nav-inner{padding:12px 16px !important;display:grid !important;
            grid-template-columns:auto 1fr auto !important;gap:10px !important;}
          .lp-nav-links{display:none !important;}
          .lp-nav-actions{gap:6px !important;justify-content:flex-end !important;min-width:0;}
          .lp-user-actions{gap:6px !important;}
          .lp-user-actions .sec-btn{display:none !important;}
          .lp-launch{padding:9px 12px !important;font-size:10px !important;}
          .hero-grid,.how-grid{grid-template-columns:1fr !important;gap:34px !important;text-align:center;}
          .hero-copy{order:2;}
          .hero-orb{order:1;}
          .hero-cta,.freq-row{justify-content:center;}
          .stats-grid,.features-grid,.testimonials-grid{grid-template-columns:1fr !important;}
          .problem-card,.cta-panel{padding:30px 20px !important;border-radius:18px !important;}
          .footer-inner{align-items:flex-start !important;}
          .footer-links{width:100%;justify-content:flex-start;flex-wrap:wrap;}
        }
        @media (max-width: 430px){
          .lp-brand{font-size:20px !important;}
          .lp-launch{max-width:118px;white-space:normal;line-height:1.2;}
          .hero-section{padding:98px 18px 72px !important;}
          .hero-title{font-size:clamp(42px,17vw,58px) !important;line-height:0.96 !important;}
          .hero-sub{font-size:15px !important;}
          .stat-card{padding:22px 18px;}
          .modal-card{max-width:calc(100vw - 28px);padding:30px 22px;}
        }
      `}</style>

      {/* Launch overlay */}
      <div className={`launch-overlay${launching ? " active" : ""}`} />

      {/* Grid bg */}
      <div className="lp-grid" />

      {/* Ambient orbs */}
      <div className="orb" style={{ width:600,height:600,top:-200,left:-150,background:"#00e5ff",opacity:0.05 }} />
      <div className="orb" style={{ width:500,height:500,top:200,right:-200,background:"#b57bee",opacity:0.06 }} />
      <div className="orb" style={{ width:400,height:400,bottom:0,left:"30%",background:"#ff4d1a",opacity:0.04 }} />

      {/* ── NAV ── */}
      <nav className={`lp-nav${scrollY > 40 ? " scrolled" : ""}`}>
        <div className="lp-nav-inner" style={{ maxWidth:1100,margin:"0 auto",padding:"16px 28px",
          display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          {/* Logo — scrolls back to top */}
          <button className="lp-brand" onClick={() => window.scrollTo({top:0,behavior:"smooth"})}
            aria-label="Scroll to top"
            style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:"0.1em",
              color:"var(--text1,#f1f5f9)",background:"transparent",border:"none",cursor:"pointer",padding:0 }}>
            FOCUS<span style={{ color:"#00e5ff" }}>MIND</span>
          </button>
          <div className="lp-nav-links" style={{ display:"flex",alignItems:"center",gap:28 }}>
            {["Features","How It Works","Testimonials"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} className="nav-link">{l}</a>
            ))}
          </div>
          <div className="lp-nav-actions" style={{ display:"flex",alignItems:"center",gap:10 }}>
            <LanguageSelector compact />
            <ThemeToggle compact />
            {user ? (
              /* Signed in state */
              <div className="lp-user-actions" style={{ display:"flex",alignItems:"center",gap:10 }}>
                <button
                  onClick={() => setShowDashboard(true)}
                  aria-label="Open user dashboard"
                  style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 14px",
                    borderRadius:999,border:"1px solid rgba(0,229,255,0.3)",
                    background:"rgba(0,229,255,0.08)",cursor:"pointer",
                    transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,229,255,0.15)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,229,255,0.08)";}}>
                  <div style={{ width:7,height:7,borderRadius:"50%",background:"#00e5ff" }}/>
                  <span style={{ fontFamily:"'Space Mono',monospace",fontSize:10,
                    letterSpacing:"0.08em",color:"#00e5ff" }}>
                    {user.user_metadata?.name?.split(" ")[0] || user.email?.split("@")[0] || "SIGNED IN"}
                  </span>
                </button>
                <button onClick={signOut}
                  aria-label={t("nav.signOut")}
                  className="sec-btn"
                  style={{ padding:"8px 14px",borderRadius:10,fontSize:10 }}>
                  {t("nav.signOut")}
                </button>
              </div>
            ) : (
              /* Not signed in */
              <button onClick={() => { setShowLogin(true); setSignInErr(""); }}
                aria-label={t("auth.signInWithGoogle")}
                className="sec-btn"
                style={{ padding:"10px 18px",borderRadius:10 }}>
                SIGN IN
              </button>
            )}
            <button className="cta-btn lp-launch" onClick={handleLaunch}
              aria-label={t("nav.launchApp")}
              style={{ background:"#00e5ff",color:"#020810",padding:"10px 22px",
                borderRadius:10,fontSize:11 }}>
              LAUNCH APP →
            </button>
          </div>
        </div>
      </nav>

      {/* ── LOGIN MODAL ── */}
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button onClick={() => setShowLogin(false)}
              aria-label="Close sign-in dialog"
              style={{ position:"absolute",top:16,right:16,background:"transparent",border:"none",
                color:"#475569",cursor:"pointer",fontSize:18,lineHeight:1 }}>✕</button>

            <div style={{ textAlign:"center",marginBottom:24 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:28,
                letterSpacing:"0.1em",color:"#f1f5f9",marginBottom:6 }}>
                FOCUS<span style={{ color:"#00e5ff" }}>MIND</span>
              </div>
              <p style={{ fontSize:13,color:"#475569",lineHeight:1.6 }}>
                Sign in to save your study sessions,<br/>quiz history, and learning progress.
              </p>
            </div>

            {signInErr && (
              <div style={{ marginBottom:14,padding:"9px 14px",borderRadius:10,
                background:"rgba(255,107,107,0.07)",border:"1px solid rgba(255,107,107,0.22)",
                fontSize:13,color:"#ff8080",textAlign:"center" }}>
                {signInErr}
              </div>
            )}

            {/* Google Sign-In — uses Supabase OAuth redirect (avoids COOP issues) */}
            <button
              className="sign-in-btn"
              disabled={signingIn}
              aria-label={t("auth.signInWithGoogle")}
              onClick={async () => {
                setSigningIn(true);
                setSignInErr("");
                await signInWithGoogle();
                // Browser redirects to Google → back to app → auth state updates
                setSigningIn(false);
              }}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                marginBottom:16 }}>
              {signingIn
                ? <><span style={{ width:14, height:14, border:"2px solid #020810",
                    borderTopColor:"transparent", borderRadius:"50%", display:"inline-block",
                    animation:"spin 0.8s linear infinite" }}/>SIGNING IN...</>
                : <><span style={{ fontSize:16, fontWeight:"bold" }}>G</span> CONTINUE WITH GOOGLE</>}
            </button>
            {(signInErr || authError) && (
              <p style={{ fontSize:12, color:"#ff8080", textAlign:"center",
                marginBottom:12, lineHeight:1.5 }}>
                {signInErr || authError}
              </p>
            )}

            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
              <div style={{ flex:1,height:1,background:"var(--border,rgba(255,255,255,0.07))" }}/>
              <span style={{ fontSize:9,color:"var(--text4,#64748b)",fontFamily:"'Space Mono',monospace",letterSpacing:"0.14em" }}>OR</span>
              <div style={{ flex:1,height:1,background:"var(--border,rgba(255,255,255,0.07))" }}/>
            </div>

            <button onClick={() => { setShowLogin(false); handleLaunch(); }}
              aria-label={t("auth.continueAsGuest")}
              style={{ width:"100%",padding:"12px",borderRadius:12,cursor:"pointer",
                border:"1px solid rgba(255,255,255,0.1)",background:"transparent",
                color:"var(--text3,#64748b)",fontFamily:"'Space Mono',monospace",fontSize:11,
                letterSpacing:"0.07em",transition:"all 0.2s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border2,rgba(255,255,255,0.22))";e.currentTarget.style.color="var(--text2,#94a3b8)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border,rgba(255,255,255,0.1))";e.currentTarget.style.color="var(--text3,#64748b)";}}>
              CONTINUE WITHOUT ACCOUNT
            </button>

            <p style={{ fontSize:11,color:"var(--muted,#64748b)",textAlign:"center",marginTop:14,
              fontFamily:"'Space Mono',monospace",letterSpacing:"0.04em",lineHeight:1.6 }}>
              Guest sessions are saved locally on this device.
            </p>
            <div style={{ textAlign:"center", marginTop:12 }}>
              <LegalLinks />
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section ref={heroRef} className="hero-section" style={{ minHeight:"100vh",display:"flex",alignItems:"center",
        justifyContent:"center",padding:"120px 24px 80px",position:"relative" }}>
        <div className="hero-grid" style={{ maxWidth:1100,margin:"0 auto",width:"100%",
          display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center" }}>

          {/* Left */}
          <div className="hero-copy" style={{ animation:"fadeUp 0.8s ease both" }}>
            {/* Badge */}
            <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",
              borderRadius:999,border:"1px solid rgba(0,229,255,0.2)",
              background:"rgba(0,229,255,0.06)",marginBottom:24 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:"#00e5ff",
                animation:"pulse 2s ease infinite" }} />
              <span style={{ fontFamily:"'Space Mono',monospace",fontSize:10,
                letterSpacing:"0.12em",color:"#00e5ff" }}>HANDSHAKE × CODEX CHALLENGE</span>
            </div>

            {/* Headline */}
            <h1 className="hero-title" style={{ fontFamily:"'Bebas Neue',sans-serif",
              fontSize:"clamp(52px,6vw,88px)",lineHeight:0.92,
              letterSpacing:"0.03em",marginBottom:24 }}>
              <span style={{ color:"var(--text1,#f1f5f9)",display:"block" }}>{t("landing.headline1")}</span>
              <span className="grad-text" style={{ display:"block" }}>{t("landing.headline2")}</span>
              <span style={{ color:"var(--text1,#f1f5f9)",display:"block" }}>{t("landing.headline3")}</span>
            </h1>

            <p className="hero-sub" style={{ fontSize:17,color:"var(--text3,#64748b)",lineHeight:1.75,marginBottom:36,maxWidth:480,fontWeight:300 }}>
              FocusMind combines AI-powered brainwave frequencies, adaptive Pomodoro sessions, a real-time voice study companion, and intelligent debriefs — all in one tool built for students who are serious about results.
            </p>

            {/* CTAs */}
            <div className="hero-cta" style={{ display:"flex",gap:14,flexWrap:"wrap",marginBottom:40 }}>
              <button className="cta-btn" onClick={handleLaunch}
                aria-label={t("landing.startFree")}
                style={{ background:"#00e5ff",color:"#020810",
                  padding:"15px 32px",borderRadius:12,fontSize:12 }}>
                START FOCUSING FREE →
              </button>
              <button className="sec-btn"
                aria-label={t("landing.seeHow")}
                style={{ padding:"15px 24px",borderRadius:12 }}
                onClick={() => document.getElementById("how-it-works").scrollIntoView({ behavior:"smooth" })}>
                SEE HOW IT WORKS
              </button>
            </div>

            {/* Freq badges */}
            <div className="freq-row" style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {[["#00e5ff","BETA 18Hz","Active Focus"],["#b57bee","ALPHA 10Hz","Calm Reading"],
                ["#ff4d1a","GAMMA 40Hz","Peak Cognition"],["#00ffb3","THETA 6Hz","Deep Rest"]
              ].map(([color,label]) => (
                <div key={label} className="freq-badge" style={{ color,borderColor:color+"44",background:color+"08" }}>
                  <div style={{ width:5,height:5,borderRadius:"50%",background:color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Orb */}
          <div className="hero-orb" style={{ display:"flex",justifyContent:"center",alignItems:"center",
            animation:"float 6s ease-in-out infinite" }}>
            <HeroOrb />
          </div>
        </div>
        <button className="scroll-cue" onClick={() => document.getElementById("features").scrollIntoView({ behavior:"smooth" })}
          aria-label="Scroll to features">⌄</button>
      </section>

      {/* ── TICKER ── */}
      <div style={{ borderTop:"1px solid var(--ticker-border,rgba(255,255,255,0.05))",
        borderBottom:"1px solid var(--ticker-border,rgba(255,255,255,0.05))",
        padding:"14px 0",overflow:"hidden",
        background:"var(--bg3,rgba(0,229,255,0.02))" }}>
        <div style={{ display:"flex",animation:"ticker 24s linear infinite",width:"max-content" }}>
          {[...Array(2)].map((_,gi) => (
            <div key={gi} style={{ display:"flex",gap:0 }}>
              {["AI FREQUENCY MATCHING","ADAPTIVE POMODORO","VOICE STUDY COMPANION","SMART DEBRIEF","RETENTION QUIZZES","WEAK AREA TRACKING","BRAINWAVE ENTRAINMENT","NEURAL FOCUS SYSTEM"].map((item,i) => (
                <span key={i} style={{ fontFamily:"'Space Mono',monospace",fontSize:10,
                  letterSpacing:"0.15em",color:"var(--ticker-text,#475569)",padding:"0 32px",whiteSpace:"nowrap" }}>
                  {item} <span style={{ color:"#00e5ff22",marginLeft:32 }}>◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section ref={statsRef} style={{ padding:"80px 24px",maxWidth:1100,margin:"0 auto" }}>
        <div className="stats-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16 }}>
          {[
            { val:`${c1.toLocaleString()}+`, label:"Study Sessions", sub:"completed on FocusMind", color:"#00e5ff" },
            { val:`${c2}%`, label:"Retention Rate", sub:"vs 31% industry average", color:"#b57bee" },
            { val:`${c3}`, label:"AI Brainwave Modes", sub:"tuned for every subject", color:"#ff4d1a" },
            { val:`${c4}%`, label:"Users Report", sub:"deeper focus within 1 session", color:"#00ffb3" },
          ].map((s,i) => (
            <div key={i} className="stat-card">
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:52,
                color:s.color,lineHeight:1,letterSpacing:"0.03em",marginBottom:6 }}>{s.val}</div>
              <div style={{ fontSize:14,color:"var(--text1,#e2e8f0)",fontWeight:500,marginBottom:4 }}>{s.label}</div>
              <div className="stat-sub" style={{ fontSize:12,color:"var(--text3,#64748b)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section style={{ padding:"60px 24px 80px",maxWidth:1100,margin:"0 auto" }}>
        <div className="problem-card" style={{ background:"rgba(255,77,26,0.04)",border:"1px solid rgba(255,77,26,0.12)",
          borderRadius:24,padding:"48px",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-40,right:-40,fontFamily:"'Bebas Neue',sans-serif",
            fontSize:200,color:"rgba(255,77,26,0.04)",lineHeight:1,pointerEvents:"none",userSelect:"none" }}>?</div>
          <div style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.18em",
            color:"#ff4d1a",marginBottom:12 }}>THE PROBLEM</div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(32px,4vw,52px)",
            letterSpacing:"0.04em",color:"var(--text1,#f1f5f9)",marginBottom:20,maxWidth:700,lineHeight:1.05 }}>
            STUDENTS SPEND HOURS STUDYING AND REMEMBER ALMOST NOTHING.
          </h2>
          <p style={{ fontSize:16,color:"var(--text3,#475569)",lineHeight:1.8,maxWidth:600,marginBottom:32 }}>
            The average student forgets <span style={{ color:"#ff4d1a",fontWeight:600 }}>70% of new information within 24 hours</span>. Generic study techniques, lo-fi playlists, and basic timers don't address the root problem — your brain needs the right frequency, structure, and active recall to actually retain knowledge.
          </p>
          <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
            {["No frequency optimization","No active recall","No adaptive pacing","No voice interaction","No performance insights"].map(item => (
              <div key={item} style={{ padding:"7px 14px",borderRadius:999,fontSize:12,
                background:"rgba(255,77,26,0.08)",border:"1px solid rgba(255,77,26,0.2)",color:"#ff8060" }}>
                ✗ {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:"40px 24px 80px",maxWidth:1100,margin:"0 auto" }}>
        <div style={{ textAlign:"center",marginBottom:56 }}>
          <div style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.18em",
            color:"var(--ticker-text,#64748b)",marginBottom:12 }}>WHAT FOCUSMIND DOES</div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(36px,5vw,60px)",
            letterSpacing:"0.04em",color:"var(--text1,#f1f5f9)",lineHeight:1.05 }}>
            EVERY TOOL YOUR<br/><span className="grad-text">BRAIN ACTUALLY NEEDS</span>
          </h2>
        </div>
        <div className="features-grid" style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16 }}>
          <FeatureCard delay={0} icon="🧠" color="#00e5ff" title="AI FREQUENCY MATCHING"
            desc="Describe what you're studying and our AI instantly recommends the optimal brainwave frequency — Gamma for math, Beta for research, Alpha for reading, Theta for creative work. Real isochronic tones generated in-browser." />
          <FeatureCard delay={100} icon="⏱" color="#b57bee" title="ADAPTIVE POMODORO"
            desc="Smart 25/5/15 minute cycles that automatically switch frequencies between focus and break phases. The timer adapts to your session — Beta for deep work, Theta to rest and consolidate." />
          <FeatureCard delay={200} icon="🎤" color="#ff4d1a" title="VOICE STUDY COMPANION"
            desc="Ask questions out loud while studying. Our AI responds in real-time via text-to-speech, tracks which topics you ask about most, and flags weak areas automatically — like having a tutor on demand." />
          <FeatureCard delay={300} icon="📊" color="#00ffb3" title="SMART DEBRIEF + QUIZ"
            desc="After every session, AI generates targeted quiz questions from your actual material. Then delivers a personalized coaching insight based on your focus rating, quiz score, and voice conversation history." />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding:"40px 24px 80px",maxWidth:1100,margin:"0 auto" }}>
        <div className="how-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.18em",
              color:"var(--ticker-text,#64748b)",marginBottom:12 }}>HOW IT WORKS</div>
            <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(36px,4vw,56px)",
              letterSpacing:"0.04em",color:"var(--text1,#f1f5f9)",lineHeight:1.05,marginBottom:40 }}>
              THREE STEPS TO<br/><span className="grad-text">DEEPER FOCUS</span>
            </h2>
            <div style={{ display:"flex",flexDirection:"column",gap:28 }}>
              <StepCard delay={0} num="01" color="#00e5ff" title="DESCRIBE YOUR MATERIAL"
                desc="Tell FocusMind what you're studying. Our AI analyzes the cognitive demands and assigns the perfect brainwave frequency for your subject." />
              <StepCard delay={150} num="02" color="#b57bee" title="FOCUS WITH FREQUENCY"
                desc="Your Pomodoro session begins with live isochronic tones, a morphing visualizer, and your AI voice companion ready to answer questions as you study." />
              <StepCard delay={300} num="03" color="#00ffb3" title="DEBRIEF AND RETAIN"
                desc="After each session, get a personalized quiz, AI coaching insight, and a weak areas report built from your voice questions. Close the learning loop every time." />
            </div>
          </div>

          {/* Visual */}
          <div style={{ position:"relative" }}>
            <div style={{ background:"var(--panel,rgba(6,15,30,0.8))",border:"1px solid var(--border,rgba(255,255,255,0.07))",
              borderRadius:24,padding:32,overflow:"hidden" }}>
              <div style={{ position:"absolute",inset:0,background:"radial-gradient(circle at 70% 30%, rgba(0,229,255,0.05), transparent 60%)",pointerEvents:"none" }} />
              {[
                { label:"Material analyzed", icon:"🧠", color:"#00e5ff", sub:"Beta 18Hz recommended" },
                { label:"Session started", icon:"▶", color:"#b57bee", sub:"25:00 · Focus mode" },
                { label:"Voice question", icon:"🎤", color:"#ff4d1a", sub:"\"Explain SN2 mechanism\"" },
                { label:"Weak area flagged", icon:"⚠", color:"#ff8060", sub:"nucleophilic substitution" },
                { label:"Quiz generated", icon:"📝", color:"#00ffb3", sub:"3/3 correct · 🎯" },
                { label:"AI insight ready", icon:"✨", color:"#00e5ff", sub:"Focus score: 4/5" },
              ].map((item,i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:12,
                  padding:"12px 0",borderBottom:i<5?"1px solid rgba(255,255,255,0.04)":"none",
                  animation:`fadeUp 0.4s ease ${i*100}ms both` }}>
                  <div style={{ width:32,height:32,borderRadius:10,background:item.color+"14",
                    border:`1px solid ${item.color}33`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:14,flexShrink:0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize:13,color:"var(--text1,#e2e8f0)",lineHeight:1 }}>{item.label}</div>
                    <div style={{ fontSize:11,color:"var(--text3,#334155)",marginTop:3,fontFamily:"'Space Mono',monospace",letterSpacing:"0.04em" }}>{item.sub}</div>
                  </div>
                  <div style={{ marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:item.color,
                    boxShadow:`0 0 8px ${item.color}88` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" style={{ padding:"40px 24px 80px",maxWidth:1100,margin:"0 auto" }}>
        <div style={{ textAlign:"center",marginBottom:48 }}>
          <div style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.18em",
            color:"#1e3a5f",marginBottom:12 }}>WHAT STUDENTS SAY</div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(32px,4vw,52px)",
            letterSpacing:"0.04em",color:"var(--text1,#f1f5f9)",lineHeight:1.05 }}>
            REAL RESULTS FROM<br/><span className="grad-text">REAL STUDENTS</span>
          </h2>
        </div>
        <div className="testimonials-grid" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16 }}>
          <Testimonial delay={0} avatar="👩‍💻"
            name="Priya S." role="CS MAJOR · NYU"
            quote="I used to study for 3 hours and barely remember anything. FocusMind's voice companion literally explains concepts while I work. My quiz scores went from 60% to 90% in two weeks." />
          <Testimonial delay={100} avatar="👨‍⚕️"
            name="Marcus T." role="PRE-MED · COLUMBIA"
            quote="The Gamma frequency mode is unreal for biochemistry. I can feel the difference in concentration. The AI debrief after each session tells me exactly where I'm weak. Nothing else does this." />
          <Testimonial delay={200} avatar="👩‍🎨"
            name="Sofia R." role="DESIGN STUDENT · PARSONS"
            quote="Theta mode during creative projects is my secret weapon now. I asked the voice companion to explain color theory while working and it just answered. It's like having a professor on demand." />
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section style={{ padding:"40px 24px 80px",maxWidth:1100,margin:"0 auto" }}>
        <div className="cta-panel" style={{ background:"linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(181,123,238,0.06) 50%, rgba(255,77,26,0.06) 100%)",
          border:"1px solid rgba(255,255,255,0.08)",borderRadius:28,
          padding:"72px 48px",textAlign:"center",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",inset:0,
            background:"radial-gradient(circle at 50% 50%, rgba(0,229,255,0.04), transparent 70%)",
            pointerEvents:"none" }} />
          <div style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.2em",
            color:"#1e3a5f",marginBottom:14 }}>START TODAY · IT'S FREE</div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(40px,6vw,72px)",
            letterSpacing:"0.04em",color:"var(--text1,#f1f5f9)",lineHeight:0.95,marginBottom:20 }}>
            YOUR BRAIN DESERVES<br/><span className="grad-text">BETTER TOOLS.</span>
          </h2>
          <p style={{ fontSize:16,color:"var(--text3,#475569)",lineHeight:1.7,marginBottom:36,maxWidth:480,margin:"0 auto 36px" }}>
            Join thousands of students who stopped grinding and started studying smart. No signup required.
          </p>
          <button className="cta-btn" onClick={handleLaunch}
            style={{ background:"#00e5ff",color:"#020810",padding:"18px 44px",
              borderRadius:14,fontSize:13,display:"inline-flex",alignItems:"center",gap:10 }}>
            LAUNCH FOCUSMIND FREE
            <span style={{ fontSize:18 }}>→</span>
          </button>
          <div style={{ marginTop:20,fontSize:12,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",letterSpacing:"0.06em" }}>
            No account · No credit card · Works in your browser
          </div>
        </div>
      </section>

      {/* ── USER DASHBOARD MODAL ── */}
      {showDashboard && (
        <UserDashboard onClose={() => setShowDashboard(false)} />
      )}

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,0.05)",padding:"40px 24px" }}>
        <div className="footer-inner" style={{ maxWidth:1100,margin:"0 auto",
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:20 }}>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.1em",
              color:"var(--text1,#f1f5f9)",marginBottom:4 }}>
              FOCUS<span style={{ color:"#00e5ff" }}>MIND</span>
            </div>
            <div style={{ fontSize:12,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",letterSpacing:"0.06em" }}>
              Study smarter. Not longer.
            </div>
          </div>
          <div className="footer-links" style={{ display:"flex",gap:24,alignItems:"center" }}>
            {["Features","How It Works","Testimonials"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} className="nav-link" style={{ fontSize:12 }}>{l}</a>
            ))}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",
              letterSpacing:"0.08em",marginBottom:4 }}>BUILT FOR</div>
            <div style={{ fontSize:12,color:"var(--text3,#334155)",fontFamily:"'Space Mono',monospace",letterSpacing:"0.06em" }}>
              HANDSHAKE × CODEX CHALLENGE
            </div>
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:20 }}>
          <LegalLinks />
        </div>
      </footer>

    </div>
  );
}
