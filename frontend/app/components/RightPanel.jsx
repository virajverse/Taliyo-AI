"use client";
import { useMemo, useState } from "react";
import Markdown from "./Markdown";
import ExportMenu from "./ExportMenu";

export default function RightPanel({ files = [], lastAssistant = "", analyzing = false }) {
  const [tab, setTab] = useState("preview"); // preview | notes | exports

  const sizeText = (n) => {
    if (n == null) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1024/1024).toFixed(2)} MB`;
  };

  const hasImage = useMemo(() => files.some(f => f.type?.startsWith("image/")), [files]);

  const FileIcon = ({ type }) => {
    const t = String(type || "");
    if (/pdf/i.test(t)) {
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-400" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L19.5 9H15z"/><text x="6" y="18" fontSize="7" className="fill-current">PDF</text></svg>
      );
    }
    if (/word|officedocument\.word|msword/i.test(t)) {
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><text x="6" y="18" fontSize="7" className="fill-current">DOC</text></svg>
      );
    }
    if (/excel|sheet|spreadsheet/i.test(t)) {
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-400" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><text x="6" y="18" fontSize="7" className="fill-current">XLS</text></svg>
      );
    }
    if (/powerpoint|presentation/i.test(t)) {
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-orange-400" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><text x="6" y="18" fontSize="7" className="fill-current">PPT</text></svg>
      );
    }
    if (/csv/i.test(t)) {
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-400" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><text x="6" y="18" fontSize="7" className="fill-current">CSV</text></svg>
      );
    }
    if (/text\//i.test(t)) {
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-zinc-300" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><text x="6" y="18" fontSize="7" className="fill-current">TXT</text></svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-zinc-400" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M8 13h8M8 9h8M8 17h5"/></svg>
    );
  };

  return (
    <aside className="hidden lg:flex w-80 shrink-0 h-full flex-col border-l border-zinc-800/60 bg-zinc-950/40">
      <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="text-sm text-zinc-300">Details</div>
        <div className="inline-flex rounded-xl overflow-hidden border border-zinc-800">
          {[
            {k: 'preview', t: 'File Preview'},
            {k: 'notes', t: 'AI Notes'},
            {k: 'exports', t: 'Exports'},
          ].map(x => (
            <button key={x.k} className={`px-3 py-1 text-xs ${tab===x.k? 'bg-zinc-900 text-zinc-100':'bg-zinc-950 text-zinc-400'}`} onClick={()=>setTab(x.k)}>{x.t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-unique">
        {analyzing && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Analyzing file...
          </div>
        )}
        {tab === 'preview' && (
          files.length === 0 ? (
            <div className="text-sm text-zinc-500">No file selected.</div>
          ) : (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 flex items-center gap-2">
                  {f.type?.startsWith('image/') ? (
                    <img src={f.previewUrl} alt="preview" className="w-10 h-10 rounded object-cover border border-zinc-800" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-zinc-800/60 flex items-center justify-center">
                      <FileIcon type={f.type} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-100">{f.name}</div>
                    <div className="text-xs text-zinc-400">{sizeText(f.size)} · {f.type || 'file'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'notes' && (
          <div className="prose prose-invert max-w-none">
            {analyzing && !lastAssistant ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-zinc-800 rounded w-4/5" />
                <div className="h-3 bg-zinc-800 rounded w-5/6" />
                <div className="h-3 bg-zinc-800 rounded w-3/5" />
                <div className="h-3 bg-zinc-800 rounded w-2/3" />
              </div>
            ) : (
              lastAssistant ? <Markdown>{lastAssistant}</Markdown> : (<div className="text-sm text-zinc-500">No notes yet.</div>)
            )}
          </div>
        )}

        {tab === 'exports' && (
          <ExportMenu content={lastAssistant} />
        )}
      </div>
    </aside>
  );
}
