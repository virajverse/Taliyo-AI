from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    quality: Optional[Literal["low", "medium", "high"]] = None
    conversation_id: Optional[str] = Field(default=None, description="Existing conversation id")
    user_key: Optional[str] = Field(default=None, description="Stable user identifier to enable cross-conversation memory")
    # Optional lightweight tool call (kept minimal for compatibility)
    tool: Optional[str] = Field(default=None, description="Optional tool name to invoke before LLM, e.g., 'db_lookup'")
    tool_args: Optional[Dict[str, Any]] = Field(default=None, description="Arguments for the tool")


class ChatResponse(BaseModel):
    reply: str
    model: str
    quality: Literal["low", "medium", "high"]
    conversation_id: str


class MessageDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ConversationCreateResponse(BaseModel):
    id: str
    title: str
    created_at: datetime


class ConversationListItem(BaseModel):
    id: str
    title: str
    updated_at: datetime


class ConversationDetail(BaseModel):
    id: str
    title: str
    messages: List[MessageDTO]
    created_at: datetime
    updated_at: datetime


class DocumentUpsertRequest(BaseModel):
    id: Optional[str] = Field(default=None, description="Optional custom id")
    text: str
    metadata: Optional[Dict[str, Any]] = None


class RagQueryRequest(BaseModel):
    query: str
    k: int = 5


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    model: Optional[str] = None
    output: Optional[str] = None  # e.g., mp3_44100_128


class ChatVoiceRequest(ChatRequest):
    voice_id: Optional[str] = None
    tts_model: Optional[str] = None
    tts_output: Optional[str] = None
