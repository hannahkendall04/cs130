import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from app.cache import SkipRange
import app.cache as db_utils
from app.cache import Comment
from app.filters.detector import analyze_subtitles, analyze_subtitles_stream, SubtitleBlock
from app.filters.srt_parser import parse_srt
from app.filters.categories import FilterCategory
from typing import List, Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

class AnalyzeSubtitlesRequest(BaseModel):
    subtitle_content: str
    show_id: str
    enabled_filters: List[str]
    save_cache: bool = True

class SkipRangeResponse(BaseModel):
    start_ms: int
    end_ms: int
    category: str

class GetCommentsShowId(BaseModel):
    show_id: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    # connect to DB
    print("Connecting to MongoDB...")
    try:
        await db_utils.client.admin.command('ping')
        print("Connected")
    except Exception as e:
        print(f"Connection failed: {e}")

    yield

    # close DB connection
    print("Closing MongoDB connection...")
    db_utils.client.close()
    print("Connection closed.")

api_description = """

### Capabilities 
* **Post comments**: post comments to the MongoDB database
* **Read comments**: retrieve comments from the MongoDB database given a Netflix showId
* **Post timestamps**: post skip range timestamps to the MongoDB database
* **Get timestamps**: retrieve skip range timestamps from the MongoDB database given a Netflix showId and selected filter categories
* **Analyze subtitles**: analyze subtitles for a given Netflix show and extract skip range timestamps for selected filter categories
* **Analyze subtitles stream**: analyze subtitles for a give Netflix show and extract skip range timestamps for selected filter categories (stream)
"""

tags_metadata = [
    {
        "name": "post_comment",
        "description": "post comments to the MongoDB database"
    },
    {
        "name": "get_comments",
        "description": "retrieve comments from the MongoDB database given a Netflix showId"
    },
    {
        "name": "stamps",
        "description": "post skip range timestamps to the MongoDB database"
    },
    {
        "name": "get_timestamps",
        "description": "retrieve skip range timestamps from the MongoDB database given a Netflix showId and selected filter categories"
    },
    {
        "name": "analyze_subtitles",
        "description": "analyze subtitles for a given Netflix show and extract skip range timestamps for selected filter categories"
    },
    {
        "name": "analyze_subtitles_stream",
        "description": "analyze subtitles for a given Netflix show and extract skip range timestamps for selected filter categories (stream)"
    }
]

app = FastAPI(
        title="Flixtra",
        description=api_description,
        summary="API documentation and endpoint descriptions for the Flixtra Chrome extension",
        lifespan=lifespan,
        openapi_tags=tags_metadata
    )

