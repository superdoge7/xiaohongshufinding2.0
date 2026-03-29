"""
Unified AI LLM client for RedBook Desktop.

Provides a single interface for calling OpenAI-compatible APIs with preset
prompt templates for Xiaohongshu content analysis. Supports OpenAI, Anthropic
Claude, Volcengine ARK, and any OpenAI-compatible custom endpoint.

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

DEFAULT_MAX_TOKENS = 4096


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
        "max_tokens": DEFAULT_MAX_TOKENS,
        "block_words": [],
        "use_note_covers": False,
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


def _extract_cover_url(feed: dict[str, Any]) -> str | None:
    """Best-effort cover image URL from a search/home feed item."""
    nc = feed.get("noteCard") or feed.get("note_card") or feed
    if not isinstance(nc, dict):
        return None
    cover = nc.get("cover")
    if not isinstance(cover, dict):
        return None
    info = cover.get("infoList") or cover.get("info_list")
    if isinstance(info, list) and info:
        first = info[0]
        if isinstance(first, dict):
            u = first.get("url")
            if isinstance(u, str) and u.startswith("http"):
                return u
    for key in ("url", "urlDefault", "url_default"):
        u = cover.get(key)
        if isinstance(u, str) and u.startswith("http"):
            return u
    return None


def _cover_urls_from_feeds(feeds: list[dict[str, Any]]) -> set[str]:
    out: set[str] = set()
    for f in feeds:
        u = _extract_cover_url(f)
        if u:
            out.add(u)
    return out


def _build_cover_catalog_text(feeds: list[dict[str, Any]]) -> str:
    """Numbered title + cover URL lines for report_visuals grounding."""
    chunks: list[str] = []
    for i, feed in enumerate(feeds):
        u = _extract_cover_url(feed)
        if not u:
            continue
        s = _extract_feed_summary(feed)
        title = (s["title"] or "无标题")[:100]
        chunks.append(f"[{i + 1}] 标题: {title}\n    封面URL: {u}")
    return "\n\n".join(chunks)


def _sanitize_report_visuals(
    raw: dict[str, Any] | None,
    allowed_urls: set[str],
) -> dict[str, Any] | None:
    if not raw or not allowed_urls:
        return None
    primary = str(raw.get("primary_image_url", "") or "").strip()
    if primary and primary not in allowed_urls:
        primary = ""
    more_raw = raw.get("more_image_urls")
    more_list: list[str] = []
    if isinstance(more_raw, list):
        for x in more_raw:
            u = str(x).strip()
            if u in allowed_urls and u != primary and u not in more_list:
                more_list.append(u)
    more_list = more_list[:5]
    caption = str(raw.get("caption", "") or "").strip()
    hint = str(raw.get("image_prompt_hint", "") or "").strip()
    if not primary and not more_list and not caption and not hint:
        return None
    return {
        "primary_image_url": primary,
        "more_image_urls": more_list,
        "caption": caption,
        "image_prompt_hint": hint,
    }


def _sanitize_report_visuals_text_only(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """When no cover URLs exist, still accept caption + image_prompt_hint."""
    if not isinstance(raw, dict):
        return None
    caption = str(raw.get("caption", "") or "").strip()
    hint = str(raw.get("image_prompt_hint", "") or "").strip()
    if not caption and not hint:
        return None
    return {
        "primary_image_url": "",
        "more_image_urls": [],
        "caption": caption,
        "image_prompt_hint": hint,
    }


def _build_user_content_for_model(
    text: str,
    feeds: list[dict[str, Any]],
    settings: dict[str, Any],
    max_images: int = 6,
) -> str | list[dict[str, Any]]:
    """Plain text, or OpenAI-style multimodal list (text + image_url parts)."""
    use_covers = bool(settings.get("use_note_covers"))
    if not use_covers:
        return text

    provider = settings.get("provider", "openai")
    base_url = _get_base_url(settings)
    claude_native = provider == "claude" and "/anthropic" in base_url
    if claude_native:
        lines = [text.strip(), "", "以下为笔记封面图 URL（当前 Claude Messages API 未接视觉通道，请结合链接理解）："]
        n = 0
        for i, feed in enumerate(feeds):
            if n >= max_images:
                break
            u = _extract_cover_url(feed)
            if u:
                n += 1
                lines.append(f"[{n}] {u}")
        return "\n".join(lines)

    parts: list[dict[str, Any]] = [{"type": "text", "text": text}]
    n_img = 0
    for feed in feeds:
        if n_img >= max_images:
            break
        u = _extract_cover_url(feed)
        if u:
            parts.append({"type": "image_url", "image_url": {"url": u}})
            n_img += 1
    return parts if n_img else text


def _call_openai_compatible(
    messages: list[dict[str, Any]],
    settings: dict[str, Any] | None = None,
    response_format: dict | None = None,
) -> str:
    """Call an OpenAI-compatible chat completions endpoint.

    ``messages`` items use ``content`` as str or as a list of content parts
    (``text`` / ``image_url``) for vision models.
    """
    if settings is None:
        settings = load_ai_settings()

    api_key = settings.get("api_key", "")
    if not api_key:
        raise ValueError(
            "AI API Key 未配置。请在「设置」页面填入你的 API Key。"
        )

    model = settings.get("model", "gpt-4o")
    base_url = _get_base_url(settings).strip().rstrip('/') # 统一去掉末尾斜杠
    provider = settings.get("provider", "openai")
    
    # 强制将 max_tokens 转为整数，有些模型不支持太大的值，默认给 4096 比较稳
    max_tokens = int(settings.get("max_tokens", 4096))

    if provider == "claude" and "/anthropic" in base_url:
        return _call_claude_native(
            messages, api_key, model, base_url, max_tokens
        )

    # --- 修复点 1: 路径拼接 ---
    # 确保只有在 base_url 不含 chat/completions 时才添加
    url = base_url if "chat/completions" in base_url else f"{base_url}/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key.strip()}",
    }

    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }
    # 火山方舟等部分 OpenAI 兼容接口不支持 json_schema / 会返回 500，默认不传
    if response_format and "volces.com" not in base_url and "volcengine" not in base_url.lower():
        body["response_format"] = response_format

    if os.environ.get("XHS_AI_DEBUG", "").strip() in ("1", "true", "yes"):
        print(f"[ai_llm_client] POST {url} model={model!r}")

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=120)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        r = getattr(e, "response", None)
        error_detail = (r.text[:2000] if r is not None else "") or str(e)
        code = r.status_code if r is not None else "?"
        raise RuntimeError(
            f"AI API 请求失败 ({code}): {error_detail}"
        ) from e
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(
            f"无法连接到 AI API（{url}）。请检查网络与 Base URL。"
        ) from e
    except requests.exceptions.Timeout as e:
        raise RuntimeError(
            "AI API 请求超时（120s），请稍后重试。"
        ) from e

    data = resp.json()

    if "error" in data and "choices" not in data:
        err_msg = data["error"].get("message", str(data["error"])) if isinstance(data["error"], dict) else str(data["error"])
        raise RuntimeError(f"AI API 返回错误: {err_msg}")

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"AI API 返回格式异常: {json.dumps(data, ensure_ascii=False)[:500]}") from e


def _message_content_to_str(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for part in content:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "text":
                chunks.append(str(part.get("text", "")))
            elif part.get("type") == "image_url":
                url = (part.get("image_url") or {}).get("url")
                if url:
                    chunks.append(f"[图片] {url}")
        return "\n".join(chunks)
    return str(content)


def _call_claude_native(
    messages: list[dict[str, Any]],
    api_key: str,
    model: str,
    base_url: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """Call Anthropic Claude messages API natively."""
    url = f"{base_url}/messages"
    system_msg = ""
    user_messages = []
    for m in messages:
        if m["role"] == "system":
            system_msg = _message_content_to_str(m.get("content", ""))
        else:
            user_messages.append({
                "role": m["role"],
                "content": _message_content_to_str(m.get("content", "")),
            })

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
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
    xsec_token = (
        nc.get("xsecToken")
        or nc.get("xsec_token")
        or feed.get("xsecToken")
        or feed.get("xsec_token")
        or ""
    )
    link = ""
    if note_id:
        link = f"https://www.xiaohongshu.com/explore/{note_id}"
        if xsec_token:
            link += f"?xsec_token={xsec_token}&xsec_source=pc_search"

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


def _feed_text_for_block_words(feed: dict[str, Any]) -> str:
    s = _extract_feed_summary(feed)
    return f"{s['title']} {s['description']} {s['author']}".lower()


def filter_feeds_by_block_words(
    feeds: list[dict[str, Any]],
    block_words: list[str] | None,
) -> tuple[list[dict[str, Any]], int]:
    """Remove feeds whose title/description/author contain any block word (case-insensitive)."""
    if not block_words:
        return feeds, 0
    normalized = [
        w.strip().lower()
        for w in block_words
        if isinstance(w, str) and w.strip()
    ]
    if not normalized:
        return feeds, 0
    kept: list[dict[str, Any]] = []
    removed = 0
    for f in feeds:
        text = _feed_text_for_block_words(f)
        if any(w in text for w in normalized):
            removed += 1
            continue
        kept.append(f)
    return kept, removed


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


def _clamp_max_feeds(max_feeds: int, *, upper: int = 50) -> int:
    """Clamp batch size sent to the model (avoid huge prompts)."""
    try:
        n = int(max_feeds)
    except (TypeError, ValueError):
        n = 10
    return max(1, min(n, upper))


def analyze_feeds(
    feeds: list[dict[str, Any]],
    preset: str,
    keyword: str | None = None,
    max_feeds: int = 10,
) -> dict[str, Any]:
    """Analyze feeds using an AI preset prompt. Returns results + summary."""
    presets = load_presets()
    preset_config = presets.get(preset)
    if not preset_config:
        raise ValueError(f"Unknown preset: {preset}")

    settings = load_ai_settings()
    bw = settings.get("block_words", [])
    if not isinstance(bw, list):
        bw = []
    feeds, filtered_n = filter_feeds_by_block_words(feeds, [str(x) for x in bw])
    if not feeds:
        return {
            "results": [],
            "summary": "所有笔记均被「屏蔽词」过滤。请在「设置」中调整屏蔽词列表或更换检索关键词。",
            "filtered_by_block_words": filtered_n,
            "feeds_analyzed": 0,
        }

    system_prompt = preset_config.get("system_prompt", "")
    user_template = preset_config.get("user_prompt", "")

    cap = _clamp_max_feeds(max_feeds, upper=50)
    slice_feeds = feeds[:cap]
    feeds_text = _build_feeds_text(slice_feeds)
    user_prompt = user_template.replace("{{feeds}}", feeds_text)
    if keyword:
        user_prompt = user_prompt.replace("{{keyword}}", keyword)
    else:
        user_prompt = user_prompt.replace("{{keyword}}", "")

    user_content = _build_user_content_for_model(
        user_prompt, slice_feeds, settings
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    raw = _call_openai_compatible(messages)
    parsed = _try_parse_json(raw)

    if isinstance(parsed, dict):
        results = parsed.get("results", parsed.get("feeds", []))
        summary = str(parsed.get("summary", "") or "")
        insights = parsed.get("insights")
        if isinstance(insights, list) and insights:
            lines = [str(x).strip() for x in insights if str(x).strip()]
            if lines:
                summary = (
                    summary
                    + ("\n\n" if summary else "")
                    + "要点：\n"
                    + "\n".join(f"- {x}" for x in lines[:12])
                )
        if not isinstance(results, list):
            results = []
        for i, r in enumerate(results):
            if isinstance(r, dict) and i < len(slice_feeds):
                s = _extract_feed_summary(slice_feeds[i])
                r.setdefault("link", s["link"])
                r.setdefault("title", s["title"])
        return {
            "results": results,
            "summary": summary,
            "filtered_by_block_words": filtered_n,
            "feeds_analyzed": len(slice_feeds),
        }

    return {
        "results": [],
        "summary": raw,
        "filtered_by_block_words": filtered_n,
        "feeds_analyzed": len(slice_feeds),
    }


def score_feeds_batch(
    feeds: list[dict[str, Any]],
    preset: str,
    max_feeds: int = 10,
) -> list[dict[str, Any]]:
    """Score a batch of feeds using the specified preset."""
    result = analyze_feeds(feeds, preset, max_feeds=max_feeds)
    return result.get("results", [])


def generate_report(
    feeds: list[dict[str, Any]],
    keyword: str,
    preset: str | None = None,
    max_feeds: int = 15,
    with_illustrations: bool = False,
) -> dict[str, Any]:
    """Generate a structured content analysis report."""
    settings = load_ai_settings()
    bw = settings.get("block_words", [])
    if not isinstance(bw, list):
        bw = []
    feeds, filtered_n = filter_feeds_by_block_words(feeds, [str(x) for x in bw])
    if not feeds:
        return {
            "title": f"「{keyword}」内容报告",
            "overview": f"共 {filtered_n} 篇候选笔记均被屏蔽词过滤，无法生成报告。请调整「设置」中的屏蔽词。",
            "top_feeds": [],
            "analysis": "",
            "recommendations": ["减少屏蔽词数量或改用更精确的关键词"],
            "filtered_by_block_words": filtered_n,
            "report_visuals": None,
        }

    presets = load_presets()
    report_config = presets.get("report", {})
    system_prompt = report_config.get("system_prompt", _default_report_system_prompt())
    user_template = report_config.get("user_prompt", _default_report_user_prompt())

    cap = _clamp_max_feeds(max_feeds, upper=40)
    slice_feeds = feeds[:cap]
    feeds_text = _build_feeds_text(slice_feeds)
    user_prompt = user_template.replace("{{feeds}}", feeds_text).replace("{{keyword}}", keyword)

    allowed_covers = _cover_urls_from_feeds(slice_feeds)
    if with_illustrations:
        catalog = _build_cover_catalog_text(slice_feeds)
        if catalog:
            user_prompt += (
                "\n\n以下为部分笔记的封面图 URL（仅可从中选择报告配图，禁止编造未列出的链接）：\n\n"
                + catalog
                + "\n\n请在 JSON 中增加字段 report_visuals："
                '{"primary_image_url":"","more_image_urls":[],"caption":"","image_prompt_hint":""} '
                "primary_image_url 须为空或完全等于上文某一「封面URL」；"
                "more_image_urls 每项也必须来自上文；"
                "caption 为配图一句说明；"
                "image_prompt_hint 为若使用文生图生成「一图读懂本报告」可用的中文画面提示。"
                "若无合适封面，primary_image_url 用空字符串。"
            )
        else:
            user_prompt += (
                "\n\n本次候选笔记未携带可用封面 URL。请在 JSON 中仍增加 report_visuals："
                '{"primary_image_url":"","more_image_urls":[],"caption":"","image_prompt_hint":""} '
                "图片字段留空；填写 caption（可选）与 image_prompt_hint（文生图「一图读懂报告」提示）。"
            )

    user_content = _build_user_content_for_model(
        user_prompt, slice_feeds, settings, max_images=8
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    raw = _call_openai_compatible(messages)
    parsed = _try_parse_json(raw)

    if isinstance(parsed, dict):
        top_feeds = parsed.get("top_feeds", [])
        if not isinstance(top_feeds, list):
            top_feeds = []
        for i, tf in enumerate(top_feeds):
            if isinstance(tf, dict) and i < len(slice_feeds):
                s = _extract_feed_summary(slice_feeds[i])
                tf.setdefault("link", s["link"])
        overview = str(parsed.get("overview", "") or "")
        analysis = str(parsed.get("analysis", "") or "")
        extra_parts: list[str] = []
        for key, label in (
            ("key_trends", "趋势要点"),
            ("audience_hints", "受众推断"),
            ("risks_or_gaps", "风险与内容空白"),
        ):
            val = parsed.get(key)
            if isinstance(val, list) and val:
                lines = [str(x).strip() for x in val if str(x).strip()]
                if lines:
                    extra_parts.append(
                        f"{label}：\n" + "\n".join(f"- {x}" for x in lines[:12])
                    )
        if extra_parts:
            analysis = "\n\n".join(extra_parts) + (
                f"\n\n---\n\n{analysis}" if analysis else ""
            )
        recs = parsed.get("recommendations", [])
        if not isinstance(recs, list):
            recs = []
        rv_raw = parsed.get("report_visuals")
        report_visuals = None
        if with_illustrations and isinstance(rv_raw, dict):
            if allowed_covers:
                report_visuals = _sanitize_report_visuals(rv_raw, allowed_covers)
            else:
                report_visuals = _sanitize_report_visuals_text_only(rv_raw)
        return {
            "title": parsed.get("title", f"「{keyword}」内容分析报告"),
            "overview": overview,
            "top_feeds": top_feeds,
            "analysis": analysis,
            "recommendations": recs,
            "filtered_by_block_words": filtered_n,
            "report_visuals": report_visuals,
        }

    return {
        "title": f"「{keyword}」内容分析报告",
        "overview": raw[:500],
        "top_feeds": [_extract_feed_summary(f) for f in feeds[:5]],
        "analysis": raw,
        "recommendations": [],
        "filtered_by_block_words": filtered_n,
        "report_visuals": None,
    }


def _try_parse_json(text: str) -> dict | list | None:
    """Try to parse JSON from text, handling markdown code fences."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
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
