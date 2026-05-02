import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./auth/AuthContext";
import { useStudyDataSync } from "./hooks/useStudyDataSync";
import { getRecentStudySessions } from "./db/userService";
import ThemeToggle from "./components/ThemeToggle";
import LanguageSelector from "./components/LanguageSelector";
import MathRenderer from "./components/MathRenderer";

const FREQS = {
  gamma: { label:"GAMMA", hz:40, carrier:200, color:"#ff4d1a", glow:"rgba(255,77,26,0.45)",  tag:"Peak cognition", r:255,g:77, b:26  },
  beta:  { label:"BETA",  hz:18, carrier:180, color:"#00e5ff", glow:"rgba(0,229,255,0.45)",  tag:"Active focus",   r:0,  g:229,b:255 },
  alpha: { label:"ALPHA", hz:10, carrier:160, color:"#b57bee", glow:"rgba(181,123,238,0.45)",tag:"Calm reading",   r:181,g:123,b:238 },
  theta: { label:"THETA", hz:6,  carrier:140, color:"#00ffb3", glow:"rgba(0,255,179,0.45)",  tag:"Deep rest",      r:0,  g:255,b:179 },
};
const PHASES = {
  focus:      { label:"FOCUS",       mins:25, freqKey:"beta"  },
  shortBreak: { label:"SHORT BREAK", mins:5,  freqKey:"theta" },
  longBreak:  { label:"LONG BREAK",  mins:15, freqKey:"alpha" },
};

