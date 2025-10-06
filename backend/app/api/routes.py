import base64
from fastapi import APIRouter, Response, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
import google.generativeai as genai

from app.core.config import settings
from app.core.auth import require_auth
from app.models.schema import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationListItem,
    TTSRequest,
    ChatVoiceRequest,
)
from app.services.gemini_service import generate_reply, stream_reply, summarize_image, ask_about_file
from app.services.web_search_service import search_web
from app.services.rag_service import upsert_document, query_similar, ingest_pdf_bytes
from app.services.telemetry import log_event
from app.services.memory_service import get_memory_text, update_conversation_summary
from app.services.archive_service import archive_messages
from app.services.tts_service import synthesize as tts_synthesize
from app.repositories.chat_repo import (
    ensure_conversation,
    add_message,
    list_conversations,
    get_conversation,
    delete_conversation,
)

router = APIRouter(dependencies=[Depends(require_auth)])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Chat endpoint: accepts a message and returns the AI reply.

    Persists user/assistant messages under a conversation.
    """
    # Ensure conversation exists (create when missing)
    conv_id = await ensure_conversation(request.conversation_id, request.message, user_key=request.user_key)
    # Store user message first so it becomes part of the history
    await add_message(conv_id, "user", request.message)

    # Load conversation history (ordered oldest->newest)
    _conv, msgs = await get_conversation(conv_id)

    # Optional simple tool-calling: rag_search
    # Compose the user message with global memory (profile + summaries)
    mem_txt = await get_memory_text(request.user_key)
    user_message = request.message
    if mem_txt:
        user_message = f"Use the user's profile and prior summaries to personalize and remain consistent.\n{mem_txt}\n\nQuestion: {request.message}"
    tool = (request.tool or "").lower()
    if tool == "rag_search":
        try:
            hits = await query_similar(request.tool_args.get("query", user_message), k=request.tool_args.get("k", 5))
            context = "\n\n".join([f"[doc {i+1} score={h.get('score',0):.3f}] {h.get('text','')}" for i, h in enumerate(hits)])
            user_message = f"Use the following context to answer.\n{context}\n\nQuestion: {user_message}"
        except Exception:
            pass
    elif tool == "web_search":
        try:
            q = (request.tool_args or {}).get("query", user_message)
            k = int((request.tool_args or {}).get("k", 5))
            results = search_web(q, k=k, fetch_pages=False)
            context = "\n\n".join([f"[web {i+1}] {r.get('title','')} - {r.get('url','')}\n{r.get('snippet','')}" for i, r in enumerate(results)])
            user_message = f"Use the following web results if relevant.\n{context}\n\nQuestion: {user_message}"
        except Exception:
            pass

    # Generate AI reply with conversation context (offload to thread if SDK is blocking)
    reply, model, quality = await run_in_threadpool(
        generate_reply, user_message, request.quality, history=msgs
    )

    # Store assistant message
    await add_message(conv_id, "assistant", reply)
    # Update conversation summary for cross-conversation memory
    try:
        await update_conversation_summary(conv_id, request.user_key)
    except Exception:
        pass

    # Telemetry (best-effort)
    try:
        await log_event("chat", {"conv": conv_id, "model": model, "quality": quality, "user_len": len(user_message or ""), "reply_len": len(reply or "")})
    except Exception:
        pass

    return ChatResponse(reply=reply, model=model, quality=quality, conversation_id=conv_id)


@router.get("/models")
def list_models():
    """List available Gemini models that support text generation."""
    if not settings.GEMINI_API_KEY:
        return {"models": [], "error": "GEMINI_API_KEY not configured"}
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        names = []
        for m in genai.list_models():
            methods = getattr(m, "supported_generation_methods", []) or []
            if "generateContent" in methods or "createContent" in methods:
                name = getattr(m, "name", "") or ""
                if name.startswith("models/"):
                    name = name.split("/", 1)[1]
                if name:
                    names.append(name)
        names = sorted(set(names))
        return {"models": names}
    except Exception as e:
        return {"models": [], "error": str(e)}


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Server-Sent Events streaming endpoint for token-by-token replies."""
    # Ensure conversation exists and store the user's message
    conv_id = await ensure_conversation(request.conversation_id, request.message, user_key=request.user_key)
    await add_message(conv_id, "user", request.message)
    _conv, msgs = await get_conversation(conv_id)

    # Precompute memory text here to avoid blocking inside generator
    mem_txt_local = await get_memory_text(request.user_key)
    message_with_mem = request.message
    if mem_txt_local:
        message_with_mem = f"Use the user's profile and prior summaries to personalize and remain consistent.\n{mem_txt_local}\n\nQuestion: {request.message}"

    def _event_gen():
        accum = []
        try:
            for chunk in stream_reply(message_with_mem, request.quality, history=msgs):
                accum.append(chunk)
                yield f"data: {chunk}\n\n"
        finally:
            # Persist assistant message and log telemetry (best-effort)
            try:
                final_text = "".join(accum).strip()
                if final_text:
                    # Store assistant message
                    import asyncio
                    loop = asyncio.get_event_loop()
                    loop.create_task(add_message(conv_id, "assistant", final_text))
                    loop.create_task(update_conversation_summary(conv_id, request.user_key))
                    loop.create_task(log_event("chat_stream", {"conv": conv_id, "reply_len": len(final_text)}))
            except Exception:
                pass

    return StreamingResponse(_event_gen(), media_type="text/event-stream")


