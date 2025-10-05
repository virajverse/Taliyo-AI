from typing import Tuple, Optional, List, Dict, Any, Iterable
import time
import tempfile
import os

from fastapi import HTTPException
from functools import lru_cache
import google.generativeai as genai

from app.core.config import settings

SYSTEM_PROMPT = (
    "You are Taliyo AI, a helpful engineering and business assistant.\n"
    "Goals:\n"
    "- Be concise, clear, and actionable.\n"
    "- Think step-by-step, but only reveal necessary steps.\n"
    "- Cite file paths, functions, and endpoints when relevant.\n"
    "- If you use provided context (docs, RAG), separate it from your reasoning.\n"
    "Safety:\n"
    "- Refuse harmful, illegal, or disallowed content.\n"
    "- If unsure, ask a brief clarifying question.\n"
)

# Guidance for file understanding tasks: PDFs, Office docs, images (OCR), text
FILE_ASSISTANT_GUIDE = (
    "You are an AI assistant that can read, understand, and summarize information from any type of file: "
    "PDF, Word, Excel, PowerPoint, images (OCR), and text.\n"
    "Responsibilities:\n"
    "1) Extract and understand the text, tables, charts, or key content from the uploaded file.\n"
    "2) Summarize the content in clear, concise, and human-friendly language.\n"
    "3) Answer user questions based on the document accurately.\n"
    "4) If the document is long, break the summary into sections with headings.\n"
    "5) For images, perform OCR, extract text, and explain it.\n"
    "6) Provide context-aware, reliable, and easy-to-read outputs (bullets, short paragraphs).\n"
    "7) If the answer is not present, respond exactly: 'Not available in the document.'\n"
)


@lru_cache(maxsize=1)
def _list_available_model_names() -> list[str]:
    """Return model ids (without 'models/' prefix) that support text generation."""
    try:
        names = []
        for m in genai.list_models():
            methods = getattr(m, "supported_generation_methods", []) or []
            # Some SDK versions used 'createContent', keep both for safety
            if "generateContent" in methods or "createContent" in methods:
                name = getattr(m, "name", "") or ""
                if name.startswith("models/"):
                    name = name.split("/", 1)[1]
                if name:
                    names.append(name)
        # de-duplicate and sort for stability
        return sorted(set(names))
    except Exception:
        return []


def _prefer(names: list[str], contains: list[str]) -> list[str]:
    return [n for n in names if any(s in n for s in contains)]


def _score_model_name(name: str) -> int:
    score = 0
    if "latest" in name:
        score += 3
    if "2.5" in name:
        score += 5
    elif "2.0" in name:
        score += 4
    elif "1.5" in name:
        score += 3
    if "pro" in name:
        score += 2
    if "flash" in name:
        score += 1
    if "exp" in name:
        score -= 1
    return score


def _select_model_for_quality(quality: str, env_model: Optional[str]) -> str:
    names = _list_available_model_names()
    # If env model is explicitly set and available, use it
    if env_model and env_model in names:
        return env_model

    candidates: list[str] = []
    if quality in ("high", "medium"):
        candidates = _prefer(names, ["pro"]) or names
    else:
        candidates = _prefer(names, ["flash"]) or _prefer(names, ["pro"]) or names

    if not candidates:
        # Fallback to a sane default; may still 404 if account lacks access
        return env_model or "gemini-1.5-pro-latest"

    candidates = sorted(candidates, key=_score_model_name, reverse=True)
    return candidates[0]


def _choose_quality_and_model(message: str, requested_quality: Optional[str], task: Optional[str] = None) -> Tuple[str, str, dict]:
    """Return (quality_used, model_name, generation_config).

    Auto-detects and selects a working model based on availability and desired quality.
    """
    # Normalize input
    rq = (requested_quality or "").lower().strip() or None

    # Heuristic-based auto quality if none provided
    if rq is None:
        msg = message.lower()
        length = len(message)
        if length > 700 or any(x in msg for x in ["architecture", "detailed", "diagram"]):
            rq = "high"
        elif length > 280 or any(x in msg for x in ["analyze", "explain", "code", "steps", "why"]):
            rq = "medium"
        else:
            rq = "low"

    # Select a model from availability, honoring per-task env override when possible
    task = (task or "").lower().strip() or None
    if task == "text":
        env_model = (settings.GEMINI_TEXT_MODEL or "").strip() or None
    elif task == "stream":
        env_model = (settings.GEMINI_STREAM_MODEL or "").strip() or None
    elif task == "vision":
        env_model = (settings.GEMINI_VISION_MODEL or "").strip() or None
    elif task == "file":
        env_model = (settings.GEMINI_FILE_MODEL or "").strip() or None
    else:
        env_model = (settings.GEMINI_MODEL or "").strip() or None
    chosen = _select_model_for_quality(rq, env_model)

    # Generation config tuned by quality only
    if rq == "high":
        gen_cfg = {"temperature": 0.8, "top_p": 0.95, "top_k": 40, "max_output_tokens": 2048}
    elif rq == "medium":
        gen_cfg = {"temperature": 0.7, "top_p": 0.9, "top_k": 40, "max_output_tokens": 1024}
    else:
        gen_cfg = {"temperature": 0.5, "top_p": 0.9, "top_k": 40, "max_output_tokens": 768}

    return rq, chosen, gen_cfg


