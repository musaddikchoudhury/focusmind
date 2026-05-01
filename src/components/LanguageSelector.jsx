import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n/index";

export default function LanguageSelector({ compact = false }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
    || SUPPORTED_LANGUAGES[0];

  const select = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div style={{ position:"relative", zIndex:100 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:6,
          padding: compact ? "5px 10px" : "7px 14px",
          borderRadius:999, cursor:"pointer",
          border:"1px solid rgba(255,255,255,0.1)",
          background:"rgba(6,15,30,0.85)", backdropFilter:"blur(10px)",
          color:"#94a3b8", fontSize: compact ? 12 : 13,
          fontFamily:"'Space Mono',monospace", letterSpacing:"0.04em",
          transition:"all 0.2s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.color = "#e2e8f0"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#94a3b8"; }}>
        <span>{current.flag}</span>
        {!compact && <span>{current.code.toUpperCase()}</span>}
        <span style={{ fontSize:9, opacity:0.5 }}>▾</span>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div onClick={() => setOpen(false)}
            style={{ position:"fixed", inset:0, zIndex:99 }} />

          <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0,
            background:"rgba(6,15,30,0.95)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:14, overflow:"hidden", minWidth:160,
            backdropFilter:"blur(20px)", zIndex:200,
            boxShadow:"0 16px 40px rgba(0,0,0,0.5)" }}>
            {SUPPORTED_LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => select(lang.code)}
                style={{ width:"100%", padding:"10px 16px",
                  display:"flex", alignItems:"center", gap:10,
                  background: i18n.language === lang.code ? "rgba(0,229,255,0.08)" : "transparent",
                  border:"none", borderBottom:"1px solid rgba(255,255,255,0.04)",
                  cursor:"pointer", textAlign:"left",
                  color: i18n.language === lang.code ? "#00e5ff" : "#64748b",
                  fontFamily:"'DM Sans',sans-serif", fontSize:13,
                  transition:"all 0.15s" }}
                onMouseEnter={e => { if (i18n.language !== lang.code) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = i18n.language === lang.code ? "rgba(0,229,255,0.08)" : "transparent"; e.currentTarget.style.color = i18n.language === lang.code ? "#00e5ff" : "#64748b"; }}>
                <span style={{ fontSize:16 }}>{lang.flag}</span>
                <span>{lang.label}</span>
                {i18n.language === lang.code && (
                  <span style={{ marginLeft:"auto", fontSize:11, color:"#00e5ff" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
