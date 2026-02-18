from fastapi import FastAPI
from contextlib import asynccontextmanager
from database.database import client, database, Comment
from .app.cache import SkipRange
import app.cache as db_utils
from typing import List

@asynccontextmanager
async def lifespan(app: FastAPI):
    # connect to DB
    print("Connecting to MongoDB...")
    try:
        await client.admin.command('ping')
        print("Connected")
    except Exception as e:
        print(f"Connection failed: {e}")

    yield

    # close DB connection
    print("Closing MongoDB connection...")
    client.close()
    print("Connection closed.")

app = FastAPI(lifespan=lifespan)

@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/post_comment")
async def post_comment(comment: Comment):
    result = await database["comments"].insert_one(comment.dict())
    # TO BE IMPLEMENTED


@app.get("/get_comments")
async def get_comments():
    collection = database["comments"]
    # TO BE IMPLEMENTED

@app.get("/post_timestamps")
async def post_timestamp(skip_ranges: List[SkipRange], filters: List[str], show_id: str):
    db_utils.save_timestamps(show_id=show_id, filters=filters, skip_ranges=skip_ranges)

@app.get("/get_timestamps")
async def get_timestamps(show_id: str, filters=List[str]):
    timestamps = db_utils.get_cached_timestamps(show_id=show_id, filters=filters)