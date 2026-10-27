from typing import Any
from datetime import datetime, timezone
from app.database.mongodb import database


pandit_collection = database["pandit_applications"]
drafts_collection = database["pandit_drafts"]


async def save_pandit_draft(draft_id: str, data: dict, expires_at: datetime, *, create: bool):
    if create:
        await drafts_collection.insert_one({'draft_id': draft_id, 'data': data, 'expires_at': expires_at})
        return True
    result = await drafts_collection.update_one(
        {'draft_id': draft_id, 'expires_at': {'$gt': datetime.now(timezone.utc)}},
        {'$set': {'data': data}})
    return result.matched_count == 1

async def get_pandit_draft(draft_id: str):
    return await drafts_collection.find_one({'draft_id': draft_id, 'expires_at': {'$gt': datetime.now(timezone.utc)}})


async def find_pandit_by_email(email: str):
    return await pandit_collection.find_one({"email": email})


async def get_all_pandits():
    public_fields = {field: 1 for field in (
        'name', 'city', 'state', 'languages', 'experience', 'specialization',
        'gender', 'availability', 'service_areas', 'education', 'gurukul',
        'achievements', 'bio', 'gallery_files',
    )}
    cursor = pandit_collection.find({'status': 'approved'}, public_fields)
    pandits = await cursor.to_list(length=100)
    for p in pandits:
        p["id"] = str(p["_id"])
        del p["_id"]
    return pandits


async def create_pandit_application(
    name: str,
    email: str,
    phone: str,
    hashed_password: str,
    city: str,
    state: str,
    languages: list,
    experience: str,
    specialization: Any,
    gender: str | None = None,
    availability: str | None = None,
    service_areas: list | None = None,
    education: str | None = None,
    gurukul: str | None = None,
    achievements: list | None = None,
    bio: str | None = None,
    aadhaar_file: str | None = None,
    certificate_file: str | None = None,
    gallery_files: list | None = None,
    gallery_files_meta: str | None = None,
) -> str:
    document = {
        "name": name,
        "email": email,
        "phone": phone,
        "hashed_password": hashed_password,
        "city": city,
        "state": state,
        "languages": languages,
        "experience": experience,
        "specialization": specialization,
        "gender": gender,
        "availability": availability,
        "service_areas": service_areas or [],
        "education": education,
        "gurukul": gurukul,
        "achievements": achievements or [],
        "bio": bio,
        "aadhaar_file": aadhaar_file,
        "certificate_file": certificate_file,
        "gallery_files": gallery_files or [],
        "gallery_files_meta": gallery_files_meta,
        "status": "pending",
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_reason": None,
    }
    result = await pandit_collection.insert_one(document)
    return str(result.inserted_id)
