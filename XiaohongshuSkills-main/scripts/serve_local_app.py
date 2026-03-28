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
from pathlib import Path
import tempfile

from fastapi import FastAPI, HTTPException
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


class SearchBody(BaseModel):
    keyword: str
    host: str = "127.0.0.1"
    port: int = 9222
    account: str | None = None
    reuse_existing_tab: bool = False
    sort_by: str | None = None
    note_type: str | None = None


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
    from ai_content_pipeline import run_search_feeds

    try:
        doc = run_search_feeds(
            body.keyword,
            host=body.host,
            port=body.port,
            account=body.account,
            reuse_existing_tab=body.reuse_existing_tab,
            sort_by=body.sort_by,
            note_type=body.note_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return JSONResponse(content=doc)


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


@app.post("/api/chrome/start")
def api_chrome_start(body: ChromeStartBody) -> JSONResponse:
    from chrome_launcher import ensure_chrome
    ok = ensure_chrome(port=body.port, headless=body.headless, account=body.account)
    return JSONResponse(content={"ok": ok})


@app.post("/api/chrome/stop")
def api_chrome_stop() -> JSONResponse:
    from chrome_launcher import kill_chrome
    kill_chrome()
    return JSONResponse(content={"ok": True})


@app.post("/api/chrome/status")
def api_chrome_status() -> JSONResponse:
    from chrome_launcher import is_port_open
    running = is_port_open(9222)
    return JSONResponse(content={"running": running})


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@app.post("/api/login/qrcode")
def api_login_qrcode() -> JSONResponse:
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


@app.post("/api/feeds/home")
def api_home_feeds() -> JSONResponse:
    from cdp_publish import XiaohongshuPublisher
    publisher = XiaohongshuPublisher()
    try:
        publisher.connect(reuse_existing_tab=True)
        if not publisher.check_home_login():
            raise HTTPException(status_code=401, detail="Not logged in")
        feeds = publisher.list_feeds()
        return JSONResponse(content={"feeds": feeds})
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
        )
        return JSONResponse(content=detail)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        publisher.disconnect()


# ---------------------------------------------------------------------------
# AI analysis endpoints (powered by ai_llm_client)
# ---------------------------------------------------------------------------

class AIAnalyzeBody(BaseModel):
    feeds: list[dict]
    preset: str = "quality"
    keyword: str | None = None


class AIScoreBatchBody(BaseModel):
    feeds: list[dict]
    preset: str = "quality"


class AIGenerateReportBody(BaseModel):
    feeds: list[dict]
    keyword: str
    preset: str | None = None


class AISettingsSaveBody(BaseModel):
    provider: str
    api_key: str
    model: str
    base_url: str | None = None


@app.post("/api/ai/analyze")
def api_ai_analyze(body: AIAnalyzeBody) -> JSONResponse:
    from ai_llm_client import analyze_feeds
    try:
        result = analyze_feeds(body.feeds, body.preset, keyword=body.keyword)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/ai/score-batch")
def api_ai_score_batch(body: AIScoreBatchBody) -> JSONResponse:
    from ai_llm_client import score_feeds_batch
    try:
        result = score_feeds_batch(body.feeds, body.preset)
        return JSONResponse(content={"scored_feeds": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/ai/generate-report")
def api_ai_generate_report(body: AIGenerateReportBody) -> JSONResponse:
    from ai_llm_client import generate_report
    try:
        report = generate_report(body.feeds, body.keyword, preset=body.preset)
        return JSONResponse(content={"report": report})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/ai/settings")
def api_ai_settings_get() -> JSONResponse:
    from ai_llm_client import load_ai_settings
    settings = load_ai_settings()
    return JSONResponse(content={
        "provider": settings.get("provider", "openai"),
        "api_key_set": bool(settings.get("api_key")),
        "model": settings.get("model", "gpt-4o"),
        "base_url": settings.get("base_url", ""),
    })


@app.post("/api/ai/settings")
def api_ai_settings_save(body: AISettingsSaveBody) -> JSONResponse:
    from ai_llm_client import save_ai_settings
    try:
        save_ai_settings({
            "provider": body.provider,
            "api_key": body.api_key,
            "model": body.model,
            "base_url": body.base_url or "",
        })
        return JSONResponse(content={"ok": True})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def main() -> None:
    import uvicorn

    host = os.environ.get("XHS_APP_HOST", "127.0.0.1")
    port = int(os.environ.get("XHS_APP_PORT", "8765"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
