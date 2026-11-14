"""Hourly, best-effort official RESCENE notice discovery. Never auto-approves events."""
import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
BASE = "https://artist.mnetplus.world"
INDEX = BASE + "/main/stg/rescene-official/tag/notice"
ALLOWED_HOSTS = {"artist.mnetplus.world"}
session = requests.Session()
session.headers.update({"User-Agent": "RESCENE-Private-NoticeCollector/1.0 (personal schedule, hourly)"})
TIMEOUT = 18
MAX_ITEMS = 20

def safe_official(url):
    try:
        p = urlparse(url)
        return p.scheme == "https" and p.hostname in ALLOWED_HOSTS and p.path.startswith("/main/stg/rescene-official/contents/")
    except ValueError:
        return False

def get(url):
    response = session.get(url, timeout=TIMEOUT, allow_redirects=True)
    response.raise_for_status()
    if not urlparse(response.url).hostname in ALLOWED_HOSTS:
        raise ValueError("Unexpected redirect host")
    return BeautifulSoup(response.text[:1_500_000], "html.parser")

def discover():
    """Public Mnet Plus notice tag page; if links are JS-only, report no results."""
    soup = get(INDEX)
    found = {}
    for a in soup.find_all("a", href=True):
        url = urljoin(BASE, a["href"]).split("?")[0].split("#")[0]
        if safe_official(url):
            title = a.get_text(" ", strip=True)
            found[url] = title[:200]
    # Some Next.js pages serialize links in JSON rather than anchors.
    for m in re.finditer(r'(?:https?:\\?/\\?/artist\\.mnetplus\\.world)?\\?/main\\?/stg\\?/rescene-official\\?/contents\\?/[a-zA-Z0-9]+', str(soup)):
        url = m.group(0).replace("\\/", "/")
        if url.startswith("/"):
            url = BASE + url
        if safe_official(url):
            found.setdefault(url, "")
    return list(found.items())[:MAX_ITEMS]

def extract(url, title):
    soup = get(url)
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    h = soup.find("h1")
    title = (h.get_text(" ", strip=True) if h else title).strip()[:180]
    body = (soup.find("article") or soup.find("main") or soup).get_text("\n", strip=True)
    body = re.sub(r"\n{3,}", "\n\n", body)[:7000]
    if not title or len(body) < 40:
        return None
    return title, body

def analyze(title, body, key):
    """Optional OpenAI extraction. Never invent an event date."""
    if not key:
        return {"title": title, "proposed_at": None, "summary": "AI 미설정: 공식 원문에서 날짜·시간을 직접 확인해 주세요."}
    prompt = (
        "Extract an upcoming or dated RESCENE event from this official notice. "
        "Respond ONLY as JSON with keys title, proposed_at, summary, is_schedule. "
        "proposed_at must be ISO8601 with +09:00 offset ONLY when an unambiguous "
        "event date AND time are explicitly in the text. Otherwise null. "
        "Do not use posting dates as event dates. No guessing. "
        "is_schedule false for purely informational notices without an event or deadline. "
        "Keep summary Korean and under 400 characters.\n"
        + json.dumps({"title": title, "text": body[:5000]}, ensure_ascii=False)
    )
    try:
        r = session.post("https://api.openai.com/v1/chat/completions", headers={
            "Authorization": "Bearer " + key, "Content-Type": "application/json"
        }, json={"model": "gpt-4o-mini", "temperature": 0, "response_format": {"type": "json_object"},
                 "messages": [{"role": "user", "content": prompt}]}, timeout=30)
        r.raise_for_status()
        data = json.loads(r.json()["choices"][0]["message"]["content"])
        if not data.get("is_schedule", True):
            return None
        proposed = data.get("proposed_at")
        if proposed:
            d = datetime.fromisoformat(proposed.replace("Z", "+00:00"))
            if d.tzinfo is None:
                proposed = None
        return {"title": str(data.get("title") or title)[:180],
                "proposed_at": proposed, "summary": str(data.get("summary") or "")[:400]}
    except (requests.RequestException, ValueError, KeyError, TypeError) as e:
        logging.warning("AI extraction unavailable (%s); keeping for manual review", type(e).__name__)
        return {"title": title, "proposed_at": None, "summary": "AI 분석 실패: 원문 직접 확인 필요"}

def api(method, path, secret, **kwargs):
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + path
    headers = {"apikey": secret, "Authorization": "Bearer " + secret,
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    r = session.request(method, url, headers=headers, timeout=TIMEOUT, **kwargs)
    r.raise_for_status()
    return r

def main():
    secret = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    owner = os.getenv("OWNER_USER_ID", "").strip()
    url = os.getenv("SUPABASE_URL", "").strip()
    if not secret or not owner or not url or "/rest/v1" in url:
        logging.error("Set SUPABASE_SECRET_KEY, OWNER_USER_ID and base SUPABASE_URL")
        return 2
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", owner):
        logging.error("OWNER_USER_ID must be an auth.users UUID")
        return 2
    try:
        links = discover()
    except (requests.RequestException, ValueError) as e:
        logging.error("Official listing unavailable: %s", type(e).__name__)
        return 1
    logging.info("Discovered %d official article links", len(links))
    created = 0
    for link, heading in links:
        try:
            # Source URL is the deduplication key across pending, rejected and approved.
            r = api("GET", "candidates", secret, params={
                "select": "id", "user_id": "eq." + owner, "source_url": "eq." + link, "limit": "1"
            })
            if r.json():
                continue
            result = extract(link, heading)
            if not result:
                continue
            title, body = result
            info = analyze(title, body, os.getenv("OPENAI_API_KEY", "").strip())
            if info is None:
                continue
            payload = {"user_id": owner, "title": info["title"],
                       "notice_text": (info["summary"] + "\n\n[공식 공지 발췌]\n" + body)[:7000],
                       "source_url": link, "proposed_at": info["proposed_at"], "status": "pending"}
            api("POST", "candidates?on_conflict=user_id%2Csource_url", secret,
                headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
                json=payload)
            created += 1
        except (requests.RequestException, ValueError, KeyError) as e:
            logging.warning("Skipped article (%s)", type(e).__name__)
    logging.info("Collector finished. Added up to %d candidate(s)", created)
    return 0

if __name__ == "__main__":
    sys.exit(main())