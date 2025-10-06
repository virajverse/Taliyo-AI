"use client";

import { useEffect, useState } from "react";
import { adminListChats, adminChatDetail, adminSubmitFeedback } from "../../lib/api";

export default function ChatsPage() {
  const [days, setDays] = useState(30);
  const [userKey, setUserKey] = useState("");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListChats(userKey || undefined, days);
      setList(res.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const open = async (id) => {
    const d = await adminChatDetail(id);
    setSelected(d);
  };

  const onFeedback = async (rating) => {
    if (!selected?.conversation?.id) return;
    await adminSubmitFeedback(selected.conversation.id, rating, undefined);
    alert("Feedback recorded");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Chat History</h1>

      <div className="flex items-center gap-2">
        <select className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={days} onChange={(e)=> setDays(Number(e.target.value))}>
          {[7,14,30,60,90,180,365].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
        <input className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder="Filter by user_key" value={userKey} onChange={(e)=> setUserKey(e.target.value)} />
        <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={load}>Apply</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
          <div className="font-medium mb-2">Conversations</div>
          <div className="space-y-1 max-h-[60vh] overflow-auto">
            {list.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className="w-full text-left px-3 py-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800">
                <div className="text-sm font-medium">{c.title || 'Untitled'}</div>
                <div className="text-xs text-zinc-500">{c.user_key || '-'} · {c.updated_at ? new Date(c.updated_at).toLocaleString() : '-'}</div>
              </button>
            ))}
            {list.length === 0 && <div className="text-zinc-400 text-sm">No conversations</div>}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
          <div className="font-medium mb-2">Conversation Detail</div>
          {selected ? (
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              <div className="text-sm text-zinc-400">{selected.conversation?.title} · {selected.conversation?.id}</div>
              {(selected.messages || []).map((m, i) => (
                <div key={i} className={`p-2 rounded-lg border ${m.role==='user' ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-800 bg-zinc-950/80'}`}>
                  <div className="text-xs text-zinc-500">{m.role} · {m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</div>
                  <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-sm" onClick={() => onFeedback(5)}>👍 Good</button>
                <button className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-sm" onClick={() => onFeedback(1)}>👎 Bad</button>
              </div>
            </div>
          ) : (
            <div className="text-zinc-400">Select a conversation</div>
          )}
        </div>
      </div>
    </div>
  );
}
