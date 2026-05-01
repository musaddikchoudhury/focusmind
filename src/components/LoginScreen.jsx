import { useEffect, useRef } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSelector from "./LanguageSelector";

const FREQ_COLOR = "#00e5ff";

export default function LoginScreen() {
  const { signInWithGoogle, continueAsGuest, authError, loading } = useAuth();
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const tRef      = useRef(0);

  // Subtle animated orb in the background
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      tRef.current += 0.01;
      const t = tRef.current;
      const W = cv.width, H = cv.height, cx = W/2, cy = H/2;
      ctx.clearRect(0, 0, W, H);
      // Slow rotating arcs
      ["#00e5ff", "#b57bee", "#ff4d1a", "#00ffb3"].forEach((color, i) => {
        const speed = 0.25 + i * 0.08;
        const start = t * speed + (i * Math.PI) / 2;
        const len = Math.PI * (0.35 + Math.sin(t * 0.4 + i) * 0.15);
        const r = 90 + i * 12;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + len);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.35 + Math.sin(t * 1.2 + i) * 0.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      // Pulse core
      const pr = 36 + Math.sin(t * 1.8) * 4;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
      g.addColorStop(0, "rgba(0,229,255,0.55)");
      g.addColorStop(1, "rgba(0,229,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2); ctx.fill();
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#020810",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px", position: "relative", overflow: "hidden",
      fontFamily: "'DM Sans', sans-serif", color: "#e2e8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box}
        .grid{position:fixed;inset:0;pointer-events:none;
          background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);
          background-size:44px 44px;}
        .orb{position:fixed;border-radius:50%;filter:blur(140px);pointer-events:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .card{animation:fadeUp 0.5s ease both;background:rgba(6,15,30,0.88);
          border:1px solid rgba(255,255,255,0.08);border-radius:22px;
          backdrop-filter:blur(20px);padding:36px 32px;width:100%;max-width:400px;}
        .google-btn-wrap > div > div { justify-content: center !important; }
        .guest-btn{width:100%;padding:13px;borderRadius:12px;border:1px solid rgba(255,255,255,0.1);
          background:transparent;color:#64748b;cursor:pointer;
          font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.07em;
          transition:all 0.2s;}
        .guest-btn:hover{border-color:rgba(255,255,255,0.22);color:#94a3b8;}
        .divider{display:flex;align-items:center;gap:12px;margin:18px 0;}
        .divider-line{flex:1;height:1px;background:rgba(255,255,255,0.07);}
        .divider-text{font-family:'Space Mono',monospace;font-size:9px;
          letter-spacing:0.14em;color:#1e3a5f;}
      `}</style>

      <div className="grid" />
      <div className="orb" style={{width:500,height:500,top:-150,left:-100,background:"#00e5ff",opacity:0.07}} />
      <div className="orb" style={{width:400,height:400,bottom:-100,right:-100,background:"#7c3aed",opacity:0.07}} />

      {/* Language selector top-right */}
      <div style={{ position:"fixed", top:20, right:20, zIndex:10 }}>
        <LanguageSelector compact />
      </div>

      <div className="card">
        {/* Orb */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <canvas ref={canvasRef} width={200} height={200} style={{ width:200, height:200 }} />
        </div>

        {/* App name */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32,
            letterSpacing:"0.1em", color:"#f1f5f9", lineHeight:1 }}>
            FOCUS<span style={{ color: FREQ_COLOR }}>MIND</span>
          </div>
          <p style={{ fontSize:13, color:"#475569", marginTop:8, lineHeight:1.6 }}>
            {t("auth.signInSubtitle")}
          </p>
        </div>

        {/* Error */}
        {authError && (
          <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10,
            background:"rgba(255,107,107,0.07)", border:"1px solid rgba(255,107,107,0.22)",
            fontSize:13, color:"#ff8080", textAlign:"center" }}>
            {authError}
          </div>
        )}

        {/* Google Sign-In */}
        {/* The credential from GoogleLogin is a Google ID token (JWT).
            It is passed to Supabase signInWithIdToken — GOOGLE_CLIENT_SECRET
            is verified by Supabase server-side and never touches this code. */}
        <div className="google-btn-wrap" style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
          <GoogleLogin
            onSuccess={signInWithGoogle}
            onError={() => {}}
            theme="filled_black"
            shape="pill"
            size="large"
            text="continue_with"
            width="320"
          />
        </div>

        {/* Divider */}
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-text">OR</span>
          <div className="divider-line" />
        </div>

        {/* Guest mode */}
        <button className="guest-btn" onClick={continueAsGuest}>
          {t("auth.continueAsGuest")}
        </button>

        {/* Guest note */}
        <p style={{ fontSize:11, color:"#1e3a5f", textAlign:"center",
          marginTop:14, lineHeight:1.6, fontFamily:"'Space Mono',monospace",
          letterSpacing:"0.04em" }}>
          {t("auth.guestNote")}
        </p>

        {/* Loading overlay */}
        {loading && (
          <div style={{ position:"absolute", inset:0, borderRadius:22,
            background:"rgba(2,8,16,0.8)", display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:12 }}>
            <div style={{ width:28, height:28, border:`2px solid ${FREQ_COLOR}33`,
              borderTopColor:FREQ_COLOR, borderRadius:"50%",
              animation:"spin 0.9s linear infinite" }} />
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10,
              color: FREQ_COLOR, letterSpacing:"0.12em" }}>
              {t("auth.syncingData")}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop:24, fontFamily:"'Space Mono',monospace", fontSize:8,
        letterSpacing:"0.18em", color:"#0a1628" }}>
        HANDSHAKE × CODEX CHALLENGE
      </div>
    </div>
  );
}
