"use client";

import { useEffect, useState } from "react";
import { adminBackupCreate, adminBackupList } from "../../lib/api";

export default function ToolsPage() {
  const [backups, setBackups] = useState([]);
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const load = async () => {
    try {
      const res = await adminBackupList();
      setBackups(res.backups || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await adminBackupCreate();
      setLastResult(res);
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Failed to create backup");
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tools & Integrations</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">Database Manager</div>
          <button disabled={creating} className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-medium disabled:opacity-60" onClick={createBackup}>{creating ? 'Creating…' : 'Create Backup Now'}</button>
          {lastResult && (
            <pre className="text-xs text-zinc-400 overflow-auto max-h-56">{JSON.stringify(lastResult, null, 2)}</pre>
          )}
          <div>
            <div className="text-sm text-zinc-400 mb-1">Available backups (directories under data/archive/)</div>
            <ul className="text-sm max-h-48 overflow-auto list-disc list-inside">
              {backups.map((b) => <li key={b}>{b}</li>)}
              {backups.length===0 && <li className="list-none text-zinc-500">No backups yet</li>}
            </ul>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">Data Export</div>
          <div className="text-sm text-zinc-400">Use backups to export Knowledge base, Memories, Conversations, Settings as JSONL files.</div>
          <div className="text-xs text-zinc-500">Note: Downloading ZIP from server is not implemented yet. Access files on the server at the backup directory path.</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
          <div className="font-medium">Google Drive / Sheets</div>
          <div className="text-sm text-zinc-400">Connect Taliyo AI to sync forms, client sheets, invoices.</div>
          <div className="text-xs text-zinc-500">TODO: Implement OAuth flow and background sync jobs.</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
          <div className="font-medium">Embeddings Import/Export</div>
          <div className="text-sm text-zinc-400">Export/import embeddings for the vector DB.</div>
          <div className="text-xs text-zinc-500">TODO: Add endpoints to export CSV/JSONL of embeddings and import from file.</div>
        </div>
      </div>
    </div>
  );
}