@router.post("/rag/upsert")
async def rag_upsert(doc: dict):
    text = doc.get("text", "")
    metadata = doc.get("metadata")
    _id = doc.get("id")
    new_id = await upsert_document(text=text, metadata=metadata, id=_id)
    await log_event("rag_upsert", {"id": new_id})
    return {"id": new_id}


@router.post("/rag/query")
async def rag_query(body: dict):
    q = body.get("query", "")
    k = int(body.get("k", 5))
    hits = await query_similar(q, k=k)
    return {"hits": hits}


@router.post("/rag/ingest_pdf")
async def rag_ingest_pdf(
    file: UploadFile = File(...),
    user_key: str | None = Form(None),
):
    """Persist knowledge from a PDF into the RAG store.

    Form fields:
    - file: application/pdf
    - user_key: optional stable user identifier to scope knowledge
    """
    mime = (file.content_type or "").lower()
    if "pdf" not in mime:
        return {"error": "Only PDF is supported for ingestion."}
    data = await file.read()
    chunks, doc_id = await ingest_pdf_bytes(data, filename=(getattr(file, "filename", None) or "document.pdf"), user_key=user_key)
    try:
        await log_event("rag_ingest_pdf", {"chunks": chunks, "doc": doc_id})
    except Exception:
        pass
    return {"ok": True, "chunks": chunks, "doc_id": doc_id}


# ---------- TTS endpoints ----------
@router.post("/tts")
async def tts(body: TTSRequest):
    """Return synthesized speech audio (audio/mpeg) for given text and voice."""
    audio = await tts_synthesize(
        text=body.text,
        voice_id=body.voice_id,
        model=body.model,
        output=body.output,
    )
    return Response(content=audio, media_type="audio/mpeg")


@router.post("/chat/voice")
async def chat_voice(request: ChatVoiceRequest):
    """Generate a chat reply and return audio as base64 along with text reply."""
    # Ensure conversation and store user message
    conv_id = await ensure_conversation(request.conversation_id, request.message, user_key=request.user_key)
    await add_message(conv_id, "user", request.message)
    _conv, msgs = await get_conversation(conv_id)

    # Compose memory
    mem_txt = await get_memory_text(request.user_key)
    user_message = request.message
    if mem_txt:
        user_message = f"Use the user's profile and prior summaries to personalize and remain consistent.\n{mem_txt}\n\nQuestion: {request.message}"

    # Optional tools
    tool = (request.tool or "").lower()
    if tool == "rag_search":
        try:
            hits = await query_similar(request.tool_args.get("query", user_message), k=request.tool_args.get("k", 5))
            context = "\n\n".join([f"[doc {i+1} score={h.get('score',0):.3f}] {h.get('text','')}" for i, h in enumerate(hits)])
            user_message = f"Use the following context to answer.\n{context}\n\nQuestion: {user_message}"
        except Exception:
            pass
    elif tool == "web_search":
        try:
            q = (request.tool_args or {}).get("query", user_message)
            k = int((request.tool_args or {}).get("k", 5))
            results = search_web(q, k=k, fetch_pages=False)
            context = "\n\n".join([f"[web {i+1}] {r.get('title','')} - {r.get('url','')}\n{r.get('snippet','')}" for i, r in enumerate(results)])
            user_message = f"Use the following web results if relevant.\n{context}\n\nQuestion: {user_message}"
        except Exception:
            pass

    # LLM reply
    reply, model, quality = await run_in_threadpool(
        generate_reply, user_message, request.quality, history=msgs
    )

    # Persist assistant reply and update summary
    await add_message(conv_id, "assistant", reply)
    try:
        await update_conversation_summary(conv_id, request.user_key)
    except Exception:
        pass

    # Synthesize audio
    audio_bytes = await tts_synthesize(
        text=reply,
        voice_id=request.voice_id,
        model=request.tts_model,
        output=request.tts_output,
    )
    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    return {
        "reply": reply,
        "model": model,
        "quality": quality,
        "conversation_id": conv_id,
        "audio_base64": audio_b64,
        "audio_mime": "audio/mpeg",
    }


