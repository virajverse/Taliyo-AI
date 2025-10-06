"use client";

import { useEffect, useState } from "react";
import { adminGetSettings, adminPutSettings, adminTestConnection } from "../../lib/api";

export default function SettingsPage() {
  const [cfg, setCfg] = useState({
    model: "",
    temperature: 0.7,
    max_tokens: 2048,
    tone: "",
    greeting: "",
    system_prompt: "",
    context_limit: 30,
    backup_enabled: false,
    backup_interval_hours: 24,
    rate_limit_per_minute: 0,
    encryption_at_rest: false,
  });
  const [secretsMasked, setSecretsMasked] = useState({
    gemini_api_key: "",
    pinecone_api_key: "",
    google_search_api_key: "",
    firebase_key: "",
  });
  const [secretsInput, setSecretsInput] = useState({
    gemini_api_key: "",
    pinecone_api_key: "",
    google_search_api_key: "",
    firebase_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ gemini: null, mongodb: null, vector: null });

  useEffect(() => {
    (async () => {
      const s = await adminGetSettings();
      setCfg(s.config || {});
      setSecretsMasked(s.secrets || {});
    })();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = { config: cfg, secrets: {} };
      Object.entries(secretsInput).forEach(([k,v]) => { if (v && String(v).trim()) payload.secrets[k] = v; });
      await adminPutSettings(payload);
      const fresh = await adminGetSettings();
      setCfg(fresh.config || {});
      setSecretsMasked(fresh.secrets || {});
      setSecretsInput({ gemini_api_key: "", pinecone_api_key: "", google_search_api_key: "", firebase_key: "" });
      alert("Saved settings");
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const doTest = async (service) => {
    setTest(t => ({ ...t, [service]: 'testing' }));
    const res = await adminTestConnection(service);
    setTest(t => ({ ...t, [service]: res?.ok ? 'ok' : (res?.error || 'fail') }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI Configuration & API Settings</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">AI Parameters</div>
          <div className="grid gap-2">
            <label className="text-sm">Model
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.model || ''} onChange={(e)=> setCfg({ ...cfg, model: e.target.value })} />
            </label>
            <label className="text-sm">Temperature
              <input type="number" step="0.1" className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.temperature ?? 0.7} onChange={(e)=> setCfg({ ...cfg, temperature: parseFloat(e.target.value) })} />
            </label>
            <label className="text-sm">Max Tokens
              <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.max_tokens ?? 2048} onChange={(e)=> setCfg({ ...cfg, max_tokens: parseInt(e.target.value||'0',10) })} />
            </label>
            <label className="text-sm">Tone
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.tone || ''} onChange={(e)=> setCfg({ ...cfg, tone: e.target.value })} />
            </label>
            <label className="text-sm">Greeting
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.greeting || ''} onChange={(e)=> setCfg({ ...cfg, greeting: e.target.value })} />
            </label>
            <label className="text-sm">System Prompt
              <textarea rows={4} className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.system_prompt || ''} onChange={(e)=> setCfg({ ...cfg, system_prompt: e.target.value })} />
            </label>
            <label className="text-sm">Context Limit (last N chats)
              <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.context_limit ?? 30} onChange={(e)=> setCfg({ ...cfg, context_limit: parseInt(e.target.value||'0',10) })} />
            </label>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">Platform Settings</div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={!!cfg.backup_enabled} onChange={(e)=> setCfg({ ...cfg, backup_enabled: e.target.checked })} /> Auto backup every {cfg.backup_interval_hours}h
          </label>
          <label className="text-sm">Backup Interval (hours)
            <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.backup_interval_hours ?? 24} onChange={(e)=> setCfg({ ...cfg, backup_interval_hours: parseInt(e.target.value||'0',10) })} />
          </label>
          <label className="text-sm">Rate limit per minute (0 = off)
            <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={cfg.rate_limit_per_minute ?? 0} onChange={(e)=> setCfg({ ...cfg, rate_limit_per_minute: parseInt(e.target.value||'0',10) })} />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={!!cfg.encryption_at_rest} onChange={(e)=> setCfg({ ...cfg, encryption_at_rest: e.target.checked })} /> Encryption at rest
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
          <div className="font-medium">Secrets</div>
          <div className="text-xs text-zinc-500">Current: masked. Enter a value to replace.</div>
          {[
            ['gemini_api_key','Gemini API Key'],
            ['pinecone_api_key','Pinecone API Key'],
            ['google_search_api_key','Google Search API Key'],
            ['firebase_key','Firebase Key'],
          ].map(([k,label]) => (
            <div key={k}>
              <div className="text-xs text-zinc-400">{label}: <span className="text-zinc-500">{secretsMasked?.[k] || 'not set'}</span></div>
              <input type="password" className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder={`Enter new ${label} (optional)`} value={secretsInput[k] || ''} onChange={(e)=> setSecretsInput(s => ({ ...s, [k]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
          <div className="font-medium">Test Connections</div>
          <div className="flex gap-2 flex-wrap">
            {['mongodb','gemini','vector'].map((s) => (
              <button key={s} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm" onClick={()=> doTest(s)}>
                {s.toUpperCase()} {test[s] === 'ok' ? '✅' : (test[s] === 'testing' ? '…' : (test[s] ? '❌' : ''))}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button disabled={saving} className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-medium disabled:opacity-60" onClick={onSave}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>
    </div>
  );
}
