"use client";

import { useMemo, useState } from "react";
import { FiPlus, FiSearch, FiTrash2, FiChevronRight, FiClock, FiZap, FiMessageSquare } from "react-icons/fi";

export default function Sidebar({ conversations = [], selectedId, onSelect, onNew, onDelete, onClose }) {
  const [query, setQuery] = useState("");

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const filtered = useMemo(() => {
    if (!query) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title?.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <aside className="w-72 md:w-72 lg:w-80 shrink-0 h-full bg-zinc-950/90 border-r border-zinc-800/60 text-zinc-200 flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800/60">
        {/* Mobile close button */}
        <div className="md:hidden mb-2">
          <button
            onClick={() => onClose && onClose()}
            className="p-2 rounded-lg btn-glass"
            aria-label="Close menu"
            title="Close"
          >
            <FiChevronRight className="w-5 h-5 transform rotate-180" />
          </button>
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-zinc-900 font-medium hover:opacity-90 transition-all duration-200 shadow-lg shadow-yellow-500/10"
        >
          <FiPlus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
        
        <div className="mt-3 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-zinc-900/70 border border-zinc-800/50 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40 focus:border-transparent placeholder-zinc-500"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2 scroll-unique">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-zinc-500">
            <FiSearch className="w-6 h-6 mb-2 opacity-50" />
            <p className="text-sm">No conversations found</p>
            <p className="text-xs mt-1 opacity-70">Start a new chat to get started</p>
          </div>
        ) : (
          <ul className="space-y-1 px-2">
            {filtered.map((c) => (
              <li key={c.id} className="relative group">
                <div
                  onClick={() => onSelect?.(c.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${
                    selectedId === c.id 
                      ? "bg-gradient-to-r from-zinc-800/70 to-zinc-800/40 border border-zinc-700/50" 
                      : "hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <FiMessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-zinc-100 truncate">
                        {c.title || "Untitled"}
                      </h3>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {formatDate(c.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500 flex items-center">
                        <FiClock className="w-3 h-3 mr-1" />
                        {new Date(c.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                    title="Delete conversation"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800/60">
        <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/60 p-3.5 border border-zinc-800/50">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-400">
              <FiZap className="w-4 h-4" />
            </div>
            <h4 className="font-medium text-sm text-zinc-100">Upgrade to Pro</h4>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Unlock advanced features and Increased usage limits with Taliyo Pro.
          </p>
          <button className="mt-3 w-full py-1.5 px-3 text-xs font-medium bg-zinc-800/70 hover:bg-zinc-800 rounded-lg transition-colors">
            Upgrade now
          </button>
        </div>
      </div>
    </aside>
  );
}
