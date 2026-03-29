# 待办 / 路线图

## 已完成（本次）

- [x] `scripts/ai_content_pipeline.py`：检索 JSON、合并打分、调用配置的打分/生图 HTTP API、`run` 一键串联、`save-draft` 填创作者草稿（默认 `--preview`）。
- [x] `config/external_ai.json.example`：外部 API 配置模板（复制为 `config/external_ai.json`，勿提交）。
- [x] `docs/ai-workflow.md`：JSON 约定与数据流说明。
- [x] `publish_pipeline.py` + `image_downloader.py`：`--strict-image-downloads` 严格下载模式。
- [x] `scripts/serve_local_app.py` + `web/static/index.html` + `requirements-app.txt`：可选本地 Web 壳。

## 后续建议

- [ ] 多账号场景为不同账号固定不同 CDP 端口，避免 `chrome_launcher` 端口占用导致串号（见 `docs/code-review-2026-03-07.md`）。
- [ ] `get_content_data` 分页参数与页面真实请求对齐，或收紧 CLI 契约。
- [ ] 为 `validate_schedule_post_time`、下载严格模式等补 `tests/test_*.py`。

## 历史备注

- 本仓库已支持 `get-login-qrcode` 输出 Base64，便于远程前端展示扫码（与早期 todo 中「仅有 login」的描述不一致，已过时）。
