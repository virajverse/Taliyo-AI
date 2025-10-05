# Taliyo AI Backend (FastAPI)

## Setup

1. Create and activate virtual environment (Windows):
```
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies:
```
pip install -r requirements.txt
```

3. Configure environment:
```
copy .env.example .env
# Set GEMINI_API_KEY and adjust models/origins as needed
```

4. Run the server:
```
uvicorn main:app --reload
```

- Health check: http://127.0.0.1:8000/health
- Chat API: POST http://127.0.0.1:8000/chat
  - Body: { "message": "Hello" }
  - Response: { "reply": "...", "model": "..." }

## Notes
- Uses Google Gemini via `google-generativeai`. Default model is `gemini-1.5-flash`.
- Configure with `GEMINI_API_KEY` in `.env`.
- `pinecone_service.py` is a placeholder for future vector DB integration.
