"""HTTP regressions using a disposable MongoDB database, never production data."""
import asyncio
from datetime import datetime, timedelta, timezone
from io import BytesIO
import os
from pathlib import Path
import secrets
from tempfile import TemporaryDirectory
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest
from pymongo import MongoClient
from bson import ObjectId
from PIL import Image
from jose import jwt
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile

DB_NAME = os.environ['DATABASE_NAME']
FILES = TemporaryDirectory(prefix='saarthi_contract_')
os.environ['UPLOAD_DIR'] = FILES.name
from app.main import app
from app.core.config import settings
from app.services.security import create_access_token
from app.utils.file_handler import save_uploaded_file
from app.services import email_service


@pytest.fixture
def patch_mongodb_client():
    # Override the legacy async-test fixture: these HTTP tests use TestClient's loop.
    yield


@pytest.fixture(scope='module')
def client():
    mongo = MongoClient(os.environ['MONGODB_URI'], serverSelectionTimeoutMS=3000)
    mongo.admin.command('ping')
    try:
        with TestClient(app) as value:
            yield value, mongo[DB_NAME]
    finally:
        assert DB_NAME.startswith('saarthi_contract_') and len(DB_NAME) == 49
        mongo.drop_database(DB_NAME)
        mongo.close()
        FILES.cleanup()


def auth(identifier=None):
    return {'Authorization': 'Bearer ' + create_access_token(str(identifier or ObjectId()), 'fixture@example.invalid')}


def test_public_directory_approved_only_and_private_fields_absent(client):
    http, db = client
    for status in ('pending', 'approved', 'rejected'):
        db.pandit_applications.insert_one(dict(name=status, status=status, email=status+'@example.invalid',
            phone='PRIVATE', hashed_password='PRIVATE', aadhaar_file='PRIVATE', certificate_file='PRIVATE',
            gallery_files=[], city='Delhi', newly_added_private_field='PRIVATE'))
    response = http.get('/pandit/list')
    assert response.status_code == 200
    assert [item['name'] for item in response.json()] == ['approved']
    assert not {'email', 'phone', 'hashed_password', 'aadhaar_file', 'certificate_file', 'newly_added_private_field'} & response.json()[0].keys()


def test_documents_owner_admin_and_public_gallery(client):
    http, db = client
    owner = ObjectId()
    references = {}
    for category in ('aadhaar', 'certificates', 'gallery'):
        filename = uuid4().hex + '.png'
        directory = Path(FILES.name) / category
        directory.mkdir(exist_ok=True)
        Image.new('RGB', (4, 4)).save(directory / filename)
        references[category] = f'uploads/{category}/{filename}'
    db.pandit_applications.insert_one(dict(_id=owner, email='owner@example.invalid', status='pending',
        aadhaar_file=references['aadhaar'], certificate_file=references['certificates'], gallery_files=[references['gallery']]))
    for path in references.values():
        assert http.get('/' + path).status_code == 401
        assert http.get('/' + path, headers=auth()).status_code == 404
        result = http.get('/' + path, headers=auth(owner))
        assert result.status_code == 200 and result.headers['cache-control'] == 'private, no-store'
        assert http.get('/' + path, headers={'x-admin-key': settings.ADMIN_SECRET_KEY}).status_code == 200
        assert http.get('/' + path, headers={'Authorization': 'Bearer invalid'}).status_code == 401
    db.pandit_applications.update_one({'_id': owner}, {'$set': {'status': 'approved'}})
    assert http.get('/' + references['gallery']).status_code == 200
    assert http.get('/' + references['aadhaar']).status_code == 401
    assert http.get('/uploads/other/' + uuid4().hex + '.png').status_code == 404


@pytest.mark.parametrize('filename,content,expected', [
    ('bad.jpg', b'not an image', 400), ('empty.png', b'', 400),
    ('bad.pdf', b'not PDF', 400), ('huge.jpg', b'x' * (10*1024*1024+1), 413),
    ('script.svg', b'<svg/>', 400), ('bad.mp4', b'not video', 400),
], ids=['fake-image', 'empty', 'fake-pdf', 'oversize', 'svg', 'fake-video'])
def test_upload_rejects_invalid_content_and_cleans_files(client, filename, content, expected):
    from fastapi import HTTPException
    category = 'gallery' if filename.endswith('.mp4') else 'aadhaar'
    before = set(Path(FILES.name).rglob('*'))
    with pytest.raises(HTTPException) as error:
        asyncio.run(save_uploaded_file(UploadFile(filename=filename, file=BytesIO(content)), category))
    assert error.value.status_code == expected
    assert {p for p in Path(FILES.name).rglob('*') if p.is_file()} == {p for p in before if p.is_file()}


