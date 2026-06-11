# Spec-Driven Development 流程

## 原則

每個功能都先有小規格，再進入實作。規格要說清楚玩家價值、技術設計、驗收條件與負責人。程式碼只有在滿足對應規格後，才算完成。

## 文件結構

```text
docs/
  project-brief.md
  spec-driven-development.md
  specs/
    escape-nthu/
      requirements.md
      design.md
      tasks.md
    feature-name/
      requirements.md
      design.md
      tasks.md
```

## 規格生命週期

1. 需求規格
   - 定義玩家會看到的行為。
   - 用可驗收的條件描述完成標準。
   - 標註優先級：Must、Should、Could。

2. 技術設計
   - 定義 Cocos 場景、元件、後端服務與資料流。
   - 寫清楚 API / WebSocket / LLM / 手勢辨識的邊界。
   - 標出風險與 fallback。

3. 任務拆分
   - 拆成 1-3 天可完成的 issue。
   - 每張 issue 只指定一位主要 owner。
   - 每張 issue 都要有驗收方式。

4. 實作
   - 只做 issue 範圍內的事情。
   - 常數與調整值要集中設定，方便 demo 前調整。
   - 若實作改變規格，要同步更新文件。

5. 驗收
   - 後端邏輯用測試或腳本驗證。
   - Cocos 遊戲流程用手動 checklist 驗證。
   - Demo blocker 要回填到 issue 或 `tasks.md`。

## GitHub 協作規則

- 使用一個 GitHub Project 管整體進度。
- 每個 milestone 用 parent issue 表示。
- 每個可交付任務用獨立 issue 追蹤。
- PR description 要寫 `Closes #issue_number`。
- 每個人同時進行中的 issue 盡量不超過 1-2 張。
- 文件修改、關卡設計、測試與美術也都要開 issue。

## 完成定義

一個功能完成代表：

- 對應需求已實作。
- owner 可以在本機或 demo 環境展示。
- 失敗狀態有明確 UI 或 log。
- 與其他模組的整合方式已記錄。
- 至少一位隊友看過行為或 PR。

## 風險優先原則

高風險系統必須先做原型：

1. Cocos 玩家移動與碰撞。
2. 多人連線與房間同步。
3. 鬼魂行為樹、追逐與尋路。
4. 演算法題 AC/WA 驗證。
5. 手勢辨識判定。
6. LLM NPC 與 prompt injection 關卡。
7. 場景、美術、音效與 UI polish。
