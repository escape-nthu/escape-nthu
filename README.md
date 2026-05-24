# 逃離清大：Delta Protocol

CS2410 Software Studio 期末專案規劃倉庫。前端依課程規定使用 Cocos Creator，開發流程採用 spec-driven development。

## 專案文件

- [專案簡報](docs/project-brief.md)：老師限制、遊戲範圍、組員分工與 MVP 定義。
- [Spec-Driven Development 流程](docs/spec-driven-development.md)：團隊如何從規格推進到實作。
- [需求規格](docs/specs/escape-nthu/requirements.md)：玩家故事、功能需求與驗收條件。
- [架構設計](docs/specs/escape-nthu/design.md)：Cocos 前端、後端、多人連線、AI、影像辨識與資料流設計。
- [實作計畫](docs/specs/escape-nthu/tasks.md)：里程碑、任務拆分、負責人與驗收方式。
- [後端開工重點](docs/backend.md)：後端可先開始的功能、開發順序與 MVP 邊界。
- [GitHub 協作設定](docs/github-collaboration.md)：issues、milestones、project board 與 PR 規則。

## 核心方向

先做出一段可以完整通關的雙人合作遊戲：兩位玩家進入同一房間，在鬼魂追逐與場景探索中完成三個關卡：

1. 演算法題目關卡：蒐集線索、提交答案、取得 AC 後解鎖。
2. 影像辨識動作關卡：透過攝影機辨識玩家動作，例如完成指定次數開合跳。
3. Prompt Injection / LLM 關卡：玩家需要透過對話策略向 AI NPC 套出關鍵線索。

技術展示重點是 Cocos Creator、多玩家同步、鬼魂行為樹與尋路、動作辨識、LLM 串接與受控提示設計。
