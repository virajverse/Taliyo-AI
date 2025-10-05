<div align="center">
  <h1>✨ Taliyo AI</h1>
  <p><em>Your Intelligent AI Assistant with Web Search & Document Understanding</em> 🚀</p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
  
  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Ftaliyo-ai)
  [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=)
</div>

## 📜 Table of Contents
- [✨ Features](#-features)
- [🚀 Tech Stack](#-tech-stack)
- [🎯 Quick Start](#-quick-start)
- [🛠️ Installation](#%EF%B8%8F-installation)
- [📁 Project Structure](#-project-structure)
- [🌐 API Reference](#-api-reference)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👨‍💻 Author](#-author)

## ✨ Features

- 💬 **AI-Powered Chat** - Natural conversations powered by Google's Gemini AI
- 🌐 **Web Search** - Get real-time information with integrated web search
- 📄 **Document Understanding** - Upload and chat with PDFs, DOCs, and more
- 🎨 **Modern UI** - Beautiful, responsive interface built with Next.js & Tailwind
- 🚀 **Blazing Fast** - Optimized for performance with FastAPI backend
- 🔒 **Secure** - Built with security best practices in mind
- 📱 **Mobile-First** - Works seamlessly across all devices

## 🚀 Tech Stack

### Frontend
- ⚡ **Next.js 14** - React framework for server-rendered applications
- 🎨 **Tailwind CSS** - Utility-first CSS framework
- 🔄 **React Query** - Data fetching and state management
- 📱 **Progressive Web App** - Installable on mobile & desktop

### Backend
- 🐍 **FastAPI** - Modern, fast (high-performance) web framework
- 🔍 **Google Gemini** - Advanced AI capabilities
- 🗃️ **MongoDB** - Scalable NoSQL database
- 🔄 **WebSockets** - Real-time communication

## 🎯 Quick Start

### Prerequisites
- Node.js 18+ & npm 9+
- Python 3.10+
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key

### 🚀 One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Ftaliyo-ai)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=)

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/taliyo-ai.git
cd taliyo-ai
```

### 2. Set up Backend
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 3. Set up Frontend
```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

### 4. Run the Application
```bash
# Start backend (from backend directory)
uvicorn app.main:app --reload

# In a new terminal, start frontend (from frontend directory)
npm run dev
```

Visit `http://localhost:3000` in your browser!

## 📁 Project Structure

```
taliyo-ai/
├── backend/               # FastAPI backend
│   ├── app/              
│   │   ├── api/          # API routes
│   │   ├── core/         # Core configurations
│   │   ├── models/       # Database models
│   │   ├── services/     # Business logic
│   │   └── main.py       # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   └── .env.example      # Environment variables example
│
└── frontend/             # Next.js frontend
    ├── app/              # App router
    │   ├── api/          # API routes
    │   ├── components/   # React components
    │   └── lib/          # Utility functions
    ├── public/           # Static files
    └── package.json      # Frontend dependencies
```

## 🌐 API Reference

### Authentication
```http
POST /api/auth/register
POST /api/auth/login
```

### Chat
```http
POST /api/chat
GET /api/chat/history
```

### Documents
```http
POST /api/documents/upload
GET /api/documents
```

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👨‍💻 Author

**Your Name**

- 🌐 [Portfolio](https://yourportfolio.com)
- 💼 [LinkedIn](https://linkedin.com/in/yourprofile)
- 🐦 [Twitter](https://twitter.com/yourhandle)
- ✉️ Email: your.email@example.com

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) for the powerful AI
- [Next.js](https://nextjs.org/) and [FastAPI](https://fastapi.tiangolo.com/) teams
- All contributors who helped shape this project

---

<div align="center">
  Made with ❤️ and ☕ by Your Name
</div>
# Edit .env and set GEMINI_API_KEY
```

3) Run server:
```
uvicorn main:app --reload
# FastAPI is now at http://127.0.0.1:8000
```

## Frontend Setup (Next.js + Tailwind)

1) Install deps:
```
cd frontend
npm install
```

2) Configure environment (optional):
```
copy .env.local.example .env.local
# Adjust NEXT_PUBLIC_BACKEND_URL if needed (defaults to http://127.0.0.1:8000)
```

3) Run dev server:
```
npm run dev
# App is now at http://localhost:3000
```

## Flow
- Frontend: http://localhost:3000
- Backend: http://127.0.0.1:8000
- Frontend -> Backend via Axios to `/chat`.

## Notes
- Uses Poppins font and a light blue theme.
- Placeholder `pinecone_service.py` is provided for future vector DB integration.
- Production tips: Add auth, rate-limiting, observability, and caching before going live.
