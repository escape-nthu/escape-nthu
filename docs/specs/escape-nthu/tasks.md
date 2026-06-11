# 實作計畫：逃離清大

時間以 2026-05-19 起算，目標是在 2026-06-13 或 2026-06-14 final demo 前完成可展示版本。

## M0：專案與協作設定

目標：讓四個人能穩定並行開發。

- [ ] 建立 Cocos Creator 專案結構。
  - Owner：李久恩
  - 驗收：專案可在 Cocos Creator 開啟並 preview。
- [ ] 建立後端 TypeScript workspace，使用 `pnpm`。
  - Owner：陳可冀
  - 驗收：`pnpm dev` 可啟動 health endpoint。
- [ ] 建立 GitHub labels、issues、project board 與 PR 規則。
  - Owner：鄭名緯
  - 驗收：每個 milestone 都有 parent issue，任務可追蹤。
- [ ] 定義美術風格、素材命名與最低可用 placeholder。
  - Owner：潘睦婷
  - 驗收：至少有地圖、角色、鬼魂、UI 色彩方向。

## M1：Cocos 基礎遊戲骨架

目標：單機狀態下可以探索、互動、切換關卡。

- [ ] 實作玩家移動、衝刺、碰撞與鏡頭跟隨。
  - Owner：李久恩
  - 驗收：玩家可在 blockout 地圖移動且不穿牆。
- [ ] 實作互動物件基底。
  - Owner：李久恩
  - 驗收：靠近物件按 E 可打開 placeholder panel。
- [ ] 實作線索收集與筆記本 UI。
  - Owner：鄭名緯
  - 驗收：收集線索後可在筆記本看到。
- [ ] 產出 MVP 地圖與 UI placeholder。
  - Owner：潘睦婷
  - 驗收：地圖與 UI 足以支撐三關測試。

## M2：多人連線與房間同步

目標：兩位玩家可進入同一房間並同步關鍵狀態。

- [ ] 實作建立/加入房間 API。
  - Owner：陳可冀
  - 驗收：API 回傳 room id、player id、role。
- [ ] 實作 WebSocket room gateway。
  - Owner：陳可冀
  - 驗收：可廣播玩家位置、線索與關卡狀態。
- [ ] 整合 Cocos lobby 與房間 API。
  - Owner：鄭名緯
  - 驗收：兩個瀏覽器視窗可加入同一房間。
- [ ] 實作遠端玩家顯示與基本狀態同步。
  - Owner：李久恩
  - 驗收：每位玩家都能看到另一位玩家移動。

## M3：鬼魂行為樹與尋路

目標：完成會巡邏、搜尋、追逐的鬼魂壓力來源。

- [ ] 實作鬼魂行為樹或 FSM。
  - Owner：李久恩
  - 驗收：鬼魂可在 patrol、search、chase 間切換。
- [ ] 實作巡邏路徑與簡化尋路。
  - Owner：李久恩
  - 驗收：鬼魂追逐時不會頻繁卡牆。
- [ ] 同步鬼魂關鍵狀態。
  - Owner：鄭名緯
  - 驗收：兩位玩家看到的鬼魂狀態一致。
- [ ] 加入追逐與被抓到的視覺/音效回饋。
  - Owner：潘睦婷
  - 驗收：玩家能明確感受到追逐開始與失敗。

## M4：第一關：Binary Search 音高 / 節拍

目標：完成可 AC/WA 的 binary search 雙人解謎關卡。

- [ ] 設計音高、節拍、tree 房間結構與正確路徑。
  - Owner：鄭名緯
  - 驗收：P1 音高與 P2 節拍需要交換資訊才能解出。
- [ ] 實作後端 puzzle verifier。
  - Owner：陳可冀
  - 驗收：正確答案回 AC，錯誤答案回 WA。
- [ ] 實作 Cocos 房間分支、音樂盒/節拍線索與提交 UI。
  - Owner：鄭名緯
  - 驗收：玩家可在限制時間內選擇路徑或提交答案並看到結果。
- [ ] 加入 AC 解鎖與關卡完成同步。
  - Owner：鄭名緯
  - 驗收：AC 後兩位玩家都進入下一關狀態。

