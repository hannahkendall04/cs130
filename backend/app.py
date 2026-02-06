from fastapi import FastAPI
from contextlib import asynccontextmanager
from database.database import client, database, Comment

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
    result = await database["COLLECTION_NAME"].insert_one(comment.dict())
    # TO BE IMPLEMENTED


@app.get("/get_comments")
async def get_comments():
    collection = database["COLLECTION_NAME"]
    # TO BE IMPLEMENTED
