"use client";

import { useEffect, useState } from "react";
import { adminAnalytics } from "../../lib/api";
import { Line, Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState({ chats_per_day: [], topic_distribution: {} });

  useEffect(() => { load(); }, [days]);

  const load = async () => {
    const res = await adminAnalytics(days);
    setData(res || { chats_per_day: [], topic_distribution: {} });
  };

  const exportCSV = () => {
    const rows = [["date","count"], ...data.chats_per_day.map(d => [d.date, d.count])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'chats_per_day.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const lineData = {
    labels: data.chats_per_day.map(d => d.date),
    datasets: [{ label: 'Chats', data: data.chats_per_day.map(d => d.count), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.2)' }]
  };

  const topics = Object.entries(data.topic_distribution || {});
  const barData = {
    labels: topics.map(([k]) => k),
    datasets: [{ label: 'Count', data: topics.map(([,v]) => v), backgroundColor: '#3b82f6' }]
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <div className="flex items-center gap-2">
        <select className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm" value={days} onChange={(e)=> setDays(Number(e.target.value))}>
          {[7,14,30,60,90,180,365].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
        <button className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-medium" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
          <div className="text-sm mb-2 text-zinc-400">Chats per day</div>
          <Line data={lineData} />
        </div>
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
          <div className="text-sm mb-2 text-zinc-400">Topic distribution</div>
          <Bar data={barData} />
        </div>
      </div>
    </div>
  );
}
