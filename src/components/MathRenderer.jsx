import { useEffect, useRef, useState } from "react";

// Loads KaTeX from CDN on first use (lazy, ~90kb)
let katexLoaded = false;
let katexPromise = null;

function loadKaTeX() {
  if (katexLoaded) return Promise.resolve();
  if (katexPromise) return katexPromise;

  katexPromise = new Promise((resolve, reject) => {
    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.onload = () => { katexLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return katexPromise;
}

// ── Detect if text contains LaTeX ─────────────────────────────────────────
function hasMath(text = "") {
  return /\$\$[\s\S]+?\$\$|\$[^$]+?\$|\\[a-zA-Z]+\{/.test(text);
}

// ── Split text into math and non-math segments ────────────────────────────
function parseSegments(text) {
  const segments = [];
  // Match $$...$$ (display) or $...$ (inline)
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let last = 0, match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) segments.push({ type:"text", val: text.slice(last, match.index) });
    const raw = match[0];
    const display = raw.startsWith("$$");
    const expr = display ? raw.slice(2,-2).trim() : raw.slice(1,-1).trim();
    segments.push({ type:"math", val: expr, display });
    last = match.index + raw.length;
  }
  if (last < text.length) segments.push({ type:"text", val: text.slice(last) });
  return segments;
}

// ── Single math expression ────────────────────────────────────────────────
function KaTeXSpan({ expr, display }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.katex) return;
    try {
      window.katex.render(expr, ref.current, {
        displayMode: display,
        throwOnError: false,
        errorColor: "#ff6b6b",
        trust: false,
      });
    } catch {
      if (ref.current) ref.current.textContent = expr;
    }
  }, [expr, display]);
  return (
    <span ref={ref} style={{
      display: display ? "block" : "inline",
      margin: display ? "8px 0" : "0 2px",
      fontFamily: display ? "inherit" : "inherit",
    }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────
/**
 * Renders text with LaTeX math support.
 * Use $inline$ or $$display$$ syntax.
 * Falls back to plain text if KaTeX fails to load.
 *
 * Usage:
 *   <MathRenderer text="The formula $E = mc^2$ is famous." />
 *   <MathRenderer text="$$\int_0^\infty e^{-x} dx = 1$$" />
 */
export default function MathRenderer({ text = "", style = {} }) {
  const [ready, setReady] = useState(katexLoaded);

  useEffect(() => {
    if (!hasMath(text)) return;
    if (katexLoaded) {
      const id = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(id);
    }
    loadKaTeX()
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, [text]);

  // No math detected — plain text
  if (!hasMath(text)) {
    return <span style={style}>{text}</span>;
  }

  // KaTeX not loaded yet
  if (!ready) {
    return <span style={style}>{text}</span>;
  }

  const segments = parseSegments(text);

  return (
    <span style={style}>
      {segments.map((seg, i) =>
        seg.type === "math"
          ? <KaTeXSpan key={i} expr={seg.val} display={seg.display} />
          : <span key={i}>{seg.val}</span>
      )}
    </span>
  );
}
