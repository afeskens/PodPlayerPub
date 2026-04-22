from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import httpx
import feedparser
import asyncio
import re
from email.utils import parsedate_to_datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Podcast Player API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ----- Models -----
class Podcast(BaseModel):
    collectionId: int
    collectionName: str
    artistName: Optional[str] = ""
    artworkUrl600: Optional[str] = ""
    artworkUrl100: Optional[str] = ""
    feedUrl: Optional[str] = ""
    primaryGenreName: Optional[str] = ""
    trackCount: Optional[int] = 0


class Episode(BaseModel):
    id: str
    title: str
    description: str = ""
    audioUrl: str = ""
    pubDate: str = ""
    duration: str = ""
    image: str = ""


class PodcastFeed(BaseModel):
    title: str
    author: str = ""
    description: str = ""
    image: str = ""
    episodes: List[Episode] = []


# ----- Routes -----
@api_router.get("/")
async def root():
    return {"message": "Podcast Player API", "status": "ok"}


@api_router.get("/search")
async def search_podcasts(term: str = Query(..., min_length=1), limit: int = 25):
    """Search podcasts using iTunes Search API."""
    url = "https://itunes.apple.com/search"
    params = {"term": term, "media": "podcast", "limit": limit}
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            cleaned = []
            for r in results:
                cleaned.append({
                    "collectionId": r.get("collectionId"),
                    "collectionName": r.get("collectionName", ""),
                    "artistName": r.get("artistName", ""),
                    "artworkUrl600": r.get("artworkUrl600", r.get("artworkUrl100", "")),
                    "artworkUrl100": r.get("artworkUrl100", ""),
                    "feedUrl": r.get("feedUrl", ""),
                    "primaryGenreName": r.get("primaryGenreName", ""),
                    "trackCount": r.get("trackCount", 0),
                })
            return {"count": len(cleaned), "results": cleaned}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"iTunes search failed: {str(e)}")


@api_router.get("/top")
async def top_podcasts(genre: Optional[str] = None, limit: int = 20):
    """Fetch popular podcasts using iTunes search with 'popular' term or a genre keyword."""
    term = genre or "news"
    url = "https://itunes.apple.com/search"
    params = {"term": term, "media": "podcast", "limit": limit}
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            cleaned = [{
                "collectionId": r.get("collectionId"),
                "collectionName": r.get("collectionName", ""),
                "artistName": r.get("artistName", ""),
                "artworkUrl600": r.get("artworkUrl600", r.get("artworkUrl100", "")),
                "artworkUrl100": r.get("artworkUrl100", ""),
                "feedUrl": r.get("feedUrl", ""),
                "primaryGenreName": r.get("primaryGenreName", ""),
                "trackCount": r.get("trackCount", 0),
            } for r in results]
            return {"count": len(cleaned), "results": cleaned}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"iTunes top failed: {str(e)}")


def _strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def _parse_feed_sync(xml_bytes: bytes) -> dict:
    parsed = feedparser.parse(xml_bytes)
    feed = parsed.feed
    image_url = ""
    if hasattr(feed, "image") and feed.image:
        image_url = getattr(feed.image, "href", "") or feed.image.get("href", "") if isinstance(feed.image, dict) else getattr(feed.image, "href", "")
    if not image_url:
        itunes_image = feed.get("itunes_image") if isinstance(feed, dict) else None
        if itunes_image and isinstance(itunes_image, dict):
            image_url = itunes_image.get("href", "")

    episodes = []
    for i, entry in enumerate(parsed.entries):
        audio_url = ""
        duration = ""
        if hasattr(entry, "enclosures") and entry.enclosures:
            for enc in entry.enclosures:
                t = enc.get("type", "") if isinstance(enc, dict) else getattr(enc, "type", "")
                href = enc.get("href", "") if isinstance(enc, dict) else getattr(enc, "href", "")
                if t and "audio" in t.lower():
                    audio_url = href
                    break
            if not audio_url and parsed.entries[i].enclosures:
                first = parsed.entries[i].enclosures[0]
                audio_url = first.get("href", "") if isinstance(first, dict) else getattr(first, "href", "")
        duration = entry.get("itunes_duration", "") if hasattr(entry, "get") else ""
        pub = entry.get("published", "") if hasattr(entry, "get") else ""
        try:
            if pub:
                dt = parsedate_to_datetime(pub)
                pub = dt.isoformat()
        except Exception:
            pass
        ep_image = ""
        if hasattr(entry, "image") and entry.image:
            ep_image = getattr(entry.image, "href", "") if not isinstance(entry.image, dict) else entry.image.get("href", "")
        if not ep_image:
            it_img = entry.get("itunes_image") if hasattr(entry, "get") else None
            if it_img and isinstance(it_img, dict):
                ep_image = it_img.get("href", "")
        desc = entry.get("summary", "") or entry.get("description", "") if hasattr(entry, "get") else ""
        episodes.append({
            "id": entry.get("id", "") or entry.get("link", "") or f"{i}-{entry.get('title','')}",
            "title": entry.get("title", ""),
            "description": _strip_html(desc)[:1000],
            "audioUrl": audio_url,
            "pubDate": pub,
            "duration": str(duration),
            "image": ep_image or image_url,
        })

    return {
        "title": feed.get("title", "") if hasattr(feed, "get") else "",
        "author": feed.get("author", "") if hasattr(feed, "get") else "",
        "description": _strip_html(feed.get("summary", "") if hasattr(feed, "get") else "")[:2000],
        "image": image_url,
        "episodes": episodes,
    }


@api_router.get("/feed")
async def get_feed(url: str = Query(..., min_length=5), limit: int = 100):
    """Fetch + parse a podcast RSS feed and return episodes."""
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True,
                                      headers={"User-Agent": "Mozilla/5.0 PodcastPlayer"}) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            xml_bytes = resp.content
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Feed fetch failed: {str(e)}")

    result = await asyncio.to_thread(_parse_feed_sync, xml_bytes)
    result["episodes"] = result["episodes"][:limit]
    return result


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
