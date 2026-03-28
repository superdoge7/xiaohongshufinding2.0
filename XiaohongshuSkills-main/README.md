# RedBookSkills

小红书（Xiaohongshu/RED）内容检索、AI 分析与自动化发布工具。
支持命令行（CLI/Skill）和 **桌面应用（Electron + React）** 两种使用方式。
通过 Chrome DevTools Protocol (CDP) 实现自动化，支持多账号管理、无头模式运行、AI 内容打分、报告生成等功能。

## 功能特性
- **桌面应用（新）**：Electron + React 桌面 GUI，支持搜索、AI 分析、报告生成、账号管理
- **AI 内容分析（新）**：内置 5 种 prompt 模板（质量评估/爆款预测/违规检测/竞品分析/改写建议），用户填入 API Key 即可使用
- **内容报告生成（新）**：自动搜索 + AI 分析 → 结构化报告（含笔记链接），支持 Markdown/HTML 导出
- **自动化发布**：自动填写标题、正文、上传图片
- **创作者中心兼容修复**：适配 2026 年 2-3 月发布页 DOM 变动（发布按钮、定时开关、日期输入、多图上传等待、正文编辑器）
- **话题标签自动写入**：识别正文最后一行 `#标签`，然后逐渐写入
- **多账号支持**：支持管理多个小红书账号，各账号 Cookie 隔离
- **无头模式**：支持后台运行，无需显示浏览器窗口
- **远程 CDP 支持**：可通过 `--host` / `--port` 连接远程 Chrome 调试端口
- **图片下载**：支持从 URL 自动下载图片，自动添加 Referer 绕过防盗链
- **登录检测**：自动检测登录状态，未登录时自动切换到有窗口模式扫码
- **登录二维码导出**：支持返回登录二维码 Base64 图片，便于远程前端展示扫码
- **登录状态缓存**：`check_login/check_home_login` 默认本地缓存 12 小时，减少重复跳转校验
- **首页推荐流抓取**：支持抓取首页推荐 feed 列表
- **内容检索与详情读取**：支持搜索笔记并获取指定笔记详情（含评论数据），详情可选滚动加载更多评论/回复
- **笔记评论**：支持按 `feed_id + xsec_token` 对指定笔记发表一级评论
- **评论回复**：支持按评论定位条件（评论 ID / 作者 / 文本片段）回复指定评论
- **互动动作控制**：支持对指定笔记执行点赞/取消点赞、收藏/取消收藏
- **用户页信息提取**：支持抓取用户主页快照与主页笔记列表
- **通知评论抓取**：支持在 `/notification` 页面抓取 `you/mentions` 接口返回
- **内容数据看板抓取**：支持抓取“笔记基础信息”表（曝光/观看/点赞等）并导出 CSV
- **AI 编排（可选）**：检索结果导出 JSON → 外部模型打分/生图（用户自配 HTTP API）→ 写入创作者草稿；详见 [docs/ai-workflow.md](docs/ai-workflow.md)

## 桌面应用（Electron + React）

### 快速启动

```bash
# 1. 安装 Python 依赖
pip install -r requirements.txt
pip install -r requirements-app.txt

# 2. 安装前端依赖
cd desktop
npm install

# 3. 启动开发模式
npm run dev
```

启动后 Electron 会自动拉起 Python FastAPI 后端（`serve_local_app.py`），无需手动启动。

### 功能页面

- **首页**：系统状态总览（后端/Chrome/登录状态）
- **搜索**：按关键词搜索小红书笔记，支持排序和类型筛选
- **AI 工作台**：输入自然语言需求，AI 自动搜索 + 分析 + 打分
- **内容报告**：生成结构化分析报告，支持 Markdown/HTML 导出
- **账号管理**：多账号管理 + 扫码登录
- **设置**：配置 AI API Key（OpenAI/Claude/自定义）、Chrome 控制

### AI 配置

1. 复制 `config/ai_settings.json.example` 为 `config/ai_settings.json`
2. 填入你的 API Key（或在桌面应用「设置」页面配置）

内置 5 种分析模板：内容质量评估、爆款潜力预测、违规风险检测、竞品分析、内容改写建议。
模板定义在 `config/ai_presets.json`，可自行编辑。

## 安装（CLI 模式）

### 环境要求

- Python 3.10+
- Google Chrome 浏览器
- Windows 操作系统（目前仅测试 Windows）
- Node.js 18+（桌面应用需要）

### 安装依赖

```bash
pip install -r requirements.txt
```

