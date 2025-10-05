"use client";
import { useEffect, useState } from "react";

const THEMES = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "dim", label: "Dim" },
  { key: "hc", label: "High Contrast" },
];

export default function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const el = document.documentElement;
    let initial = "dark";
    if (el.classList.contains("theme-light")) initial = "light";
    else if (el.classList.contains("theme-dim")) initial = "dim";
    else if (el.classList.contains("theme-hc")) initial = "hc";
    try {
      const saved = localStorage.getItem("taliyo_theme");
      if (saved) initial = saved;
    } catch {}
    applyTheme(initial);
  }, []);

  function applyTheme(next) {
    const el = document.documentElement;
    el.classList.remove("theme-light", "theme-dim", "theme-hc");
    if (next === "light") el.classList.add("theme-light");
    if (next === "dim") el.classList.add("theme-dim");
    if (next === "hc") el.classList.add("theme-hc");
    setTheme(next);
    try { localStorage.setItem("taliyo_theme", next); } catch {}
    setOpen(false);
  }

  const dot = theme === "light" ? "#FFD25A" : theme === "hc" ? "#000" : theme === "dim" ? "#7dd3fc" : "#00B8FF";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-glass px-3 py-1.5 text-xs inline-flex items-center gap-1"
        title="Theme"
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: dot, border: theme === 'hc' ? '1px solid #fff' : undefined }} />
        {THEMES.find(t => t.key === theme)?.label || "Dark"}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs z-50">
          {THEMES.map((t) => (
            <button key={t.key}
              className={`w-full text-left px-2 py-1 rounded-lg hover:bg-zinc-800 ${theme===t.key? 'text-yellow-300':'text-zinc-200'}`}
              onClick={() => applyTheme(t.key)}
            >{t.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
