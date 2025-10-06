"use client";

import { useEffect, useState } from "react";
import { adminHealth, adminAnalytics, adminKbStats, adminRecentMessages, adminTopQueries } from "../../lib/api";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function DashboardPage() {
  const [health, setHealth] = useState(null);
  const [analytics, setAnalytics] = useState({ chats_per_day: [], topic_distribution: {} });
  const [kb, setKb] = useState({ total_docs: 0, docs_today: 0, docs_week: 0 });
  const [recent, setRecent] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [h, a, k, r, t] = await Promise.all([
          adminHealth(),
          adminAnalytics(30),
          adminKbStats(),
          adminRecentMessages(10, 'user'),
          adminTopQueries(5, 7),
        ]);
        if (!mounted) return;
        setHealth(h);
        setAnalytics(a);
        setKb(k || { total_docs: 0, docs_today: 0, docs_week: 0 });
        setRecent((r?.items) || []);
        setTop((t?.items) || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const chatsData = {
    labels: analytics.chats_per_day.map((d) => d.date),
    datasets: [
      {
        label: "Chats per day",
        data: analytics.chats_per_day.map((d) => d.count),
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        tension: 0.25,
      },
    ],
  };

  const topicLabels = Object.keys(analytics.topic_distribution || {});
  const topicValues = topicLabels.map((k) => analytics.topic_distribution[k]);
  const topicData = {
    labels: topicLabels,
    datasets: [
      {
        data: topicValues,
        backgroundColor: ["#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ef4444"],
      },
    ],
  };

  // Derived metrics for tiles
  const todayCount = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return (analytics?.chats_per_day || []).find((d) => d.date === today)?.count || 0;
  })();

  const weekCount = (() => {
    const last7 = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().slice(0, 10);
      })
    );
    return (analytics?.chats_per_day || [])
      .filter((d) => last7.has(d.date))
      .reduce((sum, d) => sum + (d.count || 0), 0);
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid md:grid-cols-6 gap-4">
        <div className="card">
          <div className="card-title">Backend</div>
          <div className="text-lg font-semibold">{health?.backend ? "Online" : "Unknown"}</div>
        </div>
        <div className="card">
          <div className="card-title">MongoDB</div>
          <div className="text-lg font-semibold">{health?.mongodb ? "Connected" : "Down"}</div>
        </div>
        <div className="card">
          <div className="card-title">Gemini API Key</div>
          <div className="text-lg font-semibold">{health?.gemini_key ? "Configured" : "Missing"}</div>
        </div>
        <div className="card">
          <div className="card-title">Vector Index</div>
          <div className="text-lg font-semibold">{health?.vector_index || "-"}</div>
        </div>
        <div className="card">
          <div className="card-title">Total chats (today)</div>
          <div className="text-lg font-semibold">{todayCount}</div>
        </div>
        <div className="card">
          <div className="card-title">Total chats (7d)</div>
          <div className="text-lg font-semibold">{weekCount}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 card">
          <div className="card-title">Usage Trends</div>
          <Line data={chatsData} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#a1a1aa" } }, y: { ticks: { color: "#a1a1aa" } } } }} />
        </div>
        <div className="card">
          <div className="card-title">Topic Distribution</div>
          <Pie data={topicData} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-title mb-2">Knowledge Base</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-zinc-500">Total Docs</div>
              <div className="text-lg font-semibold">{kb.total_docs}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">New Today</div>
              <div className="text-lg font-semibold">{kb.docs_today}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">New 7d</div>
              <div className="text-lg font-semibold">{kb.docs_week}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title mb-2">Recent User Queries</div>
          <ul className="space-y-2 text-sm max-h-48 overflow-auto">
            {recent.map((m,i)=> (
              <li key={i} className="border border-zinc-800 rounded-lg p-2 truncate" title={m.content}>
                {m.content}
              </li>
            ))}
            {recent.length===0 && <li className="text-zinc-500">No recent queries</li>}
          </ul>
        </div>
        <div className="card">
          <div className="card-title mb-2">Top 5 Queries (7d)</div>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            {top.map((t,i)=> (
              <li key={i} className="truncate" title={t.query}>{t.query} <span className="text-zinc-500">· {t.count}</span></li>
            ))}
            {top.length===0 && <li className="text-zinc-500 list-none">No data</li>}
          </ol>
        </div>
      </div>

      {loading && <div className="text-zinc-400">Loading...</div>}
    </div>
  );
}
