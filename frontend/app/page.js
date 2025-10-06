"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sendMessage as apiSendMessage, sendVoice as apiSendVoice, listConversations as apiListConversations, getConversation as apiGetConversation, deleteConversation as apiDeleteConversation, summarizeImage as apiSummarizeImage, askAboutFile as apiAskAboutFile, ingestPdf as apiIngestPdf, health as apiHealth, verifyAuth as apiVerifyAuth } from "./lib/api";
import ChatMessage from "./components/ChatMessage";
import Sidebar from "./components/Sidebar";
import Hero from "./components/Hero";
import TypingBubble from "./components/TypingBubble";
import Toolbar from "./components/Toolbar";
import RightPanel from "./components/RightPanel";
import ThemeToggle from "./components/ThemeToggle";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I'm Taliyo AI. How can I help you today?", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState("auto"); // auto | low | medium | high
  const [lastMeta, setLastMeta] = useState(null); // { model, quality }
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const endRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [mode, setMode] = useState("chat"); // chat | voice | image
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState([
    "Summarize this",
    "Make bullet points",
    "Translate to Hindi",
    "Write an outline",
    "Make it shorter",
  ]);
  const [qrOpen, setQrOpen] = useState(false);
  const [newChip, setNewChip] = useState("");
  const [search, setSearch] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [backendStatus, setBackendStatus] = useState("checking"); // checking | ok | down
  const [aiVoiceReplies, setAiVoiceReplies] = useState(false); // when true, AI will speak back in Voice mode
  const [userKey, setUserKey] = useState(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestInfo, setIngestInfo] = useState(null); // { ok, chunks, doc_id } or { error }
  const [webSearch, setWebSearch] = useState(false);

  // Local cache helpers for resilience when backend restarts or is offline
  function saveCachedConversations(list) {
    try { localStorage.setItem("taliyo_conversations", JSON.stringify(list || [])); } catch {}
  }
  function loadCachedConversations() {
    try { return JSON.parse(localStorage.getItem("taliyo_conversations") || "[]"); } catch { return []; }
  }
  function saveCachedMessages(id, msgs) {
    if (!id) return; try { localStorage.setItem(`taliyo_msgs_${id}`, JSON.stringify(msgs || [])); } catch {}
  }
  function loadCachedMessages(id) {
    if (!id) return null; try { return JSON.parse(localStorage.getItem(`taliyo_msgs_${id}`) || "null"); } catch { return null; }
  }

  // Verify auth on load; if unauthorized, redirect to /login
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await apiVerifyAuth();
      } catch {
        if (!mounted) return;
        try { router.replace('/login'); } catch {}
      }
    };
    check();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1000);
    return () => clearTimeout(t);
  }, []);

  // Stable per-user id for memory/RAG scoping
  useEffect(() => {
    try {
      let k = localStorage.getItem("taliyo_user_key");
      if (!k) {
        k = "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("taliyo_user_key", k);
      }
      setUserKey(k);
    } catch {}
  }, []);

  // Backend health check (on load + periodic)
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await apiHealth();
        if (!mounted) return;
        setBackendStatus((res && res.status === "ok") ? "ok" : "down");
      } catch {
        if (mounted) setBackendStatus("down");
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const autoResizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px"; // cap at 10rem
  };

  function getRecognition() {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return null;
    const r = new SR();
    r.lang = "hi-IN"; // set to Hindi; browser will auto-mix with English fairly well
    r.interimResults = false;
    r.maxAlternatives = 1;
    return r;
  }

  function findPrevUserPrompt(beforeIndex) {
    try {
      for (let i = beforeIndex - 1; i >= 0; i--) {
        const m = messages[i];
        if (m && m.role === 'user') return String(m.content || "");
      }
    } catch {}
    return input || "";
  }

  async function handleRegenerate(atIndex) {
    const prevPrompt = findPrevUserPrompt(atIndex);
    if (!prevPrompt) return;
    setLoading(true);
    try {
      const q = quality !== "auto" ? quality : undefined;
      if (imageFile) {
        const res = await apiAskAboutFile(imageFile, prevPrompt, q, conversationId);
        if (res.conversation_id) setConversationId(res.conversation_id);
        setLastMeta({ model: res.model, quality: res.quality });
        setMessages((prev) => [...prev, { role: "assistant", content: res.answer, ts: Date.now() }]);
      } else {
        const data = await apiSendMessage(prevPrompt, q, conversationId, { userKey, tool: webSearch ? 'web_search' : 'rag_search', toolArgs: { query: prevPrompt, k: 5 } });
        setConversationId(data.conversation_id);
        setLastMeta({ model: data.model, quality: data.quality });
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
      }
      refreshConversations();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Unknown error";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${detail}` }]);
      console.error("Regenerate error:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    setLoading(true);
    try {
      const q = quality !== "auto" ? quality : undefined;
      if (imageFile) {
        const res = await apiAskAboutFile(imageFile, "Continue", q, conversationId);
        if (res.conversation_id) setConversationId(res.conversation_id);
        setLastMeta({ model: res.model, quality: res.quality });
        setMessages((prev) => [...prev, { role: "assistant", content: res.answer, ts: Date.now() }]);
      } else {
        const data = await apiSendMessage("Continue", q, conversationId, { userKey, tool: webSearch ? 'web_search' : 'rag_search', toolArgs: { query: "Continue", k: 5 } });
        setConversationId(data.conversation_id);
        setLastMeta({ model: data.model, quality: data.quality });
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
      }
      refreshConversations();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Unknown error";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${detail}` }]);
      console.error("Continue error:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  }

  function clearFile() {
    if (imagePreviewUrl) {
      try { URL.revokeObjectURL(imagePreviewUrl); } catch {}
    }
    setImageFile(null);
    setImagePreviewUrl(null);
  }

  async function onFileChange(e) {
    const f = e.target.files?.[0];
    if (f) {
      clearFile();
      setImageFile(f);
      if (f.type && f.type.startsWith("image/")) {
        try { setImagePreviewUrl(URL.createObjectURL(f)); } catch {}
      }
      // Auto-ingest PDF knowledge
      try {
        if (String(f.type || '').toLowerCase().includes('pdf')) {
          setIngesting(true);
          setIngestInfo(null);
          const res = await apiIngestPdf(f, userKey);
          if (res && res.ok) setIngestInfo(res); else setIngestInfo({ error: res?.error || 'Ingestion failed' });
        }
      } catch (err) {
        setIngestInfo({ error: err?.response?.data?.error || err?.message || 'Ingestion failed' });
      } finally {
        setIngesting(false);
      }
      // Allow selecting the same file again later
      e.target.value = "";
    }
  }


  async function onSummarizeImage(fileParam) {
    const file = fileParam || imageFile;
    if (!file) {
      alert("Please choose an image first.");
      return;
    }
    setLoading(true);
    setAnalyzing(true);
    setUploadPct(0);
    // Show a placeholder user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Summarize file: ${file.name}`, ts: Date.now(), status: "sent" },
    ]);
    try {
      const q = quality !== "auto" ? quality : undefined;
      let res;
      if (file.type && file.type.startsWith("image/")) {
        res = await apiSummarizeImage(file, imagePrompt || undefined, q, conversationId, undefined, (e) => {
          if (e?.total) setUploadPct(e.loaded / e.total);
        });
        if (res.conversation_id) setConversationId(res.conversation_id);
        setLastMeta({ model: res.model, quality: res.quality });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.summary, ts: Date.now() },
        ]);
      } else {
        res = await apiAskAboutFile(file, imagePrompt || "Summarize the document in key points.", q, conversationId, userKey, (e) => {
          if (e?.total) setUploadPct(e.loaded / e.total);
        });
        if (res.conversation_id) setConversationId(res.conversation_id);
        setLastMeta({ model: res.model, quality: res.quality });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.answer, ts: Date.now() },
        ]);
      }
      setImagePrompt("");
      // keep file for convenience; user can change
      refreshConversations();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Unknown error";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${detail}` }]);
      console.error("Image summarize error:", err?.response?.data || err);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }

  function playBase64Audio(b64, mime = "audio/mpeg") {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().finally(() => URL.revokeObjectURL(url));
    } catch (e) {
      console.error("Failed to play audio", e);
    }
  }

  async function onVoiceTurn(transcript) {
    setMessages(prev => [...prev, { role: "user", content: transcript, ts: Date.now(), status: "sent" }]);
    setLoading(true);
    try {
      const q = quality !== "auto" ? quality : undefined;
      if (imageFile) {
        // For files, always return text (no TTS) to keep UX simple
        const res = await apiAskAboutFile(imageFile, transcript, q, conversationId);
        if (res.conversation_id) setConversationId(res.conversation_id);
        setLastMeta({ model: res.model, quality: res.quality });
        setMessages(prev => [...prev, { role: "assistant", content: res.answer, ts: Date.now() }]);
        refreshConversations();
      } else if (aiVoiceReplies) {
        // Both-side voice enabled: AI speaks back
        const data = await apiSendVoice(transcript, q, conversationId, {}, { userKey, tool: webSearch ? 'web_search' : 'rag_search', toolArgs: { query: transcript, k: 5 } });
        setConversationId(data.conversation_id);
        setLastMeta({ model: data.model, quality: data.quality });
        setMessages(prev => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
        if (data.audio_base64) {
          playBase64Audio(data.audio_base64, data.audio_mime || "audio/mpeg");
        }
        refreshConversations();
      } else {
        // Text-only returns even in Voice mode
        const data = await apiSendMessage(transcript, q, conversationId, { userKey, tool: webSearch ? 'web_search' : 'rag_search', toolArgs: { query: transcript, k: 5 } });
        setConversationId(data.conversation_id);
        setLastMeta({ model: data.model, quality: data.quality });
        setMessages(prev => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
        refreshConversations();
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Unknown error";
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${detail}` }]);
      console.error("API error:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    const r = getRecognition();
    if (!r) {
      alert("Speech Recognition is not supported in this browser. Use Chrome on desktop.");
      return;
    }
    recRef.current = r;

    // Ask for mic permission first to trigger the browser prompt reliably
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      console.error("Mic permission denied", err);
      alert("Please allow microphone access to use Voice mode.");
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    r.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      if (transcript) onVoiceTurn(transcript);
    };
    r.onerror = (e) => {
      console.error("Speech recognition error", e);
      alert(`Speech recognition error: ${e?.error || "unknown"}`);
      setIsRecording(false);
    };
    r.onend = () => {
      setIsRecording(false);
    };
    try {
      r.start();
    } catch (err) {
      console.error("Failed to start recognition", err);
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const r = recRef.current;
    try { r && r.stop(); } catch {}
    setIsRecording(false);
  }

  // Dictate into the Image prompt (no server call; just transcribe)
  function startDictationToPrompt() {
    const r = getRecognition();
    if (!r) {
      alert("Speech Recognition is not supported in this browser. Use Chrome on desktop.");
      return;
    }
    recRef.current = r;
    setIsRecording(true);
    r.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      if (transcript) setImagePrompt((prev) => (prev ? prev + " " + transcript : transcript));
    };
    r.onerror = (e) => {
      console.error("Speech recognition error", e);
      alert(`Speech recognition error: ${e?.error || "unknown"}`);
      setIsRecording(false);
    };
    r.onend = () => setIsRecording(false);
    try {
      r.start();
    } catch (err) {
      console.error("Failed to start recognition", err);
      setIsRecording(false);
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load and persist draft input
  useEffect(() => {
    try {
      const d = localStorage.getItem("taliyo_draft");
      if (d) setInput(d);
    } catch {}
    // initialize size once in next tick
    setTimeout(autoResizeInput, 0);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("taliyo_draft", input); } catch {}
    autoResizeInput();
  }, [input]);

  // Load and persist quick replies
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("taliyo_quick_replies") || "null");
      if (Array.isArray(saved) && saved.length) setQuickReplies(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("taliyo_quick_replies", JSON.stringify(quickReplies)); } catch {}
  }, [quickReplies]);

  // Load/persist AI voice replies preference
  useEffect(() => {
    try {
      const v = localStorage.getItem("taliyo_ai_voice_replies");
      if (v != null) setAiVoiceReplies(v === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("taliyo_ai_voice_replies", aiVoiceReplies ? '1' : '0'); } catch {}
  }, [aiVoiceReplies]);

  // Track scroll to show "scroll to bottom" button
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScrollDown(!nearBottom);
    };
    el.addEventListener('scroll', handler);
    handler();
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Hydrate from local cache immediately so UI keeps conversations/messages across refresh
  useEffect(() => {
    try {
      const cached = loadCachedConversations();
      if (Array.isArray(cached) && cached.length) setConversations(cached);
      const last = localStorage.getItem("taliyo_last_conversation_id");
      if (last) {
        const msgs = loadCachedMessages(last);
        if (Array.isArray(msgs) && msgs.length) {
          setConversationId(last);
          setMessages(msgs);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshConversations();
  }, []);

  // Persist current conversation + messages and last selection to cache
  useEffect(() => {
    if (conversationId) {
      try { localStorage.setItem("taliyo_last_conversation_id", conversationId); } catch {}
      saveCachedMessages(conversationId, messages);
    }
  }, [conversationId, messages]);

  async function refreshConversations() {
    try {
      const list = await apiListConversations();
      if (Array.isArray(list) && list.length) {
        setConversations(list);
        saveCachedConversations(list);
      } else {
        const cached = loadCachedConversations();
        if (cached && cached.length) {
          setConversations(cached);
        } else {
          setConversations(list);
        }
      }
    } catch (e) {
      console.error("Failed to list conversations", e);
      const cached = loadCachedConversations();
      if (cached && cached.length) setConversations(cached);
    }
  }

  async function onSelectConversation(id) {
    try {
      const conv = await apiGetConversation(id);
      setConversationId(conv.id);
      const msgs = Array.isArray(conv.messages) ? conv.messages : [];
      if (msgs.length) {
        setMessages(msgs);
      } else {
        const cached = loadCachedMessages(id);
        if (Array.isArray(cached) && cached.length) setMessages(cached); else setMessages([]);
      }
      setLastMeta(null);
    } catch (e) {
      console.error("Failed to get conversation", e);
      // Fallback to cached messages if available
      const cached = loadCachedMessages(id);
      setConversationId(id);
      if (Array.isArray(cached) && cached.length) {
        setMessages(cached);
      } else {
        setMessages([]);
      }
    }
  }

  async function onDeleteConversation(id) {
    try {
      await apiDeleteConversation(id);
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
      await refreshConversations();
      // Cleanup local cache
      try { localStorage.removeItem(`taliyo_msgs_${id}`); } catch {}
      try {
        const current = loadCachedConversations();
        const next = (current || []).filter(c => c.id !== id);
        saveCachedConversations(next);
      } catch {}
    } catch (e) {
      console.error("Failed to delete conversation", e);
    }
  }

  function onNewChat() {
    setConversationId(null);
    setMessages([]);
    try { if (inputRef?.current) inputRef.current.style.height = 'auto'; } catch {}
  }

  const onSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !imageFile) return; // allow empty text if a file is attached (we'll use a default prompt)

    const userPrompt = trimmed || (imageFile ? (imageFile.type?.startsWith("image/") ? "Summarize this image" : (imageFile.type?.includes("pdf") ? "Summarize this PDF" : "Summarize this document")) : "");
    setMessages((prev) => [...prev, { role: "user", content: userPrompt, ts: Date.now(), status: "sent" }]);
    setInput("");
    try { if (inputRef?.current) { inputRef.current.style.height = 'auto'; } } catch {}
    setLoading(true);
    if (imageFile) { setAnalyzing(true); setUploadPct(0); }

    try {
      const q = quality !== "auto" ? quality : undefined;
      if (imageFile) {
        const res = await apiAskAboutFile(imageFile, userPrompt, q, conversationId, userKey, (e) => {
          if (e?.total) setUploadPct(e.loaded / e.total);
        });
        if (res.conversation_id) setConversationId(res.conversation_id);
        setLastMeta({ model: res.model, quality: res.quality });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.answer, ts: Date.now() },
        ]);
        refreshConversations();
      } else {
        const data = await apiSendMessage(userPrompt, q, conversationId, { userKey, tool: webSearch ? 'web_search' : 'rag_search', toolArgs: { query: userPrompt, k: 5 } });
        setConversationId(data.conversation_id);
        setLastMeta({ model: data.model, quality: data.quality });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, ts: Date.now() },
        ]);
        refreshConversations();
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${detail}` },
      ]);
      console.error("API error:", err?.response?.data || err);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <main className="h-[100dvh] md:h-screen w-full flex overflow-hidden">
      <div className="hidden md:block">
        <Sidebar
          conversations={conversations}
          selectedId={conversationId}
          onSelect={onSelectConversation}
          onNew={onNewChat}
          onDelete={onDeleteConversation}
        />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">
            <Sidebar
              conversations={conversations}
              selectedId={conversationId}
              onSelect={(id) => { setSidebarOpen(false); onSelectConversation(id); }}
              onNew={() => { setSidebarOpen(false); onNewChat(); }}
              onDelete={onDeleteConversation}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col px-3 md:px-6 py-4 md:py-6 gap-3 md:gap-4 pb-[env(safe-area-inset-bottom)] bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-900 text-zinc-100 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="md:hidden p-2 rounded-lg btn-glass" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <h1 className="text-lg md:text-2xl font-semibold">Taliyo AI</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden"></div>
            {lastMeta && (
              <div className="hidden md:block text-sm text-zinc-400">
                Model: <span className="font-medium">{lastMeta.model}</span> · Quality: <span className="font-medium capitalize">{lastMeta.quality}</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-2">
              <div className="relative">
                <input
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-sm w-64 text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Search in conversation"
                  value={search}
                  onChange={(e)=> setSearch(e.target.value)}
                />
                {search && (
                  <button className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200" title="Clear" onClick={()=> setSearch("")}>✕</button>
                )}
              </div>
              {search && (
                <div className="text-xs text-zinc-500">
                  Showing {messages.filter(m => String(m.content||"").toLowerCase().includes(search.toLowerCase())).length} / {messages.length}
                </div>
              )}
            </div>
            <div className="hidden md:block"><ThemeToggle /></div>
          </div>
        </div>

        {messages.length === 0 && (
          <Hero onStart={onNewChat} />
        )}

        <section className="flex-1 min-h-0 bg-zinc-900/60 border border-zinc-800 shadow-sm rounded-2xl flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-y-auto py-3 md:py-4 px-2 md:px-3 space-y-3 md:space-y-4 pb-24 md:pb-4 scroll-unique" ref={listRef}>
            <AnimatePresence initial={false}>
              {(search ? messages.map((m,i)=>({m,i})).filter(x => String(x.m.content||"").toLowerCase().includes(search.toLowerCase())) : messages.map((m,i)=>({m,i}))).map(({m,i}) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <ChatMessage
                    role={m.role}
                    content={m.content}
                    ts={m.ts}
                    status={m.status}
                    assistantAvatarUrl={process.env.NEXT_PUBLIC_ASSISTANT_AVATAR_URL}
                    userAvatarUrl={process.env.NEXT_PUBLIC_USER_AVATAR_URL}
                    onRegenerate={m.role === 'assistant' ? () => handleRegenerate(i) : undefined}
                    onContinue={m.role === 'assistant' ? () => handleContinue(i) : undefined}
                    disabledActions={loading}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <TypingBubble />
            )}
            <div ref={endRef} />
          </div>

          <div
            className={`p-2 md:p-3 bg-zinc-950/60 md:bg-zinc-900/60 ${isDragging ? "ring-2 ring-yellow-500/40" : ""} border border-zinc-800/80 md:border-zinc-800 rounded-2xl md:rounded-none m-2 md:m-0 backdrop-blur`}
            onDragOver={(e) => { e.preventDefault(); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) {
                clearFile();
                setImageFile(f);
                if (f.type && f.type.startsWith("image/")) {
                  try { setImagePreviewUrl(URL.createObjectURL(f)); } catch {}
                }
              }
            }}
          >
            {/* Toolbar pills */}
            <div className="hidden md:block">
              <Toolbar onInsert={(text) => setInput((inp) => (inp ? inp + (inp.endsWith(" ") ? "" : " ") + text : text))} />
            </div>

            {/* Analyzing progress */}
            {analyzing && (
              <div className="mt-2 w-full bg-zinc-800/60 rounded-full h-2 overflow-hidden">
                <div className="bg-accent-blue h-2" style={{ width: `${Math.round(uploadPct * 100)}%` }} />
              </div>
            )}
            <div className="hidden md:block mb-2">
              <div className="flex items-start justify-between">
                <div className="flex gap-2 overflow-x-auto md:flex-wrap no-scrollbar">
                  {quickReplies.map((s, i) => (
                    <button
                      key={i}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-yellow-500/40 hover:text-yellow-300"
                      onClick={() => setInput(inp => (inp ? inp + (inp.endsWith(" ") ? "" : " ") + s : s))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setQrOpen(v => !v)}
                  className="btn-glass px-2 py-1 text-xs ml-2"
                  title="Customize quick prompts"
                >⚙️</button>
              </div>
              {qrOpen && (
                <div className="mt-2 p-2 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 text-sm"
                      placeholder="Add a quick prompt"
                      value={newChip}
                      onChange={(e)=> setNewChip(e.target.value)}
                      onKeyDown={(e)=> { if (e.key==='Enter') { const t=newChip.trim(); if (t) { setQuickReplies(q=> [...q, t]); setNewChip(""); } } }}
                    />
                    <button className="btn-glass px-2 py-1 text-xs" onClick={()=> { const t=newChip.trim(); if (t) { setQuickReplies(q=> [...q, t]); setNewChip(""); } }}>Add</button>
                    <button className="btn-glass px-2 py-1 text-xs" onClick={()=> setQuickReplies(["Summarize this","Make bullet points","Translate to Hindi","Write an outline","Make it shorter"]) }>Reset</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((s,i)=> (
                      <div key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs">
                        <span className="truncate max-w-[140px]">{s}</span>
                        <button className="hover:text-red-400" title="Remove" onClick={()=> setQuickReplies(q => q.filter((_,idx)=> idx!==i))}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {mode === "chat" ? (
              <>
              <div className="flex items-end gap-2">
                {/* File + text + mic unified bar */}
                <div className="flex items-center flex-1 min-w-0 gap-2 border rounded-xl min-h-[3rem] px-2 py-1 border-zinc-800 bg-zinc-950">
                  {/* File picker */}
                  <label className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-800" title="Upload file" aria-label="Upload file">
                    <input type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv" className="hidden" onChange={onFileChange} />
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 11-7.78-7.78l8.49-8.49a3.5 3.5 0 115 4.95l-8.49 8.49a1.5 1.5 0 11-2.12-2.12l7.78-7.78" />
                    </svg>
                  </label>
                  {imageFile && (
                    <div className="flex items-center gap-2 max-w-[260px] bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300">
                      {imagePreviewUrl ? (
                        <img src={imagePreviewUrl} alt="preview" className="w-8 h-8 rounded object-cover border border-zinc-800" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-zinc-800/60 flex items-center justify-center">📄</div>
                      )}
                      <span className="truncate">{imageFile.name}</span>
                      <button
                        onClick={clearFile}
                        className="hover:text-red-400"
                        title="Remove file"
                      >✕</button>
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    className="flex-1 resize-none px-2 py-2 min-h-[2.5rem] max-h-40 overflow-y-auto focus:outline-none bg-transparent text-zinc-100 placeholder:text-zinc-500"
                    placeholder="Ask anything..."
                    value={input}
                    onChange={(e) => { setInput(e.target.value); try { const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px'; } catch {} }}
                    onKeyDown={onKeyDown}
                    rows={1}
                    autoFocus
                    title="Press Enter to send · Shift+Enter for newline"
                    style={{ height: 'auto' }}
                  />
                  {/* Mic control */}
                  <button
                    onClick={() => (isRecording ? stopRecording() : startRecording())}
                    disabled={loading}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border ${isRecording ? "bg-red-600 border-red-500" : "bg-zinc-900 border-zinc-800"} text-zinc-100 hover:bg-zinc-800`}
                    title={isRecording ? "Stop mic" : "Speak"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"/>
                      <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8v3h2v-3a9 9 0 0 0 8-8 1 1 0 1 0-2 0 7 7 0 1 1-14 0z"/>
                    </svg>
                  </button>
                  {/* Mobile web toggle */}
                  <button
                    onClick={() => setWebSearch(v => !v)}
                    disabled={loading}
                    className={`md:hidden w-8 h-8 rounded-full flex items-center justify-center border ${webSearch ? "bg-yellow-500 text-zinc-900 border-yellow-500/80" : "bg-zinc-900 border-zinc-800 text-zinc-100"}`}
                    title={`Web search ${webSearch ? 'on' : 'off'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                    </svg>
                  </button>
                  {/* Mobile send */}
                  <button
                    onClick={onSend}
                    disabled={loading || (!input.trim() && !imageFile)}
                    className="md:hidden w-9 h-9 rounded-full flex items-center justify-center bg-yellow-500 text-zinc-900 disabled:opacity-50"
                    title="Send"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M2 12l19-9-9 19-2-8-8-2z" />
                    </svg>
                  </button>
                </div>
                <div className="hidden sm:flex flex-col items-stretch gap-1">
                  <label className="text-xs text-zinc-400 px-1">Quality</label>
                  <select
                    className="border rounded-xl px-3 py-2 h-12 focus:outline-none focus:ring-2 focus:ring-yellow-500/40 border-zinc-800 bg-zinc-950 text-zinc-100"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={loading}
                  >
                    <option value="auto">Auto</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                {/* Desktop web toggle */}
                <div className="hidden sm:flex flex-col items-stretch gap-1">
                  <label className="text-xs text-zinc-400 px-1">Web</label>
                  <button
                    onClick={() => setWebSearch(v => !v)}
                    disabled={loading}
                    className={`border rounded-xl px-3 py-2 h-12 ${webSearch ? 'bg-yellow-500 text-zinc-900 border-yellow-500/60' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}
                    title="Toggle web search"
                  >
                    {webSearch ? 'On' : 'Off'}
                  </button>
                </div>
                {/* Emoji and Send */}
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setEmojiOpen((v) => !v)}
                    disabled={loading}
                    className="btn-glass px-3 py-2 h-12 mr-2"
                    title="Emoji"
                  >🙂</button>
                  {emojiOpen && (
                    <div className="absolute bottom-14 right-0 bg-zinc-900 border border-zinc-800 rounded-xl p-2 grid grid-cols-6 gap-1 text-xl">
                      {["😀","😁","😄","😉","😍","🤩","😎","🤔","🙏","🔥","✨","🎯","💡","📎","📝","📄","📊","📌","✅","❌","🔁","🔍","⚡","🚀"].map((e,i)=> (
                        <button key={i} className="hover:scale-110 transition" onClick={() => { setInput(inp => (inp || "") + e); setEmojiOpen(false); }}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={onSend}
                  disabled={loading}
                  className="hidden md:inline-flex btn-gradient px-4 py-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  Send
                </button>
              </div>
              <div className="hidden sm:block mt-1 ml-1 text-[11px] text-zinc-500">Press Enter to send · Shift+Enter for newline</div>
              </>
            ) : mode === "voice" ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => (isRecording ? stopRecording() : startRecording())}
                  disabled={loading}
                  className={`rounded-full w-12 h-12 flex items-center justify-center border ${isRecording ? "bg-red-600 border-red-500" : "bg-zinc-950 border-zinc-800"} text-zinc-100 hover:bg-zinc-800`}
                  title={isRecording ? "Stop" : "Start"}
                >
                  {/* Mic icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"/>
                    <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8v3h2v-3a9 9 0 0 0 8-8 1 1 0 1 0-2 0 7 7 0 1 1-14 0z"/>
                  </svg>
                </button>
                <div className="flex-1 text-sm text-zinc-400">
                  {isRecording ? "Listening... boliye" : "Press mic to speak (Chrome recommended)."}
                </div>
                <div className="flex flex-col items-stretch gap-1">
                  <label className="text-xs text-zinc-400 px-1">Quality</label>
                  <select
                    className="border rounded-xl px-3 py-2 h-12 focus:outline-none focus:ring-2 focus:ring-yellow-500/40 border-zinc-800 bg-zinc-950 text-zinc-100"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={loading}
                  >
                    <option value="auto">Auto</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                {/* Unified bar for Image mode: file + prompt + mic */}
                <div className="flex items-center flex-1 min-w-0 gap-2 border rounded-xl min-h-[3rem] px-2 py-1 border-zinc-800 bg-zinc-950">
                  <label className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-800" title="Upload file" aria-label="Upload file">
                    <input type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv" className="hidden" onChange={onFileChange} />
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 11-7.78-7.78l8.49-8.49a3.5 3.5 0 115 4.95l-8.49 8.49a1.5 1.5 0 11-2.12-2.12l7.78-7.78" />
                    </svg>
                  </label>
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-2 py-2 h-10 focus:outline-none bg-transparent text-zinc-100 placeholder:text-zinc-500 truncate"
                    placeholder="Optional prompt (e.g., 'extract key points')"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                  />
                  <button
                    onClick={() => (isRecording ? stopRecording() : startDictationToPrompt())}
                    disabled={loading}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border ${isRecording ? "bg-red-600 border-red-500" : "bg-zinc-900 border-zinc-800"} text-zinc-100 hover:bg-zinc-800`}
                    title={isRecording ? "Stop mic" : "Speak prompt"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"/>
                      <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8v3h2v-3a9 9 0 0 0 8-8 1 1 0 1 0-2 0 7 7 0 1 1-14 0z"/>
                    </svg>
                  </button>
                </div>
                <div className="flex flex-col items-stretch gap-1">
                  <label className="text-xs text-zinc-400 px-1">Quality</label>
                  <select
                    className="border rounded-xl px-3 py-2 h-12 focus:outline-none focus:ring-2 focus:ring-yellow-500/40 border-zinc-800 bg-zinc-950 text-zinc-100"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={loading}
                  >
                    <option value="auto">Auto</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <button
                  onClick={onSummarizeImage}
                  disabled={loading}
                  className="bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold px-4 py-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Summarize
                </button>
              </div>
            )}
          </div>
        </section>
        {showScrollDown && (
          <button
            className="absolute bottom-24 right-4 z-30 w-10 h-10 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-200 hover:bg-zinc-900 shadow-glow"
            onClick={scrollToBottom}
            title="Scroll to latest"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mx-auto">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}

        <div className="hidden sm:flex text-[10px] sm:text-xs text-zinc-500 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${backendStatus==='ok' ? 'bg-emerald-400' : backendStatus==='down' ? 'bg-red-400' : 'bg-zinc-400'} `} />
            {backendStatus === 'ok' ? 'Backend Connected' : backendStatus === 'down' ? 'Backend Offline' : 'Checking backend...'}
          </div>
          <div>Backend: {process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}</div>
        </div>

        {/* Floating new chat button */}
        <button
          className="hidden sm:fixed sm:bottom-6 sm:right-6 z-40 rounded-full w-12 h-12 sm:flex items-center justify-center btn-gradient shadow-glow"
          title="New Chat"
          onClick={onNewChat}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 5v14m-7-7h14"/></svg>
        </button>
      </div>

      {/* Right panel with tabs */}
      {(() => {
        const rightFiles = imageFile ? [{ name: imageFile.name, size: imageFile.size, type: imageFile.type, previewUrl: imagePreviewUrl }] : [];
        const lastAssistant = (messages.slice().reverse().find(m => m.role === 'assistant') || {}).content || "";
        return <RightPanel files={rightFiles} lastAssistant={lastAssistant} analyzing={analyzing} />;
      })()}
    </main>
  );
}
