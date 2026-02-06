import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DB_NAME = os.getenv("DB_NAME")

client = AsyncIOMotorClient(MONGODB_URL)
database = client[DB_NAME]


class Comment(BaseModel):
    text: str
    showId: int # subject to change - identifier for show
    startTime: str # subject to change - start time identifier