origins = [
    "https://www.netflix.com",
    "chrome-extension://lmbjepbjkhefnjijkgdjdhgdlaecnefp"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/post_comment", tags=["post_comment"])
async def post_comment(comment: Comment):
    print(f"Received comment:\n {comment.user}\n {comment.comment}\n {comment.showId}\n {comment.startTime}\n {comment.endTime}\n")
    try:
        result = await db_utils.db["comments"].insert_one(comment.dict())
        return {"id": str(result.inserted_id), "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_comments", tags=["get_comments"])
async def get_comments(getComments: GetCommentsShowId):
    show_id = getComments.show_id
    print("getting comments...")
    print(f"show id: {show_id}")
    try:
        collection = db_utils.db["comments"]
        query = {} if show_id is None else {"showId": show_id}
        comments = await collection.find(query).to_list(length=100)
        
        # Convert ObjectId to string for JSON serialization
        for comment in comments:
            comment["_id"] = str(comment["_id"])

        print(f"Comments: {comments}")
        
        return {"comments": comments, "count": len(comments)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


    

@app.get("/get_timestamps", tags=["get_timestamps"])
async def get_timestamps(show_id: str, filters: List[str] = Query(...)):
    print("=== get_timestamps called ===", show_id, filters)

    try:
        timestamps = await db_utils.get_cached_timestamps(show_id=show_id, filters=filters)
        if timestamps is None:
            raise HTTPException(status_code=404, detail="No cached timestamps found")
        
        # Convert ObjectId fields to strings
        def convert_objectid(obj):
            if isinstance(obj, ObjectId):
                return str(obj)
            if isinstance(obj, dict):
                return {key: convert_objectid(value) for key, value in obj.items()}
            if isinstance(obj, list):
                return [convert_objectid(item) for item in obj]
            return obj

        timestamps = convert_objectid(timestamps)
        return timestamps
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze_subtitles", tags=["analyze_subtitles"])
async def analyze_subtitles_endpoint(request: AnalyzeSubtitlesRequest):
    try:
        print("=== analyze_subtitles called ===")
        print("show_id:", request.show_id)
        print("enabled_filters:", request.enabled_filters)
        print("subtitle chars:", len(request.subtitle_content))
        # Parse SRT content
        parsed = parse_srt(request.subtitle_content)
        
        # Convert to SubtitleBlock objects
        subtitle_blocks = [
            SubtitleBlock(start_ms=start, end_ms=end, text=text)
            for start, end, text in parsed
        ]
        
        # Convert enabled filter names to FilterCategory set
        enabled_categories = set()
        for filter_name in request.enabled_filters:
            try:
                enabled_categories.add(FilterCategory[filter_name.upper()])
            except KeyError:
                raise HTTPException(status_code=400, detail=f"Invalid filter category: {filter_name}")
        
        # Analyze subtitles (async — runs Gemini chunks in parallel)
        skip_ranges = await analyze_subtitles(
            subtitle_blocks,
            enabled_categories=enabled_categories if enabled_categories else None
        )
        
        # Optionally save to cache
        if request.save_cache and skip_ranges:
            await db_utils.save_timestamps(
                show_id=request.show_id,
                filters=sorted(request.enabled_filters),
                skip_ranges=skip_ranges
            )
        
        # Convert SkipRange objects to JSON-serializable format
        response_ranges = [
            SkipRangeResponse(
                start_ms=sr.time_range.start.ms,
                end_ms=sr.time_range.end.ms,
                category=sr.category
            )
            for sr in skip_ranges
        ]
        
        return {
            "status": "success",
            "skip_ranges": response_ranges,
            "count": len(skip_ranges),
            "cached": request.save_cache
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/analyze_subtitles_stream", tags=["analyze_subtitles_stream"])
async def analyze_subtitles_stream_endpoint(request: AnalyzeSubtitlesRequest):
    print("=== analyze_subtitles_stream called ===")
    print("show_id:", request.show_id)
    print("enabled_filters:", request.enabled_filters)
    print("subtitle chars:", len(request.subtitle_content))

    parsed = parse_srt(request.subtitle_content)
    subtitle_blocks = [
        SubtitleBlock(start_ms=start, end_ms=end, text=text)
        for start, end, text in parsed
    ]

    enabled_categories = set()
    for filter_name in request.enabled_filters:
        try:
            enabled_categories.add(FilterCategory[filter_name.upper()])
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid filter category: {filter_name}")

    async def event_generator():
        all_ranges = []
        async for chunk_hits, chunk_num, total_chunks, is_final in analyze_subtitles_stream(
            subtitle_blocks,
            enabled_categories=enabled_categories if enabled_categories else None,
        ):
            ranges = [
                {"start_ms": sr.time_range.start.ms, "end_ms": sr.time_range.end.ms, "category": sr.category}
                for sr in chunk_hits
            ]

            if is_final:
                all_ranges = ranges  # final yield is the merged result
            else:
                all_ranges.extend(ranges)

            event = json.dumps({
                "skip_ranges": ranges,
                "chunk": chunk_num,
                "total_chunks": total_chunks,
                "done": is_final,
            })
            yield f"data: {event}\n\n"

        # Cache the final merged result
        if request.save_cache and all_ranges:
            from app.filters.skip_range import SkipRange as FilterSkipRange
            cache_ranges = [
                FilterSkipRange.from_ms(r["start_ms"], r["end_ms"], r["category"])
                for r in all_ranges
            ]
            await db_utils.save_timestamps(
                show_id=request.show_id,
                filters=sorted(request.enabled_filters),
                skip_ranges=cache_ranges,
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )