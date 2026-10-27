import logging
import re
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

def extract_dob(msg: str) -> Optional[str]:
    """Extract date of birth from user message."""
    if not msg:
        return None
    # 1. Standard numeric formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    date_patterns = [
        r'\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b',
        r'\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b',
    ]
    for pattern in date_patterns:
        match = re.search(pattern, msg)
        if match:
            return match.group(0)

    # 2. Textual month formats: 15 August 1995, 15th Aug 1995, August 15 1995
    months = r'(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
    text_patterns = [
        rf'\b\d{{1,2}}(?:st|nd|rd|th)?\s+{months}(?:\s+\d{{2,4}})?\b',
        rf'\b{months}\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s+\d{{2,4}})?\b',
    ]
    for pattern in text_patterns:
        match = re.search(pattern, msg, re.IGNORECASE)
        if match:
            return match.group(0)

    return None

_MUHURAT_EVENTS = [
    ("griha pravesh", "Griha Pravesh"),
    ("grihapravesh", "Griha Pravesh"),
    ("ghar pravesh", "Griha Pravesh"),
    ("housewarming", "Griha Pravesh"),
    ("makaan", "Griha Pravesh"),
    ("nayi dukan", "Business Opening"),
    ("shaadi", "Vivah"),
    ("shadi", "Vivah"),
    ("vivah", "Vivah"),
    ("wedding", "Vivah"),
    ("marriage", "Vivah"),
    ("naamkaran", "Naamkaran"),
    ("namkaran", "Naamkaran"),
    ("naming", "Naamkaran"),
    ("naam karan", "Naamkaran"),
    ("mundan", "Mundan"),
    ("business", "Business Opening"),
    ("vyapar", "Business Opening"),
    ("shop", "Business Opening"),
    ("office", "Business Opening"),
    ("vehicle", "Vehicle Purchase"),
    ("gadi", "Vehicle Purchase"),
    ("car", "Vehicle Purchase"),
    ("property", "Property Purchase"),
    ("zameen", "Property Purchase"),
    ("sagai", "Engagement"),
    ("engagement", "Engagement"),
    ("janeu", "Janeu Sanskar"),
    ("upanayana", "Janeu Sanskar"),
]

def extract_muhurat_event(msg: str) -> Optional[str]:
    """Extract Muhurat event type from user message."""
    if not msg:
        return None
    msg_lower = msg.lower()
    for kw, val in _MUHURAT_EVENTS:
        if kw in msg_lower:
            return val
    return None

# Page commands are shared by the actual voice orchestrator and contract tests.
from app.orchestrator.navigation_commands import is_navigation_command, resolve_navigation_target