// ── Rounded rect helper (replaces canvas.roundRect) ────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Audio ──────────────────────────────────────────────────────────────────
function makeAudio(ctx, freqKey, vol) {
  const f = FREQS[freqKey];
  const master = ctx.createGain(); master.gain.value = vol;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
  const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = f.carrier;
  const modG = ctx.createGain(); modG.gain.value = 0.5;
  const mod = ctx.createOscillator(); mod.type = "sine"; mod.frequency.value = f.hz;
  const dep = ctx.createGain(); dep.gain.value = 0.5;
  mod.connect(dep); dep.connect(modG.gain); osc.connect(modG); modG.connect(master);
  const sz = ctx.sampleRate * 2;
  const nb = ctx.createBuffer(1, sz, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
  for (let i=0;i<sz;i++) {
    const w=Math.random()*2-1;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    nd[i]=(b0+b1+b2+b3+b4+b5+w*0.5362)*0.038;
  }
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const ng = ctx.createGain(); ng.gain.value = 0.05;
  ns.connect(ng); ng.connect(master);
  master.connect(analyser); analyser.connect(ctx.destination);
  osc.start(); mod.start(); ns.start();
  return { nodes:[osc,mod,ns], master, analyser };
}

// ── Gemini API ─────────────────────────────────────────────────────────────
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

async function callClaude(msgs, sys, signal) {
  if (!GEMINI_KEY) throw new Error("Missing VITE_GEMINI_KEY.");
  const contents = msgs.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body = { contents };
  if (sys) body.system_instruction = { parts: [{ text: sys }] };
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal, // AbortController signal — cancels in-flight requests
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// Cancel any in-flight API call and return a fresh signal
function freshSignal(abortRef) {
  abortRef.current?.abort();
  const ctrl = new AbortController();
  abortRef.current = ctrl;
  return ctrl.signal;
}

// ── Typewriter ─────────────────────────────────────────────────────────────
function useTypewriter(text, speed = 15) {
  const [out, setOut] = useState("");
  useEffect(() => {
    let id;
    const start = setTimeout(() => {
      setOut("");
      if (!text) return;
      let i = 0;
      id = setInterval(() => {
        setOut(text.slice(0, ++i));
        if (i >= text.length) clearInterval(id);
      }, speed);
    }, 0);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [text, speed]);
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
export default function App({ onGoHome }) {
  const { user, isGuest, signOut } = useAuth();
  const { t } = useTranslation();
  // ── State ────────────────────────────────────────────────────────────
  const [screen, setScreen]       = useState("setup");
  const [isMobile, setIsMobile]   = useState(false);
  const [material, setMaterial]   = useState("");
  const [freqKey, setFreqKey]     = useState("beta");
  const [aiReason, setAiReason]   = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [setupErr, setSetupErr]   = useState("");

  const [pomPhase, setPomPhase]   = useState("focus");
  const [timeLeft, setTimeLeft]   = useState(25 * 60);
  const [totalSecs, setTotalSecs] = useState(25 * 60);
  const [running, setRunning]     = useState(false);
  const [sessions, setSessions]   = useState(0);
  const [volume, setVolume]       = useState(0.22);
  const [audioOn, setAudioOn]     = useState(false);

  const [voiceOpen, setVoiceOpen]       = useState(false);
  const [voiceState, setVoiceState]     = useState("idle");
  const [interim, setInterim]           = useState("");
  const [messages, setMessages]         = useState([]);
  const [weakAreas, setWeakAreas]       = useState({});
  const [micAllowed, setMicAllowed]     = useState(null);
  const [speechOK]                      = useState(() => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [voiceCount, setVoiceCount]     = useState(0);
  const [isContinuous, setIsContinuous]   = useState(false);
  const [textInput, setTextInput]         = useState("");
  const [voiceError, setVoiceError]       = useState("");
  const [audioWasPaused, setAudioWasPaused] = useState(false); // state mirror of wasRunningRef for JSX

  const [debriefStep, setDebriefStep]       = useState("rating");
  const [focusRating, setFocusRating]       = useState(0);
  const [hoverRating, setHoverRating]       = useState(0);
  const [covered, setCovered]               = useState("");
  const [quizData, setQuizData]             = useState(null);
  const [quizLoading, setQuizLoading]       = useState(false);
  const [quizError, setQuizError]           = useState("");
  const [answers, setAnswers]               = useState({});
  const [revealed, setRevealed]             = useState({});
  const [insight, setInsight]               = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError]     = useState("");
  const [sessionLog, setSessionLog]         = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  // ── Quiz adaptive system ──
  const [quizCount, setQuizCount]           = useState(3);   // configurable 3/5/7/10
  const [quizRound, setQuizRound]           = useState(1);
  const [quizHistory, setQuizHistory]       = useState([]);  // [{round,score,total,difficulty}]
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [, setQuizContinuing] = useState(false);
  const [quizRoundStart, setQuizRoundStart] = useState(0);
  const [testedTopics, setTestedTopics]     = useState([]);  // topics tested so far
  // ── Follow-up system ──
  const [followUp, setFollowUp]             = useState(null); // {type:"question"|"tip", text}
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────
  const actx        = useRef(null);
  const aNodes      = useRef(null);
  const aGain       = useRef(null);
  const aAnal       = useRef(null);
  const micAnal     = useRef(null);
  const micStream   = useRef(null);
  const recog       = useRef(null);
  const timerRef    = useRef(null);
  const animRef     = useRef(null);
  const tRef        = useRef(0);
  const vsRef       = useRef("idle");      // voice state ref for animation loop
  const freqRef     = useRef(FREQS.beta);  // freq ref for animation loop
  const runRef      = useRef(false);
  const audioOnRef  = useRef(false);
  const pctRef      = useRef(1);           // progress pct ref for animation loop
  const abortRef    = useRef(null);        // AbortController for in-flight API calls
  const blobCanvasRef = useRef(null);
  const specCanvasRef = useRef(null);
  const partCanvasRef = useRef(null);
  const orbCanvasRef  = useRef(null);
  const chatHist         = useRef([]);
  const particles        = useRef([]);
  const isContinuousRef  = useRef(false);  // ref mirror of isContinuous for callbacks
  const isProcessingRef  = useRef(false);  // prevents duplicate concurrent sends
  const silenceTimerRef  = useRef(null);   // detects silence timeout in continuous mode
  const pendingUtterRef  = useRef("");     // queues speech heard while AI is responding
  const lastFollowUpRef  = useRef([]);     // last 3 topic strings — prevents repeat follow-ups
  const recogSessionRef    = useRef(null);   // stable ref to startRecognitionSession
  const wasRunningRef      = useRef(false);  // was audio playing before voice panel opened?
  const sessionStartRef    = useRef(null);   // timestamp when current Pomodoro started
  const sessionDurationRef = useRef(0);      // actual elapsed seconds when debrief triggered
  const chatScrollRef      = useRef(null);
  const coveredRef         = useRef(null);
  const lastFollowUpAtRef  = useRef(0);
  const generateFollowUpRef = useRef(null);
  const sendMessageRef = useRef(null);

  const { onSessionComplete, onQuizComplete } = useStudyDataSync({
    material,
    freqKey,
    weakAreas,
  });

  const freq  = FREQS[freqKey];
  const phase = PHASES[pomPhase];
  const pct   = totalSecs > 0 ? timeLeft / totalSecs : 1;
  const typed = useTypewriter(insight, 14);
  const quizLength = quizData?.length || 0;
  const currentRoundStart = Math.min(quizRoundStart, quizLength);
  const currentRoundQuestions = quizData?.slice(currentRoundStart) || [];
  const currentRoundTotal = currentRoundQuestions.length;
  const scoreCount = Object.entries(answers)
    .filter(([i, a]) => Number(i) >= currentRoundStart && quizData?.[i] && a === quizData[i].answer).length;
  const currentRoundComplete = currentRoundTotal > 0
    && currentRoundQuestions.every((_, i) => revealed[currentRoundStart + i]);
  const weakList = Object.entries(weakAreas).filter(([,v]) => v >= 2).map(([k]) => k);
  const recentSessionItems = recentSessions.length
    ? recentSessions.map((s, i) => ({
        session: recentSessions.length - i,
        nextFocus: s.next_focus_topic || s.material || "Recent study session",
        voiceQ: s.voice_questions || 0,
        time: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "",
      }))
    : sessionLog.slice(-3).reverse();

  // keep refs in sync
  useEffect(() => { vsRef.current = voiceState; }, [voiceState]);
  useEffect(() => { freqRef.current = FREQS[freqKey]; }, [freqKey]);
  useEffect(() => { runRef.current = running; }, [running]);
  useEffect(() => { audioOnRef.current = audioOn; }, [audioOn]);
  useEffect(() => { pctRef.current = pct; }, [pct]);
  useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);

  useEffect(() => {
    if (debriefStep === "covered") {
      window.setTimeout(() => coveredRef.current?.focus(), 60);
    }
  }, [debriefStep]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, followUp, followUpLoading, interim]);

  const loadRecentSessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      setRecentSessions(await getRecentStudySessions(user.id, 3));
    } catch (error) {
      console.warn("[Sessions] recent load failed:", error);
    }
  }, [user]);

  // ── Init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    particles.current = Array.from({ length: 50 }, () => ({
      x: Math.random() * 560, y: Math.random() * 500,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.4 + 0.4, op: Math.random() * 0.3 + 0.08,
    }));
  }, []);

  useEffect(() => {
    if (screen !== "debrief" || debriefStep !== "insight") return;
    const id = setTimeout(loadRecentSessions, 0);
    return () => clearTimeout(id);
  }, [screen, debriefStep, loadRecentSessions]);

  // ── Master draw loop ──────────────────────────────────────────────────
  useEffect(() => {
    const drawBlob = (canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const R = 108, t = tRef.current;
      const f = freqRef.current;
      const amp = 11 + (runRef.current ? 5 : 0);
      const n = 10;
      ctx.clearRect(0, 0, W, H);

      // Radial bg glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160);
      grd.addColorStop(0, `rgba(${f.r},${f.g},${f.b},0.07)`);
      grd.addColorStop(1, `rgba(${f.r},${f.g},${f.b},0)`);
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, 160, 0, Math.PI * 2); ctx.fill();

      // Build blob points
      const buildPts = (r2, tOff, ampMul) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const noise = Math.sin((t + tOff) * 1.2 + i * 0.7) * amp * ampMul
                      + Math.cos((t + tOff) * 0.8 + i * 1.4) * amp * ampMul * 0.6
                      + Math.sin((t + tOff) * 2.1 + i * 0.3) * amp * ampMul * 0.3;
          pts.push([cx + Math.cos(angle) * (r2 + noise), cy + Math.sin(angle) * (r2 + noise)]);
        }
        return pts;
      };
      const drawBlobPath = (pts, fillA, strokeA, width) => {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
          const c1x = p1[0] + (p2[0] - p0[0]) * 0.28, c1y = p1[1] + (p2[1] - p0[1]) * 0.28;
          const c2x = p2[0] - (p3[0] - p1[0]) * 0.28, c2y = p2[1] - (p3[1] - p1[1]) * 0.28;
          if (i === 0) ctx.moveTo(p1[0], p1[1]);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
        }
        ctx.closePath();
        if (fillA > 0) { ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${fillA})`; ctx.fill(); }
        if (strokeA > 0) { ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${strokeA})`; ctx.lineWidth = width; ctx.stroke(); }
      };

      // Outer ghost blob
      drawBlobPath(buildPts(R + 18, 1.2, 0.5), 0, 0.08, 1);
      // Main blob
      drawBlobPath(buildPts(R, 0, 1), 0.05, runRef.current ? 0.7 : 0.28, 1.5);

      // Progress ring — use pctRef to avoid stale closure from [] deps
      const safeP = Math.max(0, Math.min(1, pctRef.current));
      ctx.beginPath();
      ctx.arc(cx, cy, R + 22, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI);
      ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},0.06)`;
      ctx.lineWidth = 2; ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R + 22, -Math.PI / 2, -Math.PI / 2 + safeP * 2 * Math.PI);
      ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${runRef.current ? 0.9 : 0.45})`;
      ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke(); ctx.lineCap = "butt";

      // Tick marks
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const r1 = R + 27, r2 = R + 30;
        ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},0.18)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
      }
    };

    const drawSpec = (canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const f = freqRef.current;
      ctx.clearRect(0, 0, W, H);
      const bars = 48, bw = W / bars;
      if (!aAnal.current) {
        for (let i = 0; i < bars; i++) {
          const h = 3 + Math.sin(tRef.current * 1.5 + i * 0.4) * 2.5;
          ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},0.12)`;
          roundRect(ctx, i * bw + bw * 0.12, H / 2 - h / 2, bw * 0.76, h, 2);
          ctx.fill();
        }
        return;
      }
      const data = new Uint8Array(aAnal.current.frequencyBinCount);
      aAnal.current.getByteFrequencyData(data);
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor(i * data.length / bars / 3)] / 255;
        const h = Math.max(3, v * H * 0.88);
        const alpha = 0.18 + v * 0.82;
        ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${alpha})`;
        roundRect(ctx, i * bw + bw * 0.1, H / 2 - h / 2, bw * 0.8, h, 3);
        ctx.fill();
      }
    };

    const drawParticles = (canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const f = freqRef.current;
      ctx.clearRect(0, 0, W, H);
      const boost = audioOnRef.current ? 2.2 : 1;
      const pts = particles.current;
      pts.forEach(p => {
        p.x += p.vx * boost; p.y += p.vy * boost;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${p.op * (audioOnRef.current ? 1.5 : 0.6)})`;
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 88) {
            ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${(1 - dist / 88) * 0.07})`;
            ctx.lineWidth = 0.5; ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
    };

    const drawOrb = (canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const f = freqRef.current;
      const state = vsRef.current;
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);
      const pulse = 1 + Math.sin(t * 1.8) * 0.04;

      if (state === "listening") {
        for (let i = 0; i < 5; i++) {
          const ph = ((t * 1.8 + i * 0.22) % 1);
          const r = 44 + ph * 88;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${(1 - ph) * 0.5})`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }
        if (micAnal.current) {
          const md = new Uint8Array(micAnal.current.frequencyBinCount);
          micAnal.current.getByteFrequencyData(md);
          for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
            const v = md[Math.floor(i * md.length / 64)] / 255;
            ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${0.3 + v * 0.7})`;
            ctx.lineWidth = 2; ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * 46, cy + Math.sin(angle) * 46);
            ctx.lineTo(cx + Math.cos(angle) * (46 + 6 + v * 28), cy + Math.sin(angle) * (46 + 6 + v * 28));
            ctx.stroke();
          }
        }
      }
      if (state === "thinking") {
        const start = t * 3;
        ctx.beginPath(); ctx.arc(cx, cy, 56, start, start + Math.PI * 1.2);
        ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},0.75)`; ctx.lineWidth = 2; ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t * 2;
          const alpha = (Math.sin(t * 4 + i * 1.1) + 1) / 2 * 0.7;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${alpha})`; ctx.fill();
        }
      }
      if (state === "speaking") {
        for (let ring = 0; ring < 4; ring++) {
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2; a += 0.05) {
            const wave = Math.sin(a * 7 + t * 5 + ring * 1.8) * (7 - ring * 1.5);
            const rr = 44 + ring * 15 + wave;
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
            a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${0.55 - ring * 0.1})`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }
      }

      // Core circle
      ctx.beginPath(); ctx.arc(cx, cy, 36 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${state === "idle" ? 0.06 : 0.14})`; ctx.fill();
      ctx.strokeStyle = `rgba(${f.r},${f.g},${f.b},${state === "idle" ? 0.28 : 0.8})`;
      ctx.lineWidth = 1.5; ctx.stroke();

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${state === "idle" ? 0.2 : 0.75})`; ctx.fill();

      // Glow
      if (state !== "idle") {
        const g2 = ctx.createRadialGradient(cx, cy, 10, cx, cy, 75);
        g2.addColorStop(0, `rgba(${f.r},${f.g},${f.b},0.14)`);
        g2.addColorStop(1, `rgba(${f.r},${f.g},${f.b},0)`);
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx, cy, 75, 0, Math.PI * 2); ctx.fill();
      }
    };

    const tick = () => {
      animRef.current = requestAnimationFrame(tick);
      tRef.current += 0.012;
      drawBlob(blobCanvasRef.current);
      drawSpec(specCanvasRef.current);
      drawParticles(partCanvasRef.current);
      drawOrb(orbCanvasRef.current);
    };
    tick();
    return () => cancelAnimationFrame(animRef.current);
  }, []); // run once — refs handle all dynamic values

  // ── Volume sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (aGain.current && actx.current)
      aGain.current.gain.setValueAtTime(volume, actx.current.currentTime);
  }, [volume]);

  // ── Audio control ─────────────────────────────────────────────────────
  // Cancel in-flight API calls on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const stopAudio = useCallback(() => {
    aNodes.current?.nodes.forEach(n => { try { n.stop(); } catch { /* ignore stopped nodes */ } });
    aNodes.current = null; aAnal.current = null; aGain.current = null;
    setAudioOn(false);
  }, []);

  const startAudio = useCallback((fk, vol) => {
    if (!actx.current) actx.current = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.current.state === "suspended") actx.current.resume();
    stopAudio();
    const b = makeAudio(actx.current, fk, vol);
    aNodes.current = b; aAnal.current = b.analyser; aGain.current = b.master;
    setAudioOn(true);
  }, [stopAudio]);

  // ── Timer ─────────────────────────────────────────────────────────────
  const triggerDebrief = useCallback(() => {
    setRunning(false); stopAudio();
    if (pomPhase === "focus") {
      // Capture actual duration before any state resets
      if (sessionStartRef.current) {
        sessionDurationRef.current = Math.round((Date.now() - sessionStartRef.current) / 1000);
        sessionStartRef.current = null;
      } else {
        // Fallback: use timer progress
        sessionDurationRef.current = totalSecs - timeLeft;
      }
      setSessions(s => s + 1);
      setScreen("debrief");
      setDebriefStep("rating"); setFocusRating(0); setCovered("");
      setQuizData(null); setAnswers({}); setRevealed({}); setInsight("");
    } else {
      sessionStartRef.current = null;
      sessionDurationRef.current = 0;
      setPomPhase("focus"); setFreqKey("beta");
      const d = 25 * 60; setTimeLeft(d); setTotalSecs(d);
    }
  }, [pomPhase, stopAudio, timeLeft, totalSecs]);

  useEffect(() => {
    if (!running) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { triggerDebrief(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, triggerDebrief]);

  // ── Mic setup ─────────────────────────────────────────────────────────
  const setupMic = useCallback(async () => {
    try {
      // Disable AEC/noise suppression — prevents browser from ducking audio output
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl:  false,
        },
      });
      micStream.current = stream;
      // Separate AudioContext for mic — prevents AEC loop with playback AudioContext
      const micCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = micCtx.createMediaStreamSource(stream);
      const an = micCtx.createAnalyser(); an.fftSize = 256;
      src.connect(an); micAnal.current = an;
      micStream.current._micCtx = micCtx;
      setMicAllowed(true);
    } catch (e) {
      console.warn("[Mic] getUserMedia failed:", e.message);
      setMicAllowed(false);
    }
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    window.speechSynthesis.cancel();

    // voices may not be loaded yet — wait if needed
    const trySpeak = (voices) => {
      const u = new SpeechSynthesisUtterance(text);

      // Priority list: best natural-sounding free voices across platforms
      const preferred = [
        "Samantha",           // macOS — best built-in voice
        "Google US English",  // Chrome on Windows/Android
        "Google UK English Female",
        "Karen",              // macOS alternative
        "Moira",              // macOS Irish English — warm tone
        "Tessa",              // macOS South African — clear
        "Fiona",              // macOS Scottish
        "Victoria",           // macOS
        "Daniel",             // macOS UK male
        "Microsoft Aria",     // Windows 11 — very natural
        "Microsoft Jenny",    // Windows 11
        "Microsoft Zira",     // Windows fallback
      ];

      let chosen = null;
      for (const name of preferred) {
        chosen = voices.find(v => v.name.includes(name));
        if (chosen) break;
      }

      // Fallback: prefer en-US voices over others
      if (!chosen) {
        chosen = voices.find(v => v.lang === "en-US" && v.localService)
               || voices.find(v => v.lang.startsWith("en"));
      }

      if (chosen) u.voice = chosen;

      // Tuned for natural, clear speech — not too fast, not robotic
      u.rate  = 1.08;   // slightly faster than default feels more natural
      u.pitch = 1.0;    // neutral pitch
      u.volume = 1.0;

      u.onstart = () => setVoiceState("speaking");
      u.onend   = () => { setVoiceState("idle"); onDone?.(); };
      u.onerror = () => setVoiceState("idle");
      window.speechSynthesis.speak(u);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      trySpeak(voices);
    } else {
      // Voices not loaded yet — wait for them
      window.speechSynthesis.onvoiceschanged = () => {
        trySpeak(window.speechSynthesis.getVoices());
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // ── Core: send any text (voice OR typed) to AI ───────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    if (isProcessingRef.current) { pendingUtterRef.current = text; return; }
    isProcessingRef.current = true;
    setVoiceError("");
    setVoiceState("thinking");
    const userMsg = { role: "user", content: text };
    chatHist.current = [...chatHist.current, userMsg];
    setMessages(prev => [...prev, { role: "user", text }]);
    setVoiceCount(c => c + 1);
    try {
      const signal = freshSignal(abortRef);
      const sys = `You are a concise AI study companion. The student is studying: "${material}". Keep answers under 3 sentences. Do not use markdown formatting. After your answer add a new line: TOPICS: comma-separated topics you just discussed.`;
      const reply = await callClaude(chatHist.current, sys, signal);
      const topicMatch = reply.match(/TOPICS:\s*(.+)/i);
      const clean = reply.replace(/\nTOPICS:.*/i, "").replace(/[*#`]/g, "").trim();
      if (topicMatch) {
        const topics = topicMatch[1].split(",").map(t => t.trim().toLowerCase());
        setWeakAreas(prev => {
          const next = { ...prev };
          topics.forEach(t => { next[t] = (next[t] || 0) + 1; });
          return next;
        });
      }
      chatHist.current = [...chatHist.current, { role: "assistant", content: clean }];
      setMessages(prev => [...prev, { role: "assistant", text: clean }]);
      speak(clean, () => {
        isProcessingRef.current = false;
        if (pendingUtterRef.current) {
          const queued = pendingUtterRef.current;
          pendingUtterRef.current = "";
          sendMessageRef.current?.(queued);
        } else if (isContinuousRef.current) {
          setVoiceState("listening");
          recogSessionRef.current?.(true); // use ref to avoid stale closure
        } else {
          setVoiceState("idle");
        }
      });
      // Generate follow-up asynchronously (non-blocking, does not affect voice flow)
      generateFollowUpRef.current?.(clean, chatHist.current);
    } catch (e) {
      isProcessingRef.current = false;
      if (e.name !== "AbortError") {
        isProcessingRef.current = false;
        setVoiceState(isContinuousRef.current ? "listening" : "idle");
        setVoiceError("Connection issue — check your internet and try again.");
        setMessages(prev => [...prev, { role: "assistant", text: "Connection issue — please try again." }]);
        if (isContinuousRef.current) recogSessionRef.current?.(true);
      }
    }
  }, [material, speak]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // ── Internal: create & start one recognition session ─────────────────
  const startRecognitionSession = useCallback((resuming = false) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recog.current) { try { recog.current.abort(); } catch { /* ignore abort races */ } recog.current = null; }
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = "en-US"; r.maxAlternatives = 1;

    const resetSilenceTimer = () => {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (isContinuousRef.current && vsRef.current === "listening" && !isProcessingRef.current) {
          recogSessionRef.current?.(true);
        }
      }, 5000);
    };

    r.onstart = () => { if (!resuming) setInterim(""); setVoiceState("listening"); setVoiceError(""); resetSilenceTimer(); };
    r.onresult = (e) => {
      resetSilenceTimer();
      let final = "", inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else inter += e.results[i][0].transcript;
      }
      if (inter) setInterim(inter);
      if (final.trim()) {
        setInterim("");
        if (!isProcessingRef.current) sendMessage(final.trim());
        else pendingUtterRef.current = final.trim();
      }
    };
    r.onerror = (e) => {
      clearTimeout(silenceTimerRef.current);
      setInterim("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicAllowed(false);
        setVoiceError("Microphone access denied. Enable permissions in browser settings & refresh.");
        setIsContinuous(false); isContinuousRef.current = false; setVoiceState("idle");
      } else if (e.error === "no-speech") {
        if (isContinuousRef.current && !isProcessingRef.current) recogSessionRef.current?.(true);
        else setVoiceState("idle");
      } else if (e.error === "aborted") {
        // intentional — ignore
      } else {
        setVoiceError(`Mic error: ${e.error}. Tap to retry.`);
        if (!isContinuousRef.current) setVoiceState("idle");
      }
    };
    r.onend = () => {
      clearTimeout(silenceTimerRef.current);
      if (isContinuousRef.current && vsRef.current === "listening" && !isProcessingRef.current) {
        setTimeout(() => recogSessionRef.current?.(true), 150);
      } else if (!isContinuousRef.current && vsRef.current === "listening") {
        setVoiceState("idle");
      }
    };
    recog.current = r;
    try { r.start(); } catch (e) {
      if (e.name === "InvalidStateError") setTimeout(() => recogSessionRef.current?.(resuming), 200);
    }
  }, [sendMessage]);

  // Keep recogSessionRef pointing to latest startRecognitionSession (fixes stale closure)
  useEffect(() => { recogSessionRef.current = startRecognitionSession; }, [startRecognitionSession]);

  // ── Public: single-tap listen ─────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!speechOK) { setVoiceError("Speech recognition not supported. Use Chrome or Edge."); return; }
    setVoiceError(""); setIsContinuous(false); isContinuousRef.current = false;
    startRecognitionSession(false);
  }, [speechOK, startRecognitionSession]);

  // ── Public: toggle continuous mode ────────────────────────────────────
  const toggleContinuous = useCallback(() => {
    if (!speechOK) { setVoiceError("Speech recognition not supported. Use Chrome or Edge."); return; }
    const next = !isContinuousRef.current;
    setIsContinuous(next); isContinuousRef.current = next; setVoiceError("");
    if (next) {
      if (recogSessionRef.current) recogSessionRef.current(false);
      else startRecognitionSession(false);
    } else {
      clearTimeout(silenceTimerRef.current);
      if (recog.current) { try { recog.current.abort(); } catch { /* ignore abort races */ } recog.current = null; }
      if (vsRef.current !== "thinking" && vsRef.current !== "speaking") setVoiceState("idle");
      setInterim("");
    }
  }, [speechOK, startRecognitionSession]);

  // ── Public: text fallback ─────────────────────────────────────────────
  const sendTextMessage = useCallback(() => {
    const t = textInput.trim(); if (!t) return;
    setTextInput(""); sendMessage(t);
  }, [textInput, sendMessage]);

  // ── Follow-up generation (non-blocking, fires after each AI reply) ────
  const generateFollowUp = useCallback(async (lastReply, history) => {
    if (!voiceOpen || !material.trim()) return;
    const now = Date.now();
    if (now - lastFollowUpAtRef.current < 3000) return;
    lastFollowUpAtRef.current = now;
    // Only generate ~60% of the time to avoid spam
    if (Math.random() > 0.6) { setFollowUp(null); return; }
    // Prevent repetition: hash last reply to compare
    const replyKey = lastReply.slice(0, 40);
    if (lastFollowUpRef.current.includes(replyKey)) { setFollowUp(null); return; }
    lastFollowUpRef.current = [...lastFollowUpRef.current.slice(-2), replyKey];
    setFollowUpLoading(true);
    try {
      const recentTopics = history.slice(-4).map(m => m.content).join(" | ");
      const raw = await callClaude(
        [{ role:"user", content:`Student studying "${material}". Recent conversation: "${recentTopics}". Generate ONE short follow-up: either a thought-provoking question OR a practical tip. Alternate between types. Keep it under 15 words. JSON: {"type":"question"|"tip","text":"<text>"}` }],
        "You are a study coach. JSON only. No markdown."
      );
      const p = JSON.parse(raw.replace(/```json|```/g,"").trim());
      if (p.text && p.type) setFollowUp(p);
      else setFollowUp(null);
    } catch { setFollowUp(null); }
    finally { setFollowUpLoading(false); }
  }, [material, voiceOpen]);

  useEffect(() => {
    generateFollowUpRef.current = generateFollowUp;
  }, [generateFollowUp]);

  const dismissFollowUp = useCallback(() => setFollowUp(null), []);

  const acceptFollowUp = useCallback(() => {
    if (!followUp) return;
    const text = followUp.text;
    setFollowUp(null);
    sendMessage(text);
  }, [followUp, sendMessage]);

  const stopListening = useCallback(() => {
    recog.current?.stop();
    setVoiceState("idle"); setInterim("");
  }, []);

  const openVoice = useCallback(async () => {
    if (micAllowed === null) await setupMic();
    // Pause frequency audio while mic is active — prevents AEC suppression
    wasRunningRef.current = runRef.current;
    setAudioWasPaused(runRef.current);
    if (runRef.current) stopAudio();
    setVoiceOpen(true);
  }, [micAllowed, setupMic, stopAudio]);

  const closeVoice = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    setIsContinuous(false); isContinuousRef.current = false;
    isProcessingRef.current = false; pendingUtterRef.current = "";
    // Stop speech recognition
    if (recog.current) { try { recog.current.abort(); } catch { /* ignore abort races */ } recog.current = null; }
    // Stop ALL mic tracks — releases the browser mic indicator light
    if (micStream.current) {
      try { micStream.current._micCtx?.close?.(); } catch { /* ignore closed audio context */ }
      try { micStream.current.getTracks().forEach(t => t.stop()); } catch { /* ignore stopped tracks */ }
      micStream.current = null;
      micAnal.current = null;
      setMicAllowed(null); // force re-request next time voice opens
    }
    window.speechSynthesis.cancel();
    setVoiceOpen(false); setVoiceState("idle"); setInterim(""); setVoiceError("");
    setAudioWasPaused(false);
    // Resume frequency audio after mic fully released (200ms gap ensures no overlap)
    if (wasRunningRef.current) {
      const fk = Object.keys(FREQS).find(k => FREQS[k].color === freqRef.current?.color) || "beta";
      setTimeout(() => startAudio(fk, volume), 200);
    }
    wasRunningRef.current = false;
  }, [startAudio, volume]);

  // ── Setup analyze ─────────────────────────────────────────────────────
  const analyzeMaterial = async () => {
    if (!material.trim()) { setSetupErr("Describe your study material first."); return; }
    setSetupErr(""); setAnalyzing(true);
    const signal = freshSignal(abortRef);
    try {
      const raw = await callClaude(
        [{ role: "user", content: `Student studying: "${material}". Pick ONE: gamma/beta/alpha/theta. JSON only no markdown: {"profile":"<key>","reason":"<1 sentence>"}` }],
        "Respond with valid JSON only. No markdown, no backticks, no explanation.",
        signal
      );
      const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setFreqKey(p.profile || "beta"); setAiReason(p.reason || "");
      const d = 25 * 60; setTimeLeft(d); setTotalSecs(d);
      setPomPhase("focus"); setScreen("session");
    } catch (e) {
      if (e.name !== "AbortError") setSetupErr(`Analysis failed — ${e.message || "try again."}`);
    }
    finally { setAnalyzing(false); }
  };

  // ── Adaptive difficulty calculator ───────────────────────────────────
  const computeDifficulty = useCallback((history) => {
    if (!history.length) return "medium";
    const last = history[history.length - 1];
    const pct = last.total > 0 ? last.score / last.total : 0;
    if (pct >= 0.8) return "hard";
    if (pct >= 0.5) return "medium";
    return "easy";
  }, []);

  // ── Load quiz (first round or continued round) ────────────────────────
  const loadQuiz = useCallback(async (isContinue = false, overrideDifficulty = null) => {
    setDebriefStep("quiz"); setQuizLoading(true); setQuizError("");
    if (!isContinue) {
      // Fresh quiz: reset everything
      setAnswers({}); setRevealed({}); setQuizRound(1);
      setQuizHistory([]); setQuizDifficulty("medium");
      setTestedTopics([]); setQuizContinuing(false); setQuizRoundStart(0);
    }
    const signal = freshSignal(abortRef);
    const difficultyInstructions = {
      easy: "Use straightforward conceptual questions. Make the correct answer clearly distinguishable. Focus on definitions and basic understanding.",
      medium: "Use standard questions requiring real understanding. Include one plausible distractor per question.",
      hard: "Use nuanced, application-level questions. Include tricky distractors. Test edge cases and deeper understanding.",
    };
    const avoidTopics = testedTopics.length
      ? `Avoid repeating these already-tested topics: ${testedTopics.join(", ")}.` : "";
    const currentDiff = isContinue ? (overrideDifficulty || quizDifficulty) : "medium";
    try {
      const raw = await callClaude(
        [{ role:"user", content:`Student studied "${material}", covered "${covered || "general review"}". Generate exactly ${quizCount} multiple-choice questions. Difficulty: ${currentDiff} — ${difficultyInstructions[currentDiff]} ${avoidTopics} JSON array only no markdown: [{"q":"<question>","options":["A","B","C","D"],"answer":0,"explanation":"<why correct>","topic":"<1-3 word topic tag>"}]` }],
        "Valid JSON array only. No markdown, no backticks.",
        signal
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Quiz response was empty.");
      if (isContinue) {
        // Append to existing quiz
        const nextStart = quizData?.length || 0;
        setQuizData(prev => [...(prev || []), ...parsed]);
        setQuizRoundStart(nextStart);
        setQuizContinuing(true);
      } else {
        setQuizData(parsed);
      }
      // Track topics tested
      const newTopics = parsed.map(q => q.topic).filter(Boolean);
      setTestedTopics(prev => [...new Set([...prev, ...newTopics])]);
    } catch (e) {
      if (e.name !== "AbortError") {
        setQuizData(prev => prev || []);
        setQuizError(e.message || "Couldn't generate quiz.");
      }
    }
    finally { setQuizLoading(false); }
  }, [covered, material, quizCount, quizData, quizDifficulty, testedTopics]);

  // ── Called when a round is fully answered ─────────────────────────────
  const completeQuizRound = useCallback((roundScore, roundTotal) => {
    const entry = { round: quizRound, score: roundScore, total: roundTotal, difficulty: quizDifficulty };
    const newHistory = [...quizHistory, entry];
    setQuizHistory(newHistory);
    const nextDiff = computeDifficulty(newHistory);
    setQuizDifficulty(nextDiff);
    setQuizRound(r => r + 1);
    return nextDiff;
  }, [quizRound, quizDifficulty, quizHistory, computeDifficulty]);

  // ── Continue: load more questions at new difficulty ───────────────────
  const continueQuiz = useCallback(async () => {
    // Score current round
    if (!quizData?.length) return;
    const roundAnswers = Object.entries(answers).filter(([i]) => Number(i) >= currentRoundStart);
    const roundScore = roundAnswers.filter(([i,a]) => quizData?.[i] && a === quizData[i].answer).length;
    const nextDiff = completeQuizRound(roundScore, currentRoundTotal);
    await loadQuiz(true, nextDiff);
  }, [quizData, answers, currentRoundStart, currentRoundTotal, completeQuizRound, loadQuiz]);

  const loadInsight = async () => {
    setDebriefStep("insight"); setInsightLoading(true); setInsightError(""); setInsight("");
    const wk = weakList.join(", ") || "none";
    const completedHistory = currentRoundComplete
      ? [...quizHistory, { round: quizRound, score: scoreCount, total: currentRoundTotal, difficulty: quizDifficulty }]
      : quizHistory;
    const histSummary = completedHistory.length
      ? completedHistory.map(h => `Round ${h.round}: ${h.score}/${h.total} (${h.difficulty})`).join(", ")
      : `${scoreCount}/${currentRoundTotal || quizData?.length || 0}`;
    try {
      const signal = freshSignal(abortRef);
      const raw = await callClaude(
        [{ role:"user", content:`Student studied "${material}", session ${sessions}, focus ${focusRating}/5, quiz history: ${histSummary}, voice questions: ${voiceCount}, weak areas: ${wk}. 2-sentence personalized insight mentioning their quiz progression + next focus topic. JSON only no markdown: {"insight":"<text>","nextFocus":"<topic>"}` }],
        "Warm study coach. JSON only. No markdown, no backticks.",
        signal
      );
      const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
      const insightText = p.insight || "Solid session. Keep the momentum going!";
      setInsight(insightText);
      setSessionLog(prev => [...prev, {
        session: sessions, rating: focusRating,
        score: histSummary, voiceQ: voiceCount,
        weakAreas: wk, nextFocus: p.nextFocus,
        difficulty: quizDifficulty,
        time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
      }]);

      // ── Save complete session to Supabase (all data available here) ──
      onSessionComplete({
        pomPhase: "focus",
        durationSeconds: sessionDurationRef.current || 0,
        focusRating,
        voiceQuestions: voiceCount,
        weakAreas: Object.keys(weakAreas),
        coveredTopics: covered,
        aiInsight: insightText,
        nextFocusTopic: p.nextFocus || "",
      });

      // ── Save quiz results ─────────────────────────────────────────────
      if (quizData?.length > 0) {
        onQuizComplete({
          roundNumber: quizRound,
          difficulty: quizDifficulty,
          score: scoreCount,
          totalQuestions: currentRoundTotal || quizData.length,
          topicsTested: currentRoundQuestions.map(q => q.topic).filter(Boolean),
          quizData: currentRoundQuestions.length ? currentRoundQuestions : quizData,
          answers,
          answerOffset: currentRoundStart,
        });
      }
      window.setTimeout(loadRecentSessions, 500);

    } catch (e) {
      if (e.name !== "AbortError") {
        setInsightError(e.message || "Couldn't load your insight.");
      }
    }
    finally { setInsightLoading(false); }
  };

  const startBreak = () => {
    const bp = sessions % 4 === 0 ? "longBreak" : "shortBreak";
    const fk = PHASES[bp].freqKey, d = PHASES[bp].mins * 60;
    setPomPhase(bp); setFreqKey(fk); setTimeLeft(d); setTotalSecs(d);
    sessionStartRef.current = null; // reset for break phase
    setScreen("session");
    setTimeout(() => {
      sessionStartRef.current = Date.now();
      setRunning(true); startAudio(fk, volume);
    }, 300);
  };

  const togglePlay = () => {
    if (running) {
      setRunning(false); stopAudio();
    } else {
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
      setRunning(true); startAudio(freqKey, volume);
    }
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const resetStudyState = (goHome = false) => {
    const hasActiveSession = running || timeLeft !== totalSecs || screen === "debrief" || voiceOpen;
    if (hasActiveSession && !window.confirm("End this session and change material?")) return;
    closeVoice();
    stopAudio(); setRunning(false);
    setScreen("setup"); setMaterial(""); setFreqKey("beta"); setAiReason("");
    setTimeLeft(25 * 60); setTotalSecs(25 * 60); setSessions(0); setVoiceCount(0);
    setMessages([]); chatHist.current = []; setWeakAreas({}); setFollowUp(null);
    setQuizData(null); setAnswers({}); setRevealed({}); setInsight(""); setQuizError(""); setInsightError("");
    sessionStartRef.current = null; sessionDurationRef.current = 0;
    if (goHome) onGoHome?.();
  };

  // ── Shared button styles ──────────────────────────────────────────────
  const iconBtn = (extra = {}) => ({
    width: 44, height: 44, borderRadius: "50%",
    border: "1px solid var(--border,rgba(255,255,255,0.09))",
    background: "transparent", cursor: "pointer",
    color: "var(--text3,#475569)", fontSize: 17,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s", ...extra,
  });

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #020810)", color: "var(--text1, #e2e8f0)",
      fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column",
      alignItems: "center", padding: "0 0 80px", position: "relative", overflow: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible{
          outline:2px solid var(--focus,#00e5ff);outline-offset:3px;
        }
        /* Theme-aware overrides via CSS custom properties */
        body[data-theme="light"]  { color-scheme: light; }
        body[data-theme="beige"]  { color-scheme: light; }
        body[data-theme="light"]  .glass,
        body[data-theme="beige"]  .glass  { background:var(--glass) !important; border-color:var(--border) !important; }
        body[data-theme="light"]  .opt,
        body[data-theme="beige"]  .opt    { background:var(--bg3) !important; color:var(--text2) !important; border-color:var(--border) !important; }
        body[data-theme="light"]  .opt:hover:not(:disabled),
        body[data-theme="beige"]  .opt:hover:not(:disabled) { background:var(--bg2) !important; color:var(--text1) !important; }
        body[data-theme="light"]  .fade,
        body[data-theme="beige"]  .fade   { color: var(--text1); }
        body[data-theme="light"] textarea,
        body[data-theme="beige"] textarea { background:var(--bg2) !important; color:var(--text1) !important; border-color:var(--border) !important; }
        body[data-theme="light"] textarea::placeholder,
        body[data-theme="beige"] textarea::placeholder { color:var(--text4) !important; }
        body[data-theme="light"] input[type="text"],
        body[data-theme="beige"] input[type="text"] { background:var(--bg2) !important; color:var(--text1) !important; border-color:var(--border) !important; }
        body[data-theme="light"] input[type="text"]::placeholder,
        body[data-theme="beige"] input[type="text"]::placeholder { color:var(--text4) !important; }

        .grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
          background-image:linear-gradient(var(--grid-line,rgba(255,255,255,0.013)) 1px,transparent 1px),
          linear-gradient(90deg,var(--grid-line,rgba(255,255,255,0.013)) 1px,transparent 1px);
          background-size:44px 44px;}
        /* Light/beige: freq card & glass backgrounds */
        body[data-theme="light"] .glass,
        body[data-theme="beige"] .glass {
          background: var(--glass) !important;
          border-color: var(--border) !important;
        }
        body[data-theme="light"] .opt,
        body[data-theme="beige"] .opt {
          background: var(--panel,rgba(248,250,252,0.92)) !important;
          color: var(--text2) !important;
          border-color: var(--border) !important;
        }
        body[data-theme="light"] .opt:hover:not(:disabled),
        body[data-theme="beige"] .opt:hover:not(:disabled) {
          background: var(--bg2) !important;
          color: var(--text1) !important;
          border-color: var(--border2) !important;
        }
        .fade{animation:fu 0.38s ease both}
        @keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
        @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes chipIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes dotPulse{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}
        @keyframes continuousPulse{0%,100%{box-shadow:0 0 0 0 var(--ac)}50%{box-shadow:0 0 0 8px transparent}}
        .glass{background:var(--glass,rgba(6,15,30,0.88));border:1px solid var(--border,rgba(255,255,255,0.07));border-radius:18px;backdrop-filter:blur(18px);}
        textarea{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
          border-radius:14px;color:#e2e8f0;font-family:'DM Sans',sans-serif;font-size:15px;
          padding:17px;resize:vertical;outline:none;line-height:1.7;transition:border-color 0.2s;}
        textarea:focus{border-color:rgba(100,200,255,0.3);}
        textarea::placeholder{color:#1a3050;}
        input[type=range]{-webkit-appearance:none;appearance:none;height:2px;border-radius:2px;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;cursor:pointer;border:2px solid #020810;}
        .opt{width:100%;padding:12px 15px;border-radius:12px;border:1px solid var(--border,rgba(255,255,255,0.07));
          background:var(--bg3,rgba(255,255,255,0.02));color:var(--text2,#94a3b8);cursor:pointer;text-align:left;
          font-family:'DM Sans',sans-serif;font-size:14px;transition:all 0.15s;line-height:1.6;}
        .opt:hover:not(:disabled){border-color:rgba(255,255,255,0.18);color:#e2e8f0;background:rgba(255,255,255,0.04);}
        .opt:disabled{cursor:default;}
        .opt-ok{border-color:#00ffb3!important;background:rgba(0,255,179,0.08)!important;color:#00ffb3!important;}
        .opt-no{border-color:#ff6b6b!important;background:rgba(255,107,107,0.07)!important;color:#ff6b6b!important;}
        .opt-dim{opacity:0.28;}
        .msg{animation:msgIn 0.28s ease both}
        .chip-in{animation:chipIn 0.32s cubic-bezier(.16,1,.3,1) both}
        .typing-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;animation:dotPulse 1s infinite}
        .typing-dot:nth-child(2){animation-delay:.15s}.typing-dot:nth-child(3){animation-delay:.3s}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#0f2744;border-radius:2px}
      `}</style>

      <div className="grid-bg" />

      {/* Particle bg canvas */}
      <canvas ref={partCanvasRef} width={560} height={500}
        aria-hidden="true"
        style={{ position:"fixed", top:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:isMobile?390:560, height:"100%", pointerEvents:"none", zIndex:0, opacity:0.6 }} />

      {/* Top bar */}
      <div style={{ width:"100%", maxWidth:isMobile?390:560, position:"relative", zIndex:2,
        padding:"18px 18px 0", display:"grid", gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center", gap:10 }}>
        <button
          onClick={() => resetStudyState(true)}
          aria-label="Back to FocusMind home"
          style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:"0.1em",
            color:"var(--text1,#f1f5f9)", background:"transparent", border:"none", cursor:"pointer",
            padding:0, transition:"opacity 0.2s", justifySelf:"start" }}
          onMouseEnter={e => e.currentTarget.style.opacity="0.7"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}
          title="Back to home">
          FOCUS<span style={{ color: freq.color }}>MIND</span>
        </button>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, minWidth:0 }}>
          {screen === "session" && running && (
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"var(--text4,#475569)", letterSpacing:"0.06em" }}>
              {fmt(timeLeft)}
            </span>
          )}
          <div style={{ width:6, height:6, borderRadius:"50%", background:freq.color,
            boxShadow:running?`0 0 10px ${freq.glow}`:"none",
            animation:running?"blink 2s ease infinite":"none" }} />
          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.1em", color:freq.color }}>
            {freq.label} {freq.hz}Hz
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6, minWidth:0 }}>
          <LanguageSelector compact />
          <ThemeToggle compact />
          {(user || isGuest) && (
            <button
              onClick={user ? signOut : () => resetStudyState(true)}
              aria-label={user ? "Sign out" : "Exit guest mode"}
              title={user ? "Sign out" : "Guest mode"}
              style={{ padding:"7px 9px", borderRadius:8,
                border:"1px solid var(--border,rgba(255,255,255,0.09))",
                background:"var(--bg3,transparent)", color:"var(--text3,#64748b)",
                cursor:"pointer", fontFamily:"'Space Mono',monospace", fontSize:9,
                letterSpacing:"0.06em", maxWidth:80, overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap" }}>
              {user ? "SIGN OUT" : "GUEST"}
            </button>
          )}
          {/* Theme + Mobile toggles */}
        <button
          onClick={() => setIsMobile(m => !m)}
          aria-label={isMobile ? "Switch preview to desktop width" : "Switch preview to mobile width"}
          title={isMobile ? "Switch to Desktop" : "Switch to Mobile"}
          style={{ width:32, height:32, borderRadius:8, border:`1px solid ${isMobile ? freq.color+"55" : "rgba(255,255,255,0.09)"}`,
            background:isMobile ? freq.color+"12" : "transparent", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, transition:"all 0.2s", color:isMobile ? freq.color : "#475569" }}>
          {isMobile ? "📱" : "🖥️"}
        </button>
        </div>
      </div>

      <div style={{ width:"100%", maxWidth:isMobile?390:560, position:"relative", zIndex:1 }}>

        {/* ══════ SETUP ══════ */}
        {screen === "setup" && (
          <div className="fade" style={{ padding:"0 20px" }}>
            <div style={{ padding:"34px 0 26px", textAlign:"center" }}>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:"0.22em", color:"var(--text5,#64748b)", marginBottom:10 }}>
                AI · FREQUENCY · POMODORO · VOICE
              </div>
              <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(50px,11vw,80px)",
                lineHeight:0.9, letterSpacing:"0.04em", color:"#f1f5f9" }}>
                {t("setup.headline1")}<br/><span style={{ color:freq.color, textShadow:`0 0 40px ${freq.glow}` }}>{t("setup.headline2")}</span>
              </h1>
              <p style={{ color:"var(--muted,#64748b)", fontSize:13, marginTop:14, lineHeight:1.7 }}>
                AI frequency match · Pomodoro focus · Voice study companion
              </p>
            </div>

            <div className="glass" style={{ padding:24, marginBottom:12 }}>
              <div style={{ fontSize:9, color:"var(--text5,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:10 }}>
                {t("setup.label")}
              </div>
              <textarea rows={4} value={material} onChange={e => setMaterial(e.target.value)}
                aria-label="Study material" maxLength={2000}
                placeholder="e.g. Organic chemistry — SN1/SN2 reaction mechanisms for my Friday exam..." />
              <div style={{ marginTop:7, textAlign:"right", fontSize:9,
                color:"var(--text5,#64748b)", fontFamily:"'Space Mono',monospace",
                letterSpacing:"0.08em" }}>
                {material.length}/2000
              </div>
              {setupErr && <p style={{ color:"#ff6b6b", fontSize:13, marginTop:8 }}>{setupErr}</p>}
              <button onClick={analyzeMaterial} disabled={analyzing}
                aria-label="Analyze study material and choose a focus frequency"
                style={{ marginTop:14, width:"100%", padding:"15px", borderRadius:13, border:"none",
                  background:analyzing ? "rgba(0,229,255,0.07)" : freq.color,
                  color:analyzing ? freq.color : "#020810",
                  cursor:analyzing ? "not-allowed" : "pointer",
                  fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:11, letterSpacing:"0.07em",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"all 0.2s" }}>
                {analyzing
                  ? <><span style={{ width:13, height:13, border:"2px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }} />MATCHING FREQUENCY + STUDY PLAN...</>
                  : "→ FIND MY FOCUS FREQUENCY"}
              </button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["Math / Coding","gamma","Solving calculus derivatives, graph algorithms, and proof-style practice problems."],["Science","beta","Reviewing cellular respiration, enzyme kinetics, and lab terminology for a biology exam."],
                ["Reading","alpha","Reading a dense history chapter and extracting the main arguments for discussion."],["Creative","theta","Brainstorming a design project, outlining themes, and connecting visual references."]
              ].map(([label, fk, mat]) => (
                <button key={fk}
                  onClick={() => { setMaterial(mat); setFreqKey(fk); setSetupErr(""); }}
                  aria-label={`Use ${label} example material`}
                  style={{ padding:"11px 13px", borderRadius:12, cursor:"pointer", textAlign:"left",
                    border:`1px solid ${FREQS[fk].color}22`,
                    background:"var(--panel,rgba(6,15,30,0.75))", transition:"all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=FREQS[fk].color+"55"; e.currentTarget.style.background=FREQS[fk].color+"0a"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=FREQS[fk].color+"22"; e.currentTarget.style.background="var(--panel,rgba(6,15,30,0.75))"; }}>
                  <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:"0.08em", color:FREQS[fk].color, marginBottom:3 }}>{FREQS[fk].label}</div>
                  <div style={{ fontSize:13, color:"#64748b" }}>{label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════ SESSION ══════ */}
        {screen === "session" && !voiceOpen && (
          <div style={{ padding:"0 16px" }}>
            {/* Phase tabs */}
            <div style={{ display:"flex", gap:6, justifyContent:"center", padding:"16px 0 0" }}>
              {Object.entries(PHASES).map(([k, p]) => (
                <button key={k}
                  aria-label={`Switch to ${p.label.toLowerCase()}`}
                  onClick={() => { setRunning(false); stopAudio(); setPomPhase(k); setFreqKey(p.freqKey); const d=p.mins*60; setTimeLeft(d); setTotalSecs(d); }}
                  style={{ padding:"6px 13px", borderRadius:999, border:"1px solid", cursor:"pointer",
                    fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:"0.07em",
                    background:pomPhase===k ? FREQS[p.freqKey].color+"14" : "transparent",
                    borderColor:pomPhase===k ? FREQS[p.freqKey].color+"55" : "rgba(255,255,255,0.07)",
                    color:pomPhase===k ? FREQS[p.freqKey].color : "var(--text4,#334155)", transition:"all 0.2s" }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Blob timer canvas — square so arc() draws circles not ovals */}
            <div style={{ position:"relative", width:"100%", height:isMobile?300:340,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <canvas ref={blobCanvasRef}
                width={isMobile?300:340}
                height={isMobile?300:340}
                aria-hidden="true"
                style={{ position:"absolute",
                  width:isMobile?300:340,
                  height:isMobile?300:340,
                  left:"50%", top:"50%",
                  transform:"translate(-50%,-50%)" }} />
              {/* Timer overlay */}
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", gap:0, pointerEvents:"none" }}>
                <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:"0.2em",
                  color:freq.color, textTransform:"uppercase", marginBottom:7, opacity:0.8 }}>
                  {phase.label}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:66, lineHeight:1,
                  color:"var(--text1,#f1f5f9)", letterSpacing:"0.05em",
                  textShadow:running ? `0 0 28px ${freq.glow}` : "none", transition:"text-shadow 0.5s" }}>
                  {fmt(timeLeft)}
                </div>
                <div style={{ fontSize:10, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", marginTop:5 }}>
                  {(freq.tag || freq.label).toUpperCase()} · {Math.round(pct * 100)}%
                </div>
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ width:6, height:6, borderRadius:"50%",
                      background:i < sessions%4 ? freq.color : "var(--bg3,rgba(255,255,255,0.08))",
                      boxShadow:i < sessions%4 ? `0 0 8px ${freq.glow}` : "none", transition:"all 0.3s" }} />
                  ))}
                  <span style={{ fontSize:10, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", marginLeft:4 }}>
                    {sessions} done
                  </span>
                </div>
              </div>
            </div>

            {/* Spectrum canvas */}
            <div style={{ borderRadius:14, overflow:"hidden", background:"var(--panel2,rgba(2,8,16,0.6))", border:"1px solid var(--border2,rgba(255,255,255,0.04))", marginTop:-8 }}>
              <canvas ref={specCanvasRef} width={isMobile?390:560} height={68} aria-hidden="true" style={{ width:"100%", height:68, display:"block" }} />
            </div>

            {/* Controls */}
            <div style={{ padding:"16px 0 0", display:"flex", alignItems:"center", justifyContent:"center", gap:14 }}>
              <button style={iconBtn()} aria-label="Reset timer" onClick={() => { setRunning(false); stopAudio(); setTimeLeft(totalSecs); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.22)"; e.currentTarget.style.color="#94a3b8"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.09)"; e.currentTarget.style.color="#475569"; }}>
                ↺
              </button>

              {/* Play button */}
              <button onClick={togglePlay}
                aria-label={running ? "Pause timer" : "Start timer"}
                style={{ width:72, height:72, borderRadius:"50%", cursor:"pointer",
                  border:`2px solid ${freq.color}`, background:running ? freq.color+"18" : "transparent",
                  color:freq.color, fontSize:25, display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:running ? `0 0 26px ${freq.glow}` : "none", transition:"all 0.3s" }}
                onMouseEnter={e => e.currentTarget.style.transform="scale(1.07)"}
                onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
                {running ? "⏸" : "▶"}
              </button>

              {/* Mic / voice button */}
              <button onClick={openVoice}
                aria-label="Open voice companion"
                style={{ width:44, height:44, borderRadius:"50%", cursor:"pointer",
                  border:`1px solid ${freq.color}55`, background:voiceCount > 0 ? freq.color+"14" : "transparent",
                  color:freq.color, fontSize:17, display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.2s", position:"relative" }}
                onMouseEnter={e => { e.currentTarget.style.background=freq.color+"1e"; e.currentTarget.style.borderColor=freq.color; }}
                onMouseLeave={e => { e.currentTarget.style.background=voiceCount>0?freq.color+"14":"transparent"; e.currentTarget.style.borderColor=freq.color+"55"; }}>
                🎤
                {voiceCount > 0 && (
                  <div style={{ position:"absolute", top:-4, right:-4, width:16, height:16, borderRadius:"50%",
                    background:freq.color, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, color:"#020810", fontFamily:"'Space Mono',monospace", fontWeight:700 }}>
                    {voiceCount}
                  </div>
                )}
              </button>

              <button style={iconBtn()} aria-label="Skip to debrief" onClick={triggerDebrief}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.22)"; e.currentTarget.style.color="#94a3b8"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.09)"; e.currentTarget.style.color="#475569"; }}>
                ⏭
              </button>
            </div>

            {/* Weak areas */}
            {weakList.length > 0 && (
              <div style={{ margin:"12px 0 0", padding:"9px 13px", borderRadius:10,
                background:"rgba(255,107,107,0.05)", border:"1px solid rgba(255,107,107,0.18)",
                display:"flex", alignItems:"flex-start", gap:7 }}>
                <span style={{ fontSize:11, color:"#ff8080", fontFamily:"'Space Mono',monospace", letterSpacing:"0.06em", whiteSpace:"nowrap", fontWeight:600 }}>⚠ WEAK:</span>
                <span style={{ fontSize:12, color:"#ff8080", lineHeight:1.5 }}>{weakList.join(" · ")}</span>
              </div>
            )}

            {/* Volume */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 0 0" }}>
              <span style={{ fontSize:10, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.12em", minWidth:36, fontWeight:600 }}>VOL</span>
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{ flex:1, background:`linear-gradient(to right,${freq.color} ${volume*100}%,rgba(255,255,255,0.07) ${volume*100}%)` }} />
              <span style={{ fontSize:9, color:freq.color, fontFamily:"'Space Mono',monospace", minWidth:28, textAlign:"right" }}>
                {Math.round(volume * 100)}%
              </span>
            </div>

            {/* Freq switcher */}
            <div className="glass" style={{ marginTop:14, padding:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7 }}>
                {Object.entries(FREQS).map(([k, f]) => (
                  <button key={k} aria-label={`Switch frequency to ${f.label} ${f.hz} hertz`} onClick={() => { setFreqKey(k); if (audioOn) startAudio(k, volume); }}
                    style={{ padding:"9px 5px", borderRadius:10, cursor:"pointer", textAlign:"center",
                      border:`1px solid ${freqKey===k ? f.color+"55" : "rgba(255,255,255,0.05)"}`,
                      background:freqKey===k ? f.color+"0e" : "transparent", transition:"all 0.2s" }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:f.color, margin:"0 auto 4px",
                      boxShadow:freqKey===k ? `0 0 7px ${f.glow}` : "none" }} />
                    <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.05em", color:freqKey===k ? f.color : "var(--label,#94a3b8)", fontWeight:600 }}>{f.label}</div>
                    <div style={{ fontSize:10, color:"var(--muted,#64748b)", marginTop:1, fontWeight:500 }}>{f.hz}Hz</div>
                  </button>
                ))}
              </div>
              {aiReason && <p style={{ fontSize:12, color:"var(--muted,#64748b)", marginTop:11, lineHeight:1.6, borderTop:"1px solid rgba(255,255,255,0.04)", paddingTop:11 }}>{aiReason}</p>}
            </div>

            <button onClick={() => resetStudyState(false)}
              aria-label="Change study material"
              style={{ marginTop:10, width:"100%", padding:"10px", borderRadius:12,
                border:"1px solid rgba(255,255,255,0.05)", background:"transparent",
                color:"var(--muted,#64748b)", cursor:"pointer", fontFamily:"'Space Mono',monospace",
                fontSize:9, letterSpacing:"0.1em", transition:"all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color="#334155"; e.currentTarget.style.borderColor="rgba(255,255,255,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.color="#1e3a5f"; e.currentTarget.style.borderColor="rgba(255,255,255,0.05)"; }}>
              ← CHANGE MATERIAL
            </button>
          </div>
        )}

        {/* ══════ VOICE PANEL ══════ */}
        {screen === "session" && voiceOpen && (
          <div style={{ padding:"0 16px", animation:"slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 0 10px" }}>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:"0.06em", color:"#f1f5f9", lineHeight:1 }}>
                  VOICE COMPANION
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:5 }}>
                  <span style={{ fontSize:9, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>
                    {voiceCount} asked{weakList.length > 0 ? ` · ${weakList.length} weak areas` : ""}
                  </span>
                  {isContinuous && (
                    <span style={{ fontSize:9, color:freq.color, fontFamily:"'Space Mono',monospace",
                      letterSpacing:"0.08em", display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ width:5, height:5, borderRadius:"50%", background:freq.color,
                        display:"inline-block", animation:"blink 1.2s ease infinite" }}/>
                      CONTINUOUS
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {/* Audio paused indicator */}
                {audioWasPaused && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px",
                    borderRadius:999, background:"rgba(255,165,0,0.08)",
                    border:"1px solid rgba(255,165,0,0.25)" }}>
                    <span style={{ fontSize:9 }}>⏸</span>
                    <span style={{ fontSize:8, color:"#f59e0b", fontFamily:"'Space Mono',monospace",
                      letterSpacing:"0.08em" }}>AUDIO PAUSED</span>
                  </div>
                )}
                <button onClick={closeVoice}
                  aria-label="Close voice companion"
                  style={{ width:34, height:34, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.1)",
                    background:"transparent", cursor:"pointer", color:"#475569", fontSize:14,
                    display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.25)";e.currentTarget.style.color="#94a3b8";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="#475569";}}>
                  ✕
                </button>
              </div>
            </div>

            {/* Resume audio notice */}
            {audioWasPaused && (
              <div style={{ marginBottom:10, padding:"9px 14px", borderRadius:12,
                background:"rgba(255,165,0,0.06)", border:"1px solid rgba(255,165,0,0.18)",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>⏸</span>
                  <span style={{ fontSize:12, color:"#f59e0b", lineHeight:1.5 }}>
                    Frequency audio paused while mic is active.
                  </span>
                </div>
                <span style={{ fontSize:10, color:"#78350f", fontFamily:"'Space Mono',monospace",
                  letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
                  RESUMES ON CLOSE
                </span>
              </div>
            )}

            {/* Orb */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"4px 0 2px" }}>
              <canvas ref={orbCanvasRef} width={220} height={220} aria-hidden="true" style={{ width:220, height:220 }} />
              {/* State label */}
              <div style={{ height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {voiceState === "idle"      && <span style={{ fontSize:10, color:"var(--text4,#475569)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>{isContinuous ? "MIC PAUSED" : "TAP MIC TO ASK"}</span>}
                {voiceState === "listening" && <span style={{ fontSize:11, color:freq.color, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", animation:"blink 1s step-end infinite" }}>● LISTENING{isContinuous ? " (CONTINUOUS)" : "..."}</span>}
                {voiceState === "thinking"  && <span style={{ fontSize:11, color:freq.color, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>THINKING...</span>}
                {voiceState === "speaking"  && <span style={{ fontSize:11, color:freq.color, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>◉ SPEAKING</span>}
              </div>
              {/* Interim transcript */}
              {interim && (
                <div style={{ marginTop:5, padding:"6px 13px", borderRadius:10, background:freq.color+"0f",
                  border:`1px solid ${freq.color}33`, fontSize:13, color:freq.color, textAlign:"center", maxWidth:320 }}>
                  "{interim}"
                </div>
              )}
              {/* Error display */}
              {voiceError && (
                <div style={{ marginTop:5, padding:"6px 13px", borderRadius:10, background:"rgba(255,107,107,0.06)",
                  border:"1px solid rgba(255,107,107,0.22)", fontSize:12, color:"#ff8080", textAlign:"center", maxWidth:320 }}>
                  {voiceError}
                </div>
              )}
            </div>

            {/* Conversation scroll */}
            <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column",
              gap:7, padding:"6px 0 10px", scrollBehavior:"smooth" }} ref={chatScrollRef}>
              {messages.length === 0 && (
                <div style={{ textAlign:"center", padding:"12px 0", color:"var(--muted,#64748b)", fontSize:13, lineHeight:1.7 }}>
                  Ask anything about your material.<br/>
                  <span style={{ fontSize:11, color:"var(--text5,#64748b)" }}>Weak areas tracked automatically.</span>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className="msg" style={{ display:"flex", justifyContent:m.role==="user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth:"82%", padding:"8px 13px", borderRadius:13, lineHeight:1.6,
                    background:m.role==="user" ? freq.color+"18" : "rgba(255,255,255,0.03)",
                    border:`1px solid ${m.role==="user" ? freq.color+"44" : "rgba(255,255,255,0.07)"}`,
                    fontSize:13, color:m.role==="user" ? freq.color : "#94a3b8",
                    borderBottomRightRadius:m.role==="user" ? 4 : 13,
                    borderBottomLeftRadius:m.role==="assistant" ? 4 : 13 }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {voiceState === "thinking" && (
                <div className="msg" style={{ display:"flex", justifyContent:"flex-start" }}>
                  <div aria-label="AI is typing" style={{ display:"flex", gap:4, alignItems:"center",
                    padding:"10px 13px", borderRadius:13, borderBottomLeftRadius:4,
                    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
                    color:freq.color }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
              {/* Follow-up suggestion chip */}
              {followUpLoading && (
                <div className="chip-in" style={{ display:"flex", justifyContent:"flex-start", paddingLeft:4 }}>
                  <div style={{ padding:"5px 12px", borderRadius:999, background:"rgba(255,255,255,0.02)",
                    border:"1px solid rgba(255,255,255,0.06)", fontSize:11, color:"var(--muted,#64748b)",
                    fontFamily:"'Space Mono',monospace", letterSpacing:"0.06em" }}>...</div>
                </div>
              )}
              {followUp && !followUpLoading && (
                <div className="msg chip-in" style={{ display:"flex", justifyContent:"flex-start", gap:6, alignItems:"center", paddingLeft:2 }}>
                  <span style={{ fontSize:11, color:"var(--muted,#64748b)",
                    fontFamily:"'Space Mono',monospace", letterSpacing:"0.06em", flexShrink:0 }}>
                    {followUp.type === "question" ? "💡" : "⚡"}
                  </span>
                  <button onClick={acceptFollowUp}
                    style={{ padding:"6px 12px", borderRadius:999, cursor:"pointer",
                      background:freq.color+"0d", border:`1px solid ${freq.color}33`,
                      color:freq.color, fontSize:12, lineHeight:1.45, textAlign:"left",
                      fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background=freq.color+"1a"}
                    onMouseLeave={e => e.currentTarget.style.background=freq.color+"0d"}>
                    {followUp.text}
                  </button>
                  <button onClick={dismissFollowUp}
                    style={{ background:"transparent", border:"none", color:"var(--muted,#64748b)",
                      cursor:"pointer", fontSize:13, flexShrink:0, padding:"0 2px" }}>✕</button>
                </div>
              )}
            </div>

            {/* Weak areas */}
            {weakList.length > 0 && (
              <div style={{ marginBottom:10, padding:"8px 12px", borderRadius:10,
                background:"rgba(255,107,107,0.05)", border:"1px solid rgba(255,107,107,0.16)" }}>
                <div style={{ fontSize:8, color:"#ff8080", fontFamily:"'Space Mono',monospace", letterSpacing:"0.12em", marginBottom:5 }}>⚠ WEAK AREAS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {weakList.map(a => (
                    <span key={a} style={{ padding:"2px 8px", borderRadius:999, fontSize:11,
                      background:"rgba(255,107,107,0.1)", border:"1px solid rgba(255,107,107,0.28)", color:"#ff8080" }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Controls row ── */}
            {micAllowed === false ? (
              <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,107,107,0.05)",
                border:"1px solid rgba(255,107,107,0.2)", fontSize:13, color:"#ff8080", textAlign:"center", marginBottom:10 }}>
                Microphone blocked. Enable permissions in browser settings & refresh.
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:10 }}>

                {/* Single-tap mic */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <button
                    onClick={voiceState === "listening" && !isContinuous ? stopListening : startListening}
                    aria-label={voiceState === "listening" && !isContinuous ? "Stop listening" : "Start voice input"}
                    disabled={isContinuous || voiceState === "thinking" || voiceState === "speaking"}
                    style={{ width:64, height:64, borderRadius:"50%", cursor: isContinuous ? "not-allowed" : "pointer",
                      border:`2px solid ${!isContinuous && voiceState==="listening" ? freq.color : "rgba(255,255,255,0.14)"}`,
                      background:!isContinuous && voiceState==="listening" ? freq.color+"20" : "rgba(255,255,255,0.02)",
                      fontSize:24, display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:!isContinuous && voiceState==="listening" ? `0 0 24px ${freq.glow}` : "none",
                      transform:!isContinuous && voiceState==="listening" ? "scale(1.06)" : "scale(1)",
                      opacity: isContinuous ? 0.3 : voiceState === "thinking" || voiceState === "speaking" ? 0.4 : 1,
                      transition:"all 0.25s" }}>
                    🎤
                  </button>
                  <span style={{ fontSize:8, color:"var(--text4,#475569)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.07em" }}>
                    {!isContinuous && voiceState === "listening" ? "TAP STOP" : "TAP"}
                  </span>
                </div>

                {/* Continuous mode toggle */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <button
                    onClick={toggleContinuous}
                    aria-label={isContinuous ? "Turn continuous listening off" : "Turn continuous listening on"}
                    disabled={voiceState === "thinking"}
                    style={{ width:64, height:64, borderRadius:"50%", cursor:"pointer",
                      border:`2px solid ${isContinuous ? freq.color : "rgba(255,255,255,0.14)"}`,
                      background:isContinuous ? freq.color+"20" : "rgba(255,255,255,0.02)",
                      fontSize:22, display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:isContinuous ? `0 0 24px ${freq.glow}` : "none",
                      transition:"all 0.25s",
                      animation: isContinuous && voiceState === "listening" ? "continuousPulse 2s ease infinite" : "none",
                      "--ac": freq.glow }}>
                    {isContinuous ? "🔴" : "♾️"}
                  </button>
                  <span style={{ fontSize:8, color: isContinuous ? freq.color : "#334155",
                    fontFamily:"'Space Mono',monospace", letterSpacing:"0.07em" }}>
                    {isContinuous ? "CONTINUOUS" : "HOLD ON"}
                  </span>
                </div>

              </div>
            )}

            {/* ── Text input fallback ── */}
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input
                type="text"
                aria-label="Type a question for the voice companion"
                placeholder="Or type your question here..."
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextMessage(); } }}
                disabled={voiceState === "thinking" || voiceState === "speaking"}
                style={{ flex:1, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:11, color:"#e2e8f0", fontFamily:"'DM Sans',sans-serif", fontSize:13,
                  padding:"10px 14px", outline:"none", transition:"border-color 0.2s",
                  opacity: voiceState === "thinking" || voiceState === "speaking" ? 0.4 : 1 }} />
              <button
                onClick={sendTextMessage}
                aria-label="Send typed question"
                disabled={!textInput.trim() || voiceState === "thinking" || voiceState === "speaking"}
                style={{ padding:"10px 16px", borderRadius:11, border:"none", cursor:"pointer",
                  background:textInput.trim() ? freq.color : "rgba(255,255,255,0.05)",
                  color:textInput.trim() ? "#020810" : "#334155",
                  fontFamily:"'Space Mono',monospace", fontSize:11, fontWeight:700,
                  transition:"all 0.2s", whiteSpace:"nowrap" }}>
                SEND
              </button>
            </div>

            <button onClick={closeVoice}
              aria-label="Back to timer"
              style={{ width:"100%", padding:"11px", borderRadius:12,
                border:`1px solid ${freq.color}33`, background:"transparent", color:freq.color,
                cursor:"pointer", fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.08em" }}>
              ← BACK TO TIMER
            </button>
          </div>
        )}

        {/* ══════ DEBRIEF ══════ */}
        {screen === "debrief" && (
          <div style={{ padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:14 }}>
            {/* Step dots */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:4 }}>
              {["rating","covered","quiz","insight"].map((s, i, arr) => {
                const idx = arr.indexOf(debriefStep);
                return (
                  <div key={s} style={{ display:"flex", alignItems:"center" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", transition:"all 0.3s",
                      background:i <= idx ? freq.color : "rgba(255,255,255,0.08)",
                      boxShadow:i === idx ? `0 0 10px ${freq.glow}` : "none" }} />
                    {i < arr.length - 1 && (
                      <div style={{ width:34, height:1, margin:"0 5px", transition:"all 0.3s",
                        background:i < idx ? freq.color+"66" : "rgba(255,255,255,0.06)" }} />
                    )}
                  </div>
                );
              })}
            </div>

            {debriefStep === "rating" && (
              <div className="fade glass" style={{ padding:28, textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.14em", marginBottom:8, fontWeight:600 }}>SESSION {sessions} COMPLETE</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38, color:"#f1f5f9", letterSpacing:"0.04em", marginBottom:4 }}>HOW WAS YOUR FOCUS?</div>
                {voiceCount > 0 && <p style={{ fontSize:12, color:freq.color, fontFamily:"'Space Mono',monospace", letterSpacing:"0.05em", marginBottom:10 }}>🎤 {voiceCount} voice questions logged</p>}
                <p style={{ color:"var(--muted,#64748b)", fontSize:13, marginBottom:24 }}>Be honest — helps your AI coach</p>
                <div role="radiogroup" aria-label="Focus rating" style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:20 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setFocusRating(n)}
                      aria-label={`${n} out of 5 focus rating`}
                      aria-checked={focusRating === n}
                      role="radio"
                      onKeyDown={e => {
                        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                          e.preventDefault(); setFocusRating(Math.min(5, (focusRating || 1) + 1));
                        }
                        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                          e.preventDefault(); setFocusRating(Math.max(1, (focusRating || 1) - 1));
                        }
                      }}
                      onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                      style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:32, padding:"0 3px",
                        transition:"transform 0.15s", transform:n <= (hoverRating || focusRating) ? "scale(1.15)" : "scale(1)" }}>
                      <span style={{ filter:n <= (hoverRating || focusRating) ? "none" : "grayscale(1) opacity(0.2)", transition:"filter 0.15s" }}>⭐</span>
                    </button>
                  ))}
                </div>
                {focusRating > 0 && <div style={{ fontSize:13, color:freq.color, fontFamily:"'Space Mono',monospace", marginBottom:18 }}>
                  {["","Rough session","Getting there","Decent flow","Good focus","Deep focus 🔥"][focusRating]}
                </div>}
                <button disabled={!focusRating} onClick={() => setDebriefStep("covered")}
                  style={{ padding:"13px 34px", borderRadius:13, border:"none",
                    background:focusRating ? freq.color : "rgba(255,255,255,0.04)",
                    color:focusRating ? "#020810" : "#1e3a5f",
                    cursor:focusRating ? "pointer" : "not-allowed",
                    fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:11, letterSpacing:"0.07em" }}>
                  CONTINUE →
                </button>
              </div>
            )}

            {debriefStep === "covered" && (
              <div className="fade glass" style={{ padding:24 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:"#f1f5f9", letterSpacing:"0.04em", marginBottom:13 }}>WHAT DID YOU COVER?</div>
                <textarea ref={coveredRef} rows={4} value={covered} onChange={e => setCovered(e.target.value)}
                  aria-label="Topics covered this session"
                  placeholder="Which specific topics did you work through this session?" />
                {/* Quiz question count picker */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:13, marginBottom:4 }}>
                  <span style={{ fontSize:10, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>QUESTIONS:</span>
                  {[3, 5, 7, 10].map(n => (
                    <button key={n} onClick={() => setQuizCount(n)}
                      style={{ width:32, height:28, borderRadius:8, cursor:"pointer",
                        border:`1px solid ${quizCount===n ? freq.color+"55" : "rgba(255,255,255,0.08)"}`,
                        background:quizCount===n ? freq.color+"14" : "transparent",
                        color:quizCount===n ? freq.color : "#334155",
                        fontFamily:"'Space Mono',monospace", fontSize:11, transition:"all 0.2s" }}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10, marginTop:10 }}>
                  <button onClick={() => setDebriefStep("rating")}
                    style={{ padding:"11px 18px", borderRadius:11, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#475569", cursor:"pointer", fontFamily:"'Space Mono',monospace", fontSize:10 }}>← BACK</button>
                  <button onClick={() => loadQuiz(false)}
                    style={{ flex:1, padding:"11px", borderRadius:11, border:"none", background:freq.color, color:"#020810", cursor:"pointer", fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:11, letterSpacing:"0.06em" }}>GENERATE QUIZ ({quizCount}Q) →</button>
                </div>
              </div>
            )}

            {debriefStep === "quiz" && (
              <div className="fade" style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div className="glass" style={{ padding:18 }}>
                  <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:"#f1f5f9", letterSpacing:"0.04em" }}>
                      QUIZ · R{quizRound}
                    </div>
                    <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.1em",
                      padding:"4px 10px", borderRadius:999,
                      background:quizDifficulty==="hard" ? "rgba(255,77,26,0.12)" : quizDifficulty==="easy" ? "rgba(0,255,179,0.1)" : "rgba(0,229,255,0.1)",
                      color:quizDifficulty==="hard" ? "#ff4d1a" : quizDifficulty==="easy" ? "#00ffb3" : "#00e5ff",
                      border:`1px solid ${quizDifficulty==="hard" ? "#ff4d1a44" : quizDifficulty==="easy" ? "#00ffb344" : "#00e5ff44"}` }}>
                      {quizDifficulty.toUpperCase()}
                    </div>
                  </div>
                </div>
                {quizLoading ? (
                  <div className="glass" style={{ padding:40, textAlign:"center" }}>
                    <div style={{ width:28, height:28, border:`2px solid ${freq.color}33`, borderTopColor:freq.color, borderRadius:"50%", margin:"0 auto 12px", animation:"spin 0.9s linear infinite" }} />
                    <p style={{ color:"var(--muted,#64748b)", fontSize:13 }}>Generating quiz...</p>
                  </div>
                ) : quizData?.length > 0 ? (
                  <>
                    {quizData.map((q, qi) => (
                      <div key={qi} className="glass" style={{ padding:20 }}>
                        <div style={{ display:"flex", gap:10, marginBottom:13 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background:freq.color+"14", border:`1px solid ${freq.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:freq.color, fontFamily:"'Space Mono',monospace", flexShrink:0 }}>{qi+1}</div>
                          <p style={{ fontSize:14, color:"var(--text1,#cbd5e1)", lineHeight:1.65 }}>
                            <MathRenderer text={q.q} />
                          </p>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                          {q.options.map((opt, oi) => {
                            const chosen = answers[qi] === oi, isRev = revealed[qi], correct = q.answer === oi;
                            let cls = "opt";
                            if (isRev && correct) cls += " opt-ok";
                            else if (isRev && chosen && !correct) cls += " opt-no";
                            else if (isRev && !correct && !chosen) cls += " opt-dim";
                            return (
                              <button key={oi} className={cls} disabled={!!isRev}
                                onClick={() => { setAnswers(p => ({...p,[qi]:oi})); setRevealed(p => ({...p,[qi]:true})); }}>
                                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, opacity:0.5, marginRight:10, fontWeight:700 }}>{["A","B","C","D"][oi]}</span>{opt}
                              </button>
                            );
                          })}
                        </div>
                        {revealed[qi] && (
                          <div style={{ marginTop:10, padding:"9px 13px", borderRadius:9,
                            background:answers[qi]===q.answer ? "rgba(0,255,179,0.06)" : "rgba(255,107,107,0.05)",
                            border:`1px solid ${answers[qi]===q.answer ? "#00ffb333" : "#ff6b6b33"}` }}>
                            <div style={{ fontSize:8, marginBottom:4, fontFamily:"'Space Mono',monospace",
                              letterSpacing:"0.1em", color:answers[qi]===q.answer ? "#00ffb3" : "#ff8080" }}>
                              {answers[qi]===q.answer ? "CORRECT" : "REVIEW"}
                            </div>
                            <p style={{ fontSize:12, lineHeight:1.6, color:answers[qi]===q.answer ? "#00ffb3" : "#ff8080" }}>{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {currentRoundComplete && (
                      <div className="fade glass" style={{ padding:20 }}>
                        {/* Score row */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                          <div>
                            <div style={{ fontSize:9, color:"var(--text5,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.14em", marginBottom:4 }}>
                              ROUND {quizRound} · {quizDifficulty.toUpperCase()}
                            </div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:42, color:freq.color, lineHeight:1 }}>
                              {scoreCount}<span style={{ fontSize:20, color:"var(--muted,#64748b)" }}>/{currentRoundTotal}</span>
                            </div>
                          </div>
                          <span style={{ fontSize:38 }}>{scoreCount === currentRoundTotal ? "🎯" : scoreCount >= currentRoundTotal/2 ? "⚡" : "📚"}</span>
                        </div>
                        {/* Quiz history mini-log */}
                        {quizHistory.length > 0 && (
                          <div style={{ marginBottom:14, display:"flex", gap:6, flexWrap:"wrap" }}>
                            {quizHistory.map((h,i) => (
                              <div key={i} style={{ padding:"4px 10px", borderRadius:999, fontSize:10,
                                background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
                                fontFamily:"'Space Mono',monospace", color:"var(--text4,#475569)" }}>
                                R{h.round}: {h.score}/{h.total} · {h.difficulty}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Next difficulty preview */}
                        <div style={{ marginBottom:14, fontSize:11, color:"var(--text4,#475569)",
                          fontFamily:"'Space Mono',monospace", letterSpacing:"0.06em" }}>
                          {(() => {
                            const nextD = quizHistory.length > 0
                              ? computeDifficulty([...quizHistory, {score:scoreCount, total:currentRoundTotal}])
                              : scoreCount/currentRoundTotal >= 0.8 ? "hard" : scoreCount/currentRoundTotal >= 0.5 ? "medium" : "easy";
                            return `Next round difficulty → ${nextD.toUpperCase()}`;
                          })()}
                        </div>
                        {/* Question count config */}
                        <div style={{ marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, color:"var(--muted,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>QUESTIONS:</span>
                          {[3, 5, 7, 10].map(n => (
                            <button key={n} onClick={() => setQuizCount(n)}
                              style={{ width:32, height:28, borderRadius:8, cursor:"pointer",
                                border:`1px solid ${quizCount===n ? freq.color+"55" : "rgba(255,255,255,0.08)"}`,
                                background:quizCount===n ? freq.color+"14" : "transparent",
                                color:quizCount===n ? freq.color : "#334155",
                                fontFamily:"'Space Mono',monospace", fontSize:11, transition:"all 0.2s" }}>
                              {n}
                            </button>
                          ))}
                        </div>
                        {/* Action buttons */}
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={continueQuiz} disabled={quizLoading}
                            style={{ flex:1, padding:"12px", borderRadius:11, cursor:quizLoading ? "not-allowed" : "pointer",
                              border:`1px solid ${freq.color}44`, background:"transparent",
                              color:freq.color, fontFamily:"'Space Mono',monospace",
                              fontWeight:700, fontSize:10, letterSpacing:"0.06em",
                              opacity:quizLoading ? 0.5 : 1, transition:"all 0.2s" }}>
                            {quizLoading ? "LOADING..." : "+ MORE QUESTIONS"}
                          </button>
                          <button onClick={loadInsight}
                            style={{ flex:1, padding:"12px", borderRadius:11, border:"none",
                              background:freq.color, color:"#020810", cursor:"pointer",
                              fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:10, letterSpacing:"0.06em" }}>
                            AI INSIGHT →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="glass" style={{ padding:26, textAlign:"center" }}>
                    <p style={{ color:"var(--muted,#64748b)", fontSize:14, marginBottom:13 }}>{quizError || "Couldn't generate quiz."}</p>
                    <button onClick={() => loadQuiz(false)}
                      style={{ marginRight:8, padding:"11px 18px", borderRadius:11, border:`1px solid ${freq.color}44`, background:"transparent", color:freq.color, cursor:"pointer", fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:11 }}>RETRY QUIZ</button>
                    <button onClick={loadInsight}
                      style={{ padding:"11px 22px", borderRadius:11, border:"none", background:freq.color, color:"#020810", cursor:"pointer", fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:11 }}>GET INSIGHT →</button>
                  </div>
                )}
              </div>
            )}

            {debriefStep === "insight" && (
              <div className="fade" style={{ position:"relative", overflow:"hidden" }}>
                <div className="glass" style={{ padding:24 }}>
                  <div style={{ position:"absolute", top:-20, right:-10, fontFamily:"'Bebas Neue',sans-serif",
                    fontSize:150, color:freq.color, opacity:0.04, lineHeight:1, pointerEvents:"none", userSelect:"none" }}>
                    {sessions}
                  </div>
                  <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"var(--muted,#64748b)", letterSpacing:"0.12em", marginBottom:8, fontWeight:600 }}>AI STUDY COACH</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, color:"#f1f5f9", letterSpacing:"0.04em", marginBottom:16 }}>SESSION DEBRIEF</div>

                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
                    {[{l:"FOCUS",v:["","★","★★","★★★","★★★★","★★★★★"][focusRating]||"—"},
                      {l:"QUIZ",v:`${scoreCount}/${currentRoundTotal || quizData?.length || 0}`},
                      {l:"VOICE",v:`${voiceCount}Q`},
                      {l:"SESSION",v:`#${sessions}`}
                    ].map(item => (
                      <div key={item.l} style={{ padding:"10px 6px", borderRadius:10, textAlign:"center", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize:7, color:"var(--text5,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:4 }}>{item.l}</div>
                        <div style={{ fontSize:15, color:freq.color, fontFamily:"'Space Mono',monospace" }}>{item.v}</div>
                      </div>
                    ))}
                  </div>

                  {weakList.length > 0 && (
                    <div style={{ marginBottom:14, padding:"10px 13px", borderRadius:10, background:"rgba(255,107,107,0.05)", border:"1px solid rgba(255,107,107,0.16)" }}>
                      <div style={{ fontSize:8, color:"#ff8080", fontFamily:"'Space Mono',monospace", letterSpacing:"0.12em", marginBottom:6 }}>⚠ FLAGGED WEAK AREAS</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                        {weakList.map(a => (
                          <span key={a} style={{ padding:"3px 9px", borderRadius:999, fontSize:11, background:"rgba(255,107,107,0.1)", border:"1px solid rgba(255,107,107,0.28)", color:"#ff8080" }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {insightLoading ? (
                    <div style={{ padding:"22px 0", textAlign:"center" }}>
                      <div style={{ width:26, height:26, border:`2px solid ${freq.color}33`, borderTopColor:freq.color, borderRadius:"50%", margin:"0 auto 12px", animation:"spin 0.9s linear infinite" }} />
                      <p style={{ color:"var(--muted,#64748b)", fontSize:13 }}>Analyzing your session...</p>
                    </div>
                  ) : insightError ? (
                    <div style={{ padding:"18px 0", textAlign:"center" }}>
                      <p style={{ color:"#ff8080", fontSize:13, lineHeight:1.6, marginBottom:12 }}>
                        {insightError}
                      </p>
                      <button onClick={loadInsight}
                        style={{ padding:"11px 20px", borderRadius:11, border:"none",
                          background:freq.color, color:"#020810", cursor:"pointer",
                          fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:11 }}>
                        RETRY INSIGHT
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding:"14px 16px", borderRadius:12, marginBottom:14, background:`${freq.color}08`, border:`1px solid ${freq.color}1a` }}>
                        <div style={{ fontSize:10, color:freq.color, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:8, fontWeight:700 }}>COACH SAYS</div>
                        <p style={{ fontSize:14, color:"#94a3b8", lineHeight:1.8, minHeight:44 }}>
                          {typed}
                          <span style={{ display:"inline-block", width:2, height:13, background:freq.color, marginLeft:2, verticalAlign:"middle", animation:typed.length === insight.length ? "none" : "blink 0.7s step-end infinite" }} />
                        </p>
                      </div>

                      {recentSessionItems.length > 0 && (
                        <div style={{ marginBottom:14 }}>
                          <div style={{ fontSize:8, color:"var(--text5,#64748b)", fontFamily:"'Space Mono',monospace", letterSpacing:"0.14em", marginBottom:8 }}>RECENT SESSIONS</div>
                          {recentSessionItems.map((s, i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, marginBottom:5, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.04)" }}>
                              <span style={{ fontSize:9, color:freq.color, fontFamily:"'Space Mono',monospace", minWidth:18 }}>#{s.session}</span>
                              <span style={{ fontSize:11, color:"var(--text4,#475569)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.nextFocus}</span>
                              {s.voiceQ > 0 && <span style={{ fontSize:9, color:"var(--text4,#475569)" }}>🎤{s.voiceQ}</span>}
                              <span style={{ fontSize:9, color:"var(--text5,#64748b)", fontFamily:"'Space Mono',monospace" }}>{s.time}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={startBreak}
                          style={{ flex:1, padding:"13px", borderRadius:12, border:"none", background:FREQS.theta.color, color:"#020810", cursor:"pointer", fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:10, letterSpacing:"0.06em" }}>
                          → {sessions%4===0?15:5}min BREAK
                        </button>
                        <button onClick={() => { setPomPhase("focus"); setFreqKey("beta"); const d=25*60; setTimeLeft(d); setTotalSecs(d); setScreen("session"); setTimeout(() => { sessionStartRef.current = Date.now(); setRunning(true); startAudio("beta", volume); }, 300); }}
                          style={{ padding:"13px 14px", borderRadius:12, cursor:"pointer", border:`1px solid ${freq.color}44`, background:"transparent", color:freq.color, fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.06em" }}>
                          SKIP →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {debriefStep !== "insight" && (
              <button onClick={() => resetStudyState(false)}
                aria-label="Back to setup"
                style={{ padding:"10px", borderRadius:11, border:"1px solid rgba(255,255,255,0.05)", background:"transparent", color:"var(--text5,#64748b)", cursor:"pointer", fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:"0.1em", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.color="#334155"; e.currentTarget.style.borderColor="rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.color="#0f2744"; e.currentTarget.style.borderColor="rgba(255,255,255,0.05)"; }}>
                ← BACK TO SETUP
              </button>
            )}
          </div>
        )}

        <div style={{ textAlign:"center", padding:"26px 0 0", fontFamily:"'Space Mono',monospace", fontSize:8, letterSpacing:"0.18em", color:"var(--text5,#64748b)" }}>
          HANDSHAKE × CODEX CHALLENGE · FOCUSMIND v3
        </div>
      </div>
    </div>
  );
}
