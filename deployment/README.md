# Saarthi deployment

Frontend: Vercel project `saarthi-mantrasetu`, GitHub repository `yash2595/Saarthi`, production branch `main`.
Root directory: `final frontend mantrasetu/MantraSetu-Saarthi-main`.

Backend: existing Render service `Saarthi` (`srv-datnu0mgekts73bj30n0`).
Uses the root Dockerfile. Process health: `/health`; database readiness: `/ready`.

AI: existing Render service `Saarthi-1` (`srv-datnub7avr4c73e9s7ug`).
Root directory: `FINAL ai Mantra setu/MantraSetu-Saarthi-feature-ai-intent-engine`.
Build: `pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements.txt`.
Start: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
Process health: `/live`; full readiness: `/health`.

## Complete configuration later

The owner requested to add provider credentials and MongoDB later. The services remain reachable and return HTTP 503 `configuration_required` for unavailable features. No fake provider keys or database were added.

Set these variables in Render, then deploy both services:

| Variable | Backend | AI |
| --- | --- | --- |
| `MONGODB_URI` | Required | Required; use the same Atlas database |
| `GROQ_API_KEY` | — | Required |
| `INWORLD_API_KEY` | — | Required for voice |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Optional; required for verification emails | — |
| `GOOGLE_CLIENT_ID` | Optional; required for Google sign-in | — |

For Google sign-in, also set Vercel `VITE_GOOGLE_CLIENT_ID` to the same client ID and configure the production origin in Google Cloud. Redeploy the frontend after changing Vite variables.

Generated `JWT_SECRET_KEY`, `ADMIN_SECRET_KEY`, and the shared `VOICE_TICKET_SECRET` are stored in Render. Preserve them. Backend and AI must share the same voice secret. Do not commit secret values.

The service URLs and production CORS origin are configured in hosting environment variables. Vercel `VITE_API_BASE_URL` points to the backend.

## Persistent files and compute

The existing Render services use the free plan. Uploaded files and the local Chroma/TTS cache are ephemeral. Before accepting real document uploads, configure durable storage: attach an appropriate paid persistent disk and set `UPLOAD_DIR` for the backend, and configure persistent AI cache paths. No paid resources were provisioned.

Local sentence-transformer inference can need more memory than a free instance provides. Check actual memory use after adding keys and upgrade the AI compute plan if required. Database/provider operations and end-to-end voice cannot be verified until the owner supplies credentials.

## Validation

Frontend: `npm ci` and `npm run build` in its root directory.
Service smoke tests: install backend dependencies plus `google-genai`, `groq`, `PyJWT`, and `pytest`, then run `python -m pytest deployment/test_startup.py` from the repo root.

After configuration, verify backend `/ready`, AI `/health`, signup/login, a puja query, and a voice session. Keep `/live` distinct from full readiness so pending setup is not reported as a healthy AI pipeline.
