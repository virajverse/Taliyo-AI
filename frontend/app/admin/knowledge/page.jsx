"use client";

import { useEffect, useState } from "react";
import { adminListDocs, adminDeleteDoc, adminSearchDocs, adminCrawl } from "../../lib/api";
import { ingestPdf } from "../../lib/api";

export default function KnowledgePage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [urls, setUrls] = useState("https://taliyotechnologies.com");
  const [crawlResult, setCrawlResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListDocs();
      setDocs(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await ingestPdf(file);
      alert(res?.ok ? `Ingested ${res.chunks} chunks` : (res?.error || "Failed"));
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Upload failed");
    } finally {
      e.target.value = "";
    }
  };

  const onDelete = async (docId) => {
    if (!confirm("Delete this document and its chunks?")) return;
    await adminDeleteDoc(docId);
    await load();
  };

  const onSearch = async () => {
    if (!query.trim()) return;
    const res = await adminSearchDocs(query.trim(), 5);
    alert(JSON.stringify(res.hits, null, 2));
  };

  const onCrawl = async () => {
    const list = urls.split(/\n|,|\s+/).map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    const res = await adminCrawl(list);
    setCrawlResult(res);
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Knowledge Base</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">Upload Document (PDF)</div>
          <input type="file" accept="application/pdf" onChange={onUpload} className="text-sm" />
          <div className="text-xs text-zinc-400">PDF will be parsed, chunked, embedded, and indexed.</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
          <div className="font-medium">Website Crawler</div>
          <textarea className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" rows={4} value={urls} onChange={(e)=> setUrls(e.target.value)} placeholder="Enter URLs separated by comma or newline" />
          <button className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-medium" onClick={onCrawl}>Crawl & Index</button>
          {crawlResult && (
            <pre className="text-xs text-zinc-400 overflow-auto max-h-40">{JSON.stringify(crawlResult, null, 2)}</pre>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
        <div className="flex items-center gap-2">
          <input className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" placeholder="Test a question against knowledge base" value={query} onChange={(e)=> setQuery(e.target.value)} />
          <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={onSearch}>Test</button>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
        <div className="font-medium mb-3">Documents</div>
        {loading ? (
          <div className="text-zinc-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Chunks</th>
                  <th className="py-2 pr-4">Added</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.doc_id} className="border-b border-zinc-900/60">
                    <td className="py-2 pr-4">{d.name}</td>
                    <td className="py-2 pr-4">{d.type}</td>
                    <td className="py-2 pr-4">{d.chunks}</td>
                    <td className="py-2 pr-4">{d.updated_at ? new Date(d.updated_at).toLocaleString() : "-"}</td>
                    <td className="py-2 pr-4">{d.status}</td>
                    <td className="py-2 pr-4">
                      <button className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-xs" onClick={() => onDelete(d.doc_id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