可选本地 Web 控制台（需额外依赖）：

```bash
pip install -r requirements-app.txt
python scripts/serve_local_app.py
```

浏览器访问 `http://127.0.0.1:8765`（可用环境变量 `XHS_APP_HOST` / `XHS_APP_PORT` 修改）。

## 快速开始

### 1. 首次登录

```bash
python scripts/cdp_publish.py login
```

在弹出的 Chrome 窗口中扫码登录小红书。

说明：当前发布链路已按 2026 年 2-3 月的小红书创作者中心改版调整过选择器与等待策略；如果后续再次改版，优先检查 `scripts/cdp_publish.py` 中的 `SELECTORS`、多图上传等待和发布按钮点击逻辑。

### AI：检索 → 打分 → 生图 → 草稿（预览）

1. 复制 `config/external_ai.json.example` 为 `config/external_ai.json`，填写你的打分/生图 API（密钥建议用环境变量，如 `Bearer ${XHS_SCORE_API_KEY}`）。
2. 准备标题、正文文件（可由任意 LLM 生成）。
3. 一键串联示例（默认只填草稿、不点发布）：

```bash
python scripts/ai_content_pipeline.py run ^
  --keyword "春招" ^
  --title-file D:\abs\title.txt ^
  --content-file D:\abs\content.txt ^
  --config config\external_ai.json ^
  --prompt-file D:\abs\image_prompt.txt ^
  --image-count 3
```

或使用分步命令：`fetch-search`、`merge-scores`、`score-api`、`image-api`、`save-draft`。约定见 [docs/ai-workflow.md](docs/ai-workflow.md)。

`publish_pipeline.py` 在使用 `--image-urls` 时可加 `--strict-image-downloads`，任意一张图下载失败即退出。

### 2. 启动/测试浏览器（不发布）

```bash
# 启动测试浏览器（有窗口，推荐）
python scripts/chrome_launcher.py

# 无头启动测试浏览器
python scripts/chrome_launcher.py --headless

# 检查当前登录状态
python scripts/cdp_publish.py check-login

# 获取登录二维码（返回 Base64，可供远程前端直接展示）
python scripts/cdp_publish.py get-login-qrcode

# 可选：优先复用已有标签页（减少有窗口模式下切到前台）
python scripts/cdp_publish.py check-login --reuse-existing-tab

# 连接远程 CDP（Chrome 在另一台机器）
python scripts/cdp_publish.py --host 10.0.0.12 --port 9222 check-login

# 重启测试浏览器
python scripts/chrome_launcher.py --restart

# 关闭测试浏览器
python scripts/chrome_launcher.py --kill
```

### 3. 发布内容

```bash
# 无头模式（推荐，默认自动发布）
python scripts/publish_pipeline.py --headless \
    --title "文章标题" \
    --content "文章正文" \
    --image-urls "https://example.com/image.jpg"

# 有窗口预览模式（仅填充，不自动点发布）
python scripts/publish_pipeline.py \
    --preview \
    --title "文章标题" \
    --content "文章正文" \
    --image-urls "https://example.com/image.jpg"

# 可选：优先复用已有标签页（减少有窗口模式下切到前台）
python scripts/publish_pipeline.py --reuse-existing-tab \
    --title "文章标题" \
    --content "文章正文" \
    --image-urls "https://example.com/image.jpg"

# 连接远程 CDP 并发布（远程 Chrome 需已开启调试端口）
python scripts/publish_pipeline.py --host 10.0.0.12 --port 9222 \
    --title "文章标题" \
    --content "文章正文" \
    --image-urls "https://example.com/image.jpg"

# 从文件读取内容
python scripts/publish_pipeline.py --headless \
    --title-file title.txt \
    --content-file content.txt \
    --image-urls "https://example.com/image.jpg"

# 正文最后一行可放话题标签（最多 10 个）
# 例如 content.txt 最后一行：
# #春招 #26届 #校招 #求职 #找工作

# 使用本地图片
python scripts/publish_pipeline.py --headless \
    --title "文章标题" \
    --content "文章正文" \
    --images "C:\path\to\image.jpg"

# WSL/远程 CDP + Windows/UNC 路径可跳过本地文件预校验
python scripts/publish_pipeline.py --headless \
    --title "文章标题" \
    --content "文章正文" \
    --images "\\wsl.localhost\Ubuntu\home\user\image.jpg" \
    --skip-file-check

```

### 4. 多账号管理

