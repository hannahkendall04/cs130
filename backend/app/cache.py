from datetime import datetime
from typing import List
from motor.motor_asyncio import AsyncIOMotorCollection

from app.filters.skip_range import SkipRange
from database import database

timestamp_collection: AsyncIOMotorCollection = database["timestamp_cache"]


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
        "created_at": datetime.utcnow(),
    }

    # Upsert prevents duplicate entries
    await timestamp_collection.update_one(
        {"showId": show_id, "filters": filters},
        {"$set": document},
        upsert=True
    )