def test_valid_image_upload(client):
    stream = BytesIO()
    Image.new('RGB', (8, 8)).save(stream, format='PNG')
    result = asyncio.run(save_uploaded_file(UploadFile(filename='real.png', file=BytesIO(stream.getvalue())), 'aadhaar'))
    assert result.startswith('uploads/aadhaar/')
    assert (Path(FILES.name) / 'aadhaar' / result.split('/')[-1]).is_file()


@pytest.mark.parametrize('data', [{'password': 'forbidden'}, {'panditStep': True}, {'panditStep': 4},
    {'panditFirstName': 'x'*301}, {'panditLanguages': ['x']*31}, {'panditPhone': {'nested': 'value'}}])
def test_draft_field_validation(client, data):
    assert client[0].post('/pandit/draft', json={'data': data}).status_code == 422


def test_draft_capability_tampering_expiry_and_update(client):
    http, db = client
    assert http.post('/pandit/draft', json={'draft_id': 'attacker-chosen', 'data': {}}).status_code == 404
    response = http.post('/pandit/draft', json={'data': {'panditFirstName': 'Fixture', 'panditStep': 1}})
    assert response.status_code == 200
    token = response.json()['draft_id']
    # A draft capability must never authenticate an account or booking request.
    assert http.get('/puja/history', headers={'Authorization': 'Bearer ' + token}).status_code == 401
    claims = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert claims['purpose'] == 'pandit_draft'
    assert http.get('/pandit/draft/' + token).json()['data']['panditFirstName'] == 'Fixture'
    assert http.post('/pandit/draft', json={'draft_id': token, 'data': {'panditFirstName': 'Updated'}}).status_code == 200
    assert http.get('/pandit/draft/' + token).json()['data'] == {'panditFirstName': 'Updated'}
    assert http.get('/pandit/draft/' + token + 'tampered').status_code == 404
    for values in ({**claims, 'purpose': 'other'}, {**claims, 'exp': 1}):
        bad = jwt.encode(values, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        assert http.get('/pandit/draft/' + bad).status_code == 404
    db.pandit_drafts.update_one({'draft_id': claims['sub']}, {'$set': {'expires_at': datetime.now(timezone.utc)-timedelta(days=1)}})
    assert http.get('/pandit/draft/' + token).status_code == 404
    assert http.post('/pandit/draft', json={'draft_id': token, 'data': {}}).status_code == 404


@pytest.mark.parametrize('changes', [{'date': 'invalid'}, {'date': '2000-01-01'}, {'time': '25:80'},
    {'city': ''}, {'devotee_name': ''}, {'phone': 'letters'}, {'phone': '123'}])
def test_booking_invalid_fields_rejected(client, changes):
    payload = dict(puja_id='fixture-puja', city='Delhi', date='2099-01-01', time='10:30 AM', devotee_name='Fixture', phone='9876543210')
    assert client[0].post('/puja/book', headers=auth(), json={**payload, **changes}).status_code == 422


def test_booking_is_request_and_history_is_owned(client):
    http, db = client
    db.pujas.insert_one({'id': 'fixture-puja', 'title': 'Fixture Puja'})
    owner = ObjectId()
    payload = dict(puja_id='fixture-puja', city='Delhi', date='2099-01-01', time='14:30', devotee_name='Fixture', phone='+91 9876543210')
    assert http.post('/puja/book', json=payload).status_code in (401, 403)
    response = http.post('/puja/book', headers=auth(owner), json=payload)
    assert response.status_code == 200 and response.json()['booking_status'] == 'requested'
    stored = db.puja_bookings.find_one({'user_id': str(owner)})
    assert stored['status'] == 'requested' and stored['time'] == '02:30 PM'
    history = http.get('/puja/history', headers=auth(owner))
    assert history.status_code == 200 and len(history.json()) == 1
    assert http.get('/puja/history', headers=auth()).json() == []


def test_missing_email_configuration_is_not_delivery(client, monkeypatch, caplog):
    for key in ('RESEND_API_KEY', 'SMTP_USERNAME', 'SMTP_PASSWORD'):
        monkeypatch.setattr(settings, key, '')
    assert asyncio.run(email_service.send_verification_email('fixture@example.invalid', 'https://example.invalid/private-token')) is False
    assert 'private-token' not in caplog.text


@pytest.mark.parametrize('status,expected', [(200, True), (403, False), (429, False), (500, False)])
def test_https_email_delivery_result(client, monkeypatch, status, expected):
    import httpx
    monkeypatch.setattr(settings, 'RESEND_API_KEY', 'test-only')
    monkeypatch.setattr(settings, 'EMAIL_FROM', 'fixture@example.invalid')
    session = AsyncMock()
    session.__aenter__.return_value = session
    session.post.return_value = httpx.Response(status, json={'id': 'fixture'})
    with patch.object(email_service.httpx, 'AsyncClient', return_value=session):
        assert asyncio.run(email_service.send_draft_resume_email('fixture@example.invalid', 'https://example.invalid/resume')) is expected
    assert session.post.call_args.args[0] == 'https://api.resend.com/emails'


def test_email_timeout_returns_failure(client, monkeypatch):
    import httpx
    monkeypatch.setattr(settings, 'RESEND_API_KEY', 'test-only')
    monkeypatch.setattr(settings, 'EMAIL_FROM', 'fixture@example.invalid')
    session = AsyncMock()
    session.__aenter__.return_value = session
    session.post.side_effect = httpx.ReadTimeout('test')
    with patch.object(email_service.httpx, 'AsyncClient', return_value=session):
        assert asyncio.run(email_service.send_verification_email('fixture@example.invalid', 'https://example.invalid')) is False


def test_signup_login_and_verification_lifecycle(client):
    http, db = client
    body = dict(name='Contract User', email='contract-user@example.com', password='Test-only-password-123', confirm_password='Test-only-password-123')
    with patch.object(email_service, 'send_verification_email', new_callable=AsyncMock, return_value=False) as mail:
        created = http.post('/auth/signup', json=body)
    assert created.status_code == 200 and created.json()['email_sent'] is False
    assert 'could not be delivered' in created.json()['message']
    stored = db.users.find_one({'email': body['email']})
    assert stored['hashed_password'] != body['password']
    assert http.post('/auth/signup', json=body).status_code == 409
    assert http.post('/auth/login', json={'email': body['email'], 'password': 'wrong'}).status_code == 401
    assert http.post('/auth/login', json={'email': body['email'], 'password': 'x'*100}).status_code == 401
    logged = http.post('/auth/login', json={'email': body['email'], 'password': body['password']})
    assert logged.status_code == 200
    me = http.get('/auth/me', headers={'Authorization': 'Bearer '+logged.json()['access_token']})
    assert me.status_code == 200 and me.json()['name'] == body['name']
    verification = db.email_verification_tokens.find_one({'email': body['email']})
    assert http.get('/auth/verify-email', params={'token': verification['token']}).status_code == 200
    assert http.get('/auth/verify-email', params={'token': verification['token']}).status_code == 400
    assert http.get('/auth/verify-email', params={'token': 'invalid'}).status_code == 400


@pytest.mark.parametrize('changes', [{'email': 'invalid'}, {'phone': 'letters'}, {'password': 'x', 'confirm_password': 'x'}, {'city': ' '}, {'experience': '100'}])
def test_pandit_multipart_validation(client, changes):
    fields = dict(name='Contract Pandit', email='contract-pandit@example.com', phone='9876543210', password='Test-only-password-123',
        confirm_password='Test-only-password-123', city='Delhi', state='Delhi', languages='Hindi', experience='5', specialization='Ganesh Puja')
    assert client[0].post('/pandit/apply', data={**fields, **changes}).status_code == 422


def test_pandit_application_review_and_directory(client):
    http, db = client
    fields = dict(name='Contract Pandit', email='contract-pandit@example.com', phone='9876543210', password='Test-only-password-123',
        confirm_password='Test-only-password-123', city='Delhi', state='Delhi', languages='Hindi', experience='5', specialization='Ganesh Puja')
    created = http.post('/pandit/apply', data=fields)
    assert created.status_code == 200 and created.json()['application_status'] == 'pending'
    identifier = created.json()['application_id']
    assert http.post('/pandit/apply', data=fields).status_code == 409
    path = '/admin/pandit/' + identifier + '/status'
    assert http.patch(path, json={'status': 'approved'}).status_code == 403
    with patch.object(email_service, 'send_status_update_email', new_callable=AsyncMock, return_value=False):
        assert http.patch(path, headers={'x-admin-key': settings.ADMIN_SECRET_KEY}, json={'status': 'approved'}).status_code == 200
    directory = http.get('/pandit/list').json()
    assert any(item['id'] == identifier for item in directory)
    assert not any('hashed_password' in item or 'email' in item for item in directory)
