"use client";

import { useEffect, useState } from "react";
import { adminListFacts, adminCreateFact, adminUpdateFact, adminDeleteFact, adminSearchDocs } from "../../lib/api";

export default function TrainingPage() {
  const [facts, setFacts] = useState([]);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [k, setK] = useState(5);

  const load = async () => {
    const res = await adminListFacts(200);
    setFacts(res.items || []);
  };

  useEffect(() => { load(); }, []);

  const addFact = async () => {
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    try {
      const ts = tags.split(",").map(s=>s.trim()).filter(Boolean);
      await adminCreateFact(t, ts);
      setText(""); setTags("");
      await load();
    } finally { setSaving(false); }
  };

  const saveFact = async (id, newText, newTagsCsv) => {
    const ts = newTagsCsv.split(",").map(s=>s.trim()).filter(Boolean);
    await adminUpdateFact(id, { text: newText, tags: ts });
    await load();
  };

  const delFact = async (id) => {
    if (!confirm("Delete this fact?")) return;
    await adminDeleteFact(id);
    await load();
  };

  const testRag = async () => {
    if (!q.trim()) return;
    const res = await adminSearchDocs(q.trim(), k);
    setHits(res.hits || []);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Training & Testing</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">Add Fact</div>
          <textarea rows={4} className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder="e.g., Taliyo Technologies was founded in 2019." value={text} onChange={(e)=> setText(e.target.value)} />
          <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder="tags (comma separated)" value={tags} onChange={(e)=> setTags(e.target.value)} />
          <button disabled={saving} className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-medium disabled:opacity-60" onClick={addFact}>{saving ? 'Saving…' : 'Add Fact'}</button>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">RAG Test Bench</div>
          <div className="flex gap-2">
            <input className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder="Enter a test query" value={q} onChange={(e)=> setQ(e.target.value)} />
            <input type="number" min={1} max={20} className="w-24 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={k} onChange={(e)=> setK(parseInt(e.target.value||'5',10))} />
            <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm" onClick={testRag}>Search</button>
          </div>
          <div className="space-y-2 max-h-60 overflow-auto">
            {hits.map((h,i)=> (
              <div key={i} className="border border-zinc-800 rounded-lg p-2 text-sm">
                <div className="text-xs text-zinc-500">score {typeof h.score==='number' ? h.score.toFixed(3) : h.score}</div>
                <div className="whitespace-pre-wrap">{h.text}</div>
              </div>
            ))}
            {hits.length===0 && <div className="text-zinc-500 text-sm">No results</div>}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
        <div className="font-medium mb-2">Facts</div>
        <div className="space-y-3">
          {facts.map((f) => (
            <FactItem key={f.id} item={f} onSave={saveFact} onDelete={delFact} />
          ))}
          {facts.length===0 && <div className="text-zinc-500 text-sm">No facts yet</div>}
        </div>
      </div>
    </div>
  );
}

function FactItem({ item, onSave, onDelete }) {
  const [t, setT] = useState(item.text || "");
  const [tagsCsv, setTagsCsv] = useState((item.tags || []).join(", "));
  const [edit, setEdit] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-lg p-3">
      {edit ? (
        <>
          <textarea rows={3} className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={t} onChange={(e)=> setT(e.target.value)} />
          <input className="w-full mt-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={tagsCsv} onChange={(e)=> setTagsCsv(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="px-3 py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-sm" onClick={()=> { onSave(item.id, t, tagsCsv); setEdit(false); }}>Save</button>
            <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm" onClick={()=> { setT(item.text||""); setTagsCsv((item.tags||[]).join(", ")); setEdit(false); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm whitespace-pre-wrap">{item.text}</div>
          <div className="text-xs text-zinc-500">{(item.tags||[]).join(", ")}</div>
          <div className="mt-2 flex gap-2">
            <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm" onClick={()=> setEdit(true)}>Edit</button>
            <button className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-sm" onClick={()=> onDelete(item.id)}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
