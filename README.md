<div align="center">

# 🕉️ MantraSetu — Saarthi AI Voice Assistant

### *AgentOS · AI-Driven Navigation Intelligence*

[![Version](https://img.shields.io/badge/version-1.0.0--beta-orange?style=for-the-badge)](https://github.com/yash2595/Saarthi)
[![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](./LICENSE)

> **MantraSetu Saarthi** is a multilingual AI voice assistant for Hindu rituals — connecting users with pandits, guiding puja bookings, and answering spiritual queries in real-time through an AI-driven navigation architecture.

</div>

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [AgentOS — Navigation Intelligence](#-agentos--navigation-intelligence)
3. [Repository Architecture](#-repository-architecture)
4. [Why AI Cannot Navigate Directly](#-why-ai-cannot-navigate-directly)
5. [End-to-End Navigation Flow](#-end-to-end-navigation-flow)
6. [AI Processing Pipeline](#-ai-processing-pipeline)
7. [Route Resolution & Navigation Registry](#-route-resolution--navigation-registry)
8. [Sequence Diagram](#-sequence-diagram)
9. [Responsibilities Matrix](#-responsibilities-matrix)
10. [Tech Stack](#-tech-stack)
11. [Project Structure](#-project-structure)
12. [Quick Start](#-quick-start)
13. [Environment Variables](#-environment-variables)
14. [API Reference](#-api-reference)
15. [Key Design Principles](#-key-design-principles)
16. [Contributing](#-contributing)

---

## 🌟 Project Overview

**MantraSetu Saarthi** is an intelligent, voice-first platform built for Sanatan Dharma practitioners. It enables users to:

- 🗣️ **Voice-interact** in Hindi & English with an AI assistant (Saarthi)
- 📿 **Book pandits** for pujas, havan, and religious ceremonies
- 🏛️ **Discover temples** and upcoming religious events
- 📅 **Find muhurat** (auspicious timing) via AI-guided conversation
- 🤖 **Get AI-driven navigation** — the app moves to the right screen based on what you _say_, not what you click

MantraSetu follows a unique **AI-driven navigation architecture (AgentOS)** where the AI assistant decides which screen to show, and the frontend executes that navigation.

---

## 🧠 AgentOS — Navigation Intelligence

> **Module:** AI Navigation Intelligence | **Version:** 1.0
> **Audience:** Frontend Engineers · Backend Engineers · AI Engineers

### Objective

The **Navigation Intelligence** module enables the AI Assistant to **control application navigation dynamically**, based on the user's conversational intent.

Unlike traditional applications where navigation is initiated by user clicks, MantraSetu follows an **AI-driven navigation architecture**:

- The **AI** determines the appropriate screen based on user intent
- The **Frontend** executes the navigation using React Router
- This architecture **separates decision-making (AI) from UI rendering (Frontend)**, ensuring loose coupling and scalability

---

## 🏗️ Repository Architecture

The system is divided into **three independent repositories**, each with a dedicated responsibility:

```
┌─────────────────────────────┐
│       Frontend Repository   │
│       React + Vite          │
└──────────────┬──────────────┘
               │
          REST / WebSocket
               │
┌──────────────▼──────────────┐
│       Backend Repository    │
│       Node.js + Express     │
└──────────────┬──────────────┘
               │
          Internal REST API
               │
┌──────────────▼──────────────┐
│         AI Repository       │
│  Python + FastAPI (AgentOS) │
└─────────────────────────────┘
```

| Repository | Responsibility |
|---|---|
| **Frontend** | UI Rendering & React Router Navigation |
| **Backend** | Authentication, Business Logic, API Gateway |
| **AI Service** | Intent Detection, Workflow Planning, Navigation Decision |

---

## ❓ Why AI Cannot Navigate Directly

The AI service has **no access to the browser**. It cannot execute:

```javascript
navigate("/booking"); // ❌ Impossible from Python backend
```

**Because:**
- React Router exists **only inside the frontend** application
- The Python AI runs as an **independent backend service**
- **Browser APIs are inaccessible** to backend services

> ✅ **Therefore:** The AI only _suggests_ navigation. The frontend _performs_ the actual navigation.

---

## 🔄 End-to-End Navigation Flow

### Step 1 — User Sends a Request

The user provides a voice or text command:

```
User says: "Mujhe Satyanarayan Puja book karni hai."
```

The frontend captures the message.

```
User → React Frontend
```

### Step 2 — Frontend Calls Backend

```http
POST /api/chat
Content-Type: application/json

{
  "message": "Mujhe Satyanarayan Puja book karni hai"
}
```

> The frontend does **not** decide navigation. Its responsibility is limited to sending the user request.

### Step 3 — Backend Calls AI

```http
POST http://ai-service:8000/chat
Content-Type: application/json

{
  "sessionId": "abc123",
  "userId":    "u100",
  "message":   "Mujhe Satyanarayan Puja book karni hai"
}
```

> The backend behaves as an **API Gateway**.

---

## 🤖 AI Processing Pipeline

The AI receives the request. Internally, the following pipeline executes:

```
Conversation Manager
        ↓
Intent Detection
        ↓
Entity Extraction
        ↓
Workflow Selection
        ↓
Navigation Decision
        ↓
Response Builder
```

Suppose the detected intent is `BOOK_PUJA`. The AI determines that the user must be taken to the **Booking Screen**.

---

## 🗺️ Route Resolution & Navigation Registry

The AI does **not** know frontend URLs directly. Instead, it uses a **logical screen identifier**:

```
BOOKING_SCREEN
```

The **Navigation Registry** maps this identifier:

```
BOOKING_SCREEN  →  /booking
HOME_SCREEN     →  /
KUNDALI_SCREEN  →  /kundali
MUHURAT_SCREEN  →  /muhurat-finder
PUJA_SCREEN     →  /puja
DASHBOARD       →  /dashboard
```

> This abstraction ensures **frontend routes can change without affecting AI workflows**.

### AI Generates Navigation Action

```json
{
  "reply": "Ji bilkul, chaliye booking shuru karte hain.",
  "actions": [
    {
      "type":  "NAVIGATE",
      "route": "/booking"
    }
  ]
}
```

> ⚠️ The AI is **not navigating** — it is only **instructing** the frontend.

### Step 8 — Backend Returns AI Response

```
AI → Backend → Frontend
```

> The backend performs **no UI navigation**.

### Step 9 — Frontend Executes Navigation

```typescript
const navigate = useNavigate();
navigate("/booking");
// React Router: /  →  /booking
// React renders: BookingPage.tsx
```

### Step 10 — Navigation Acknowledgement

```http
POST /api/navigation/ack
Content-Type: application/json

{
  "route": "/booking"
}
```

### Step 11 — Backend Updates Navigation State

| Field | Value |
|---|---|
| Current Route | `/booking` |
| Workflow | `BOOK_PUJA` |
| History | `/ → /booking` |

> The AI now knows the user's **current screen** and continues the workflow.

### Step 12 — Workflow Continuation (FORM_FILL)

If the conversation already contains:

```
Temple = Ram Mandir
Puja   = Satyanarayan
```

The AI generates:

```json
{
  "type": "FORM_FILL",
  "fields": {
    "temple": "Ram Mandir",
    "puja":   "Satyanarayan"
  }
}
```

**React Hook Form** auto-populates:

```typescript
setValue("temple", "Ram Mandir");
setValue("puja",   "Satyanarayan");
```

The booking form is **automatically populated**. ✨

---

## 📊 Sequence Diagram

```
User
 │
 │  1. Voice / Text Input
 ▼
Frontend (React + Vite)
 │
 │  POST /api/chat
 ▼
Backend (Node.js + Express)
 │
 │  POST http://ai-service:8000/chat
 ▼
AI Service (Python + FastAPI)
 │
 │  ┌──────────────────────────────┐
 │  │  Intent Detection             │
 │  │  Entity Extraction            │
 │  │  Workflow Selection           │
 │  │  Navigation Decision          │
 │  └──────────────────────────────┘
 ▼
AI Response
{ "reply": "...", "actions": [{ "type": "NAVIGATE", "route": "/booking" }] }
 │
 ▼
Backend  (validates & forwards)
 │
 ▼
Frontend
 │
 │  navigate("/booking")   ← React Router
 ▼
Booking Page Rendered ✅
 │
 │  POST /api/navigation/ack  { "route": "/booking" }
 ▼
Backend  (updates Navigation Store)
 │
 ▼
AI Workflow Continues  →  FORM_FILL / next intent
```

---

## 📋 Responsibilities Matrix

| Component | Responsibility |
|---|---|
| **React Frontend** | Capture input, execute React Router navigation, render UI |
| **Backend** | Authentication, API Gateway, communication with AI |
| **AI Service** | Understand user intent, decide workflow, generate navigation actions |
| **React Router** | Perform browser navigation |
| **Workflow Engine** | Determine the required business screen |
| **Navigation Registry** | Convert logical screen identifiers into frontend routes |

---

## 🛠️ Tech Stack

### AI Service (AgentOS — Python)

| Technology | Purpose |
|---|---|
| **Python 3.11** | Core language |
| **FastAPI** | REST + WebSocket API server |
| **Groq — Qwen 3.8B** | LLM for multi-turn conversation |
| **Groq — GPT-oss-20b** | Fast LLM for quick intent classification |
| **Google Gemini** | Advanced AI reasoning |
| **InWorld AI STT** | Speech-to-Text (`inworld/inworld-stt-1`) |
| **InWorld AI TTS** | Text-to-Speech (`inworld-tts-2-flash`, voice: Manoj) |
| **ChromaDB** | Vector DB for RAG (ritual knowledge base) |
| **MongoDB Atlas + Motor** | Async session, user & workflow state |
| **multilingual MiniLM** | Sentence embeddings for semantic search |

### Frontend (React)

| Technology | Purpose |
|---|---|
| **React 18** | UI Framework |
| **Vite** | Build tool & dev server |
| **TypeScript** | Type safety |
| **React Router v6** | AI-driven client-side navigation |
| **React Hook Form** | AI-driven form population |
| **shadcn/ui** | Component library |
| **WebSocket** | Real-time voice streaming |

### Backend (Node.js)

| Technology | Purpose |
|---|---|
| **Node.js + Express** | API Gateway |
| **JWT (HS256)** | Authentication |
| **HMAC-SHA256** | Voice ticket signing |

---

## 📂 Project Structure

```
Saarthi/
├── 📁 final backend mantrasetu/
│   └── mantrasetu-saarthi-backend-main/
│       ├── app/
│       │   ├── api/              # FastAPI route handlers
│       │   │   ├── auth.py       # /auth/* endpoints
│       │   │   └── voice.py      # /voice/ticket, /voice/stream
│       │   ├── controllers/      # Business logic controllers
│       │   ├── core/             # JWT, config, security
│       │   ├── database/         # MongoDB Atlas connection (Motor)
│       │   ├── models/           # Pydantic v2 models
│       │   ├── orchestrator/     # Voice pipeline (STT → LLM → TTS)
│       │   ├── schemas/          # Request / Response schemas
│       │   ├── services/         # InWorld, Groq, ChromaDB services
│       │   └── utils/            # Helpers & utilities
│       ├── main.py               # FastAPI app entrypoint
│       ├── .env.example
│       └── requirements.txt
│
├── 📁 final frontend mantrasetu/
│   └── MantraSetu-Saarthi-main/
│       ├── src/
│       │   ├── components/       # VoiceAssistant, Navbar, etc.
│       │   ├── contexts/         # AuthContext, NavigationContext
│       │   ├── hooks/            # useSaarthiVoice, useNavigate
│       │   ├── pages/            # Home, Login, Dashboard, Puja, Booking
│       │   ├── services/         # API service layer
│       │   └── utils/            # formSecurity, helpers
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── 📁 FINAL ai Mantra setu/       # AgentOS AI Repository
│   └── MantraSetu-Saarthi-feature-ai-intent-engine/
│       └── app/
│           ├── conversation/      # Intent engine, entity extractor
│           ├── orchestrator/      # Navigation intelligence, workflow engine
│           └── api/               # WebSocket & REST handlers
│
├── .github/
│   └── workflows/ci.yml          # GitHub Actions CI pipeline
│
├── README.md
├── SECURITY.md
├── PERFORMANCE.md
├── DEPLOYMENT_CHECKLIST.md
└── .gitignore
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB Atlas account
- Groq API key
- InWorld AI API key

### 1. Clone the Repository

```bash
git clone https://github.com/yash2595/Saarthi.git
cd Saarthi
```

### 2. Setup AI Backend (Python / FastAPI)

```bash
cd "final backend mantrasetu/mantrasetu-saarthi-backend-main"

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r app/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

### 3. Setup Frontend (React / Vite)

```bash
cd "final frontend mantrasetu/MantraSetu-Saarthi-main"

npm install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000

npm run dev
```

- Frontend: `http://localhost:5173`

---

## ⚙️ Environment Variables

```env
# API URLs
API_BASE_URL=http://localhost:8000
MAIN_BACKEND_URL=http://localhost:8000

# Security & Database
JWT_SECRET=your_jwt_secret_here
JWT_SECRET_KEY=your_jwt_secret_here
VOICE_TICKET_SECRET=your_voice_ticket_secret_here
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
DATABASE_NAME=mantrasetu

# LLM — Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash

# LLM — Groq
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_LLM_MODEL=qwen/qwen3.8-27b
GROQ_LLM_MODEL_FAST=openai/gpt-oss-20b

# STT & TTS — InWorld AI
DEFAULT_STT_PROVIDER=inworld
DEFAULT_TTS_PROVIDER=inworld
INWORLD_API_KEY=your_inworld_api_key
INWORLD_STT_MODEL=inworld/inworld-stt-1
INWORLD_TTS_MODEL=inworld-tts-2-flash
INWORLD_VOICE_ID=Manoj
INWORLD_SPEED=0.88

# RAG — ChromaDB
CHROMA_DB_PATH=./data/chroma_db
EMBEDDING_MODEL_NAME=paraphrase-multilingual-MiniLM-L12-v2

# Voice Rate Limiting
VOICE_GUEST_SESSION_LIMIT=5
VOICE_GUEST_WINDOW_SECONDS=600
```

> ⚠️ **Never commit `.env` to Git.** Already excluded in `.gitignore`.

---

## 📡 API Reference

### Chat (Navigation Intelligence Entry Point)

```http
POST /api/chat
Authorization: Bearer <jwt_token>

{
  "message":   "Mujhe Satyanarayan Puja book karni hai",
  "sessionId": "abc123"
}
```

**Response:**
```json
{
  "reply": "Ji bilkul, chaliye booking shuru karte hain.",
  "actions": [
    { "type": "NAVIGATE",  "route": "/booking" },
    { "type": "FORM_FILL", "fields": { "puja": "Satyanarayan" } }
  ]
}
```

### Navigation Acknowledgement

```http
POST /api/navigation/ack
Authorization: Bearer <jwt_token>

{ "route": "/booking" }
```

### Voice WebSocket

```
WS /voice/stream?ticket=<voice_ticket>
```

Binary PCM 16-bit, 16kHz audio frames, bidirectional.

### Voice Ticket

```http
POST /voice/ticket
Authorization: Bearer <jwt_token>
```

Returns a short-lived HMAC-SHA256 signed ticket.

### Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login & receive JWT |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/pandit/register` | Pandit registration with documents |

---

## 🎯 Key Design Principles

```
┌──────────────────────────────────────────────────────────────────┐
│                     AgentOS Core Principles                       │
├──────────────────────────────────────────────────────────────────┤
│  1.  AI never directly controls the browser                      │
│  2.  Frontend is the ONLY layer for UI navigation                │
│  3.  Backend is the communication bridge (AI ↔ Frontend)        │
│  4.  Navigation is action-based (NAVIGATE) not hardcoded URLs    │
│  5.  Route mapping centralized via Navigation Registry           │
│  6.  Workflow resumes ONLY after successful navigation ACK       │
│  7.  Loosely coupled & independently deployable across 3 repos   │
└──────────────────────────────────────────────────────────────────┘
```

| Principle | Benefit |
|---|---|
| AI suggests, Frontend executes | Browser security boundary maintained |
| Navigation Registry abstraction | Frontend routes change without AI code changes |
| ACK-based continuation | Guaranteed screen state before workflow resumes |
| Action-based response format | Extensible: add `SCROLL`, `MODAL`, `TOAST` anytime |
| Three-repo separation | Each team deploys and scales independently |

---

## 🔐 Security

- All secrets sourced from environment variables — never hardcoded
- Voice sessions use **HMAC-SHA256 signed tickets** (short-lived)
- JWT access tokens with refresh flow
- MongoDB URI uses a **scoped DB user** with minimal permissions

See [SECURITY.md](./SECURITY.md) for the full policy.

---

## ⚡ Performance

- TTS cache reduces median latency: **1.2s → 0.15s** for repeated phrases
- Fast LLM (`openai/gpt-oss-20b`) for quick intent detection
- Full LLM (`qwen/qwen3.8-27b`) for complex multi-turn conversations
- ChromaDB runs embedded — no external vector DB round-trip

See [PERFORMANCE.md](./PERFORMANCE.md) for full notes.

---

## 🤝 Contributing

```bash
# Fork, clone, then:
git checkout -b feat/your-feature-name
git commit -m "feat(navigation): add MODAL action type support"
git push origin feat/your-feature-name
# → Open PR against main
```

Commit types: `feat:` · `fix:` · `docs:` · `perf:` · `test:` · `ci:` · `chore:`

---

## 📜 License

[MIT](./LICENSE) © 2026 Yash Mishra & MantraSetu Team

---

<div align="center">

**🕉️ Jai Shree Ram — Built with devotion for Sanatan Dharma 🕉️**

[GitHub](https://github.com/yash2595/Saarthi) · [Report Bug](https://github.com/yash2595/Saarthi/issues) · [Request Feature](https://github.com/yash2595/Saarthi/issues)

</div>