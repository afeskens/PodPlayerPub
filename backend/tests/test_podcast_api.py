"""Backend API tests for Podcast Player - iTunes search proxy + RSS feed parser."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pod-stream-2.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"


# --- /api/search (iTunes Search proxy) ---
class TestSearch:
    def test_search_radiolab(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"term": "radiolab", "limit": 10}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "results" in data
        assert isinstance(data["results"], list)
        assert data["count"] >= 1, f"Expected at least 1 result for radiolab, got {data['count']}"
        # Validate result shape
        first = data["results"][0]
        for key in ["collectionId", "collectionName", "artistName", "artworkUrl600",
                    "artworkUrl100", "feedUrl", "primaryGenreName", "trackCount"]:
            assert key in first, f"missing key {key} in result"
        assert isinstance(first["collectionId"], int)
        assert isinstance(first["collectionName"], str) and first["collectionName"]

    def test_search_empty_term_rejected(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"term": ""}, timeout=15)
        # min_length=1 => FastAPI returns 422
        assert r.status_code == 422

    def test_search_no_results_query(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"term": "zzzqqqxxx__unlikely_term__9182734", "limit": 5}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("results", None), list)


# --- /api/top (Popular podcasts) ---
class TestTop:
    def test_top_default(self, api):
        r = api.get(f"{BASE_URL}/api/top", params={"limit": 12}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 1
        assert len(data["results"]) >= 1
        first = data["results"][0]
        assert "collectionId" in first
        assert "artworkUrl600" in first

    def test_top_with_genre(self, api):
        r = api.get(f"{BASE_URL}/api/top", params={"genre": "comedy", "limit": 5}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert len(data["results"]) >= 1


# --- /api/feed (RSS feedparser) ---
class TestFeed:
    @pytest.fixture(scope="class")
    def feed_url(self, api):
        """Resolve a real podcast feed URL via iTunes search."""
        r = api.get(f"{BASE_URL}/api/search", params={"term": "radiolab", "limit": 5}, timeout=20)
        assert r.status_code == 200
        results = r.json().get("results", [])
        for p in results:
            if p.get("feedUrl"):
                return p["feedUrl"]
        pytest.skip("No feedUrl found in search results")

    def test_feed_parse(self, api, feed_url):
        r = api.get(f"{BASE_URL}/api/feed", params={"url": feed_url, "limit": 5}, timeout=40)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ["title", "author", "description", "image", "episodes"]:
            assert key in data, f"missing key {key}"
        assert isinstance(data["episodes"], list)
        assert len(data["episodes"]) >= 1, "feed has no episodes"
        ep = data["episodes"][0]
        for key in ["id", "title", "description", "audioUrl", "pubDate", "duration", "image"]:
            assert key in ep
        # Most important: audioUrl should be present for playable episodes
        has_audio = any(e.get("audioUrl") for e in data["episodes"])
        assert has_audio, "no episode has audioUrl"

    def test_feed_invalid_url(self, api):
        r = api.get(f"{BASE_URL}/api/feed", params={"url": "https://invalid.example.invalid/rss.xml"}, timeout=20)
        assert r.status_code == 502

    def test_feed_missing_param(self, api):
        r = api.get(f"{BASE_URL}/api/feed", timeout=10)
        assert r.status_code == 422
