# used for database tools for comment storage and timestamp caching
import os
from datetime import datetime
from typing import List
from motor.motor_asyncio import AsyncIOMotorCollection
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from app.filters.skip_range import SkipRange


load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DB_NAME = os.getenv("DB_NAME")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]
timestamp_collection = db["timestamp_cache"]


class Comment(BaseModel):
    comment: str
    showId: str # subject to change - identifier for show
    startTime: str # subject to change - start time identifier
    endTime: str # subject to change - end time identifier
    user: str # subject to change - posting user

class TimestampCache(BaseModel):
    showID: str
    filters: list[str]
    timestamps: list[dict]
    created_at: str

timestamp_collection: AsyncIOMotorCollection = db["timestamp_cache"]


def serialize_skip_ranges(ranges: List[SkipRange]) -> List[dict]:
    """
    Convert SkipRange objects to Mongo-safe dicts.
    """
    return [
        {
            "start_ms": r.time_range.start.ms,
            "end_ms": r.time_range.end.ms,
            "category": r.category,
        }
        for r in ranges
    ]


async def get_cached_timestamps(show_id: str, filters: list[str]):
    filters = sorted(filters)

    return await timestamp_collection.find_one({
        "showId": show_id,
        "filters": filters
    })


async def save_timestamps(
    show_id: str,
    filters: list[str],
    skip_ranges: List[SkipRange]
):
    filters = sorted(filters)

    document = {
        "showId": show_id,
        "filters": filters,
        "skip_ranges": serialize_skip_ranges(skip_ranges),
        "created_at": datetime.now(datetime.timezone.utc),
    }

    # Upsert prevents duplicate entries
    await timestamp_collection.update_one(
        {"showId": show_id, "filters": filters},
        {"$set": document},
        upsert=True
    )
