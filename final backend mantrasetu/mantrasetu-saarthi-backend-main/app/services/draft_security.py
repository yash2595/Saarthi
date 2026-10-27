"""Expiring resume capabilities for pre-account onboarding drafts."""
from datetime import datetime, timedelta, timezone
import re
import secrets
from jose import jwt, JWTError
from fastapi import HTTPException
from app.core.config import settings

DRAFT_FIELDS = frozenset({
    'panditStep', 'panditFirstName', 'panditLastName', 'panditName', 'panditGender',
    'panditPhone', 'panditEmail', 'panditCity', 'panditState', 'panditAvailabilityMode',
    'selectedServiceAreas', 'panditExp', 'panditEducation', 'panditGurukul',
    'panditSpec', 'selectedSpecs', 'panditLanguages', 'panditAchievements', 'panditBio',
})


def validate_draft_data(data: dict) -> dict:
    if set(data) - DRAFT_FIELDS:
        raise ValueError('Only supported, non-sensitive onboarding fields may be saved')
    for key, value in data.items():
        if key == 'panditStep':
            if type(value) is not int or value not in (1, 2, 3):
                raise ValueError('Invalid draft step')
        elif isinstance(value, list):
            if len(value) > 30 or any(not isinstance(item, str) or len(item) > 300 for item in value):
                raise ValueError('Invalid draft list')
        elif not isinstance(value, str) or len(value) > (2000 if key == 'panditBio' else 300):
            raise ValueError('Invalid draft field')
    return data


def create_draft_capability() -> tuple[str, str, datetime]:
    identifier = secrets.token_hex(24)
    expiry = datetime.now(timezone.utc) + timedelta(days=7)
    token = jwt.encode({'sub': identifier, 'purpose': 'pandit_draft', 'exp': expiry},
                       settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return identifier, token, expiry


def decode_draft_capability(token: str) -> tuple[str, datetime]:
    try:
        claims = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if claims.get('purpose') != 'pandit_draft' or not re.fullmatch(r'[0-9a-f]{48}', claims.get('sub', '')):
            raise ValueError('Invalid draft capability')
        return claims['sub'], datetime.fromtimestamp(claims['exp'], timezone.utc)
    except (JWTError, ValueError, TypeError, KeyError):
        raise HTTPException(status_code=404, detail='Draft link is invalid or expired')
