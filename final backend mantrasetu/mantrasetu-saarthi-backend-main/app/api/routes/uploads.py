"""Private verification documents; only approved gallery assets are public."""
import hmac
from pathlib import Path
import re

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.config import settings
from app.database.pandit_db import pandit_collection
from app.services.security import decode_access_token
from app.utils.file_handler import UPLOAD_DIR

router = APIRouter(tags=['Documents'])
optional_bearer = HTTPBearer(auto_error=False)


@router.get('/uploads/{category}/{filename}')
async def download_upload(
    category: str,
    filename: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    x_admin_key: str | None = Header(None),
):
    fields = {'aadhaar': 'aadhaar_file', 'certificates': 'certificate_file', 'gallery': 'gallery_files'}
    if category not in fields or not re.fullmatch(r'[0-9a-f]{32}\.(?:png|jpe?g|pdf|webp|mp4|webm|mov|avi|mkv)', filename):
        raise HTTPException(status_code=404, detail='Document not found')
    reference = f'uploads/{category}/{filename}'
    public = category == 'gallery' and await pandit_collection.find_one(
        {'status': 'approved', 'gallery_files': reference}, {'_id': 1})
    admin = bool(x_admin_key and hmac.compare_digest(x_admin_key, settings.ADMIN_SECRET_KEY))
    if not public and not admin:
        if not credentials:
            raise HTTPException(status_code=401, detail='Sign in to access this document')
        try:
            payload = decode_access_token(credentials.credentials)
            owner_id = ObjectId(payload.get('sub', ''))
        except (JWTError, InvalidId, ValueError, TypeError):
            raise HTTPException(status_code=401, detail='Invalid or expired token')
        owner = await pandit_collection.find_one(
            {'_id': owner_id, fields[category]: reference}, {'_id': 1})
        if not owner:
            raise HTTPException(status_code=404, detail='Document not found')
    root = Path(UPLOAD_DIR).resolve()
    path = (root / category / filename).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(status_code=404, detail='Document not found')
    return FileResponse(path, filename=filename if category != 'gallery' else None,
                        headers={'Cache-Control': 'public, max-age=300' if public else 'private, no-store',
                                 'X-Content-Type-Options': 'nosniff'})