```bash
# 列出所有账号
python scripts/cdp_publish.py list-accounts

# 添加新账号
python scripts/cdp_publish.py add-account myaccount --alias "我的账号"

# 登录指定账号
python scripts/cdp_publish.py --account myaccount login

# 使用指定账号发布
python scripts/publish_pipeline.py --account myaccount --headless \
    --title "标题" --content "正文" --image-urls "URL"

# 设置默认账号
python scripts/cdp_publish.py set-default-account myaccount

# 切换账号（清除当前登录，重新扫码）
python scripts/cdp_publish.py switch-account
```

### 5. 搜索内容、查看笔记详情与互动操作

```bash
# 首页推荐列表
python scripts/cdp_publish.py list-feeds

# 搜索笔记（可选筛选）
python scripts/cdp_publish.py search-feeds --keyword "春招"
python scripts/cdp_publish.py search-feeds --keyword "春招" --sort-by 最新 --note-type 图文

# 获取笔记详情（feed_id 与 xsec_token 可从搜索结果中获取）
python scripts/cdp_publish.py get-feed-detail \
    --feed-id 67abc1234def567890123456 \
    --xsec-token YOUR_XSEC_TOKEN

# 可选：滚动加载更多一级评论，并尝试展开二级回复
python scripts/cdp_publish.py get-feed-detail \
    --feed-id 67abc1234def567890123456 \
    --xsec-token YOUR_XSEC_TOKEN \
    --load-all-comments \
    --limit 20 \
    --click-more-replies \
    --reply-limit 10 \
    --scroll-speed normal

# 给笔记发表评论（一级评论）
python scripts/cdp_publish.py post-comment-to-feed \
    --feed-id 67abc1234def567890123456 \
    --xsec-token YOUR_XSEC_TOKEN \
    --content "写得很实用，感谢分享！"

# 回复指定评论（可按评论ID / 作者 / 文本片段定位）
python scripts/cdp_publish.py respond-comment \
    --feed-id 67abc1234def567890123456 \
    --xsec-token YOUR_XSEC_TOKEN \
    --comment-id COMMENT_ID \
    --content "感谢你的反馈～"

# 点赞 / 取消点赞
python scripts/cdp_publish.py note-upvote --feed-id 67abc1234def567890123456 --xsec-token YOUR_XSEC_TOKEN
python scripts/cdp_publish.py note-unvote --feed-id 67abc1234def567890123456 --xsec-token YOUR_XSEC_TOKEN

# 收藏 / 取消收藏
python scripts/cdp_publish.py note-bookmark --feed-id 67abc1234def567890123456 --xsec-token YOUR_XSEC_TOKEN
python scripts/cdp_publish.py note-unbookmark --feed-id 67abc1234def567890123456 --xsec-token YOUR_XSEC_TOKEN

# 用户主页快照 / 用户主页笔记列表
python scripts/cdp_publish.py profile-snapshot --user-id USER_ID
python scripts/cdp_publish.py notes-from-profile --user-id USER_ID --limit 20 --max-scrolls 3

# 抓取“评论和@”通知接口（you/mentions）
python scripts/cdp_publish.py get-notification-mentions
```

说明：`list-feeds` 返回首页推荐 feed 列表；`search-feeds` 会先在搜索框输入关键词，抓取下拉推荐词（`recommended_keywords`），再回车拉取 feed 列表。
说明：`get-feed-detail --load-all-comments` 会在详情页滚动评论区，并可选点击“更多回复”后再提取 `window.__INITIAL_STATE__`。

### 6. 获取内容数据表（content_data）

```bash
# 抓取“笔记基础信息”数据表
python scripts/cdp_publish.py content-data

# 下划线别名
python scripts/cdp_publish.py content_data

# 导出 CSV
python scripts/cdp_publish.py content-data --csv-file "/abs/path/content_data.csv"
```

## 命令参考

### 话题标签（publish_pipeline.py）

- 从正文中提取规则：若“最后一个非空行”全部由 `#标签` 组成，则提取为话题标签并从正文移除。
- 标签输入策略：逐个输入 `#标签`，等待 `3` 秒，再发送 `Enter` 进行确认。
- 建议数量：`1-10` 个标签；超过平台限制时请手动精简。
- 示例（正文最后一行）：`#春招 #26届 #校招 #春招规划 #面试`

### publish_pipeline.py

统一发布入口，一条命令完成全部流程。

