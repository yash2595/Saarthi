"""Keep an unconfigured deployment reachable without accepting AI requests."""

import os

from starlette.responses import JSONResponse


def missing_configuration() -> list[str]:
    provider = os.getenv("LLM_PROVIDER", "groq").lower()
    llm_key = "GEMINI_API_KEY" if provider == "gemini" else "GROQ_API_KEY"
    return [key for key in ("MONGODB_URI", llm_key, "INWORLD_API_KEY") if not os.getenv(key, "").strip()]


class ConfigurationGuard:
    def __init__(self, app, application):
        self.app = app
        self.application = application

    async def __call__(self, scope, receive, send):
        missing = getattr(self.application.state, "missing_configuration", [])
        if missing and scope["type"] == "websocket":
            await receive()
            await send({"type": "websocket.close", "code": 1013, "reason": "AI service configuration is pending"})
            return
        if missing and scope["type"] == "http" and scope["path"] not in (
            "/live", "/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"
        ):
            response = JSONResponse(
                {"status": "configuration_required", "healthy": False, "missing": missing},
                status_code=503,
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
