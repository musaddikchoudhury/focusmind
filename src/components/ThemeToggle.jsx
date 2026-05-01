import { useTheme } from "../theme/ThemeContext";

export default function ThemeToggle({ compact = false }) {
  const { cycleTheme, theme } = useTheme();

  return (
    <button
      onClick={cycleTheme}
      aria-label={`Switch theme. Current theme: ${theme.name}`}
      title={`Theme: ${theme.name} — click to switch`}
      style={{
        width: compact ? 30 : 36,
        height: compact ? 30 : 36,
        borderRadius: 9,
        border: `1px solid var(--border)`,
        background: "var(--bg3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: compact ? 14 : 15,
        transition: "all 0.2s",
        flexShrink: 0,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      {theme.icon}
    </button>
  );
}
