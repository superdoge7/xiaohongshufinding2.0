# RedBook Desktop — 小红书内容检索、AI 分析与报告生成工具

RedBook Desktop 是一个桌面应用，帮助你快速搜索小红书笔记、用 AI 分析内容质量、生成结构化报告。

支持 **Google Chrome** 和 **Microsoft Edge** 两种浏览器，通过浏览器远程调试协议（CDP）与小红书交互。

---

## 目录

- [功能一览](#功能一览)
- [运行环境要求](#运行环境要求)
- [安装步骤（零基础指南）](#安装步骤零基础指南)
  - [第一步：安装 Python](#第一步安装-python)
  - [第二步：安装 Node.js](#第二步安装-nodejs)
  - [第三步：下载本项目](#第三步下载本项目)
  - [第四步：安装 Python 依赖](#第四步安装-python-依赖)
  - [第五步：安装前端依赖](#第五步安装前端依赖)
- [启动应用](#启动应用)
  - [方式一：完整启动（推荐）](#方式一完整启动推荐)
  - [方式二：仅启动后端（浏览器访问）](#方式二仅启动后端浏览器访问)
- [使用教程](#使用教程)
  - [1. 启动浏览器](#1-启动浏览器)
  - [2. 登录小红书](#2-登录小红书)
  - [3. 搜索笔记](#3-搜索笔记)
  - [4. AI 分析](#4-ai-分析)
  - [5. 生成报告](#5-生成报告)
  - [6. 设置页面](#6-设置页面)
- [常见问题（FAQ）](#常见问题faq)
- [项目结构](#项目结构)
- [CLI 模式（高级用户）](#cli-模式高级用户)
- [安全说明](#安全说明)

---

## 功能一览

| 功能 | 说明 |
|------|------|
| 扫码登录 | 使用小红书 App 扫描二维码完成登录 |
| 手机号登录 | 输入手机号，接收短信验证码登录 |
| 关键词搜索 | 按关键词搜索，可选排序/类型；**目标条数**可一键选择或自定义（5–200） |
| 首页推荐流 | 在「搜索」页切换「首页推荐流」，抓取登录账号的首页 feed 列表 |
| 笔记详情 | 卡片摘要 + 可选「加载详情 JSON / 详情+评论」（CDP 滚动加载一级评论） |
| AI 内容分析 | 对搜索结果评估、打分；支持**屏蔽词**（设置中配置，过滤后再送 AI） |
| 报告生成 | 结构化报告，支持 Markdown / HTML / JSON 下载；检索条数与屏蔽词同上 |
| 界面滚动 | 主内容区可上下滚动，设置等长页面不再被裁切 |
| 多账号管理 | 支持多个小红书账号切换 |
| Chrome/Edge 支持 | 自动检测并支持两种浏览器 |

---

## 运行环境要求

| 软件 | 最低版本 | 用途 |
|------|----------|------|
| **Python** | 3.10+ | 运行后端服务 |
| **Node.js** | 18+ | 运行桌面前端 |
| **Google Chrome** 或 **Microsoft Edge** | 最新版 | 浏览器自动化 |

> 如果你的电脑是 Windows 10/11，通常已自带 Edge 浏览器，无需额外安装。

---

## 安装步骤（零基础指南）

### 第一步：安装 Python

1. 打开浏览器，访问 [Python 官网下载页](https://www.python.org/downloads/)
2. 点击黄色的 **Download Python 3.x.x** 按钮
3. 运行下载的安装程序
4. **重要**：安装界面底部勾选 **"Add Python to PATH"**（添加到环境变量），然后点击 **Install Now**
5. 安装完成后，打开 **CMD**（按 `Win + R`，输入 `cmd`，回车），输入以下命令验证：

```
python --version
```

如果显示类似 `Python 3.12.x` 的版本号，说明安装成功。

### 第二步：安装 Node.js

1. 打开浏览器，访问 [Node.js 官网](https://nodejs.org/)
2. 下载 **LTS**（长期支持版），运行安装程序，一路点 **Next** 即可
3. 安装完成后，在 CMD 中验证：

```
node --version
npm --version
```

如果都显示版本号，说明安装成功。

### 第三步：下载本项目

**方法 A（推荐）**：如果你安装了 Git：

```
git clone https://github.com/你的用户名/XiaohongshuSkills.git
cd XiaohongshuSkills-main
```

**方法 B**：直接下载 ZIP 文件，解压到你喜欢的位置（如 `D:\RedBookDesktop`）。

### 第四步：安装 Python 依赖

打开 CMD，进入项目目录，执行：

```
cd 你的项目路径
pip install -r requirements.txt
pip install -r requirements-app.txt
```

例如：

```
cd D:\RedBookDesktop\XiaohongshuSkills-main
pip install -r requirements.txt
pip install -r requirements-app.txt
```

### 第五步：安装前端依赖

继续在 CMD 中执行：

```
cd desktop
npm install
```

等待安装完成（可能需要几分钟）。

---

## 启动应用

### 方式一：完整启动（推荐）

需要打开 **两个** CMD 窗口：

**CMD 窗口 1 — 启动后端服务：**

```
cd 你的项目路径
python scripts/serve_local_app.py
```

看到类似以下输出表示启动成功：

```
INFO:     Uvicorn running on http://127.0.0.1:8765
```

> 这个窗口不要关闭！后端服务需要一直运行。

**CMD 窗口 2 — 启动桌面前端：**

```
cd 你的项目路径\desktop
npm run dev
```

稍等几秒，桌面应用窗口会自动弹出。

### 方式二：仅启动后端（浏览器访问）

如果你不想使用 Electron 桌面模式，也可以只启动后端：

```
cd 你的项目路径
python scripts/serve_local_app.py
```

然后在浏览器中打开 `http://127.0.0.1:8765` 即可。

> 注意：仅后端模式下前端 UI 功能有限，推荐使用完整启动方式。

---

## 使用教程

### 1. 启动浏览器

应用启动后，首页会显示三个状态指示灯：

| 指示灯 | 含义 |
|--------|------|
| 后端就绪 (绿色) | Python 后端正在运行 |
| 浏览器运行中 (绿色) | Chrome 或 Edge 已启动 |
| 已登录 (绿色) | 已登录小红书 |

如果「浏览器」显示未启动：
- 点击首页的 **「一键启动浏览器」** 按钮，或
- 前往 **「设置」** 页面，选择浏览器（Chrome/Edge/自动检测），点击 **「启动」**

> 如果你的电脑没有安装 Chrome，应用会自动使用 Edge 浏览器。

### 2. 登录小红书

前往 **「账号管理」** 页面，点击 **「登录小红书」**，支持两种方式：

**扫码登录：**
1. 选择「扫码登录」标签
2. 等待二维码加载
3. 打开手机上的小红书 App，扫描屏幕上的二维码
4. 在手机上确认登录
5. 页面会自动跳转显示「登录成功」

**手机号登录：**
1. 选择「手机号登录」标签
2. 输入手机号码
3. 点击「获取验证码」
4. 输入收到的短信验证码
5. 点击「确认登录」

### 3. 搜索笔记

1. 点击左侧 **「搜索」** 菜单
2. **关键词搜索**：输入关键词（如「美食推荐」），在 **目标条数** 区选择 20/30/50… 或在自定义框输入 5–200 后点「应用」；点「搜索」执行
3. 点 **筛选** 图标可展开排序（综合/最新等）与类型（视频/图文）
4. **首页推荐流**：切换到同一页顶部的「首页推荐流」，点「加载首页推荐」或「刷新列表」，抓取当前登录账号的首页 feed（与 CLI `list-feeds` 同源）
5. 点击任意笔记卡片，右侧打开摘要；在详情区可使用 **仅加载详情 JSON** 或 **详情 + 评论**（勾选「滚动加载更多一级评论」时较慢，对应 CDP 详情页的评论滚动）

### 4. AI 分析

1. 点击左侧 **「AI 工作台」** 菜单
2. 选择 **检索条数**（与搜索页逻辑一致，先拉取足够多笔记再取前 10 条送 AI）
3. 输入分析主题，选择预设（质量评估、爆款预测等），点击「分析」
4. 若在「设置」中配置了 **屏蔽词**，标题/描述/作者命中屏蔽词的笔记会在服务端过滤，界面会提示过滤篇数
5. **切换页面不会清空输入或中断任务**：分析请求在后台继续执行，完成后可随时回到「AI 工作台」查看结果

> 需要先在「设置」页面配置 AI API Key。仅修改屏蔽词等项时，**可不重填 API Key**（留空保存会保留原密钥）。  
> 调试火山引擎等接口时，可在启动后端前设置环境变量 `XHS_AI_DEBUG=1`，仅在控制台打印请求 URL 与模型名（默认不打印）。

### 5. 生成报告

1. 点击左侧 **「内容报告」** 菜单
2. 选择 **检索条数**，输入关键词，点击「生成报告」
3. 报告生成后，顶部和底部都有下载按钮，支持三种格式：
   - **Markdown**：纯文本格式，适合在笔记软件中编辑
   - **HTML 网页**：排版精美的网页文件，可直接用浏览器打开
   - **JSON 数据**：结构化数据，适合二次处理或导入其他工具
4. 若启用屏蔽词，报告顶部会提示过滤掉的候选笔记数量
5. 左侧栏会记录历史报告，点击可随时回看

### 6. 设置页面

**浏览器设置：**
- 选择浏览器：自动检测 / Google Chrome / Microsoft Edge
- 启动或停止浏览器

**AI 服务配置：**
- 选择 API 提供商（OpenAI / Claude / 自定义）
- 填入 API Key（**留空并保存不会清空已保存的 Key**）
- 选择模型、Base URL（如火山引擎 ARK）、Max Tokens
- **内容屏蔽词**：每行一词或逗号分隔；仅影响 AI 工作台与内容报告，搜索列表仍显示全部结果

---

## 常见问题（FAQ）

### Q: 启动时显示"后端服务未启动"怎么办？

请确保你在另一个 CMD 窗口中运行了 `python scripts/serve_local_app.py`，并且没有报错。

### Q: 点击"启动浏览器"没反应或报错？

1. 确认你安装了 Google Chrome 或 Microsoft Edge
2. 在设置页面尝试切换到另一个浏览器
3. 确保没有其他程序占用了 9222 端口

### Q: 扫码登录显示"Failed to fetch"？

这是因为后端服务未启动或浏览器未启动。按以下顺序操作：
1. 先启动后端：`python scripts/serve_local_app.py`
2. 再在应用中启动浏览器
3. 然后尝试登录

### Q: 只安装了 Edge，没有 Chrome 可以用吗？

可以。应用支持自动检测可用浏览器。在「设置」页面可以手动选择 Edge。

### Q: AI 功能怎么配置？

1. 你需要一个 AI 服务的 API Key（如 OpenAI 的 API Key）
2. 前往「设置」页面
3. 选择提供商，填入 API Key，选择模型
4. 点击「保存设置」

### Q: 设置页、首页内容太长，下面看不到？

主内容区已支持上下滚动。若仍无法滚动，请将 `desktop` 依赖更新后重新 `npm run dev`，并确认窗口未处于异常最大化状态。

### Q: 屏蔽词有什么用？

在「设置」里配置的词会在 **AI 分析** 和 **生成报告** 前过滤笔记（标题、描述、作者名中任一包含即剔除，不区分大小写）。搜索页展示的列表不受屏蔽词影响。

### Q: `npm run dev` 报错 "electron is not recognized"？

请确保你在 `desktop` 目录下执行了 `npm install`。

### Q: `pip install` 报错？

- 确认 Python 已添加到 PATH（安装时勾选了 "Add to PATH"）
- 尝试使用 `pip3 install -r requirements.txt`
- 如果网络不佳，可使用国内镜像：`pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`

### Q: 登录状态会过期吗？

登录状态保存在浏览器的 Profile 目录中，一般可持续较长时间。如果提示需要重新登录，重新扫码或输入验证码即可。

---

## 项目结构

```
XiaohongshuSkills-main/
├── scripts/                    # Python 后端核心
│   ├── serve_local_app.py      # FastAPI 后端 API 服务
│   ├── cdp_publish.py          # CDP 自动化（登录/搜索/发布）
│   ├── chrome_launcher.py      # Chrome/Edge 浏览器生命周期管理
│   ├── ai_llm_client.py        # AI LLM 调用层
│   ├── ai_content_pipeline.py  # 可选：检索+打分+生图流水线
│   ├── account_manager.py      # 多账号管理
│   └── ...
├── desktop/                    # Electron + React 桌面前端
│   ├── electron/               # Electron 主进程
│   │   ├── main.ts             # 窗口创建 + Python 后端管理
│   │   ├── preload.ts          # 安全通信桥接
│   │   └── python-manager.ts   # Python 进程管理
│   ├── src/                    # React 前端源码
│   │   ├── pages/              # 各功能页面
│   │   ├── components/         # 通用 UI 组件
│   │   ├── services/api.ts     # 前后端 API 通信
│   │   ├── App.tsx             # 路由配置
│   │   └── main.tsx            # 入口文件
│   └── package.json
├── config/                     # 配置文件
│   ├── ai_presets.json         # AI 分析预设 prompt 模板
│   ├── ai_settings.json.example
│   ├── accounts.json.example
│   └── external_ai.json.example
├── requirements.txt            # Python 核心依赖
├── requirements-app.txt        # Python Web 服务依赖
├── SKILL.md                    # AI Agent Skill 定义
├── AGENTS.md                   # 仓库开发指南
└── README.md                   # 本文件
```

---

## CLI 模式（高级用户）

除了桌面应用，所有功能也可以通过命令行使用：

```bash
# 启动浏览器（自动检测 Chrome/Edge）
python scripts/chrome_launcher.py
python scripts/chrome_launcher.py --browser edge
python scripts/chrome_launcher.py --browser chrome

# 检查登录状态
python scripts/cdp_publish.py check-login

# 搜索笔记
python scripts/cdp_publish.py search-feeds --keyword "春招面试"

# 获取笔记详情
python scripts/cdp_publish.py get-feed-detail --feed-id ID --xsec-token TOKEN

# 发布图文
python scripts/publish_pipeline.py --headless \
  --title "标题" --content "正文" \
  --image-urls "https://example.com/img.jpg"

# 关闭浏览器
python scripts/chrome_launcher.py --kill
```

更多命令请参考 `SKILL.md`。

---

## 安全说明

- **API Key 仅存储在本地** `config/ai_settings.json` 文件中，不会上传到任何服务器
- **登录状态** 保存在本地浏览器 Profile 目录中
- 不要将 `config/ai_settings.json`、`config/accounts.json` 等包含敏感信息的文件提交到 Git
- 本工具仅用于个人内容分析和学习研究，请遵守小红书平台的使用规范
