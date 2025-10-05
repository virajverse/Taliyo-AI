import { useMemo, useState } from "react";
import Markdown from "./Markdown";
import { FiCopy, FiRefreshCw, FiChevronRight, FiThumbsUp, FiThumbsDown, FiCheck } from "react-icons/fi";

export default function ChatMessage({ role, content, ts, status, assistantAvatarUrl, userAvatarUrl, onRegenerate, onContinue, disabledActions }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState(null);

  const tsText = useMemo(() => {
    if (!ts) return "";
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(ts));
    } catch {
      return "";
    }
  }, [ts]);

  const isShort = useMemo(() => {
    const t = String(content || "").trim();
    const lines = t.split(/\r?\n/).length;
    return t.length > 0 && t.length <= 32 && lines <= 2;
  }, [content]);

  const relText = useMemo(() => {
    if (!ts) return "";
    try {
      const diff = Date.now() - Number(ts);
      const s = Math.max(0, Math.floor(diff / 1000));
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      return `${d}d ago`;
    } catch {
      return "";
    }
  }, [ts]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(content || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className={`group relative w-full py-3 flex ${isUser ? 'justify-end pr-3 pl-12' : 'justify-start pl-3 pr-12'}`}>
      <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-zinc-900' 
            : 'bg-zinc-800 text-zinc-200 border border-zinc-700/50'
        }`}>
          {isUser ? (
            userAvatarUrl ? (
              <img src={userAvatarUrl} alt="You" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-sm">👤</span>
            )
          ) : assistantAvatarUrl ? (
            <img src={assistantAvatarUrl} alt="AI" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-sm">🤖</span>
          )}
        </div>

        {/* Message Content */}
        <div className={`relative flex-1 min-w-0 ${
          isUser ? 'flex items-center' : ''
        }`}>
          <div 
            className={`relative inline-block max-w-[92%] sm:max-w-[90%] md:max-w-[78%] lg:max-w-[72%] min-w-[8rem] sm:min-w-[10rem] px-4 py-3 rounded-2xl break-words leading-relaxed ${
              isUser 
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-zinc-900 rounded-br-sm' 
                : 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 rounded-bl-sm'
            }`}
          >
            {isUser ? (
              <div className={`whitespace-pre-wrap ${isShort ? 'text-[16px] md:text-[17px] leading-7' : 'text-[15px] leading-relaxed'}`}>{content}</div>
            ) : (
              <Markdown>{content}</Markdown>
            )}

            {/* Bubble tails */}
            {isUser ? (
              <span className="pointer-events-none absolute -bottom-1 right-3 w-3 h-3 rotate-45 bg-amber-500" />
            ) : (
              <span className="pointer-events-none absolute -bottom-1 left-3 w-3 h-3 rotate-45 bg-zinc-900 border-l border-t border-zinc-800" />
            )}

            {/* Timestamp */}
            <div className={`mt-1.5 flex items-center justify-end gap-2 text-xs ${
              isUser ? 'text-amber-900/80' : 'text-zinc-500'
            }`}>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                {tsText}
              </span>
              {!isUser && (
                <button
                  onClick={handleCopy}
                  className={`p-1 rounded-md transition-colors ${
                    copied 
                      ? 'text-green-400' 
                      : 'opacity-0 group-hover:opacity-100 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={copied ? 'Copied!' : 'Copy'}
                >
                  {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Actions for assistant messages */}
          {!isUser && (
            <div className="absolute -bottom-6 right-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setReaction(reaction === 'up' ? null : 'up')}
                className={`p-1.5 rounded-full transition-colors ${
                  reaction === 'up' 
                    ? 'bg-yellow-500/10 text-yellow-400' 
                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
                title="Helpful"
              >
                <FiThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setReaction(reaction === 'down' ? null : 'down')}
                className={`p-1.5 rounded-full transition-colors ${
                  reaction === 'down' 
                    ? 'bg-red-500/10 text-red-400' 
                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
                title="Not helpful"
              >
                <FiThumbsDown className="w-3.5 h-3.5" />
              </button>
              
              <div className="h-4 w-px bg-zinc-700 mx-1"></div>
              
              {onRegenerate && (
                <button
                  onClick={() => !disabledActions && onRegenerate()}
                  disabled={disabledActions}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-400 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-zinc-700"
                  title="Regenerate response"
                >
                  <FiRefreshCw className="inline w-3 h-3 mr-1 -mt-0.5" />
                  Regenerate
                </button>
              )}
              
              {onContinue && (
                <button
                  onClick={() => !disabledActions && onContinue()}
                  disabled={disabledActions}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-zinc-700"
                  title="Continue generating"
                >
                  <FiChevronRight className="inline w-3.5 h-3.5 -mr-0.5" />
                  Continue
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
