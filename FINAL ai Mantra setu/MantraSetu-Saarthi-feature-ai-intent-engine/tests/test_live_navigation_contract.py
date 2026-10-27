"""Actual voice-orchestrator page command regressions, without cloud providers."""
import asyncio
from uuid import uuid4
from unittest.mock import AsyncMock, patch
import pytest
from app.orchestrator.navigation_commands import resolve_navigation_target
from app.orchestrator.ai_orchestrator import AIOrchestrator, build_location_response
from app.orchestrator.ai_session_manager import AISessionManager
from app.orchestrator.orchestrator_models import OrchestratorRequest
from app.orchestrator.providers.llm_intent_detector import LLMIntentDetector
from app.orchestrator.provider_manager import ProviderManager


@pytest.mark.parametrize('message,target', [
    ('Kundali page kholo', '/kundali-creation'), ('कुंडली खोलो', '/kundali-creation'),
    ('mujhe kundali banwani hai', '/kundali-creation'),
    ('मुझे कुंडली पेज पर ले चलो।', '/kundali-creation'),
    ('Puja dikhao', '/puja'), ('पूजा खोलो', '/puja'), ('havan kholo', '/puja'),
    ('Muhurat kholo', '/muhurat-finder'), ('puja ka muhurat kholo', '/muhurat-finder'),
    ('signup kholo', '/sign-up'), ('register', '/sign-up'),
    ('pandit registration kholo', '/sign-up?role=pandit'), ('पंडित पंजीकरण खोलो', '/sign-up?role=pandit'),
    ('pandit login', '/login?role=pandit'), ('login', '/login'),
    ('contact kholo', '/#contact'), ('about us', '/#mission'), ('profile kholo', '/dashboard'),
    ('kundali nahi, puja kholo', '/puja'), ('kundali nahi puja kholo', '/puja'),
    ('kundali mat kholo', None), ('cancel', None), ('my name is Puja', None),
    ('mera naam Puja hai', None), ('pooja@example.com', None), ('I met Puja yesterday', None),
])
def test_page_command_contract(message, target):
    assert resolve_navigation_target(message)['target'] == target


def test_ordered_clarification_and_cancel():
    first = resolve_navigation_target('muhurat aur kundali kholo')
    assert first['choices'] == ['/muhurat-finder', '/kundali-creation']
    assert resolve_navigation_target('dusra wala', first['choices'])['target'] == '/kundali-creation'
    assert resolve_navigation_target('२', first['choices'])['target'] == '/kundali-creation'
    assert resolve_navigation_target('nahi', first['choices'])['target'] is None
    assert resolve_navigation_target('haan', first['choices'])['target'] is None
    assert resolve_navigation_target('haan', first['choices'])['needs_clarification'] is True


def test_back_is_history_action_not_home():
    result = resolve_navigation_target('wapas jao')
    assert result['action'] == 'GO_BACK' and result['target'] is None


def test_actual_orchestrator_multiturn_and_no_provider_calls():
    async def scenario():
        sessions = AISessionManager()
        orchestrator = AIOrchestrator(session_manager=sessions)
        sid = 'navigation-contract-' + uuid4().hex
        async def turn(message, page='/'):
            return await orchestrator.process(OrchestratorRequest(user_message=message, session_id=sid, current_page=page))
        with patch.object(ProviderManager, 'generate_with_failover', new_callable=AsyncMock) as llm, \
             patch.object(LLMIntentDetector, 'detect', new_callable=AsyncMock) as intent:
            result = await turn('kundali kholo')
            assert result.navigation_directive['target'] == '/kundali-creation'
            result = await turn('muhurat aur puja kholo')
            assert result.navigation_directive is None and '1.' in result.text
            result = await turn('dusra wala')
            assert result.navigation_directive['target'] == '/puja'
            result = await turn('kundali nahi, login kholo')
            assert result.navigation_directive['target'] == '/login'
            result = await turn('wapas jao')
            assert result.navigation_directive['action'] == 'GO_BACK'
            result = await turn('cancel')
            assert result.navigation_directive is None
            result = await turn('signup kholo')
            assert result.navigation_directive['target'] == '/sign-up'
            session = sessions.get_or_create_session(sid, 'default_conv')
            assert not getattr(session, 'onboarding_state', None)
            result = await turn('puja kholo', '/sign-up')
            assert result.navigation_directive['target'] == '/puja'
            assert not getattr(session, 'onboarding_state', None)
            assert not getattr(session, 'pending_booking', None)
            llm.assert_not_called()
            intent.assert_not_called()
    asyncio.run(scenario())


def test_pandit_location_uses_actual_frontend_url():
    sessions = AISessionManager()
    session = sessions.get_or_create_session('location-contract', 'default_conv')
    session.update_location(page='/sign-up?role=pandit')
    assert 'Panditji Registration' in build_location_response(session)
