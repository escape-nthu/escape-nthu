# 後端開工重點

Author: will cheng

這份文件整理目前後端可以先開始做的功能，來源包含 `docs/specs/escape-nthu/*` 與 GitHub issues。重點是先把 MVP 必要的後端骨架做出來，讓前端可以逐步串接房間、同步、題目驗證與 AI NPC。

## 建議開發順序

1. #10 `[M0] 建立後端 TypeScript workspace`
   - 先建立 `server/` workspace，使用 Node.js + TypeScript + `pnpm`。
   - 最小驗收：`pnpm dev` 可以啟動 health endpoint。
   - 這是後續 API、WebSocket、puzzle verifier、LLM adapter 的共同基礎。

2. #17 `[M2] 實作建立/加入房間 API`
   - 提供建立房間、加入房間、分配 `roomId`、`playerId`、`role`。
   - 房間狀態先使用 in-memory store，不需要資料庫。
   - 回應格式先對齊 `docs/specs/escape-nthu/design.md` 的 API 草案。

3. #18 `[M2] 實作 WebSocket room gateway`
   - 廣播玩家位置、線索、關卡狀態與斷線事件。
   - 先同步必要狀態，不做完整物理同步。
   - 需要支援兩位玩家在同一房間看到關鍵狀態一致。

4. #26 `[M4] 實作後端 puzzle verifier`
   - 使用固定題目資料驗證第一關答案。
   - 正確答案回 `AC`，錯誤答案回 `WA`，並記錄 attempts。
   - 暫不做完整 Online Judge，也不執行玩家提交的程式碼。

5. #35 / #36 `[M6] LLM adapter、prompt builder、hint tier、scripted fallback`
   - 後端保管 LLM API key、system prompt 與 NPC profile。
   - prompt builder 只帶入必要線索，不把整個遊戲狀態丟給 LLM。
   - LLM 失敗或回覆不穩時，使用 hint tier 與 scripted fallback 保證 demo 可以通關。

6. #40 `[M7] 補齊失敗狀態與重試流程`
   - 等核心功能有雛形後，再補齊斷線、WA、影像辨識失敗、LLM 失敗等整合流程。
   - 後端至少要提供清楚錯誤回應與可讓前端顯示重試 UI 的狀態。

## MVP 後端邊界

- 技術棧：Node.js + TypeScript，套件管理使用 `pnpm`。
- HTTP API：處理 health check、房間建立/加入、題目提交、動作關完成回報、AI NPC 對話。
- WebSocket：處理雙人房間內的位置、線索、關卡進度與斷線同步。
- 狀態儲存：MVP 使用 in-memory store，不引入資料庫。
- Puzzle verifier：用固定 fixtures 驗證答案，回傳 AC/WA。
- LLM adapter/fallback：後端保護 API key，並提供 scripted fallback。

## 暫不處理

- 帳號系統與登入。
- 永久資料庫與跨天房間保存。
- 完整 Online Judge 或任意程式碼執行。
- 影像檔案上傳、保存或後端影像辨識。
- 生產等級 matchmaking 與大規模房間管理。

## 測試重點

- `pnpm dev` 可以啟動後端並回應 health endpoint。
- 房間 API 能建立房間、加入房間，且角色分配穩定。
- WebSocket 能在同一房間廣播玩家位置、線索與關卡狀態。
- Puzzle verifier 對正確答案回 `AC`，錯誤答案回 `WA`。
- LLM adapter 在沒有可用 LLM 或呼叫失敗時，仍能透過 scripted fallback 回覆。
