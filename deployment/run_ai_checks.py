"""Repeatable AI contracts with mocked cloud providers and no real credentials."""
import os
from pathlib import Path
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
AI = ROOT / 'FINAL ai Mantra setu/MantraSetu-Saarthi-feature-ai-intent-engine'
SUITES = (
    'test_live_navigation_contract', 'test_websocket_navigation_contract',
    'test_groq_stt_contract', 'test_groq_llm_contract', 'test_inworld_tts_contract',
    'test_voice_gateway', 'test_navigation_foundation', 'test_navigation_execution',
    'test_navigation_intelligence', 'test_spoken_extraction', 'test_orchestrator',
)
env = os.environ.copy()
for name in ('MONGODB_URI', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'INWORLD_API_KEY'):
    env[name] = ''
env.update(VOICE_TICKET_SECRET=secrets.token_urlsafe(48), LLM_PROVIDER='groq')
raise SystemExit(subprocess.call([sys.executable, '-m', 'pytest',
    *[f'tests/{suite}.py' for suite in SUITES], '-q', '--tb=short', *sys.argv[1:]], cwd=AI, env=env))
