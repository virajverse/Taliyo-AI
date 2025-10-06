"use client";

import { useEffect, useState } from "react";
import { adminListMemories, adminDeleteSummary, adminDeleteProfile, adminExportMemories } from "../../lib/api";

export default function MemoriesPage() {
  const [userKey, setUserKey] = useState("");
  const [data, setData] = useState({ profiles: [], summaries: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListMemories(userKey || undefined, 200);
      setData(res || { profiles: [], summaries: [] });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onExport = async () => {
    const res = await adminExportMemories(userKey || undefined);
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'memories.json'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI Memories</h1>

      <div className="flex items-center gap-2">
        <input className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder="Filter by user_key (optional)" value={userKey} onChange={(e)=> setUserKey(e.target.value)} />
        <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={load}>Filter</button>
        <button className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-medium" onClick={onExport}>Export JSON</button>
      </div>

      {loading ? <div className="text-zinc-400">Loading...</div> : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="font-medium mb-2">Profiles</div>
            <div className="space-y-2">
              {data.profiles.map((p, i) => (
                <div key={i} className="border border-zinc-800 rounded-lg p-3">
                  <div className="text-sm text-zinc-400">{p.user_key}</div>
                  <div className="text-sm whitespace-pre-wrap">{p.notes}</div>
                  <div className="mt-2">
                    <button className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-xs" onClick={async ()=> { await adminDeleteProfile(p.user_key); await load(); }}>Delete</button>
                  </div>
                </div>
              ))}
              {data.profiles.length === 0 && <div className="text-zinc-400 text-sm">No profiles</div>}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="font-medium mb-2">Summaries</div>
            <div className="space-y-2">
              {data.summaries.map((s, i) => (
                <div key={i} className="border border-zinc-800 rounded-lg p-3">
                  <div className="text-sm text-zinc-400">Conv: {s.conversation_id}</div>
                  <div className="text-sm whitespace-pre-wrap">{s.summary}</div>
                  <div className="mt-2">
                    <button className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-xs" onClick={async ()=> { await adminDeleteSummary(s.conversation_id); await load(); }}>Delete</button>
                  </div>
                </div>
              ))}
              {data.summaries.length === 0 && <div className="text-zinc-400 text-sm">No summaries</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
