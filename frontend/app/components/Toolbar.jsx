export default function Toolbar({ onInsert }) {
  const actions = [
    { key: 'summarize', label: 'Summarize', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
    ), text: 'Summarize this' },
    { key: 'bullets', label: 'Bullet Points', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
    ), text: 'Make bullet points' },
    { key: 'translate', label: 'Translate', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 5h7l9 14H13L4 5z"/></svg>
    ), text: 'Translate to Hindi' },
    { key: 'outline', label: 'Outline', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 6h16M4 10h10M4 14h16M4 18h8"/></svg>
    ), text: 'Write an outline' },
    { key: 'shorten', label: 'Shorten', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 12h16M4 12a4 4 0 0 1 4-4h2m6 8a4 4 0 0 1-4-4"/></svg>
    ), text: 'Make it shorter' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => (
        <button key={a.key}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-950/80 text-zinc-200 text-xs hover:border-accent-blue/40 hover:text-accent-blue transition-colors"
          onClick={() => onInsert?.(a.text)}
          title={a.label}
        >
          {a.icon}
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
