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
- [x] 内容草案三件套已出：NPC（docs/drafts/NPC_DRAFTS.md）、地图（docs/drafts/MAP_DRAFTS.md）、配色（docs/drafts/PALETTES.md）——**待两人审核**
- [x] Day-1 spike 测试页已就绪：spike/api-test.html（填 key 即可验证浏览器直连 API）
- [ ] M0：环境搭建 + 审核草案 + AI 连通性验证（计划两周内启动）

## 协作约定（速查）

- 语言：中文；目标平台：Windows；预算：0 元（API 充值约 10 元除外）
- 版本管理：Git + GitHub 私有仓库，改动走 PR 互查
- 决策一律落 `docs/decisions.md`，不靠口头记忆
- 学业忙时降速不放弃，里程碑可滑动
