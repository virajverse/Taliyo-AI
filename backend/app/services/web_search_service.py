from __future__ import annotations

from typing import List, Dict, Any
import re

import httpx
from duckduckgo_search import DDGS
from bs4 import BeautifulSoup


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def search_web(query: str, k: int = 5, fetch_pages: bool = False, timeout: float = 8.0) -> List[Dict[str, Any]]:
    """Search the web and return a list of results: title, url, snippet, content (optional)."""
    results: List[Dict[str, Any]] = []

    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max(1, min(k, 10))):
            # r: {title, href, body}
            results.append({
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
            })
            if len(results) >= k:
                break

    if fetch_pages and results:
        for item in results:
            url = item.get("url")
            if not url:
                continue
            try:
                text = _fetch_page_text(url, timeout=timeout)
                item["content"] = text
            except Exception:
                # Best-effort: leave content missing if fetch fails
                pass

    return results


def _fetch_page_text(url: str, timeout: float = 8.0, max_chars: int = 2500) -> str:
    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(timeout=timeout, headers=headers, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        html = resp.text or ""
    # Strip scripts/styles and extract visible text
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text(" ")
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_chars:
        text = text[:max_chars] + " …"
    return text