```bash
python scripts/publish_pipeline.py [选项]

选项:
  --title TEXT           文章标题
  --title-file FILE      从文件读取标题
  --content TEXT         文章正文
  --content-file FILE    从文件读取正文
  --image-urls URL...    图片 URL 列表
  --images FILE...       本地图片文件列表
  --skip-file-check      跳过本地媒体文件存在性检查（WSL/远程 CDP/UNC 路径可用）
  --preserve-upload-paths 强制保留原始上传路径，不将反斜杠转换为正斜杠
  --host HOST            CDP 主机地址（默认 127.0.0.1）
  --port PORT            CDP 端口（默认 9222）
  --headless             无头模式（无浏览器窗口）
  --reuse-existing-tab   优先复用已有标签页（默认关闭）
  --account NAME         指定账号
  --auto-publish         兼容参数：默认已自动发布（可省略）
  --preview              预览模式：仅填充内容，不点击发布
  --strict-image-downloads  使用 --image-urls 时，任一下载失败则立即退出
```

说明：启用 `--reuse-existing-tab` 后，发布流程仍会自动导航到发布页，因此会刷新到目标页面再继续执行。
说明：当 `--host` 非 `127.0.0.1/localhost` 时为远程模式，会跳过本地 `chrome_launcher.py` 的自动启动/重启逻辑，请确保远程 CDP 地址可达。
说明：当控制端运行在 WSL、但媒体路径使用 Windows/UNC（如 `\\wsl.localhost\...`）时，可加 `--skip-file-check` 跳过 Linux 侧 `isfile` 预校验。
说明：脚本现在会自动识别 `C:\...`、`\\wsl.localhost\...` 等 Windows/UNC 路径，并在传给 `DOM.setFileInputFiles` 时保留原始形态。
说明：若仍想强制关闭路径改写，可显式加 `--preserve-upload-paths`。
说明：`publish_pipeline.py` 默认会自动点击发布；如需人工确认，请显式加 `--preview`。

### cdp_publish.py

底层发布控制，支持分步操作。

```bash
# 检查登录状态
python scripts/cdp_publish.py check-login
python scripts/cdp_publish.py check-login --reuse-existing-tab
python scripts/cdp_publish.py --host 10.0.0.12 --port 9222 check-login

# 填写表单（不发布）
python scripts/cdp_publish.py fill --title "标题" --content "正文" --images img.jpg
python scripts/cdp_publish.py fill --title "标题" --content "正文" --images img.jpg --reuse-existing-tab
python scripts/cdp_publish.py --host 10.0.0.12 --port 9222 fill --title "标题" --content "正文" --images img.jpg

# 点击发布按钮
python scripts/cdp_publish.py click-publish

# 获取登录二维码（支持下划线别名：get_login_qrcode）
python scripts/cdp_publish.py get-login-qrcode

# 首页推荐列表（支持下划线别名：list_feeds）
python scripts/cdp_publish.py list-feeds

# 搜索笔记（支持下划线别名：search_feeds）
python scripts/cdp_publish.py search-feeds --keyword "春招"
python scripts/cdp_publish.py search-feeds --keyword "春招" --sort-by 最新 --note-type 图文

# 获取笔记详情（支持下划线别名：get_feed_detail）
python scripts/cdp_publish.py get-feed-detail --feed-id FEED_ID --xsec-token XSEC_TOKEN
python scripts/cdp_publish.py get-feed-detail --feed-id FEED_ID --xsec-token XSEC_TOKEN --load-all-comments --limit 20 --click-more-replies --reply-limit 10 --scroll-speed normal

# 发表评论（支持下划线别名：post_comment_to_feed）
python scripts/cdp_publish.py post-comment-to-feed --feed-id FEED_ID --xsec-token XSEC_TOKEN --content "评论内容"

# 回复评论（支持下划线别名：respond_comment）
python scripts/cdp_publish.py respond-comment --feed-id FEED_ID --xsec-token XSEC_TOKEN --content "回复内容" [--comment-id COMMENT_ID]

# 点赞/取消点赞（支持下划线别名：note_upvote / note_unvote）
python scripts/cdp_publish.py note-upvote --feed-id FEED_ID --xsec-token XSEC_TOKEN
python scripts/cdp_publish.py note-unvote --feed-id FEED_ID --xsec-token XSEC_TOKEN

# 收藏/取消收藏（支持下划线别名：note_bookmark / note_unbookmark）
python scripts/cdp_publish.py note-bookmark --feed-id FEED_ID --xsec-token XSEC_TOKEN
python scripts/cdp_publish.py note-unbookmark --feed-id FEED_ID --xsec-token XSEC_TOKEN

# 用户主页快照/主页笔记（支持下划线别名：profile_snapshot / notes_from_profile）
python scripts/cdp_publish.py profile-snapshot --profile-url "https://www.xiaohongshu.com/user/profile/USER_ID"
python scripts/cdp_publish.py notes-from-profile --user-id USER_ID --limit 20 --max-scrolls 3

# 抓取通知评论接口（支持下划线别名：get_notification_mentions）
python scripts/cdp_publish.py get-notification-mentions

# 获取内容数据表（支持下划线别名：content_data）
python scripts/cdp_publish.py content-data
python scripts/cdp_publish.py content-data --csv-file "/abs/path/content_data.csv"

# 账号管理
python scripts/cdp_publish.py login
python scripts/cdp_publish.py list-accounts
python scripts/cdp_publish.py add-account NAME [--alias ALIAS]
python scripts/cdp_publish.py remove-account NAME [--delete-profile]
python scripts/cdp_publish.py set-default-account NAME
python scripts/cdp_publish.py switch-account
```

