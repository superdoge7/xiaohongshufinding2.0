"""
Orchestrate: XHS search JSON → optional external score API → merge scores →
optional external image API (1–4 URLs) → save creator draft via publish_pipeline.

Does not embed vendor API keys; use config/external_ai.json (gitignored template:
config/external_ai.json.example).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CDP_PUBLISH = SCRIPT_DIR / "cdp_publish.py"
PUBLISH_PIPELINE = SCRIPT_DIR / "publish_pipeline.py"
DEFAULT_CONFIG = REPO_ROOT / "config" / "external_ai.json"
EXAMPLE_CONFIG = REPO_ROOT / "config" / "external_ai.json.example"

SEARCH_MARKER = "SEARCH_FEEDS_RESULT:"


def _expand_headers(headers: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in headers.items():
        if isinstance(v, str):
            out[str(k)] = os.path.expandvars(v)
        else:
            out[str(k)] = str(v)
    return out


def load_config(path: Path | None) -> dict[str, Any]:
    p = path or DEFAULT_CONFIG
    if not p.is_file():
        raise FileNotFoundError(
            f"Config not found: {p}. Copy {EXAMPLE_CONFIG} to config/external_ai.json."
        )
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def parse_search_stdout(stdout: str) -> dict[str, Any]:
    idx = stdout.rfind(SEARCH_MARKER)
    if idx < 0:
        raise ValueError(
            f"Could not find {SEARCH_MARKER!r} in cdp_publish output. "
            "Ensure home login works and search-feeds succeeded."
        )
    blob = stdout[idx + len(SEARCH_MARKER) :].strip()
    return json.loads(blob)


def run_search_feeds(
    keyword: str,
    *,
    host: str,
    port: int,
    account: str | None,
    reuse_existing_tab: bool,
    sort_by: str | None,
    note_type: str | None,
) -> dict[str, Any]:
    cmd: list[str] = [
        sys.executable,
        str(CDP_PUBLISH),
        "--host",
        host,
        "--port",
        str(port),
    ]
    if account:
        cmd.extend(["--account", account])
    if reuse_existing_tab:
        cmd.append("--reuse-existing-tab")
    cmd.extend(
        [
            "search-feeds",
            "--keyword",
            keyword,
        ]
    )
    if sort_by:
        cmd.extend(["--sort-by", sort_by])
    if note_type:
        cmd.extend(["--note-type", note_type])

    proc = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (proc.stdout or "") + "\n" + (proc.stderr or "")
    if proc.returncode != 0:
        raise RuntimeError(
            f"search-feeds failed (exit {proc.returncode}). Output tail:\n{out[-4000:]}"
        )
    return parse_search_stdout(out)


def _feed_id_candidates(feed: dict[str, Any]) -> set[str]:
    ids: set[str] = set()

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                lk = str(k).lower()
                if lk in ("id", "noteid", "note_id", "feedid", "feed_id") and isinstance(
                    v, str
                ):
                    if len(v) >= 16:
                        ids.add(v)
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(feed)
    return ids


def merge_scores_from_file(search_doc: dict[str, Any], scores_path: Path) -> dict[str, Any]:
    with open(scores_path, encoding="utf-8") as f:
        scores_doc = json.load(f)
    if not isinstance(scores_doc, dict):
        raise ValueError("scores JSON must be an object")

    feeds = search_doc.get("feeds")
    if not isinstance(feeds, list):
        raise ValueError("search doc has no feeds[]")

    out = json.loads(json.dumps(search_doc))

    if "feeds" in scores_doc and isinstance(scores_doc["feeds"], list):
        out["feeds"] = scores_doc["feeds"]
        return out

    by_index: dict[int, dict[str, Any]] = {}
    for item in scores_doc.get("feed_scores", []):
        if not isinstance(item, dict):
            continue
        ix = item.get("index")
        if isinstance(ix, int):
            by_index[ix] = item

    by_feed_id: dict[str, dict[str, Any]] = {}
    for item in scores_doc.get("by_feed_id", []):
        if not isinstance(item, dict):
            continue
        fid = item.get("feed_id") or item.get("id")
        if isinstance(fid, str):
            by_feed_id[fid] = item

    new_feeds: list[Any] = []
    for i, feed in enumerate(feeds):
        if not isinstance(feed, dict):
            new_feeds.append(feed)
            continue
        merged = dict(feed)
        src = by_index.get(i)
        if not src:
            for cid in _feed_id_candidates(feed):
                if cid in by_feed_id:
                    src = by_feed_id[cid]
                    break
        if src:
            if "score" in src:
                merged["ai_score"] = src.get("score")
            if "labels" in src:
                merged["ai_labels"] = src.get("labels")
            if "reason" in src:
                merged["ai_reason"] = src.get("reason")
        new_feeds.append(merged)

    out["feeds"] = new_feeds
    return out


def post_score_api(config: dict[str, Any], search_doc: dict[str, Any]) -> dict[str, Any]:
    sc = config.get("score_api")
    if not isinstance(sc, dict) or not sc.get("enabled"):
        raise ValueError("score_api.enabled is false or missing")
    url = sc.get("url")
    if not url:
        raise ValueError("score_api.url is empty")

    method = str(sc.get("method", "POST")).upper()
    headers = _expand_headers(sc.get("headers") or {})
    timeout = float(sc.get("timeout_seconds", 120))
    wrap = sc.get("request_wrap") or {}
    envelope = wrap.get("envelope_key") if isinstance(wrap, dict) else None
    if envelope:
        body: Any = {str(envelope): search_doc}
    else:
        body = {"search": search_doc}

    r = requests.request(method, url, json=body, headers=headers, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict):
        raise ValueError("score API returned non-object JSON")

    if isinstance(data.get("feeds"), list):
        merged = dict(search_doc)
        merged["feeds"] = data["feeds"]
        return merged
    if isinstance(data.get("feed_scores"), list):
        tmp_scores = REPO_ROOT / "tmp" / "_inline_feed_scores.json"
        tmp_scores.parent.mkdir(parents=True, exist_ok=True)
        with open(tmp_scores, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return merge_scores_from_file(search_doc, tmp_scores)

    for k in ("search", "result", "data"):
        sub = data.get(k)
        if isinstance(sub, dict) and isinstance(sub.get("feeds"), list):
            merged = dict(search_doc)
            merged["feeds"] = sub["feeds"]
            return merged

    return search_doc


def _first_url_list(obj: Any, max_count: int) -> list[str]:
    if max_count < 1:
        return []

    if isinstance(obj, list):
        urls = [x for x in obj if isinstance(x, str) and x.startswith("http")]
        if urls:
            return urls[:max_count]

    if isinstance(obj, dict):
        for key in ("image_urls", "urls", "data"):
            v = obj.get(key)
            if isinstance(v, list):
                got = _first_url_list(v, max_count)
                if got:
                    return got
        for v in obj.values():
            got = _first_url_list(v, max_count)
            if got:
                return got

    return []


def post_image_api(
    config: dict[str, Any], prompt: str, count: int
) -> list[str]:
    if not 1 <= count <= 4:
        raise ValueError("image count must be 1–4")
    ic = config.get("image_api")
    if not isinstance(ic, dict) or not ic.get("enabled"):
        raise ValueError("image_api.enabled is false or missing")
    url = ic.get("url")
    if not url:
        raise ValueError("image_api.url is empty")

    method = str(ic.get("method", "POST")).upper()
    headers = _expand_headers(ic.get("headers") or {})
    timeout = float(ic.get("timeout_seconds", 300))
    body_cfg = ic.get("body") or {}
    if not isinstance(body_cfg, dict):
        body_cfg = {}
    p_field = str(body_cfg.get("prompt_field", "prompt"))
    c_field = str(body_cfg.get("count_field", "n"))
    extra = body_cfg.get("extra") if isinstance(body_cfg.get("extra"), dict) else {}
    body: dict[str, Any] = {**extra, p_field: prompt, c_field: count}

    r = requests.request(method, url, json=body, headers=headers, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    urls = _first_url_list(data, count)
    if len(urls) < count:
        raise RuntimeError(
            f"image API returned {len(urls)} URL(s), expected {count}. Raw keys: "
            f"{list(data.keys()) if isinstance(data, dict) else type(data)}"
        )
    return urls


def cmd_fetch_search(args: argparse.Namespace) -> None:
    doc = run_search_feeds(
        args.keyword,
        host=args.host,
        port=args.port,
        account=args.account,
        reuse_existing_tab=args.reuse_existing_tab,
        sort_by=args.sort_by,
        note_type=args.note_type,
    )
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"[ai_content_pipeline] Wrote search JSON: {out_path}")


def cmd_merge_scores(args: argparse.Namespace) -> None:
    with open(args.search_json, encoding="utf-8") as f:
        search_doc = json.load(f)
    merged = merge_scores_from_file(search_doc, Path(args.scores_json))
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"[ai_content_pipeline] Wrote scored search JSON: {out_path}")


def cmd_score_api(args: argparse.Namespace) -> None:
    cfg = load_config(Path(args.config) if args.config else None)
    with open(args.search_json, encoding="utf-8") as f:
        search_doc = json.load(f)
    merged = post_score_api(cfg, search_doc)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"[ai_content_pipeline] Wrote score-api output: {out_path}")


def cmd_image_api(args: argparse.Namespace) -> None:
    cfg = load_config(Path(args.config) if args.config else None)
    if args.prompt_file:
        prompt = Path(args.prompt_file).read_text(encoding="utf-8").strip()
    else:
        prompt = args.prompt or ""
    if not prompt.strip():
        raise SystemExit("Provide --prompt or --prompt-file")
    count = int(args.count)
    urls = post_image_api(cfg, prompt, count)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"image_urls": urls, "count": len(urls)}, f, ensure_ascii=False, indent=2)
    print(f"[ai_content_pipeline] Wrote image URLs JSON: {out_path}")


def cmd_save_draft(args: argparse.Namespace) -> None:
    cmd: list[str] = [
        sys.executable,
        str(PUBLISH_PIPELINE),
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--title-file",
        args.title_file,
        "--content-file",
        args.content_file,
        "--image-urls",
        *args.image_urls,
    ]
    if args.account:
        cmd.extend(["--account", args.account])
    if args.headless:
        cmd.append("--headless")
    if args.reuse_existing_tab:
        cmd.append("--reuse-existing-tab")
    if args.preview:
        cmd.append("--preview")
    if args.strict_image_downloads:
        cmd.append("--strict-image-downloads")

    print("[ai_content_pipeline] Running:", " ".join(cmd))
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT))
    raise SystemExit(proc.returncode)


def cmd_run(args: argparse.Namespace) -> None:
    """
    fetch-search → optional score-api → optional image-api → save-draft.
    Title/content must already exist (e.g. from your LLM); image prompt from file.
    """
    work = Path(args.work_dir)
    work.mkdir(parents=True, exist_ok=True)
    search_path = work / "search.json"
    scored_path = work / "search_scored.json"
    images_path = work / "image_urls.json"

    doc = run_search_feeds(
        args.keyword,
        host=args.host,
        port=args.port,
        account=args.account,
        reuse_existing_tab=args.reuse_existing_tab,
        sort_by=args.sort_by,
        note_type=args.note_type,
    )
    search_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ai_content_pipeline] Step search → {search_path}")

    cfg: dict[str, Any] = {}
    if args.config and Path(args.config).is_file():
        cfg = load_config(Path(args.config))

    final_search = doc
    if args.scores_json:
        final_search = merge_scores_from_file(doc, Path(args.scores_json))
        scored_path.write_text(
            json.dumps(final_search, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"[ai_content_pipeline] Step merge-scores → {scored_path}")
    elif cfg.get("score_api", {}).get("enabled"):
        final_search = post_score_api(cfg, doc)
        scored_path.write_text(
            json.dumps(final_search, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"[ai_content_pipeline] Step score-api → {scored_path}")

    image_urls: list[str] = []
    if args.image_urls_manual:
        image_urls = list(args.image_urls_manual)
    elif cfg.get("image_api", {}).get("enabled") and args.prompt_file:
        icount = int(args.image_count)
        if not 1 <= icount <= 4:
            raise SystemExit("--image-count must be between 1 and 4")
        prompt = Path(args.prompt_file).read_text(encoding="utf-8").strip()
        image_urls = post_image_api(cfg, prompt, icount)
        images_path.write_text(
            json.dumps({"image_urls": image_urls}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"[ai_content_pipeline] Step image-api → {images_path}")
    else:
        raise SystemExit(
            "Provide --image-urls (one or more) or enable image_api + --prompt-file"
        )

    if not 1 <= len(image_urls) <= 4:
        raise SystemExit("Need 1–4 image URLs for 小红书图文草稿")

    cmd: list[str] = [
        sys.executable,
        str(PUBLISH_PIPELINE),
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--title-file",
        args.title_file,
        "--content-file",
        args.content_file,
        "--image-urls",
        *image_urls,
    ]
    if args.account:
        cmd.extend(["--account", args.account])
    if args.headless:
        cmd.append("--headless")
    if args.reuse_existing_tab:
        cmd.append("--reuse-existing-tab")
    cmd.append("--preview")
    if args.strict_image_downloads:
        cmd.append("--strict-image-downloads")

    print("[ai_content_pipeline] Step save-draft (preview):", " ".join(cmd))
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT))
    raise SystemExit(proc.returncode)


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--host", default="127.0.0.1")
    common.add_argument("--port", type=int, default=9222)
    common.add_argument("--account", default=None)
    common.add_argument("--reuse-existing-tab", action="store_true")

    p = argparse.ArgumentParser(
        description="AI content pipeline: search → score → images → creator draft"
    )
    sub = p.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser(
        "fetch-search",
        parents=[common],
        help="Run search-feeds and write SEARCH_FEEDS JSON to file",
    )
    p_fetch.add_argument("--keyword", required=True)
    p_fetch.add_argument("--output", required=True, help="Output JSON path")
    p_fetch.add_argument("--sort-by", default=None)
    p_fetch.add_argument("--note-type", default=None)
    p_fetch.set_defaults(func=cmd_fetch_search)

    p_merge = sub.add_parser(
        "merge-scores",
        help="Merge feed_scores JSON into search JSON",
    )
    p_merge.add_argument("--search-json", required=True)
    p_merge.add_argument("--scores-json", required=True)
    p_merge.add_argument("--output", required=True)
    p_merge.set_defaults(func=cmd_merge_scores)

    p_score = sub.add_parser(
        "score-api",
        help="POST search JSON to configured score_api",
    )
    p_score.add_argument("--config", default=None, help="Path to external_ai.json")
    p_score.add_argument("--search-json", required=True)
    p_score.add_argument("--output", required=True)
    p_score.set_defaults(func=cmd_score_api)

    p_img = sub.add_parser(
        "image-api",
        help="POST prompt to configured image_api (1–4 URLs)",
    )
    p_img.add_argument("--config", default=None)
    p_img.add_argument("--prompt", default=None)
    p_img.add_argument("--prompt-file", default=None)
    def _count_1_4(raw: str) -> int:
        v = int(raw)
        if not 1 <= v <= 4:
            raise argparse.ArgumentTypeError("count must be 1–4")
        return v

    p_img.add_argument(
        "--count",
        type=_count_1_4,
        default=3,
        help="Number of images (1–4)",
    )
    p_img.add_argument("--output", required=True, help="Write {image_urls: [...]}")
    p_img.set_defaults(func=cmd_image_api)

    p_draft = sub.add_parser(
        "save-draft",
        parents=[common],
        help="Fill creator publish form (--preview default on)",
    )
    p_draft.add_argument("--title-file", required=True)
    p_draft.add_argument("--content-file", required=True)
    p_draft.add_argument(
        "--image-urls",
        nargs="+",
        required=True,
        help="1–4 image URLs",
    )
    p_draft.add_argument(
        "--no-preview",
        action="store_true",
        help="Actually click publish (use with care)",
    )
    p_draft.add_argument("--headless", action="store_true")
    p_draft.add_argument(
        "--strict-image-downloads",
        action="store_true",
    )

    def _save_draft_preview_default(ns: argparse.Namespace) -> None:
        ns.preview = not ns.no_preview
        cmd_save_draft(ns)

    p_draft.set_defaults(func=_save_draft_preview_default)

    p_run = sub.add_parser(
        "run",
        parents=[common],
        help="fetch-search → optional score → images → save draft (preview)",
    )
    p_run.add_argument("--keyword", required=True)
    p_run.add_argument("--work-dir", default="tmp/ai_pipeline_run")
    p_run.add_argument("--title-file", required=True)
    p_run.add_argument("--content-file", required=True)
    p_run.add_argument("--config", default=None)
    p_run.add_argument("--scores-json", default=None, help="Local merge instead of score_api")
    p_run.add_argument("--prompt-file", default=None, help="For image_api when enabled")
    p_run.add_argument(
        "--image-urls",
        dest="image_urls_manual",
        nargs="*",
        default=None,
        help="Skip image_api; use these URLs (1–4)",
    )
    p_run.add_argument(
        "--image-count",
        type=int,
        default=3,
        help="When using image_api: number of images (1–4)",
    )
    p_run.add_argument("--sort-by", default=None)
    p_run.add_argument("--note-type", default=None)
    p_run.add_argument("--headless", action="store_true")
    p_run.add_argument("--strict-image-downloads", action="store_true")
    p_run.set_defaults(func=cmd_run)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
