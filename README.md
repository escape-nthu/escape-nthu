# 逃離清大：Delta Protocol

CS2410 Software Studio 期末專案規劃倉庫。前端依課程規定使用 Cocos Creator，開發流程採用 spec-driven development。

## 專案文件

- [專案簡報](docs/project-brief.md)：老師限制、遊戲範圍、組員分工與 MVP 定義。
- [Final Project Proposal](docs/final-project-proposal.md)：完整遊戲概念、故事、操作、關卡構想、風險分析、素材與音樂音效清單。
- [Spec-Driven Development 流程](docs/spec-driven-development.md)：團隊如何從規格推進到實作。
- [需求規格](docs/specs/escape-nthu/requirements.md)：玩家故事、功能需求與驗收條件。
- [架構設計](docs/specs/escape-nthu/design.md)：Cocos 前端、後端、多人連線、AI、手勢辨識與資料流設計。
- [實作計畫](docs/specs/escape-nthu/tasks.md)：里程碑、任務拆分、負責人與驗收方式。
- [後端開工重點](docs/backend.md)：後端可先開始的功能、開發順序與 MVP 邊界。
- [後端部署與 Firebase 設定](docs/deployment.md)：Docker/Render 部署、Firebase Email/Password 與 Cocos 首頁欄位。
- [GitHub 協作設定](docs/github-collaboration.md)：issues、milestones、project board 與 PR 規則。

## 核心方向

先做出一段可以完整通關的雙人合作遊戲：兩位玩家進入同一房間，在鬼魂追逐與場景探索中完成三個關卡：

1. Binary search 音高 / 節拍關卡：兩位玩家交換音樂盒音高與節拍資訊，在 tree 結構房間中限時搜尋正確路徑，取得 AC 後解鎖。
2. Prompt Injection / LLM 助教關卡：玩家透過場景線索與對話策略向 AI 助教套出扣分原因或關鍵資訊。
3. 陽台手勢合作關卡：兩位玩家在台達館與資電館陽台兩兩相望，透過 MediaPipe 或 browser pose / hand gesture 辨識完成同步手勢機關。

技術展示重點是 Cocos Creator、多玩家同步、鬼魂行為樹與尋路、LLM 串接與受控提示設計、MediaPipe 手勢辨識，以及 Top-down 探索切換視覺小說式互動。

## 後端快速啟動

```bash
pnpm install
pnpm dev
```

預設後端在 `http://localhost:8787`，health check 為 `GET /health`。WebSocket room gateway 為
`ws://localhost:8787/ws?roomId=<ROOM_ID>&playerId=<PLAYER_ID>`。

常用檢查：

```bash
pnpm typecheck
pnpm test
```
