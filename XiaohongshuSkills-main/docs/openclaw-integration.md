# OpenClaw 集成说明

本仓库可作为 **OpenClaw Skill** 使用：目录内 **`SKILL.md`（YAML frontmatter + 指令）** 与 **`scripts/`** 下的 Python 脚本共同构成技能包。OpenClaw 根据文档调度 Agent，在授权时通过终端/exec 执行本机命令。

官方参考：[Creating Skills](https://docs.openclaw.ai/tools/creating-skills)、[Skills 加载](https://docs.openclaw.ai/tools/skills)。

## 是否支持「下载」和「调用」？

| 方式 | 说明 |
|------|------|
| **Git 克隆** | 将本仓库放到本机后，把**项目根目录**（含 `SKILL.md` 与 `scripts/`）链入 OpenClaw 的技能目录，或通过 `skills.load.extraDirs` 指向该路径。 |
| **ClawHub** | 若将本 Skill 发布到 [ClawHub](https://clawhub.com/)，用户可使用 `openclaw skills install <name>` 安装；本仓库不代为上架，需自行发布或继续使用 Git。 |
| **调用** | Agent 按 `SKILL.md` 中的命令示例执行 `python scripts/...`；工作目录应为**仓库根目录**，或使用脚本**绝对路径**。 |

## 环境要求

- **Python 3.10+**：`pip install -r requirements.txt`
- **Google Chrome**：与 README 一致，完成 `python scripts/cdp_publish.py login` 等登录流程
- **操作系统**：README 以 Windows 为主测；其他系统需自行验证

## 推荐安装步骤

1. 克隆或复制仓库到固定路径，例如 `D:\dev\XiaohongshuSkills-main`。
2. 创建虚拟环境并安装依赖（见 README）。
3. 将技能目录挂载到 OpenClaw 之一（以你本机文档为准）：
   - 工作区：`<workspace>/skills/<folder>/`（内容为本仓库或符号链接）
   - 全局：`~/.openclaw/skills/<folder>/`
   - 或在 `~/.openclaw/openclaw.json` 中配置 `skills.load.extraDirs`
4. 重启网关或新会话：`openclaw gateway restart` 或 `/new`，执行 `openclaw skills list` 确认已加载。
5. 自然语言测试：如「检查小红书登录」「搜索关键词 xxx 的笔记」。

## `SKILL.md` 与 OpenClaw 约定

- `name` 使用 **`redbook_skills`**（snake_case），符合 OpenClaw 建议的唯一标识格式。
- `metadata.openclaw.requires.bins` 声明需要 **`python`**，便于环境提示（可选扩展 `chrome` 等，视 OpenClaw 版本是否识别）。

## 安全说明

- 技能会驱动 **本机 Chrome（CDP）** 与账号 Cookie，仅在可信环境使用。
- 勿提交 `config/accounts.json`、`config/external_ai.json`。

## 与 Claude Code / Cursor 的关系

同一套 `SKILL.md` 可被多种工具读取；若某工具对 `name` 格式有额外要求，以该工具文档为准。产品展示名称仍为 **RedBookSkills**（README 标题等）。
