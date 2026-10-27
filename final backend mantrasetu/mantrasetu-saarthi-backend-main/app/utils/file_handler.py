import os
import uuid
import aiofiles
from pathlib import Path
import warnings
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException, UploadFile

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf", ".webp", ".mp4", ".webm", ".mov", ".avi", ".mkv"}
DOCUMENT_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.pdf', '.webp'}
Image.MAX_IMAGE_PIXELS = 20_000_000


def validate_content(path: Path, ext: str) -> None:
    with path.open('rb') as stream:
        header = stream.read(32)
        if ext == '.pdf':
            stream.seek(max(0, path.stat().st_size - 1024))
            valid = header.startswith(b'%PDF-') and b'%%EOF' in stream.read()
        elif ext in {'.png', '.jpg', '.jpeg', '.webp'}:
            formats = {'.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG', '.webp': 'WEBP'}
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('error', Image.DecompressionBombWarning)
                    with Image.open(path) as image:
                        valid = image.format == formats[ext]
                        image.verify()
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                valid = False
        elif ext in {'.mp4', '.mov'}:
            valid = header[4:8] == b'ftyp'
        elif ext in {'.webm', '.mkv'}:
            valid = header.startswith(b'\x1aE\xdf\xa3')
        else:
            valid = header.startswith(b'RIFF') and header[8:12] == b'AVI '
    if not valid:
        raise HTTPException(status_code=400, detail='File content does not match its declared type')

async def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing")
    ext = os.path.splitext(file.filename)[1].lower()

    if subfolder not in {'aadhaar', 'certificates', 'gallery'}:
        raise HTTPException(status_code=400, detail='Invalid upload category')
    allowed = ALLOWED_EXTENSIONS if subfolder == 'gallery' else DOCUMENT_EXTENSIONS
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}"
        )

    folder = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(folder, filename)

    size = 0
    limit = (25 if subfolder == 'gallery' else 10) * 1024 * 1024
    try:
        async with aiofiles.open(filepath, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f'File exceeds the {limit // 1024 // 1024} MB limit')
                await buffer.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail='Empty files are not allowed')
        validate_content(Path(filepath), ext)
    except Exception:
        Path(filepath).unlink(missing_ok=True)
        raise

    return f"uploads/{subfolder}/{filename}"
