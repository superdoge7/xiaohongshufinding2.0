# 仓库指南

## 项目结构与模块组织
本仓库是一个用于小红书自动化的 Python Skill 包，同时支持 Electron + React 桌面应用模式。
- `scripts/` 包含全部可执行逻辑：`publish_pipeline.py`（主流程）、`cdp_publish.py`（CDP 自动化与账号命令，支持扫码和手机号登录）、`chrome_launcher.py`（Chrome/Edge 浏览器生命周期管理）、`ai_content_pipeline.py`（可选：检索 JSON + 外部打分/生图 API + 填草稿）、`serve_local_app.py`（FastAPI 后端，桌面应用的 API 层）、`ai_llm_client.py`（AI LLM 统一调用层），以及辅助模块（`image_downloader.py`、`account_manager.py`、`run_lock.py`）。`serve_local_app.py` 另提供桌面会话 API：`GET/POST /api/desktop/config`（历史目录指针存 `tmp/desktop_ui_settings.json`）、`GET/POST /api/desktop/session`（快照 `redbook_session.json`，默认目录 `tmp/redbook_history/`）。
- `desktop/` 包含 Electron + React 桌面应用：`electron/`（主进程 + Python sidecar 管理）、`src/`（React 页面与组件）。
- `config/accounts.json.example` 是账号与 Profile 的配置模板；`config/external_ai.json.example` 是外部打分/生图 HTTP API 模板；`config/ai_presets.json` 是内置 AI 分析 prompt 模板；`config/ai_settings.json.example` 是 AI 服务配置模板（复制为未跟踪的对应文件）。
- `docs/` 存放集成说明（例如 `docs/claude-code-integration.md`、`docs/openclaw-integration.md`、`docs/technical-interview-guide.md` 技术架构与面试要点）。
- `images/publish_temp/` 是临时素材目录占位。
- 根目录关键文件：`README.md`、`SKILL.md`、`requirements.txt`。

## 文件修改 /工作流
- 当新增或者修改功能之后，注意同步修改 SKILL.md 以及 README.md
- 新增功能时，建议在 plan.md 中先规划好，再实现，然后优化其中的内容


## 构建、测试与开发命令
- `python -m venv .venv && source .venv/bin/activate`：创建并激活本地虚拟环境。
- `pip install -r requirements.txt`：安装运行依赖。
- `python scripts/chrome_launcher.py`：启动启用 CDP 的 Chrome 或 Edge（有界面，自动检测）。
- `python scripts/chrome_launcher.py --browser edge`：强制使用 Edge 浏览器。
- `python scripts/cdp_publish.py check-login`：检查当前登录状态。
- `python scripts/publish_pipeline.py --headless --title "T" --content "C" --image-urls "https://example.com/a.jpg"`：执行端到端发布流程。
- `python scripts/chrome_launcher.py --kill`：关闭测试浏览器。

## 代码风格与命名规范
- 遵循 PEP 8，使用 4 空格缩进，并为模块提供清晰 docstring。
- 函数/变量使用 `snake_case`，类使用 `PascalCase`，并显式添加类型注解（如 `list[str]`、`str | None`）。
- CLI 参数优先使用长参数名，`argparse` 说明保持清晰、可读。
- 日志输出沿用 `[module]` 前缀风格，便于排查。
- 考虑到操作随机值，模拟人机交互，避免被系统检测

## 测试指南
当前仓库尚未配置自动化测试套件。提交 PR 前请完成冒烟验证：
- 启动或重启浏览器：`python scripts/chrome_launcher.py --restart`
- 验证登录：`python scripts/cdp_publish.py check-login`
- 先在测试账号执行非破坏流程（不加 `--auto-publish`）。
若新增自动化测试，请放在 `tests/` 目录下，文件命名为 `test_*.py`，并补充运行说明。


## 安全与配置建议
- 禁止提交真实 Cookie、账号令牌或个人 Chrome Profile 路径。
- 本地账号配置请基于 `config/accounts.json.example` 复制为未跟踪的 `config/accounts.json` 后再使用。
- AI 配置请基于 `config/ai_settings.json.example` 复制为 `config/ai_settings.json`，其中包含用户的 API Key、`max_tokens`、`block_words`（AI 分析/报告前按标题与描述等过滤）等字段；**`config/ai_settings.json` 已列入 `.gitignore`，勿手动强制 add**。若历史上曾提交过该文件，需 `git rm --cached` 并轮换已泄露的 Key。