说明：`list-feeds`、`search-feeds`、`get-feed-detail`、`post-comment-to-feed`、`respond-comment`、`note-upvote`、`note-unvote`、`note-bookmark`、`note-unbookmark`、`profile-snapshot`、`notes-from-profile` 与 `get-notification-mentions` 会校验 `xiaohongshu.com` 主页登录态（非创作者中心登录态）。
说明：登录态检查默认启用本地缓存（12 小时，仅缓存“已登录”结果），到期后自动重新走网页校验。
说明：`get-login-qrcode` 返回 `qrcode_base64` / `qrcode_data_url`，便于远程前端直接展示扫码。
说明：`search-feeds` 输出新增 `recommended_keywords_count` 与 `recommended_keywords` 字段，表示输入关键词后回车前的下拉推荐词。
说明：`get-feed-detail --load-all-comments` 额外返回 `comment_loading`，用于说明评论滚动加载结果。
说明：`content-data` 会校验创作者中心登录态，并抓取 `statistics/data-analysis` 页面中的笔记基础信息表。

### chrome_launcher.py

Chrome 浏览器管理。

```bash
# 启动 Chrome
python scripts/chrome_launcher.py
python scripts/chrome_launcher.py --headless

# 重启 Chrome
python scripts/chrome_launcher.py --restart

# 关闭 Chrome
python scripts/chrome_launcher.py --kill
```

## 支持各种 Skill 工具

本项目可作为 **Claude Code**、**OpenCode**、**OpenClaw** 等支持 Skill 的工具使用：根目录已包含 `SKILL.md` 与 `scripts/`，将整个仓库放入对应工具的技能目录（或配置额外技能路径）即可。

- Claude Code：见 [docs/claude-code-integration.md](docs/claude-code-integration.md)（示例路径 `.claude/skills/post-to-xhs/`）。
- **OpenClaw**：见 [docs/openclaw-integration.md](docs/openclaw-integration.md)（加载路径、`openclaw skills list`、ClawHub 说明）。

## 注意事项

1. **仅供学习研究**：请遵守小红书平台规则，不要用于违规内容发布
2. **登录安全**：Cookie 存储在本地 Chrome Profile 中，请勿泄露
3. **选择器更新**：如果小红书页面结构变化导致发布失败，需要更新 `cdp_publish.py` 中的选择器
4. feed 的图片类型
- WB_PRV：预览图（preview），通常更轻、更快，适合列表卡片。
  - WB_DFT：默认图（default），通常用于详情展示，质量/尺寸更完整。

## RoadMap
- [x] 支持更多账号管理功能
- [x] 支持发布功能
- [x] 增加后台笔记获取功能
- [x] 支持自动评论
- [x] 支持素材检索功能
- [x] 增加更多错误处理机制


## 许可证

MIT License

## 联系方式

微信号：`whitedewstory`

<img src="public/whitedew.jpg" alt="微信二维码" width="240" />

### 知识星球，分享最新的使用技巧
<img src="20260302-141029.jpg" alt="知识星球二维码" width="240" />

## Stars
[![Stargazers over time](https://starchart.cc/white0dew/XiaohongshuSkills.svg?variant=adaptive)](https://starchart.cc/white0dew/XiaohongshuSkills)

## 致谢
灵感来自：[Post-to-xhs](https://github.com/Angiin/Post-to-xhs)
