from fastapi import FastAPI, HTTPException, Query
from contextlib import asynccontextmanager
from app.cache import SkipRange
import app.cache as db_utils
from app.cache import Comment
from app.filters.detector import analyze_subtitles, SubtitleBlock
from app.filters.srt_parser import parse_srt
from app.filters.categories import FilterCategory
from typing import List, Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

class AnalyzeSubtitlesRequest(BaseModel):
    subtitle_content: str
    show_id: str
    enabled_filters: List[str]
    save_cache: bool = True

class SkipRangeResponse(BaseModel):
    start_ms: int
    end_ms: int
    category: str

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

app = FastAPI(lifespan=lifespan)

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

@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/post_comment")
async def post_comment(comment: Comment):
    print(f"Received comment:\n {comment.user}\n {comment.comment}\n {comment.showId}\n {comment.startTime}\n {comment.endTime}\n")
    try:
        result = await db_utils.db["comments"].insert_one(comment.dict())
        return {"id": str(result.inserted_id), "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/get_comments")
async def get_comments(show_id: Optional[str] = None):
    try:
        collection = db_utils.db["comments"]
        query = {} if show_id is None else {"showId": int(show_id)}
        comments = await collection.find(query).to_list(length=100)
        
        # Convert ObjectId to string for JSON serialization
        for comment in comments:
            comment["_id"] = str(comment["_id"])

        print(f"Comments: {comments}")
        
        return {"comments": comments, "count": len(comments)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/post_timestamps")
async def post_timestamps(skip_ranges: List[SkipRange], filters: List[str], show_id: str):
    try:
        await db_utils.save_timestamps(show_id=show_id, filters=filters, skip_ranges=skip_ranges)
        return {"status": "success", "show_id": show_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_timestamps")
async def get_timestamps(show_id: str, filters: List[str] = Query(...)):
    try:
        timestamps = await db_utils.get_cached_timestamps(show_id=show_id, filters=filters)
        if timestamps is None:
            raise HTTPException(status_code=404, detail="No cached timestamps found")
        return timestamps
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze_subtitles")
async def analyze_subtitles_endpoint(request: AnalyzeSubtitlesRequest):
    try:
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
        
        # Analyze subtitles
        skip_ranges = analyze_subtitles(
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