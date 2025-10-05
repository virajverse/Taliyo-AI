import os
from pathlib import Path
from dotenv import load_dotenv

# Load env files from backend root: prefer local overrides if present
BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")


class Settings:
    """Application settings loaded from environment variables (.env supported)."""

    def __init__(self) -> None:
        # Google Gemini
        self.GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
        # Default model if none provided
        self.GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-pro-latest")
        # Optional per-task overrides
        # Text chat generation
        self.GEMINI_TEXT_MODEL: str = os.getenv("GEMINI_TEXT_MODEL", self.GEMINI_MODEL)
        # Streaming chat (can differ if desired)
        self.GEMINI_STREAM_MODEL: str = os.getenv("GEMINI_STREAM_MODEL", self.GEMINI_TEXT_MODEL)
        # Vision (images)
        self.GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", self.GEMINI_MODEL)
        # File analysis (PDF/Office/CSV/TXT)
        self.GEMINI_FILE_MODEL: str = os.getenv("GEMINI_FILE_MODEL", self.GEMINI_VISION_MODEL)

        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
        self.CORS_ORIGINS = [o.strip() for o in origins.split(",") if o.strip()]

        # MongoDB
        self.MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
        self.MONGODB_DB: str = os.getenv("MONGODB_DB", "taliyo_ai")

        # Memory / context window for chat (number of recent turns kept)
        self.MEMORY_MAX_MESSAGES: int = int(os.getenv("MEMORY_MAX_MESSAGES", "30"))

        # Streaming toggle (for SSE endpoint)
        self.STREAMING_ENABLED: bool = os.getenv("STREAMING_ENABLED", "true").lower() in {"1", "true", "yes", "y"}

        # Embeddings / RAG
        self.EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
        self.RAG_COLLECTION: str = os.getenv("RAG_COLLECTION", "documents")
        self.RAG_VECTOR_INDEX: str = os.getenv("RAG_VECTOR_INDEX", "vector_index")

        # Safety settings (very simple word blocklist for demo)
        self.SAFETY_BLOCK_WORDS: list[str] = [w.strip() for w in os.getenv("SAFETY_BLOCK_WORDS", "").split(',') if w.strip()]

        # Memory summaries to include from previous conversations per user
        self.GLOBAL_SUMMARIES_LIMIT: int = int(os.getenv("GLOBAL_SUMMARIES_LIMIT", "5"))

        # Local archiving (free, no cloud)
        self.ARCHIVE_AFTER_DAYS: int = int(os.getenv("ARCHIVE_AFTER_DAYS", "30"))
        self.LOCAL_ARCHIVE_DIR: str = os.getenv("LOCAL_ARCHIVE_DIR", "data/archive")

        # ElevenLabs TTS
        self.ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
        # Default voice id from your ElevenLabs account (VoiceLab)
        self.ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "")
        # TTS model (common: eleven_multilingual_v2, eleven_turbo_v2)
        self.ELEVENLABS_MODEL: str = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
        # Output format preset (e.g., mp3_44100_128, mp3_44100_64)
        self.ELEVENLABS_OUTPUT: str = os.getenv("ELEVENLABS_OUTPUT", "mp3_44100_128")


settings = Settings()
