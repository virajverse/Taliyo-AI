import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

const api = axios.create({ baseURL });

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const t = localStorage.getItem('taliyo_token');
      if (t) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${t}`;
      }
    } catch {}
  }
  return config;
});

// Redirect to /login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      try { localStorage.removeItem('taliyo_token'); } catch {}
      try { window.location.href = '/login'; } catch {}
    }
    return Promise.reject(error);
  }
);

export async function health() {
  const { data } = await api.get("/health");
  return data; // { status: "ok" }
}

export async function sendMessage(message, quality, conversationId, opts = {}) {
  const body = { message };
  if (quality) body.quality = quality;
  if (conversationId) body.conversation_id = conversationId;
  if (opts.userKey) body.user_key = opts.userKey;
  if (opts.tool) {
    body.tool = opts.tool;
    if (opts.toolArgs) body.tool_args = opts.toolArgs;
  }
  const { data } = await api.post("/chat", body);
  return data;
}

export async function sendVoice(message, quality, conversationId, voiceOptions = {}, opts = {}) {
  const body = { message };
  if (quality) body.quality = quality;
  if (conversationId) body.conversation_id = conversationId;
  if (opts.userKey) body.user_key = opts.userKey;
  if (opts.tool) {
    body.tool = opts.tool;
    if (opts.toolArgs) body.tool_args = opts.toolArgs;
  }
  if (voiceOptions.voice_id) body.voice_id = voiceOptions.voice_id;
  if (voiceOptions.tts_model) body.tts_model = voiceOptions.tts_model;
  if (voiceOptions.tts_output) body.tts_output = voiceOptions.tts_output;
  const { data } = await api.post("/chat/voice", body);
  return data; // { reply, audio_base64, audio_mime, conversation_id, model, quality }
}

export async function listConversations() {
  const { data } = await api.get("/conversations");
  return data;
}

export async function getConversation(conversationId) {
  const { data } = await api.get(`/conversations/${conversationId}`);
  return data;
}

export async function deleteConversation(conversationId) {
  const { data } = await api.delete(`/conversations/${conversationId}`);
  return data;
}

export async function summarizeImage(file, prompt, quality, conversationId, userKey, onUploadProgress) {
  const form = new FormData();
  form.append("file", file);
  if (prompt) form.append("prompt", prompt);
  if (quality) form.append("quality", quality);
  if (conversationId) form.append("conversation_id", conversationId);
  if (userKey) form.append("user_key", userKey);
  const { data } = await api.post("/vision/summarize", form, {
    onUploadProgress,
  });
  return data; // { summary, model, quality, conversation_id }
}

export async function askAboutFile(file, prompt, quality, conversationId, userKey, onUploadProgress) {
  const form = new FormData();
  form.append("file", file);
  if (prompt) form.append("prompt", prompt);
  if (quality) form.append("quality", quality);
  if (conversationId) form.append("conversation_id", conversationId);
  if (userKey) form.append("user_key", userKey);
  const { data } = await api.post("/files/ask", form, {
    onUploadProgress,
  });
  return data; // { answer, model, quality }
}

export async function ingestPdf(file, userKey) {
  const form = new FormData();
  form.append("file", file);
  if (userKey) form.append("user_key", userKey);
  const { data } = await api.post("/rag/ingest_pdf", form);
  return data; // { ok, chunks, doc_id }
}

export async function login(passcode) {
  const { data } = await api.post('/auth/login', { passcode });
  return data; // { token, expires_at }
}

export async function verifyAuth() {
  const { data } = await api.get('/auth/verify');
  return data; // { ok: true }
}

export default api;
