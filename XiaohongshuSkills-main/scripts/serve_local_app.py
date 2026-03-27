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
            sort_by=None,
            note_type=None,
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


def main() -> None:
    import uvicorn

    host = os.environ.get("XHS_APP_HOST", "127.0.0.1")
    port = int(os.environ.get("XHS_APP_PORT", "8765"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
