"""Pydantic schemas for the Puja module."""

from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime
from zoneinfo import ZoneInfo
import re


class PujaResponse(BaseModel):
    """A single puja, as returned to the frontend."""

    id: str
    title: str
    category: str
    duration: str
    price: int
    rating: float
    reviewsCount: int
    description: str
    image: str
    popular: bool = False


class BookPujaRequest(BaseModel):
    """What the frontend sends when confirming a booking."""

    model_config = ConfigDict(str_strip_whitespace=True)
    puja_id: str = Field(min_length=1, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    date: str
    time: str
    devotee_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=24)

    @field_validator('date')
    @classmethod
    def valid_date(cls, value: str) -> str:
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            raise ValueError('Use a valid YYYY-MM-DD ceremony date')
        if parsed < datetime.now(ZoneInfo('Asia/Kolkata')).date():
            raise ValueError('Ceremony date cannot be in the past')
        return parsed.isoformat()

    @field_validator('time')
    @classmethod
    def valid_time(cls, value: str) -> str:
        for pattern in ('%I:%M %p', '%H:%M'):
            try:
                return datetime.strptime(value.upper(), pattern).strftime('%I:%M %p')
            except ValueError:
                continue
        raise ValueError('Use a valid ceremony time')

    @field_validator('phone')
    @classmethod
    def valid_phone(cls, value: str) -> str:
        if not re.fullmatch(r'\+?[0-9 ()-]+', value):
            raise ValueError('Use a valid phone number')
        digits = re.sub(r'\D', '', value)
        if not 10 <= len(digits) <= 15:
            raise ValueError('Phone number must contain 10 to 15 digits')
        return ('+' if value.startswith('+') else '') + digits


class BookPujaResponse(BaseModel):
    """What we send back after a successful booking."""

    status: str
    booking_id: str
    booking_status: str = 'requested'
    message: str = 'Booking request saved; awaiting confirmation.'
    
class BookingHistoryItem(BaseModel):
    """A single past booking, as returned to the frontend."""

    booking_id: str
    puja_id: str
    city: str
    date: str
    time: str
    devotee_name: str
    phone: str
    status: str
