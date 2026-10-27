"""Real FastAPI WebSocket framing with the real router/orchestrator; cloud audio mocked."""
import base64
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from jose import jwt
from app.core.config import settings
from app.api.websocket import router
from app.orchestrator.ai_orchestrator import AIOrchestrator
from app.voice.gateway import VoiceGateway
from app.voice.session_manager import VoiceSessionManager
from app.voice.stt.base import ISpeechRecognizer


def ticket(**changes):
    return jwt.encode({'type': 'guest', 'client_ip': uuid4().hex,
        'exp': datetime.now(timezone.utc)+timedelta(minutes=1), **changes}, settings.voice_ticket_secret, algorithm='HS256')


@pytest.fixture
def client():
    application = FastAPI()
    application.include_router(router.ws_router)
    gateway = VoiceGateway(ai_orchestrator=AIOrchestrator(), session_manager=VoiceSessionManager(),
        speech_recognizer=AsyncMock(spec=ISpeechRecognizer))
    class SyntheticTTS:
        async def process_response(self, response):
            yield SimpleNamespace(sequence_number=0, is_final=True, data=b'\x01\x00'*20,
                metadata={'sample_rate': 24000, 'encoding': 'PCM'})
    with patch.object(router, 'get_voice_gateway', return_value=gateway), \
         patch.object(router, 'get_tts_pipeline', return_value=SyntheticTTS()):
        with TestClient(application) as http:
            yield http


def receive_type(ws, expected):
    for _ in range(10):
        frame = ws.receive_json()
        if frame['type'] == expected:
            return frame
    raise AssertionError('Expected ' + expected)


@pytest.mark.parametrize('page,pandit', [('/', False), ('/sign-up', False),
    ('/signup', False), ('/sign-up?role=pandit', True), ('/signup?role=pandit', True)])
def test_connect_greeting_is_role_aware(client, page, pandit):
    with client.websocket_connect('/ws/voice?ticket=' + ticket()) as ws:
        ws.send_json({'type': 'CONNECT', 'payload': {'current_page': page}})
        connected = receive_type(ws, 'CONNECTED')
        assert connected['payload']['session_id']
        greeting = receive_type(ws, 'AI_RESPONSE')['payload']
        assert (greeting['active_field'] == 'pandit-avatar') is pandit
        audio = receive_type(ws, 'AUDIO_CHUNK')['payload']
        assert audio['sample_rate'] == 24000 and audio['encoding'] == 'PCM'
        assert base64.b64decode(audio['data']) == b'\x01\x00'*20
        ws.send_json({'type': 'DISCONNECT'})


def test_text_conversation_roundtrip_and_invalid_frame_recovery(client):
    with client.websocket_connect('/ws/voice?ticket=' + ticket()) as ws:
        ws.send_json({'type': 'CONNECT', 'payload': {'current_page': '/'}})
        receive_type(ws, 'CONNECTED')
        receive_type(ws, 'AI_RESPONSE')
        receive_type(ws, 'AUDIO_CHUNK')
        ws.send_text('{malformed')
        assert receive_type(ws, 'ERROR')['payload']['message']
        for text, expected in [('kundali kholo', '/kundali-creation'), ('muhurat aur puja kholo', None), ('dusra wala', '/puja')]:
            ws.send_json({'type': 'TEXT', 'payload': {'text': text, 'current_page': '/'}})
            response = receive_type(ws, 'AI_RESPONSE')['payload']
            assert response['target'] == expected
            receive_type(ws, 'AUDIO_CHUNK')
        ws.send_json({'type': 'PING'})
        receive_type(ws, 'PONG')
        ws.send_json({'type': 'DISCONNECT'})


@pytest.mark.parametrize('query,origin', [('', None), ('?ticket=invalid', None),
    ('expired', None), ('valid', 'https://untrusted.example.invalid')])
def test_websocket_ticket_and_origin_gates(client, query, origin):
    if query == 'expired':
        query = '?ticket=' + ticket(exp=1)
    if query == 'valid':
        query = '?ticket=' + ticket()
    with pytest.raises(WebSocketDisconnect) as rejected:
        with client.websocket_connect('/ws/voice' + query, headers={'origin': origin} if origin else {}):
            pytest.fail('Unauthorized connection opened')
    assert rejected.value.code == 1008