def _to_gemini_history(history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert our stored messages to Gemini chat history format.

    Each item in `history` is expected to have keys: role ('user'|'assistant'), content (str).
    Gemini expects roles 'user' and 'model'.
    """
    out: List[Dict[str, Any]] = []
    for m in history:
        role = "user" if m.get("role") == "user" else "model"
        content = m.get("content", "")
        # Gemini Python SDK accepts strings as parts
        out.append({"role": role, "parts": [content]})
    return out


def _trim_history(history: Optional[List[Dict[str, Any]]], max_messages: int = 20) -> Optional[List[Dict[str, Any]]]:
    if not history:
        return history
    if len(history) <= max_messages:
        return history
    return history[-max_messages:]


def _moderate_text(text: str) -> Optional[str]:
    """Very simple moderation using block words from settings. Returns an error message if blocked, else None."""
    words = set((settings.SAFETY_BLOCK_WORDS or []))
    if not words:
        return None
    lower = (text or "").lower()
    for w in words:
        if w and w.lower() in lower:
            return "Your message contains disallowed content."
    return None


def generate_reply(message: str, quality: Optional[str] = None, history: Optional[List[Dict[str, Any]]] = None) -> Tuple[str, str, str]:
    """Generate a reply using Google Gemini models with safe fallbacks.

    Returns: (reply_text, model_used, quality_used)

    If `history` is provided, it will be used to create a chat session so the
    model has multi-turn context similar to ChatGPT.
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")

    # Basic input moderation
    err = _moderate_text(message)
    if err:
        raise HTTPException(status_code=400, detail=err)

    genai.configure(api_key=settings.GEMINI_API_KEY)
    # Decide model & generation config
    quality_used, model_name, gen_cfg = _choose_quality_and_model(message, quality, task="text")

    def _run(model_name_local: str, gen_cfg_local: dict) -> str:
        model = genai.GenerativeModel(
            model_name=model_name_local,
            system_instruction=SYSTEM_PROMPT,
        )
        # Use chat session with history when available
        hist = _trim_history(history, max_messages=settings.MEMORY_MAX_MESSAGES)
        if hist:
            chat = model.start_chat(history=_to_gemini_history(hist))
            response = chat.send_message(message, generation_config=gen_cfg_local)
        else:
            response = model.generate_content(message, generation_config=gen_cfg_local)
        text = getattr(response, "text", None)
        if not text and hasattr(response, "candidates"):
            try:
                for cand in response.candidates or []:
                    parts = getattr(cand.content, "parts", [])
                    chunks = [getattr(p, "text", "") for p in parts]
                    text = "\n".join([c for c in chunks if c])
                    if text:
                        break
            except Exception:
                pass
        if not text:
            raise ValueError("Empty response from Gemini.")
        return text.strip()

    try:
        # Try primary model
        text = _run(model_name, gen_cfg)
        return text, model_name, quality_used
    except Exception as e_primary:
        errors = [f"Primary {model_name}: {e_primary}"]
        # If not-found, try alternate variant of same name
        try:
            msg = str(e_primary).lower()
            if "404" in msg or "not found" in msg:
                alt_name = model_name[:-7] if model_name.endswith("-latest") else model_name + "-latest"
                if alt_name != model_name:
                    try:
                        text = _run(alt_name, gen_cfg)
                        return text, alt_name, quality_used
                    except Exception as e_alt:
                        errors.append(f"Alt {alt_name}: {e_alt}")
        except Exception:
            pass

        # Try explicit well-known defaults before scanning the full list
        explicit_fallbacks = [
            "gemini-1.5-pro-latest",
            "gemini-1.5-flash-latest",
        ]
        tried = {model_name}
        if 'alt_name' in locals():
            tried.add(alt_name)
        for cand in explicit_fallbacks:
            if cand in tried:
                continue
            try:
                text = _run(cand, gen_cfg)
                return text, cand, quality_used
            except Exception as e_exp:
                errors.append(f"{cand}: {e_exp}")

        # Try other available models by quality preference
        names = _list_available_model_names()
        # Build preference list
        def _pref_list(q: str) -> list[str]:
            if q in ("high", "medium"):
                first = _prefer(names, ["pro"]) or []
                second = _prefer(names, ["flash"]) or []
            else:
                first = _prefer(names, ["flash"]) or []
                second = _prefer(names, ["pro"]) or []
            # Remove ones we attempted
            tried_local = set(tried)
            seq = [n for n in first + second if n not in tried]
            if not seq:
                seq = [n for n in names if n not in tried_local]
            # sort by score
            return sorted(seq, key=_score_model_name, reverse=True)

        for candidate in _pref_list(quality_used):
            try:
                text = _run(candidate, gen_cfg)
                return text, candidate, quality_used
            except Exception as e_c:
                errors.append(f"{candidate}: {e_c}")

        # No working model found
        raise HTTPException(status_code=502, detail="Gemini errors: " + " | ".join(errors))


def stream_reply(message: str, quality: Optional[str] = None, history: Optional[List[Dict[str, Any]]] = None) -> Iterable[str]:
    """Yield reply chunks (strings) for streaming to the client.

    This uses the chosen model and streams tokens. Minimal moderation is applied on input.
    """
    err = _moderate_text(message)
    if err:
        # Stream a single error message
        yield err
        return

    genai.configure(api_key=settings.GEMINI_API_KEY)
    quality_used, model_name, gen_cfg = _choose_quality_and_model(message, quality, task="stream")

    model = genai.GenerativeModel(model_name=model_name, system_instruction=SYSTEM_PROMPT)
    hist = _trim_history(history, max_messages=settings.MEMORY_MAX_MESSAGES)
    try:
        if hist:
            chat = model.start_chat(history=_to_gemini_history(hist))
            response = chat.send_message(message, generation_config=gen_cfg, stream=True)
        else:
            response = model.generate_content(message, generation_config=gen_cfg, stream=True)
        for event in response:
            text_piece = getattr(event, "text", None)
            if text_piece:
                yield text_piece
    except Exception as e:
        yield f"[stream error: {e}]"


def summarize_image(image_bytes: bytes, mime_type: str, prompt: Optional[str] = None, quality: Optional[str] = None) -> Tuple[str, str, str]:
    """Summarize an image using Gemini multimodal models.

    Returns: (summary_text, model_used, quality_used)
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")

    genai.configure(api_key=settings.GEMINI_API_KEY)

    # Choose model/quality; seed message is generic since content is visual
    quality_used, model_name, gen_cfg = _choose_quality_and_model("image_summary", quality, task="vision")

    # Default instruction optimized for concise summaries + file assistant guide
    instruction = (
        (FILE_ASSISTANT_GUIDE + "\nTask: " + (prompt or (
            "Summarize the image in 4-8 concise bullet points. "
            "If it's a document, extract main headings, key facts, dates, amounts, and totals. "
            "Avoid guessing unreadable text; mention if parts are unclear."
        )))
    ).strip()

    parts: List[Any] = [
        {"mime_type": (mime_type or "image/png"), "data": image_bytes},
        instruction,
    ]

    def _run(model_name_local: str, gen_cfg_local: dict) -> str:
        model = genai.GenerativeModel(
            model_name=model_name_local,
            system_instruction=SYSTEM_PROMPT,
        )
        response = model.generate_content(parts, generation_config=gen_cfg_local)
        text = getattr(response, "text", None)
        if not text and hasattr(response, "candidates"):
            try:
                for cand in response.candidates or []:
                    content = getattr(cand, "content", None)
                    if not content:
                        continue
                    pieces = getattr(content, "parts", []) or []
                    chunks = [getattr(p, "text", "") for p in pieces]
                    text = "\n".join([c for c in chunks if c])
                    if text:
                        break
            except Exception:
                pass
        if not text:
            raise ValueError("Empty response from Gemini.")
        return text.strip()

    try:
        summary = _run(model_name, gen_cfg)
        return summary, model_name, quality_used
    except Exception as e_primary:
        errors = [f"Primary {model_name}: {e_primary}"]
        try:
            msg = str(e_primary).lower()
            if "404" in msg or "not found" in msg:
                alt_name = model_name[:-7] if model_name.endswith("-latest") else model_name + "-latest"
                if alt_name != model_name:
                    try:
                        summary = _run(alt_name, gen_cfg)
                        return summary, alt_name, quality_used
                    except Exception as e_alt:
                        errors.append(f"Alt {alt_name}: {e_alt}")
        except Exception:
            pass

    # Explicit fallbacks
    explicit_fallbacks = [
        "gemini-1.5-pro-latest",
        "gemini-1.5-flash-latest",
    ]
    tried = {model_name}
    if 'alt_name' in locals():
        tried.add(alt_name)
    for cand in explicit_fallbacks:
        if cand in tried:
            continue
        try:
            summary = _run(cand, gen_cfg)
            return summary, cand, quality_used
        except Exception:
            continue

    # Broader search across available models
    names = _list_available_model_names()
    def _pref_list(q: str) -> list[str]:
        if q in ("high", "medium"):
            first = _prefer(names, ["pro"]) or []
            second = _prefer(names, ["flash"]) or []
        else:
            first = _prefer(names, ["flash"]) or []
            second = _prefer(names, ["pro"]) or []
        seq = [n for n in first + second if n not in tried]
        if not seq:
            seq = [n for n in names if n not in tried]
        return sorted(seq, key=_score_model_name, reverse=True)

    for candidate in _pref_list(quality_used):
        try:
            summary = _run(candidate, gen_cfg)
            return summary, candidate, quality_used
        except Exception:
            continue

    raise HTTPException(status_code=502, detail="Gemini vision failed to summarize the image with available models.")


def ask_about_file(file_bytes: bytes, mime_type: str, prompt: Optional[str], quality: Optional[str] = None) -> Tuple[str, str, str]:
    """Answer a user prompt about an uploaded file (image/* or application/pdf).

    Returns (answer, model_used, quality_used).
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")

    # Route images through the existing vision helper
    if (mime_type or "").lower().startswith("image/"):
        text, model, q_used = summarize_image(file_bytes, mime_type=mime_type, prompt=prompt, quality=quality)
        return text, model, q_used

    if (mime_type or "").lower() not in {"application/pdf", "application/x-pdf", "application/acrobat"}:
        # Fallback: treat unknown types as binary attachment and still try via upload API
        pass

    genai.configure(api_key=settings.GEMINI_API_KEY)
    q_used, model_name, gen_cfg = _choose_quality_and_model(prompt or "analyze file", quality, task="file")

    instruction = (
        FILE_ASSISTANT_GUIDE + "\nTask: " + (
            prompt or "Answer the user's request using only the content of the attached file."
        )
    ).strip()

    # Persist bytes to a temp file for upload_file API
    tmp_path = None
    try:
        suffix = ".pdf" if (mime_type or "").lower().endswith("pdf") else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        def _run(model_local: str, cfg_local: dict) -> str:
            # Upload and wait until processed
            uploaded = genai.upload_file(path=tmp_path, mime_type=mime_type or "application/octet-stream")
            # best-effort wait until ACTIVE
            try:
                for _ in range(30):
                    meta = genai.get_file(uploaded.name)
                    state = getattr(getattr(meta, "state", None), "name", None) or getattr(meta, "state", None) or getattr(meta, "processing_status", None)
                    s = str(state).upper() if state else ""
                    if "ACTIVE" in s or "SUCCEED" in s or "READY" in s:
                        break
                    time.sleep(1)
            except Exception:
                pass

            model = genai.GenerativeModel(model_name=model_local, system_instruction=SYSTEM_PROMPT)
            resp = model.generate_content([uploaded, instruction], generation_config=cfg_local)
            text = getattr(resp, "text", None)
            if not text and hasattr(resp, "candidates"):
                try:
                    for cand in resp.candidates or []:
                        parts = getattr(cand.content, "parts", [])
                        chunks = [getattr(p, "text", "") for p in parts]
                        text = "\n".join([c for c in chunks if c])
                        if text:
                            break
                except Exception:
                    pass
            if not text:
                raise ValueError("Empty response from Gemini.")
            return text.strip()

        try:
            ans = _run(model_name, gen_cfg)
            return ans, model_name, q_used
        except Exception as e_primary:
            msg = str(e_primary).lower()
            if "404" in msg or "not found" in msg:
                alt = model_name[:-7] if model_name.endswith("-latest") else model_name + "-latest"
                if alt != model_name:
                    try:
                        ans = _run(alt, gen_cfg)
                        return ans, alt, q_used
                    except Exception:
                        pass
        # final fallbacks
        for cand in ["gemini-1.5-pro-latest", "gemini-1.5-flash-latest"]:
            if cand == model_name:
                continue
            try:
                ans = _run(cand, gen_cfg)
                return ans, cand, q_used
            except Exception:
                continue
        raise HTTPException(status_code=502, detail="Gemini failed to analyze the file with available models.")
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
