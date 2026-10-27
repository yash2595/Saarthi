"""Deployment smoke checks that need no database or provider credentials."""
from pathlib import Path
import os
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "final frontend mantrasetu/MantraSetu-Saarthi-main"


def run_service(folder, code):
    env = os.environ.copy()
    for key in ("MONGODB_URI", "GROQ_API_KEY", "GEMINI_API_KEY", "INWORLD_API_KEY"):
        env.pop(key, None)
    env.update({key: secrets.token_urlsafe(48) for key in (
        "JWT_SECRET_KEY", "ADMIN_SECRET_KEY", "VOICE_TICKET_SECRET"
    )})
    env.update(RENDER="true", LLM_PROVIDER="groq", CORS_ORIGINS="https://saarthi-mantrasetu.vercel.app")
    result = subprocess.run([sys.executable, "-c", code], cwd=ROOT / folder, env=env,
                            capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr


def test_backend_starts_and_reports_pending_database():
    run_service("final backend mantrasetu/mantrasetu-saarthi-backend-main", '''
from app.main import app
from fastapi.testclient import TestClient
with TestClient(app) as client:
    assert client.get('/health').status_code == 200
    assert client.get('/ready').status_code == 503
    assert client.post('/auth/login', json={}).status_code == 503
    assert client.get('/openapi.json').status_code == 200
    response = client.get('/ready', headers={'Origin': 'https://saarthi-mantrasetu.vercel.app'})
    assert response.headers['access-control-allow-origin'] == 'https://saarthi-mantrasetu.vercel.app'
    response = client.options('/auth/login', headers={'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 400
''')


def test_ai_starts_without_keys_and_rejects_unconfigured_traffic():
    run_service("FINAL ai Mantra setu/MantraSetu-Saarthi-feature-ai-intent-engine", '''
from app.main import app
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
with TestClient(app) as client:
    assert client.get('/live').json() == {'status': 'running', 'configured': False}
    response = client.get('/health')
    assert response.status_code == 503
    assert set(response.json()['missing']) == {'MONGODB_URI', 'GROQ_API_KEY', 'INWORLD_API_KEY'}
    assert client.get('/openapi.json').status_code == 200
    try:
        with client.websocket_connect('/ws/voice'):
            raise AssertionError('Unconfigured voice connection must not open')
    except WebSocketDisconnect as exc:
        assert exc.code == 1013
''')


def test_required_frontend_assets_are_present():
    for filename in ('temple-hero.jpg', 'journey-explore.jpg', 'journey-puja.jpg',
                     'journey-muhurat.jpg', 'journey-pandit.jpg', 'special-pujas.jpg'):
        asset = FRONTEND / 'public' / filename
        assert asset.stat().st_size > 1000
    for state in ('idle', 'greeting', 'listening', 'thinking'):
        asset = FRONTEND / 'public/assets/saarthi' / f'{state}-avatar.png'
        assert asset.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
