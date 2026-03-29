"""
Minimal local web UI + JSON API to drive ai_content_pipeline / cdp_publish.

Usage:
    pip install -r requirements-app.txt
    python scripts/serve_local_app.py

Open http://127.0.0.1:8765 in browser. Requires Python 3.10+ and configured Chrome/CDP.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
STATIC_DIR = REPO_ROOT / "web" / "static"

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

app = FastAPI(title="XiaohongshuSkills Local")

# 便于 React 开发服务器、Electron 渲染进程等跨端口调用本地 API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ---------------------------------------------------------------------------
# Desktop UI: 历史记录目录与会话快照（搜索 / 报告 / AI 工作台）
# ---------------------------------------------------------------------------

SESSION_FILE_NAME = "redbook_session.json"
DESKTOP_UI_SETTINGS_FILE = "desktop_ui_settings.json"
SESSION_SNAPSHOT_VERSION = 1
_MAX_SESSION_BYTES = 80 * 1024 * 1024  # 80 MiB 上限，防止误写爆磁盘


def _desktop_ui_settings_path() -> Path:
    d = REPO_ROOT / "tmp"
    d.mkdir(parents=True, exist_ok=True)
    return d / DESKTOP_UI_SETTINGS_FILE


def _load_history_dir_setting() -> str:
    p = _desktop_ui_settings_path()
    if not p.is_file():
        return ""
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return ""
    raw = data.get("history_dir")
    return raw.strip() if isinstance(raw, str) else ""


def _save_history_dir_setting(history_dir: str) -> None:
    p = _desktop_ui_settings_path()
    payload = {"history_dir": (history_dir or "").strip()}
    p.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _default_history_dir() -> Path:
    d = REPO_ROOT / "tmp" / "redbook_history"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _resolve_history_dir(user_path: str | None) -> Path:
    """用户配置为空时使用仓库下 tmp/redbook_history；否则使用绝对路径并确保目录存在。"""
    raw = (user_path or "").strip()
    if not raw:
        return _default_history_dir()
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = (REPO_ROOT / path).resolve()
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise HTTPException(
            status_code=400,
            detail=f"无法创建或使用历史目录: {path} ({e})",
        ) from e
    return path


def _effective_history_dir() -> Path:
    return _resolve_history_dir(_load_history_dir_setting())


def _session_file_path() -> Path:
    return _effective_history_dir() / SESSION_FILE_NAME


def _xiaohongshu_navigate_url_allowed(url: str) -> bool:
    u = (url or "").strip()
    if not u.startswith("https://"):
        return False
    try:
        host = (urlparse(u).hostname or "").lower()
    except ValueError:
        return False
    return host == "xiaohongshu.com" or host.endswith(".xiaohongshu.com")


class SearchBody(BaseModel):
    keyword: str
    host: str = "127.0.0.1"
    port: int = 9222
    account: str | None = None
    reuse_existing_tab: bool = True
    sort_by: str | None = None
    note_type: str | None = None
    min_count: int = Field(default=50, ge=5, le=200)


class MergeScoresBody(BaseModel):
    search: dict
    scores: dict


class SaveDraftBody(BaseModel):
    title: str
    content: str
    image_urls: list[str]
    host: str = "127.0.0.1"
    port: int = 9222
    account: str | None = None
    headless: bool = False
    strict_image_downloads: bool = False


class ImageApiBody(BaseModel):
    prompt: str
    count: int = Field(default=3, ge=1, le=4)
    config_path: str | None = None


class BrowserNavigateBody(BaseModel):
    url: str
    host: str = "127.0.0.1"
    port: int = 9222


class ScoreApiBody(BaseModel):
    """与 CLI `ai_content_pipeline.py score-api` 一致：用 config 里的 score_api 请求外部服务。"""

    search: dict
    config_path: str | None = None


class EnrichScoresBody(BaseModel):
    """
    统一「给检索结果贴分」入口：
    - 若提供 `scores`：等价于 merge-scores（本地/Agent 已算好的 JSON）
    - 若不提供 `scores`：等价于 score-api（按 external_ai.json 调远程 HTTP）
    """

    search: dict
    scores: dict | None = None
    config_path: str | None = None


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return index_file.read_text(encoding="utf-8")
    return "<p>Missing web/static/index.html. See docs/ai-workflow.md</p>"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/search")
def api_search(body: SearchBody) -> JSONResponse:
    from cdp_publish import XiaohongshuPublisher
    from feed_explorer import SearchFilters

    publisher = XiaohongshuPublisher(host=body.host, port=body.port)
    try:
        publisher.connect(reuse_existing_tab=True)
        if not publisher.check_home_login():
            raise HTTPException(status_code=401, detail="Not logged in")

        filters = None
        if body.sort_by or body.note_type:
            filters = SearchFilters(
                sort_by=body.sort_by,
                note_type=body.note_type,
            )
        result = publisher.search_feeds(
            keyword=body.keyword,
            filters=filters,
            min_count=body.min_count,
        )
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


@app.post("/api/merge-scores")
def api_merge_scores(body: MergeScoresBody) -> JSONResponse:
    from ai_content_pipeline import merge_scores_from_file

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        delete=False,
        encoding="utf-8",
    ) as f:
        json.dump(body.scores, f, ensure_ascii=False)
        scp = Path(f.name)
    try:
        merged = merge_scores_from_file(body.search, scp)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        scp.unlink(missing_ok=True)
    return JSONResponse(content=merged)


@app.post("/api/score-api")
def api_score_api(body: ScoreApiBody) -> JSONResponse:
    from ai_content_pipeline import load_config, post_score_api

    cfg_path = (
        Path(body.config_path)
        if body.config_path
        else REPO_ROOT / "config" / "external_ai.json"
    )
    try:
        cfg = load_config(cfg_path if cfg_path.is_file() else None)
        merged = post_score_api(cfg, body.search)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return JSONResponse(content=merged)


@app.post("/api/enrich-scores")
def api_enrich_scores(body: EnrichScoresBody) -> JSONResponse:
    from ai_content_pipeline import load_config, merge_scores_from_file, post_score_api

    cfg_path = (
        Path(body.config_path)
        if body.config_path
        else REPO_ROOT / "config" / "external_ai.json"
    )
    try:
        if body.scores is not None:
            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".json",
                delete=False,
                encoding="utf-8",
            ) as f:
                json.dump(body.scores, f, ensure_ascii=False)
                scp = Path(f.name)
            try:
                merged = merge_scores_from_file(body.search, scp)
            finally:
                scp.unlink(missing_ok=True)
        else:
            cfg = load_config(cfg_path if cfg_path.is_file() else None)
            merged = post_score_api(cfg, body.search)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return JSONResponse(content=merged)


@app.post("/api/image-api")
def api_image_api(body: ImageApiBody) -> JSONResponse:
    from ai_content_pipeline import load_config, post_image_api

    cfg_path = Path(body.config_path) if body.config_path else REPO_ROOT / "config" / "external_ai.json"
    try:
        cfg = load_config(cfg_path if cfg_path.is_file() else None)
        urls = post_image_api(cfg, body.prompt, body.count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return JSONResponse(content={"image_urls": urls})


@app.post("/api/save-draft")
def api_save_draft(body: SaveDraftBody) -> JSONResponse:
    if not 1 <= len(body.image_urls) <= 4:
        raise HTTPException(
            status_code=400,
            detail="image_urls must contain between 1 and 4 URLs",
        )
    work = REPO_ROOT / "tmp" / "web_app_draft"
    work.mkdir(parents=True, exist_ok=True)
    tf = work / "title.txt"
    cf = work / "content.txt"
    tf.write_text(body.title.strip(), encoding="utf-8")
    cf.write_text(body.content.strip(), encoding="utf-8")

    cmd: list[str] = [
        str(SCRIPT_DIR / "publish_pipeline.py"),
        "--host",
        body.host,
        "--port",
        str(body.port),
        "--preview",
        "--title-file",
        str(tf),
        "--content-file",
        str(cf),
        "--image-urls",
        *body.image_urls,
    ]
    if body.account:
        cmd.extend(["--account", body.account])
    if body.headless:
        cmd.append("--headless")
    if body.strict_image_downloads:
        cmd.append("--strict-image-downloads")

    proc = subprocess.run([sys.executable, *cmd], cwd=str(REPO_ROOT))
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"publish_pipeline exited {proc.returncode}",
        )
    return JSONResponse(content={"ok": True, "message": "Draft filled; review in Chrome"})


# ---------------------------------------------------------------------------
# Chrome lifecycle
# ---------------------------------------------------------------------------

class ChromeStartBody(BaseModel):
    headless: bool = False
    port: int = 9222
    account: str | None = None
    browser: str = "auto"


@app.post("/api/chrome/start")
def api_chrome_start(body: ChromeStartBody) -> JSONResponse:
    from chrome_launcher import ensure_chrome, get_active_browser
    try:
        ok = ensure_chrome(
            port=body.port,
            headless=body.headless,
            account=body.account,
            browser=body.browser,
        )
        return JSONResponse(content={
            "ok": ok,
            "browser": get_active_browser(),
        })
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/chrome/stop")
def api_chrome_stop() -> JSONResponse:
    from chrome_launcher import kill_chrome
    kill_chrome()
    return JSONResponse(content={"ok": True})


@app.post("/api/chrome/status")
def api_chrome_status() -> JSONResponse:
    from chrome_launcher import is_port_open, get_active_browser
    running = is_port_open(9222)
    return JSONResponse(content={
        "running": running,
        "browser": get_active_browser() if running else None,
    })


@app.get("/api/chrome/browsers")
def api_chrome_browsers() -> JSONResponse:
    from chrome_launcher import detect_available_browsers
    return JSONResponse(content={"browsers": detect_available_browsers()})


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@app.post("/api/login/qrcode")
def api_login_qrcode() -> JSONResponse:
    from chrome_launcher import is_port_open
    if not is_port_open(9222):
        raise HTTPException(
            status_code=503,
            detail="浏览器未启动，请先在「设置」页面启动浏览器",
        )
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher()
    try:
        publisher.connect(reuse_existing_tab=True)
        result = publisher.get_login_qrcode()
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


@app.post("/api/login/check")
def api_login_check() -> JSONResponse:
    from chrome_launcher import is_port_open
    if not is_port_open(9222):
        return JSONResponse(content={"logged_in": False, "error": "browser_not_running"})
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher()
    try:
        publisher.connect(reuse_existing_tab=True)
        logged_in = publisher.check_login()
        return JSONResponse(content={"logged_in": logged_in})
    except Exception as e:
        return JSONResponse(content={"logged_in": False, "error": str(e)})
    finally:
        publisher.disconnect()


# ---------------------------------------------------------------------------
# Phone login (SMS verification code)
# ---------------------------------------------------------------------------

class PhoneLoginStartBody(BaseModel):
    phone: str
    country_code: str = "86"


class PhoneLoginVerifyBody(BaseModel):
    phone: str
    code: str
    country_code: str = "86"


@app.post("/api/login/phone/start")
def api_login_phone_start(body: PhoneLoginStartBody) -> JSONResponse:
    """Navigate to login page, switch to phone mode, fill phone number, click send code."""
    from chrome_launcher import is_port_open
    if not is_port_open(9222):
        raise HTTPException(
            status_code=503,
            detail="浏览器未启动，请先在「设置」页面启动浏览器",
        )
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher()
    try:
        publisher.connect(reuse_existing_tab=True)
        result = publisher.phone_login_start(body.phone, body.country_code)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


@app.post("/api/login/phone/verify")
def api_login_phone_verify(body: PhoneLoginVerifyBody) -> JSONResponse:
    """Fill verification code and complete login."""
    from chrome_launcher import is_port_open
    if not is_port_open(9222):
        raise HTTPException(
            status_code=503,
            detail="浏览器未启动，请先在「设置」页面启动浏览器",
        )
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher()
    try:
        publisher.connect(reuse_existing_tab=True)
        result = publisher.phone_login_verify(body.code)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


# ---------------------------------------------------------------------------
# Account management
# ---------------------------------------------------------------------------

class AddAccountBody(BaseModel):
    name: str
    alias: str | None = None


class SetDefaultBody(BaseModel):
    name: str


@app.get("/api/accounts")
def api_list_accounts() -> JSONResponse:
    from account_manager import list_accounts
    accounts = list_accounts()
    return JSONResponse(content={"accounts": accounts})


@app.post("/api/accounts")
def api_add_account(body: AddAccountBody) -> JSONResponse:
    from account_manager import add_account
    ok = add_account(body.name, body.alias)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Account '{body.name}' already exists")
    return JSONResponse(content={"ok": True})


@app.delete("/api/accounts/{name}")
def api_delete_account(name: str) -> JSONResponse:
    from account_manager import remove_account
    ok = remove_account(name)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Cannot remove account '{name}'")
    return JSONResponse(content={"ok": True})


@app.post("/api/accounts/default")
def api_set_default_account(body: SetDefaultBody) -> JSONResponse:
    from account_manager import set_default_account
    ok = set_default_account(body.name)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Account '{body.name}' not found")
    return JSONResponse(content={"ok": True})


# ---------------------------------------------------------------------------
# Feeds - home / detail
# ---------------------------------------------------------------------------

class FeedDetailBody(BaseModel):
    feed_id: str
    xsec_token: str
    host: str = "127.0.0.1"
    port: int = 9222
    load_all_comments: bool = False
    limit: int = Field(default=20, ge=1, le=200)
    click_more_replies: bool = False
    reply_limit: int = Field(default=10, ge=0, le=50)
    scroll_speed: str = "normal"


@app.post("/api/feeds/home")
def api_home_feeds() -> JSONResponse:
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher()
    try:
        publisher.connect(reuse_existing_tab=True)
        if not publisher.check_home_login():
            raise HTTPException(status_code=401, detail="Not logged in")
        raw = publisher.list_feeds()
        # list_feeds() 返回 {"count": n, "feeds": [...]}，前端需要顶层 feeds 数组
        if isinstance(raw, dict) and "feeds" in raw:
            feeds_list = raw["feeds"]
        else:
            feeds_list = raw
        if not isinstance(feeds_list, list):
            feeds_list = []
        return JSONResponse(content={"feeds": feeds_list, "count": len(feeds_list)})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


@app.post("/api/feeds/detail")
def api_feed_detail(body: FeedDetailBody) -> JSONResponse:
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher(host=body.host, port=body.port)
    try:
        publisher.connect(reuse_existing_tab=True)
        if not publisher.check_home_login():
            raise HTTPException(status_code=401, detail="Not logged in")
        detail = publisher.get_feed_detail(
            feed_id=body.feed_id,
            xsec_token=body.xsec_token,
            load_all_comments=body.load_all_comments,
            limit=body.limit,
            click_more_replies=body.click_more_replies,
            reply_limit=body.reply_limit,
            scroll_speed=body.scroll_speed,
        )
        return JSONResponse(content=detail)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


@app.post("/api/browser/navigate")
def api_browser_navigate(body: BrowserNavigateBody) -> JSONResponse:
    """在当前 CDP 调试浏览器标签页打开 URL，沿用已登录小红书账号。"""
    from chrome_launcher import is_port_open
    if not is_port_open(body.port):
        raise HTTPException(
            status_code=503,
            detail="浏览器未启动或调试端口不可用",
        )
    if not _xiaohongshu_navigate_url_allowed(body.url):
        raise HTTPException(
            status_code=400,
            detail="仅允许 https://*.xiaohongshu.com 下的链接",
        )
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher(host=body.host, port=body.port)
    try:
        publisher.connect(reuse_existing_tab=True)
        publisher.navigate_current_tab(body.url.strip())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()
    return JSONResponse(content={"ok": True})


# ---------------------------------------------------------------------------
# AI analysis endpoints (powered by ai_llm_client)
# ---------------------------------------------------------------------------

class AIAnalyzeBody(BaseModel):
    feeds: list[dict]
    preset: str = "quality"
    keyword: str | None = None
    max_feeds: int = Field(default=10, ge=1, le=50)


class AIScoreBatchBody(BaseModel):
    feeds: list[dict]
    preset: str = "quality"
    max_feeds: int = Field(default=10, ge=1, le=50)


class AIGenerateReportBody(BaseModel):
    feeds: list[dict]
    keyword: str
    preset: str | None = None
    max_feeds: int = Field(default=15, ge=1, le=40)
    with_illustrations: bool = False


class AISettingsSaveBody(BaseModel):
    provider: str
    api_key: str = ""
    model: str
    base_url: str | None = None
    max_tokens: int = 4096
    block_words: list[str] = Field(default_factory=list)
    use_note_covers: bool = False


@app.post("/api/ai/analyze")
def api_ai_analyze(body: AIAnalyzeBody) -> JSONResponse:
    from ai_llm_client import analyze_feeds
    try:
        result = analyze_feeds(
            body.feeds,
            body.preset,
            keyword=body.keyword,
            max_feeds=body.max_feeds,
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/ai/score-batch")
def api_ai_score_batch(body: AIScoreBatchBody) -> JSONResponse:
    from ai_llm_client import score_feeds_batch
    try:
        result = score_feeds_batch(
            body.feeds, body.preset, max_feeds=body.max_feeds
        )
        return JSONResponse(content={"scored_feeds": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/ai/generate-report")
def api_ai_generate_report(body: AIGenerateReportBody) -> JSONResponse:
    from ai_llm_client import generate_report
    try:
        report = generate_report(
            body.feeds,
            body.keyword,
            preset=body.preset,
            max_feeds=body.max_feeds,
            with_illustrations=body.with_illustrations,
        )
        return JSONResponse(content={"report": report})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/ai/settings")
def api_ai_settings_get() -> JSONResponse:
    from ai_llm_client import load_ai_settings
    settings = load_ai_settings()
    bw = settings.get("block_words", [])
    if not isinstance(bw, list):
        bw = []
    bw = [str(x).strip() for x in bw if str(x).strip()]
    return JSONResponse(content={
        "provider": settings.get("provider", "openai"),
        "api_key_set": bool(settings.get("api_key")),
        "model": settings.get("model", "gpt-4o"),
        "base_url": settings.get("base_url", ""),
        "max_tokens": settings.get("max_tokens", 4096),
        "block_words": bw,
        "use_note_covers": bool(settings.get("use_note_covers", False)),
    })


@app.post("/api/ai/settings")
def api_ai_settings_save(body: AISettingsSaveBody) -> JSONResponse:
    from ai_llm_client import load_ai_settings, save_ai_settings
    try:
        existing = load_ai_settings()
        api_key = (body.api_key or "").strip()
        if not api_key:
            api_key = str(existing.get("api_key", "") or "")
        merged: dict[str, object] = {
            "provider": body.provider,
            "api_key": api_key,
            "model": body.model,
            "base_url": body.base_url or "",
            "max_tokens": body.max_tokens,
            "block_words": list(body.block_words),
            "use_note_covers": bool(body.use_note_covers),
        }
        save_ai_settings(merged)
        return JSONResponse(content={"ok": True})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


class DesktopHistoryConfigBody(BaseModel):
    """用户自定义历史根目录；空字符串表示使用仓库内默认 tmp/redbook_history。"""

    history_dir: str = ""


@app.get("/api/desktop/config")
def api_desktop_config_get() -> JSONResponse:
    configured = _load_history_dir_setting()
    eff = _effective_history_dir()
    return JSONResponse(
        content={
            "history_dir": configured,
            "effective_history_dir": str(eff),
            "default_history_dir": str(_default_history_dir()),
            "session_file": str(eff / SESSION_FILE_NAME),
        }
    )


@app.post("/api/desktop/config")
def api_desktop_config_save(body: DesktopHistoryConfigBody) -> JSONResponse:
    _save_history_dir_setting(body.history_dir)
    eff = _effective_history_dir()
    return JSONResponse(
        content={
            "ok": True,
            "history_dir": _load_history_dir_setting(),
            "effective_history_dir": str(eff),
            "session_file": str(eff / SESSION_FILE_NAME),
        }
    )


@app.get("/api/desktop/session")
def api_desktop_session_get() -> JSONResponse:
    sp = _session_file_path()
    if not sp.is_file():
        return JSONResponse({"snapshot": None, "session_path": str(sp)})
    try:
        snap = json.loads(sp.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=500, detail=f"读取会话失败: {e}") from e
    if not isinstance(snap, dict):
        raise HTTPException(status_code=500, detail="会话文件格式无效")
    return JSONResponse({"snapshot": snap, "session_path": str(sp)})


@app.post("/api/desktop/session")
async def api_desktop_session_save(request: Request) -> JSONResponse:
    body = await request.body()
    if len(body) > _MAX_SESSION_BYTES:
        raise HTTPException(status_code=413, detail="会话数据过大")
    try:
        data = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"无效 JSON: {e}") from e
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="会话必须是 JSON 对象")
    data.setdefault("version", SESSION_SNAPSHOT_VERSION)
    sp = _session_file_path()
    sp.parent.mkdir(parents=True, exist_ok=True)
    sp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return JSONResponse({"ok": True, "session_path": str(sp)})


def main() -> None:
    import uvicorn

    host = os.environ.get("XHS_APP_HOST", "127.0.0.1")
    port = int(os.environ.get("XHS_APP_PORT", "8765"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
