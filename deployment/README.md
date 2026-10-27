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

## Configuration status

MongoDB, Groq and InWorld values are now configured on the AI service as well as the backend. AI health and MongoDB readiness return success. Real InWorld STT/TTS and Groq requests have been checked with synthetic test data. No secret values are committed. Browser microphone permission and a verified email sender still need environment-specific acceptance.

For a fresh environment, set these variables in Render, then deploy both services:

| Variable | Backend | AI |
| --- | --- | --- |
| `MONGODB_URI` | Required | Required; use the same Atlas database |
| `GROQ_API_KEY` | — | Required |
| `INWORLD_API_KEY` | — | Required for voice |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional HTTPS email provider with verified sender | — |
| `DATABASE_NAME` | Set explicitly | Set to the same value |
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

## Email and document storage

Free Render web services block outbound SMTP ports 25/465/587. The backend supports Resend over HTTPS using `RESEND_API_KEY` and `EMAIL_FROM`; provision a verified sender before testing actual email delivery. SMTP remains an option only on hosting that permits it. Missing configuration is reported as delivery failure.

Private Aadhaar/certificates require an owner access token or the admin header. Only approved gallery files are public. Uploads have content and size checks; these are not an antivirus scan. Free local storage is ephemeral, so real identity-document collection must wait for durable storage.

Draft capabilities expire after seven days and accept only supported non-password fields. Old caller-chosen draft identifiers are rejected. Store signing keys securely; rotating the account signing key invalidates outstanding access tokens and draft links.

## CI and acceptance

Install `deployment/requirements-test.txt`, run `deployment/run_ai_checks.py`, the backend `tests/test_security_contract.py` suite and `deployment/test_startup.py`. The AI runner uses mocked provider contracts and real local WebSocket framing. Actual cloud speech acceptance is still required after credentials are configured.

The deployed AI uses `GROQ_LLM_MODEL=openai/gpt-oss-20b`. `PREWARM_TTS_CACHE=false` keeps startup from generating all static audio prompts; normal audio generation and caching happen on demand. A denied microphone must remain visible in the UI and can be retried after the browser permission is enabled.
