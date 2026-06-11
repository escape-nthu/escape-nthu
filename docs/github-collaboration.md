# GitHub 協作設定

## 已建立項目

- GitHub milestones：M0 到 M7。
- GitHub labels：優先級、領域、類型、blocked 狀態。
- GitHub issues：8 張 parent issue 與 35 張 task issue。
- Parent issue checklist：每個 milestone issue 已連到對應 task issue。

## Project Board 建議欄位

建立一個 GitHub Project，名稱建議：

`Escape NTHU Development`

建議欄位：

| 欄位 | 類型 | 建議值 |
| --- | --- | --- |
| Status | Single select | Backlog、Ready、In Progress、Review、Done |
| Priority | Single select | P0、P1、P2 |
| Area | Single select | 前端Cocos、後端、多人連線、鬼魂AI、演算法關卡、影像辨識、LLM、美術音效、文件、整合 |
| Milestone | Milestone | M0-M7 |

## CLI 權限需求

目前 `gh` 已能操作 repo issues，但 Project API 需要額外 scope。若要用 CLI 操作 GitHub Projects，先執行：

```bash
gh auth refresh -s project,read:project
```

完成瀏覽器授權後，確認：

```bash
gh project list --owner escape-nthu
```

若能列出 Projects，就可以繼續用 CLI 建立 project 並加入 issues。

## GitHub 網頁操作方式

若不想處理 CLI scope，可以直接用網頁建立：

1. 到 GitHub organization `escape-nthu`。
2. 進入 Projects。
3. 建立新 Project，名稱使用 `Escape NTHU Development`。
4. 將 repo `escape-nthu/escape-nthu` 的 open issues 加入 project。
5. 新增 `Priority` 與 `Area` 欄位。
6. 依 issue labels 手動或批次填欄位。

## Issue 使用規則

- 每個人一次最多 1-2 張 `In Progress` issue。
- 開 PR 時在 description 寫 `Closes #issue_number`。
- 任務卡住超過半天，請加上 `狀態:blocked` 並留言說明卡點。
- 文件、測試、demo script、美術與整合工作都要用 issue 追蹤。
- Parent issue 只看進度與討論方向，實作請在 task issue 裡進行。

