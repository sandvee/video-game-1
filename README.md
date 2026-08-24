# 治愈小镇 · AI 对话 RPG（开发中）

> 一款 30 分钟可通关的 2D 像素风治愈系小镇 RPG。核心亮点：**所有 NPC 对话由 AI（DeepSeek v4 flash）实时生成，每次游玩都不一样**。

## 这是什么

- 你扮演一位回到小镇的主角，在小镇里走动、和 NPC 聊天、触发事件。
- 对话内容（台词、选项）由 AI 实时生成；事件由 AI 在预制的剧本池中调度触发。
- 第一版：固定剧情骨架 + AI 生成台词与选项（远期升级为 AI 调度事件、决定主线走向）。

## 技术方案（一句话版）

**无游戏引擎**：HTML5 Canvas + 原生 JavaScript，浏览器里直接跑，双击 HTML 即玩。
AI 调用 DeepSeek API（v4 flash），本地 Tiled 画地图，LibreSprite 画像素图。

## 文档导航

| 文件 | 内容 |
|---|---|
| [docs/CONTEXT.md](docs/CONTEXT.md) | 项目背景、技术栈、团队约定（先读这个） |
| [docs/DESIGN.md](docs/DESIGN.md) | 游戏设计文档（GDD） |
| [docs/AI_PROTOCOL.md](docs/AI_PROTOCOL.md) | AI 对话协议规范 + 系统提示词模板 |
| [docs/decisions.md](docs/decisions.md) | 全部决策记录（访谈结论落档） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 里程碑 M0–M6 任务拆解 |
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | 双人 + 双 DSH 协作手册（启动模板/交接/文件归属） |
| [docs/drafts/NPC_DRAFTS.md](docs/drafts/NPC_DRAFTS.md) | NPC 角色草案 + 世界观提案（待审核） |

## 当前状态

- [x] 2026-07 需求访谈完成（本文档即访谈产物）
- [x] 内容草案三件套已审核通过；NPC 人物卡已定稿 data/npcs/*.json；配色选定方案 A「奶油与青草」
- [x] Day-1 spike 测试页已就绪：spike/api-test.html（填 key 即可验证浏览器直连 API）
- [x] DeepSeek API key 已就绪（桌面 API.txt，**不入库**）；**spike 已在本机跑通，浏览器直连无 CORS 拦截**
- [x] **M1 引擎原型已就绪：双击 index.html 即可玩**（40x30 测试地图渲染 + 四向移动 + 碰撞 + 镜头跟随 + 8 个触发点）
- [x] **L3 可行性测试台已就绪：spike/director-test.html**（AI 导演在事件池中编排剧情，验证"每次都不一样"是否可行，方法见 docs/SPIKE_DIRECTOR.md）
- [ ] M0 剩余：推送仓库到 GitHub（首次用 GitHub Desktop）→ 同伴 clone → 装 Tiled/LibreSprite → 画小镇第一版 → 定分工
- [ ] M1 待办：美术方在 Tiled 绘制真实小镇地图替换测试图；咖啡馆室内场景切换

## 协作约定（速查）

- 仓库：https://github.com/sandvee/video-game-1
- 语言：中文；目标平台：Windows；预算：0 元（API 充值约 10 元除外）
- 版本管理：Git + GitHub 私有仓库，改动走 PR 互查
- 决策一律落 `docs/decisions.md`，不靠口头记忆
- 学业忙时降速不放弃，里程碑可滑动
