"""
Unified AI LLM client for RedBook Desktop.

Provides a single interface for calling OpenAI-compatible APIs with preset
prompt templates for Xiaohongshu content analysis. Supports OpenAI, Anthropic
Claude, and any OpenAI-compatible custom endpoint.

Settings are stored in config/ai_settings.json (gitignored).
Prompt presets are loaded from config/ai_presets.json.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
AI_SETTINGS_FILE = REPO_ROOT / "config" / "ai_settings.json"
AI_PRESETS_FILE = REPO_ROOT / "config" / "ai_presets.json"

DEFAULT_PROVIDER_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "claude": "https://api.anthropic.com/v1",
}


def load_ai_settings() -> dict[str, Any]:
    if AI_SETTINGS_FILE.is_file():
        try:
            with open(AI_SETTINGS_FILE, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    return {
        "provider": "openai",
        "api_key": "",
        "model": "gpt-4o",
        "base_url": "",
    }


def save_ai_settings(settings: dict[str, Any]) -> None:
    AI_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(AI_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


def load_presets() -> dict[str, Any]:
    if AI_PRESETS_FILE.is_file():
        with open(AI_PRESETS_FILE, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    return {}


def _get_base_url(settings: dict[str, Any]) -> str:
    if settings.get("base_url"):
        return settings["base_url"].rstrip("/")
    provider = settings.get("provider", "openai")
    return DEFAULT_PROVIDER_URLS.get(provider, DEFAULT_PROVIDER_URLS["openai"])


def _call_openai_compatible(
    messages: list[dict[str, str]],
    settings: dict[str, Any] | None = None,
    response_format: dict | None = None,
) -> str:
    """Call an OpenAI-compatible chat completions endpoint."""
    if settings is None:
        settings = load_ai_settings()

    api_key = settings.get("api_key", "")
    if not api_key:
        raise ValueError(
            "AI API Key 未配置。请在「设置」页面填入你的 API Key。"
        )

    model = settings.get("model", "gpt-4o")
    base_url = _get_base_url(settings)
    provider = settings.get("provider", "openai")

    if provider == "claude":
        return _call_claude_native(messages, api_key, model, base_url)

    url = f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
    }
    if response_format:
        body["response_format"] = response_format

    resp = requests.post(url, json=body, headers=headers, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _call_claude_native(
    messages: list[dict[str, str]],
    api_key: str,
    model: str,
    base_url: str,
) -> str:
    """Call Anthropic Claude messages API natively."""
    url = f"{base_url}/messages"
    system_msg = ""
    user_messages = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            user_messages.append({"role": m["role"], "content": m["content"]})

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": 4096,
        "messages": user_messages,
    }
    if system_msg:
        body["system"] = system_msg

    resp = requests.post(url, json=body, headers=headers, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    content_blocks = data.get("content", [])
    return "".join(b.get("text", "") for b in content_blocks if b.get("type") == "text")


def _extract_feed_summary(feed: dict[str, Any]) -> dict[str, Any]:
    """Extract key fields from a feed for prompt injection."""
    nc = feed.get("noteCard") or feed.get("note_card") or feed
    if not isinstance(nc, dict):
        nc = feed

    title = nc.get("displayTitle") or nc.get("display_title") or nc.get("title") or ""
    desc = nc.get("desc") or nc.get("description") or ""
    user = nc.get("user") or {}
    nickname = user.get("nickname") or user.get("nickName") or ""
    interact = nc.get("interactInfo") or {}
    likes = interact.get("likedCount", "")
    comments = interact.get("commentCount", "")
    collected = interact.get("collectedCount", "")

    note_id = (
        nc.get("noteId")
        or nc.get("note_id")
        or nc.get("id")
        or feed.get("id")
        or ""
    )
    link = f"https://www.xiaohongshu.com/explore/{note_id}" if note_id else ""

    return {
        "title": str(title),
        "description": str(desc)[:500],
        "author": str(nickname),
        "likes": str(likes),
        "comments": str(comments),
        "collected": str(collected),
        "link": link,
        "note_id": str(note_id),
    }


def _build_feeds_text(feeds: list[dict[str, Any]]) -> str:
    """Build a numbered text block describing each feed."""
    lines: list[str] = []
    for i, feed in enumerate(feeds):
        s = _extract_feed_summary(feed)
        lines.append(
            f"[{i+1}] 标题: {s['title']}\n"
            f"    描述: {s['description'][:200]}\n"
            f"    作者: {s['author']} | 点赞: {s['likes']} | 评论: {s['comments']} | 收藏: {s['collected']}\n"
            f"    链接: {s['link']}"
        )
    return "\n\n".join(lines)


def analyze_feeds(
    feeds: list[dict[str, Any]],
    preset: str,
    keyword: str | None = None,
) -> dict[str, Any]:
    """Analyze feeds using an AI preset prompt. Returns results + summary."""
    presets = load_presets()
    preset_config = presets.get(preset)
    if not preset_config:
        raise ValueError(f"Unknown preset: {preset}")

    system_prompt = preset_config.get("system_prompt", "")
    user_template = preset_config.get("user_prompt", "")

    feeds_text = _build_feeds_text(feeds[:10])
    user_prompt = user_template.replace("{{feeds}}", feeds_text)
    if keyword:
        user_prompt = user_prompt.replace("{{keyword}}", keyword)
    else:
        user_prompt = user_prompt.replace("{{keyword}}", "")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    raw = _call_openai_compatible(messages)
    parsed = _try_parse_json(raw)

    if isinstance(parsed, dict):
        results = parsed.get("results", parsed.get("feeds", []))
        summary = parsed.get("summary", "")
        if not isinstance(results, list):
            results = []
        # Attach links from original feeds
        for i, r in enumerate(results):
            if isinstance(r, dict) and i < len(feeds):
                s = _extract_feed_summary(feeds[i])
                r.setdefault("link", s["link"])
                r.setdefault("title", s["title"])
        return {"results": results, "summary": summary}

    return {"results": [], "summary": raw}


def score_feeds_batch(
    feeds: list[dict[str, Any]],
    preset: str,
) -> list[dict[str, Any]]:
    """Score a batch of feeds using the specified preset."""
    result = analyze_feeds(feeds, preset)
    return result.get("results", [])


def generate_report(
    feeds: list[dict[str, Any]],
    keyword: str,
    preset: str | None = None,
) -> dict[str, Any]:
    """Generate a structured content analysis report."""
    presets = load_presets()
    report_config = presets.get("report", {})
    system_prompt = report_config.get("system_prompt", _default_report_system_prompt())
    user_template = report_config.get("user_prompt", _default_report_user_prompt())

    feeds_text = _build_feeds_text(feeds[:15])
    user_prompt = user_template.replace("{{feeds}}", feeds_text).replace("{{keyword}}", keyword)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    raw = _call_openai_compatible(messages)
    parsed = _try_parse_json(raw)

    if isinstance(parsed, dict):
        # Attach links to top_feeds
        top_feeds = parsed.get("top_feeds", [])
        for i, tf in enumerate(top_feeds):
            if isinstance(tf, dict) and i < len(feeds):
                s = _extract_feed_summary(feeds[i])
                tf.setdefault("link", s["link"])
        return {
            "title": parsed.get("title", f"「{keyword}」内容分析报告"),
            "overview": parsed.get("overview", ""),
            "top_feeds": top_feeds,
            "analysis": parsed.get("analysis", ""),
            "recommendations": parsed.get("recommendations", []),
        }

    return {
        "title": f"「{keyword}」内容分析报告",
        "overview": raw[:500],
        "top_feeds": [_extract_feed_summary(f) for f in feeds[:5]],
        "analysis": raw,
        "recommendations": [],
    }


def _try_parse_json(text: str) -> dict | list | None:
    """Try to parse JSON from text, handling markdown code fences."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # drop opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _default_report_system_prompt() -> str:
    return (
        "你是一个专业的小红书内容分析师。根据提供的笔记数据生成结构化的内容分析报告。"
        "请以 JSON 格式返回，包含以下字段：\n"
        "- title: 报告标题\n"
        "- overview: 概览总结（2-3 句话）\n"
        "- top_feeds: 数组，每项含 title, score(1-10), reason\n"
        "- analysis: 详细分析文本\n"
        "- recommendations: 行动建议数组（3-5 条）"
    )


def _default_report_user_prompt() -> str:
    return (
        "请分析以下关于「{{keyword}}」的小红书笔记，生成内容分析报告：\n\n"
        "{{feeds}}\n\n"
        "请以 JSON 格式返回报告。"
    )