# ---------- Vision endpoints ----------
@router.post("/vision/summarize")
async def vision_summarize(
    file: UploadFile = File(...),
    prompt: str | None = Form(None),
    quality: str | None = Form(None),
    conversation_id: str | None = Form(None),
    user_key: str | None = Form(None),
):
    """Accept an image upload and return a concise summary using Gemini vision.

    Also saves the exchange in a conversation and returns conversation_id.

    Form fields:
    - file: image/*
    - prompt: optional instruction override
    - quality: auto|low|medium|high (optional)
    - conversation_id: reuse an existing conversation (optional)
    - user_key: per-user grouping for memory (optional)
    """
    data = await file.read()
    mime = file.content_type or "image/png"

    # Ensure or create conversation and store a user-side entry
    title_seed = prompt or (getattr(file, "filename", None) or "image summary")
    conv_id = await ensure_conversation(conversation_id, title_seed, user_key=user_key)
    display_name = getattr(file, "filename", None) or "uploaded image"
    user_text = (prompt or "Summarize this image").strip()
    await add_message(conv_id, "user", f"[Image] {display_name} ({mime})\nInstruction: {user_text}")

    summary, model, q_used = summarize_image(data, mime_type=mime, prompt=prompt, quality=quality)

    await add_message(conv_id, "assistant", summary)
    try:
        await update_conversation_summary(conv_id, user_key)
    except Exception:
        pass

    return {"summary": summary, "model": model, "quality": q_used, "conversation_id": conv_id}


@router.post("/files/ask")
async def files_ask(
    file: UploadFile = File(...),
    prompt: str | None = Form(None),
    quality: str | None = Form(None),
    conversation_id: str | None = Form(None),
    user_key: str | None = Form(None),
):
    """Ask a question about an uploaded file (image/PDF/Office/text). Saves to a conversation.

    Form fields:
    - file: image/* or document mime-types
    - prompt: user question/instruction
    - quality: auto|low|medium|high (optional)
    - conversation_id: reuse an existing conversation (optional)
    - user_key: per-user grouping for memory (optional)
    """
    data = await file.read()
    mime = file.content_type or "application/octet-stream"

    # Ensure or create conversation and store user message placeholder
    title_seed = prompt or (getattr(file, "filename", None) or "file question")
    conv_id = await ensure_conversation(conversation_id, title_seed, user_key=user_key)
    display_name = getattr(file, "filename", None) or "uploaded file"
    user_text = (prompt or "Summarize this document").strip()
    await add_message(conv_id, "user", f"[File] {display_name} ({mime})\nQuestion: {user_text}")

    answer, model, q_used = ask_about_file(data, mime_type=mime, prompt=prompt, quality=quality)

    # Store assistant message and update summary (best-effort)
    await add_message(conv_id, "assistant", answer)
    try:
        await update_conversation_summary(conv_id, user_key)
    except Exception:
        pass

    return {"answer": answer, "model": model, "quality": q_used, "conversation_id": conv_id}


@router.post("/admin/archive")
async def admin_archive(body: dict):
    """Archive old messages to local disk as JSONL. Body: {"days": 30, "dry_run": false}."""
    days = int(body.get("days", settings.ARCHIVE_AFTER_DAYS))
    dry = bool(body.get("dry_run", False))
    # backend is ignored; kept for backward compatibility
    result = await archive_messages(days=days, backend=None, dry_run=dry)
    return result


@router.get("/conversations", response_model=list[ConversationListItem])
async def conversations_list():
    items = await list_conversations()
    return [ConversationListItem(**i) for i in items]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def conversations_get(conversation_id: str):
    conv, msgs = await get_conversation(conversation_id)
    return ConversationDetail(id=conv["id"], title=conv["title"], created_at=conv["created_at"], updated_at=conv["updated_at"], messages=msgs)


@router.delete("/conversations/{conversation_id}")
async def conversations_delete(conversation_id: str):
    await delete_conversation(conversation_id)
    return {"ok": True}
