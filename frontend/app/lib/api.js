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

// ---------------- Admin APIs ----------------
export async function adminHealth() {
  const { data } = await api.get('/admin/health');
  return data;
}

export async function adminListDocs(limit = 100, skip = 0) {
  const { data } = await api.get('/admin/docs', { params: { limit, skip } });
  return data; // { items: [...] }
}

export async function adminDeleteDoc(docId) {
  const { data } = await api.delete(`/admin/docs/${docId}`);
  return data; // { ok, deleted_chunks }
}

export async function adminSearchDocs(query, k = 5) {
  const { data } = await api.get('/admin/docs/search', { params: { query, k } });
  return data; // { hits: [...] }
}

export async function adminCrawl(urls) {
  const { data } = await api.post('/admin/crawl', urls);
  return data; // { results: [...] }
}

export async function adminListMemories(userKey, limit = 100) {
  const { data } = await api.get('/admin/memories', { params: { user_key: userKey, limit } });
  return data; // { profiles: [...], summaries: [...] }
}

export async function adminDeleteSummary(conversationId) {
  const { data } = await api.delete(`/admin/memories/summary/${conversationId}`);
  return data;
}

export async function adminDeleteProfile(userKey) {
  const { data } = await api.delete(`/admin/memories/profile/${encodeURIComponent(userKey)}`);
  return data;
}

export async function adminExportMemories(userKey) {
  const { data } = await api.post('/admin/memories/export', null, { params: { user_key: userKey } });
  return data;
}

export async function adminListChats(userKey, days = 30) {
  const { data } = await api.get('/admin/chats', { params: { user_key: userKey, days } });
  return data; // { items: [...] }
}

export async function adminChatDetail(conversationId) {
  const { data } = await api.get(`/admin/chats/${conversationId}`);
  return data; // { conversation, messages }
}

export async function adminSubmitFeedback(conversationId, rating, comment) {
  const { data } = await api.post(`/admin/chats/${conversationId}/feedback`, null, { params: { rating, comment } });
  return data;
}

export async function adminAnalytics(days = 30) {
  const { data } = await api.get('/admin/analytics', { params: { days } });
  return data; // { chats_per_day, topic_distribution }
}

export async function adminKbStats() {
  const { data } = await api.get('/admin/kb/stats');
  return data; // { total_docs, docs_today, docs_week }
}

export async function adminTopQueries(limit = 5, windowDays = 7) {
  const { data } = await api.get('/admin/queries/top', { params: { limit, window_days: windowDays } });
  return data; // { items: [{ query, count }] }
}

export async function adminRecentMessages(limit = 10, role = 'user') {
  const { data } = await api.get('/admin/messages/recent', { params: { limit, role } });
  return data; // { items: [...] }
}

export async function adminGetSettings() {
  const { data } = await api.get('/admin/settings');
  return data; // { config, secrets(masked) }
}

export async function adminPutSettings(payload) {
  const { data } = await api.put('/admin/settings', payload);
  return data; // { ok }
}

export async function adminTestConnection(service) {
  const { data } = await api.get('/admin/settings/test', { params: { service } });
  return data; // { ok, error? }
}

export async function adminBackupCreate() {
  const { data } = await api.post('/admin/backup/create');
  return data; // { dir, collections: {...} }
}

export async function adminBackupList() {
  const { data } = await api.get('/admin/backup/list');
  return data; // { backups: [...] }
}

export async function adminListFacts(limit = 200) {
  const { data } = await api.get('/admin/facts', { params: { limit } });
  return data; // { items }
}

export async function adminCreateFact(text, tags = []) {
  const { data } = await api.post('/admin/facts', { text, tags });
  return data; // { id }
}

export async function adminUpdateFact(id, updates) {
  const { data } = await api.put(`/admin/facts/${id}`, updates);
  return data; // { ok }
}

export async function adminDeleteFact(id) {
  const { data } = await api.delete(`/admin/facts/${id}`);
  return data; // { ok }
}

export async function adminListUsers(limit = 200) {
  const { data } = await api.get('/admin/users', { params: { limit } });
  return data; // { items }
}

export async function adminCreateUser(username, role) {
  const { data } = await api.post('/admin/users', { username, role });
  return data; // { id }
}

export async function adminUpdateUser(id, updates) {
  const { data } = await api.put(`/admin/users/${id}`, updates);
  return data; // { ok }
}

export async function adminDeleteUser(id) {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data; // { ok }
}

export async function adminListRoles(limit = 200) {
  const { data } = await api.get('/admin/roles', { params: { limit } });
  return data; // { items }
}

export async function adminCreateRole(name, permissions = []) {
  const { data } = await api.post('/admin/roles', { name, permissions });
  return data; // { id }
}

export async function adminUpdateRole(id, updates) {
  const { data } = await api.put(`/admin/roles/${id}`, updates);
  return data; // { ok }
}

export async function adminDeleteRole(id) {
  const { data } = await api.delete(`/admin/roles/${id}`);
  return data; // { ok }
}

export async function adminListAuditLog(limit = 200) {
  const { data } = await api.get('/admin/audit-log', { params: { limit } });
  return data; // { items }
}

export default api;