## M5：第二關：AI 助教 / Prompt Injection 線索關

目標：完成受控 LLM 對話解謎，主題是向 AI 助教追問扣分原因或關鍵資訊。

- [ ] 設計 prompt injection 關卡規則、助教人設與成功條件。
  - Owner：鄭名緯
  - 驗收：玩家目標是取得指定線索，而不是單純叫 AI 給答案。
- [ ] 實作後端 LLM adapter 與 prompt builder。
  - Owner：陳可冀
  - 驗收：API key 不出現在前端，後端可回覆對話。
- [ ] 實作 hint tier 與 scripted fallback。
  - Owner：陳可冀
  - 驗收：LLM 失敗時仍可通關。
- [ ] 實作 Cocos AI 對話 UI。
  - Owner：鄭名緯
  - 驗收：玩家可輸入問題、看到 NPC 回覆與線索變化。
- [ ] 產出 NPC 立繪、對話框與關卡氛圍。
  - Owner：潘睦婷
  - 驗收：AI 關卡視覺上和探索模式有區別。

## M6：第三關：陽台手勢合作 / MediaPipe

目標：完成至少一種可 demo 的陽台手勢合作關卡。

- [ ] 評估並整合 MediaPipe 或 browser pose / hand gesture 方案。
  - Owner：鄭名緯
  - 驗收：可在 Web build 中取得手勢或姿態 keypoints。
- [ ] 實作攝影機權限 UI 與錯誤處理。
  - Owner：鄭名緯
  - 驗收：玩家知道何時需要開啟攝影機。
- [ ] 實作陽台雙人手勢同步條件。
  - Owner：李久恩
  - 驗收：完成指定手勢或同步條件後觸發通關。
- [ ] 設計陽台場景、手勢提示與達成特效。
  - Owner：潘睦婷
  - 驗收：偵測中、失敗、成功都有清楚回饋。
- [ ] 加入 demo fallback。
  - Owner：鄭名緯
  - 驗收：攝影機或模型失敗仍可完成 demo。

## M7：整合、測試與 Demo 準備

目標：把三關與多人流程串成完整 demo。

- [ ] 串接三關流程與通關畫面。
  - Owner：李久恩、鄭名緯
  - 驗收：可從房間開始一路玩到結尾。
- [ ] 補齊失敗狀態與重試流程。
  - Owner：陳可冀、鄭名緯
  - 驗收：斷線、WA、手勢辨識失敗、LLM 失敗都有處理。
- [ ] 完成 MVP 美術、音效與特效 polish。
  - Owner：潘睦婷
  - 驗收：地圖、鬼魂、三關 UI 與結尾畫面風格一致。
- [ ] 撰寫 demo script 與操作說明。
  - Owner：鄭名緯
  - 驗收：5-8 分鐘內可穩定展示完整流程。
- [ ] 進行 final manual checklist。
  - Owner：全員
  - 驗收：多人連線、鬼魂、三關、結尾都通過。

## 時間不足時的優先順序

1. 多人房間與基本同步。
2. Cocos 玩家移動與互動。
3. 鬼魂巡邏/追逐/尋路。
4. 第一關演算法 AC/WA。
5. 第二關 LLM 對話與 fallback。
6. 第三關手勢辨識最小可玩版。
7. 美術、音效、演出 polish。
8. 隱藏劇情、成就與多結局。

## 手動 Demo Checklist

- [ ] Player A 建立房間。
- [ ] Player B 加入房間。
- [ ] 兩位玩家能看到彼此或同步狀態。
- [ ] 玩家可以移動、互動、收集線索。
- [ ] 鬼魂可以巡邏、追逐、被甩開或抓到玩家。
- [ ] 第一關演算法題會回傳 WA。
- [ ] 第一關演算法題會回傳 AC 並解鎖。
- [ ] 第二關 AI NPC 能回覆並逐步透露線索。
- [ ] 第二關 LLM fallback 可用。
- [ ] 第三關可以辨識指定手勢或同步條件。
- [ ] 第三關 fallback 可用。
- [ ] 三關完成後出現逃脫成功畫面。
