# Frontend Architecture: Game Scene

本文件說明 Game 場景的節點結構、碰撞系統、房間管理與地圖設計流程。

引擎版本：**Cocos Creator 2.4.8**。所有 API 和寫法以此版本為準。

---

## 目錄

1. [場景節點結構](#場景節點結構)
2. [雙 Camera 架構](#雙-camera-架構)
3. [碰撞系統](#碰撞系統)
4. [玩家移動](#玩家移動)
5. [相機跟隨](#相機跟隨)
6. [房間製作方式](#房間製作方式)
7. [房間管理與切換](#房間管理與切換)
8. [地圖格局設計指南](#地圖格局設計指南)
9. [互動物件與線索系統](#互動物件與線索系統)
10. [對話系統](#對話系統)
11. [UI 系統](#ui-系統)

---

## 場景節點結構

Game.fire 場景分成兩棵獨立的節點樹：**GameWorld**（遊戲世界）和 **UICanvas**（UI）。

```
Game (Scene Root)
│
├── GameWorld                       遊戲世界，不掛 Canvas
│    ├── GameCamera                 cc.Camera + CameraFollow
│    ├── RoomContainer              RoomManager（房間 prefab 載入到此）
│    ├── Player                     PlayerController + cc.BoxCollider
│    └── Ghost                      GhostController（M3 再實作）
│
└── UICanvas                        cc.Canvas (960×640)，group = "ui"
     ├── UICamera                   cc.Camera，只渲染 ui group
     ├── GameManager                GameManager（設定碰撞系統和雙 Camera）
     ├── GameState                  GameState（線索/門鎖/flags 狀態 singleton）
     ├── DialogueManager            DialogueManager（對話系統 singleton）
     ├── DialoguePanel              對話 UI（姓名欄、文字區、左右立繪）
     ├── NotebookPanel              NotebookPanel（Tab 鍵開關）
     └── Toast                      Toast + cc.Label（短暫提示文字）
```

遊戲物件和 UI 分開放的原因：
- GameCamera 跟隨玩家移動，UI 不應該跟著滾動。
- 用 cullingMask 分離渲染層，GameCamera 只看遊戲世界，UICamera 只看 UI。
- 概念清晰：遊戲座標系和 UI 座標系互不干擾。

---

## 雙 Camera 架構

碰撞分組（`settings/project.json` 的 `group-list`）同時用於碰撞檢測和 Camera culling：

| Index | Group        | 碰撞用途   | 渲染 Camera |
|-------|-------------|-----------|------------|
| 0     | default     | 預設       | GameCamera |
| 1     | player      | 玩家       | GameCamera |
| 2     | wall        | 牆壁碰撞   | GameCamera |
| 3     | door        | 門觸發區   | GameCamera |
| 4     | interactable| 可互動物件 | GameCamera |
| 5     | ghost       | 鬼         | GameCamera |
| 6     | ui          | UI 元素    | UICamera   |

`GameManager.onLoad()` 會自動設定：
- GameCamera：`cullingMask = 0b0111111`（groups 0–5），`depth = 0`，清除顏色+深度。
- UICamera：`cullingMask = 0b1000000`（group 6），`depth = 1`，只清除深度（遊戲畫面透過來）。

---

## 碰撞系統

使用 **cc.CollisionManager**（輕量 AABB 碰撞），**不是** cc.PhysicsManager (box2d)。

兩套系統的差異：

| 項目 | cc.CollisionManager（本專案） | cc.PhysicsManager (box2d) |
|------|------------------------------|--------------------------|
| 碰撞元件 | cc.BoxCollider | cc.PhysicsBoxCollider + cc.RigidBody |
| 移動方式 | 直接改 node.x / node.y | 透過 RigidBody.linearVelocity |
| 重力 | 無 | 有（預設向下，top-down 要手動關） |
| 碰撞回應 | 自己寫推回邏輯 | 引擎自動處理 |
| 適用場景 | top-down 俯視角、不需物理模擬 | 平台跳躍、需要彈性/摩擦力 |

選擇 CollisionManager 的原因：top-down 遊戲不需要重力和物理模擬，直接控制座標更簡單、回應更即時。

### 碰撞矩陣

在 Project Settings > Group Manager 中設定：

|              | player | wall | door | interactable | ghost |
|--------------|--------|------|------|-------------|-------|
| **player**   |        | ✓    | ✓    | ✓           | ✓     |
| **wall**     | ✓      |      |      |             | ✓     |
| **door**     | ✓      |      |      |             |       |
| **interactable** | ✓  |      |      |             |       |
| **ghost**    | ✓      | ✓    |      |             |       |

### 啟用方式

```typescript
// GameManager.ts onLoad()
const collisionMgr = cc.director.getCollisionManager();
collisionMgr.enabled = true;
collisionMgr.enabledDebugDraw = true; // 開發時開啟，可看到綠色碰撞框
```

---

## 玩家移動

`PlayerController` 每幀讀取 WASD 按鍵狀態，計算方向向量，乘以速度後直接修改 `node.x` / `node.y`。

```
update(dt)
  ├── 讀取 keyState (W/A/S/D/Shift)
  ├── 計算 moveDir（正規化為單位向量，避免斜向移動變快）
  ├── speed = Shift 按住 ? sprintSpeed : walkSpeed
  └── node.x += moveDir.x * speed * dt
      node.y += moveDir.y * speed * dt
```

碰牆處理：CollisionManager 在 update 結束後自動檢測重疊，觸發回調：

```
onCollisionStay(other, self)
  ├── 計算 X 軸和 Y 軸的重疊量
  ├── 取較小的軸（最小穿透方向）
  └── 將玩家往該方向推回重疊量 → 玩家不再與牆壁重疊
```

---

## 相機跟隨

`CameraFollow` 掛在 GameCamera 節點上，每幀平滑跟隨玩家位置。

```
lateUpdate(dt)
  ├── target 為 null → 不動
  ├── needsSnap = true（換房間或首次進入）→ 直接跳到玩家位置
  └── 正常情況 → 指數平滑插值跟隨（smoothSpeed 控制速度）
```

**換房間時的行為**：收到 `room:changed` 事件後設定 `needsSnap = true`，下一幀相機直接跳到玩家位置，避免從舊位置慢慢滑過去造成畫面晃動。

目前不做房間邊界限制，相機始終對準玩家中心。

---

## 房間製作方式

每個房間直接在 Cocos Creator 編輯器中繪製，不使用 Tiled / TMX。

### 一個房間 Prefab 的節點結構

```
RoomRoot                           掛 RoomController（設定 roomWidth / roomHeight）
├── Background                     cc.Sprite（整張房間背景圖或拼接底圖）
├── Decorations                    容器，放不需碰撞的裝飾 Sprite
├── Walls                          容器，放牆壁碰撞節點
│    ├── wall-top                  空節點，group="wall"，cc.BoxCollider
│    ├── wall-bottom               同上
│    ├── wall-left                 同上
│    ├── wall-right                同上
│    └── wall-inner-xxx            內部隔間牆
├── Doors                          容器，放門觸發節點
│    ├── door-to-2f                空節點，group="door"，cc.BoxCollider + DoorTrigger
│    └── door-to-lab               同上
└── Interactables                  容器，放可互動物件
     ├── clue-graph-note           空節點，group="interactable"，cc.BoxCollider + ClueObject
     └── clue-error-log            同上
```

### 各類子節點的建立方式

**牆壁節點（Walls 下）：**
1. 建立空節點，命名（如 `wall-top`）
2. Group 設為 `wall`
3. 加入 `cc.BoxCollider`，調整 `size` 覆蓋牆壁區域
4. 調整 Position 對齊牆壁位置
5. 不需要 Sprite（牆壁視覺由 Background 處理），但開發時可加半透明色塊輔助對位

**門節點（Doors 下）：**
1. 建立空節點，命名必須與 `RoomRegistry.ts` 中的 `doorId` 一致（如 `door_1a`）
2. Group 設為 `door`
3. 加入 `cc.BoxCollider`，size 設為門口大小（如 `64 × 48`）
4. 加入 `DoorTrigger` 腳本
   - `Door Id` 填入與節點同名的 doorId
   - `Spawn Offset X / Y` 設為玩家進入此門後相對於門的偏移量（預設 Y = -50，表示出現在門下方 50px）

**互動物件（Interactables 下）：**
1. 建立空節點
2. Group 設為 `interactable`
3. 加入 `cc.BoxCollider`
4. 加入 `ClueObject`（或 `Interactable` 的其他子類）腳本，填寫屬性
5. 可加子 Sprite 顯示物件圖案

### RoomController

掛在 RoomRoot 上，只有兩個屬性：

| 屬性 | 說明 |
|------|------|
| `Room Width` | 房間寬度（像素），供 CameraFollow 限制邊界 |
| `Room Height` | 房間高度（像素） |

不包含任何自動生成碰撞的邏輯——所有牆壁、門、互動物件都在編輯器中手動擺放。

---

## 房間管理與切換

### 核心概念

大地圖由多個獨立房間組成。每個房間是一個 Prefab。所有房間共存於同一個 Game 場景中，透過 `node.active` 切換顯示。

### 相關腳本

| 腳本 | 職責 |
|------|------|
| `RoomRegistry.ts` | 靜態資料：所有房間的定義和門的連接關係 |
| `RoomManager.ts` | 載入/快取/切換房間 prefab，定位玩家 |
| `RoomController.ts` | 提供房間尺寸給 CameraFollow |
| `DoorTrigger.ts` | 偵測玩家進入門的碰撞區，發出切換事件 |

### 切換流程

```
玩家走進門的碰撞區
    │
    ▼
DoorTrigger.onCollisionEnter()
    │  檢查門是否上鎖（GameState.isDoorLocked）
    │  上鎖 → 顯示 Toast 提示，流程結束
    │
    ▼
EventBus.emit("door:enter", doorId)
    │
    ▼
RoomManager.onDoorEnter(doorId)
    │  查 RoomRegistry：此門連到哪個房間的哪扇門？
    │  例如：door-to-2f → delta-2f-hallway / door-from-1f
    │
    ▼
RoomManager.enterRoom(targetRoomId, arrivalDoorId)
    │
    ├── ① 當前房間 node.active = false
    │      （隱藏但保留在記憶體中，狀態完整保存）
    │
    ├── ② 目標房間是否載入過？
    │      沒有 → cc.resources.load(prefabPath) → cc.instantiate → 加入場景
    │      有   → node.active = true（零載入時間，狀態照舊）
    │
    ├── ③ 定位玩家（依優先順序）：
    │      a. arrivalDoorId 不為 null → 找到門的 DoorTrigger → 用 spawnOffset 定位
    │      b. 房間有名為 "SpawnPoint" 的子節點 → 用該節點座標
    │      c. 房間有 RoomController → 用 (roomWidth/2, roomHeight/2) 房間中心
    │      d. 都沒有 → (0, 0)
    │
    └── ④ EventBus.emit("room:changed") → CameraFollow 瞬間跳到玩家位置
```

### 為什麼不用一個房間一個 Scene？

| 考量 | 單場景 + Prefab 快取 | 一房間一 Scene |
|------|---------------------|---------------|
| 切換速度 | 瞬間（enable/disable） | 需要 loadScene 載入 |
| 狀態保存 | 自然保留在 node tree | 需要額外序列化/反序列化 |
| WebSocket | 不受影響 | 切場景可能斷線 |
| 記憶體 | 所有房間同時佔用（5-10 間約 < 10MB） | 只佔當前房間 |
| 適用規模 | 5–10 個房間（本遊戲） | 50+ 房間的大型遊戲 |

### 雙人同步切換

Server 端新增了 `room:transition` WebSocket 事件：

```
Client A 觸碰門
    → 送 { type: "room:transition", payload: { targetRoomId, arrivalDoorId } }
    → Server broadcast 給雙方
    → 兩端各自呼叫 RoomManager.enterRoom()
    → 兩個玩家同時出現在新房間的對應門口
```

---

## 地圖格局設計指南

### Step 1：畫房間連接圖

把整個大地圖想成一張圖（graph）：節點 = 房間，邊 = 門。

目前測試用的兩個房間：

```
┌──────────────┐    door_1a / door_1b    ┌──────────────┐
│  Room_temp_1 │◄───────────────────────►│  Room_temp_2 │
│  （初始房間） │                          │              │
└──────────────┘                          └──────────────┘
```

先決定：
- 有幾個房間
- 哪些門連哪些門
- 哪些門需要鑰匙（解謎後）才能開

### Step 2：在編輯器中繪製每個房間

每個房間在 Cocos Creator 中獨立製作成 Prefab。步驟：

1. 建立 RoomRoot 空節點，掛 `RoomController`，設定 `roomWidth` / `roomHeight`
2. 在 RoomRoot 下放 Background Sprite（房間底圖）
3. 建立 Walls 容器，在裡面逐一建立牆壁碰撞節點（group="wall" + BoxCollider）
4. 建立 Doors 容器，建立門觸發節點（group="door" + BoxCollider + DoorTrigger）
5. 建立 Interactables 容器，放線索物件和 NPC
6. 存成 Prefab 到 `assets/resources/prefabs/rooms/`

房間大小可以不同：

| 房間 | 建議像素大小 | 風格 |
|------|-------------|------|
| 走廊 | 960 × 320 | 長條型 |
| 實驗室 | 640 × 480 | 方形，有桌椅 |
| 伺服器室 | 480 × 480 | 小房間，密集機櫃 |

### Step 3：在 RoomRegistry.ts 註冊

每個房間加入 `ROOM_REGISTRY`，門的連接必須**雙向定義**：

```typescript
// 如果 A 的 door_1a 連到 B 的 door_1b，
// 那 B 的 door_1b 也要連回 A 的 door_1a

["Room_temp_1", {
    roomId: "Room_temp_1",
    prefabPath: "prefabs/rooms/Room_temp_1",
    initialRoom: true,
    doors: [
        { doorId: "door_1a", connectsTo: { roomId: "Room_temp_2", doorId: "door_1b" } }
    ],
}],
["Room_temp_2", {
    roomId: "Room_temp_2",
    prefabPath: "prefabs/rooms/Room_temp_2",
    doors: [
        { doorId: "door_1b", connectsTo: { roomId: "Room_temp_1", doorId: "door_1a" } }
    ],
}],
```

### 新增房間的 Checklist

- [ ] 在編輯器中建好房間節點樹（Background, Walls, Doors, Interactables）
- [ ] RoomRoot 掛 RoomController，設定正確的 roomWidth / roomHeight
- [ ] 初始房間的 RoomRoot 下加一個空節點命名為 `SpawnPoint`，放在玩家出生位置
- [ ] 牆壁節點的 group = "wall"，BoxCollider size 覆蓋牆壁
- [ ] 門節點的 group = "door"，DoorTrigger 的 doorId 與 Registry 一致
- [ ] 門節點的 DoorTrigger.spawnOffsetX/Y 設定正確（玩家進門後相對門的偏移）
- [ ] 存成 Prefab 到 `resources/prefabs/rooms/`，路徑吻合 Registry 的 prefabPath
- [ ] 在 `RoomRegistry.ts` 加入房間定義和雙向門連接
- [ ] Preview 測試：能走進門並正確切換

---

## 互動物件與線索系統

### 基底元件：Interactable

掛在帶 `cc.BoxCollider`（group = "interactable"）的節點上。所有可互動物件（ClueObject、DialogueInteractable 等）都繼承此類。

#### Inspector 屬性

| 屬性 | 型別 | 說明 |
|------|------|------|
| `Interactable Id` | string | 唯一識別碼（非必填，供通用事件使用） |
| `Prompt Text` | string | 靠近時顯示的提示文字，預設 `"Press E to interact"` |
| `Reusable` | boolean | 勾選 = 可重複互動（預設）；取消勾選 = 互動完成後銷毀節點 |

#### 行為流程

```
玩家進入碰撞範圍
    │
    ▼
Toast 常駐顯示 promptText（透過 EventBus "ui:interaction-prompt"）
    │
    ▼  玩家按 E
onInteract()（子類覆寫）
    │
    ├── reusable = true  → 不做額外處理，可再次互動
    └── reusable = false → 清除提示 + this.node.destroy()
    │
    ▼  玩家離開碰撞範圍
Toast 隱藏提示（emit null）
```

#### 對話中的行為

Interactable 監聽 `dialogue:start` / `dialogue:end` 事件。對話進行中：
- 按 E 無反應（`dialoguePlaying` 旗標阻擋）
- 靠近提示仍會顯示（碰撞偵測不受影響），但無法觸發互動

#### 繼承此類的子類

| 子類 | 用途 |
|------|------|
| `ClueObject` | 撿起線索物件，可選觸發對話 |
| `DialogueInteractable` | 按 E 觸發對話（NPC、告示牌等） |

### 線索物件：ClueObject

繼承 Interactable。撿起時收集線索到 GameState，並可選擇觸發一段對話。

#### Inspector 屬性（含繼承）

| 屬性 | 型別 | 說明 | 範例 |
|------|------|------|------|
| `Prompt Text`（繼承） | string | 靠近提示 | `按 E 撿起文件` |
| `Reusable`（繼承） | boolean | 線索物品通常取消勾選 | `false` |
| `Clue Id` | string | 線索唯一識別碼 | `graph-note-01` |
| `Clue Text` | string | 線索內容文字 | `這張圖沒有負權重…` |
| `Clue Category` | string | 分類標籤 | `puzzle-hint` |
| `Dialogue Id` | string | 撿起後觸發的對話 ID（留空 = 不觸發） | `item-keycard` |

#### 互動流程

```
玩家按 E 互動
    │
    ├── 已收集過 → 直接 return
    │
    ▼
GameState.collectClue({ clueId, text, category })
    │ 存入 Map<string, ClueEntry>
    │ 發出 "clue:collected" 事件
    │
    ▼
EventBus.emit("ui:show-clue", ...)
    │
    ▼
物件淡出（opacity → 80）
    │
    ├── dialogueId 有值 → DialogueManager.play(dialogueId)
    │                      對話開始 → 玩家凍結、UI 鎖定
    │
    └── reusable = false → 節點銷毀
```

### 線索資料流

```
ClueObject (Inspector 填資料)
    │ 玩家按 E 互動
    ▼
GameState.collectClue({ clueId, text, category })
    │ 存入 Map<string, ClueEntry>
    │ 發出 "clue:collected" 事件
    ▼
NotebookPanel.refreshDisplay()
    │ 從 GameState.getAllClues() 讀取所有已收集線索
    ▼
顯示 [category] text 列表
```

`GameState` 是唯一的資料來源（single source of truth）。NotebookPanel 不自己存資料，每次開啟時都從 GameState 讀取。

### 新增互動物件的 Checklist

- [ ] 建立空節點，group 設為 `interactable`
- [ ] 加入 `cc.BoxCollider`，調整 size 為互動觸發範圍
- [ ] 加入對應腳本（ClueObject / DialogueInteractable / 自訂 Interactable 子類）
- [ ] 填寫 Inspector 屬性（promptText、clueId 等）
- [ ] 一次性物品取消勾選 `Reusable`
- [ ] 如需撿起後觸發對話，填入 `Dialogue Id` 並確認 JSON 存在
- [ ] 可加子 Sprite 顯示物件圖案

---

## 對話系統

視覺小說風格的對話系統，支援多種觸發方式和對話結束後的狀態變更。對話進行中會凍結玩家移動、禁止互動、鎖定筆記面板。

### 相關腳本

| 腳本 | 位置 | 職責 |
|------|------|------|
| `DialogueData.ts` | `scripts/dialogue/` | 純介面定義（DialogueLine, DialogueAction, DialogueSequence） |
| `DialogueManager.ts` | `scripts/dialogue/` | Singleton，載入 JSON、檢查條件、驅動面板、執行結束動作 |
| `DialoguePanel.ts` | `scripts/dialogue/` | UI：姓名欄、文字區、左右立繪（說話者亮、不說話者暗） |
| `DialogueTrigger.ts` | `scripts/dialogue/` | 區域觸發器，支援自動觸發 / 按 E 觸發 |
| `DialogueInteractable.ts` | `scripts/dialogue/` | 繼承 Interactable，按 E 開始對話（用於 NPC、告示牌等） |

### 對話資料格式

對話用 JSON 檔案存放在 `resources/dialogues/`，runtime 透過 `cc.resources.load` 載入。

```jsonc
{
  "id": "intro-room1",
  "lines": [
    {
      "speaker": "教授",
      "text": "歡迎來到台達館...",
      "portraitLeft": "portraits/playerA/1",   // resources/ 相對路徑，null = 不顯示
      "portraitRight": "portraits/playerB/3",
      "activeSide": "left"                      // "left" | "right" | "none"
    }
  ],
  "onComplete": [
    { "type": "setFlag", "flag": "intro-seen" },
    { "type": "unlockDoor", "doorId": "door-to-lab" },
    { "type": "collectClue", "clueId": "hint-01", "text": "...", "category": "main-quest" },
    { "type": "emitEvent", "event": "ui:toast", "data": "獲得了新的線索" }
  ],
  "conditions": {
    "requireFlags": [],            // 需要這些 flag 才觸發
    "excludeFlags": ["intro-seen"] // 有這些 flag 就不觸發
  }
}
```

#### DialogueLine 欄位

| 欄位 | 型別 | 說明 |
|------|------|------|
| `speaker` | string | 姓名欄顯示的角色名稱 |
| `text` | string | 對話文字內容 |
| `portraitLeft` | string \| null | 左側立繪路徑（`resources/` 相對路徑，不含副檔名），null = 隱藏 |
| `portraitRight` | string \| null | 右側立繪路徑，同上 |
| `activeSide` | `"left"` \| `"right"` \| `"none"` | 目前說話者在哪一側 |

#### onComplete Action 類型

| type | 必填欄位 | 說明 |
|------|---------|------|
| `setFlag` | `flag` | 設定遊戲進度旗標 |
| `unlockDoor` | `doorId` | 解鎖指定門 |
| `lockDoor` | `doorId` | 鎖定指定門 |
| `collectClue` | `clueId`, `text`, `category` | 收集線索到 GameState |
| `emitEvent` | `event`, `data`（選填） | 發出自訂事件（如 `ui:toast`） |

#### conditions 欄位

| 欄位 | 說明 |
|------|------|
| `requireFlags` | 必須擁有這些 flag 才會觸發對話（空陣列 = 無條件） |
| `excludeFlags` | 擁有任一 flag 就不觸發（常用於防止重複觸發） |

### 立繪資源

立繪圖片放在 `assets/resources/portraits/` 下，按角色分資料夾：

```
resources/portraits/
  playerA/          ← 眼鏡角色
    1.PNG           ← 表情 1（普通）
    2.PNG           ← 表情 2
    3.PNG
    4.PNG           ← 表情 4（嚴肅）
  playerB/          ← 藍外套角色
    1.PNG           ← 表情 1（驚訝）
    2.PNG           ← 表情 2（笑）
    3.PNG           ← 表情 3（普通）
    4.PNG           ← 表情 4（普通）
    5.PNG           ← 表情 5（笑）
```

JSON 裡的路徑對應：`"portraits/playerA/1"` → 載入 `resources/portraits/playerA/1.PNG`。

新增角色時，在 `resources/portraits/` 下建新資料夾，放入立繪圖片即可。原始素材也保留在 `Art/Portraits/` 下。

### 觸發方式

| 方式 | 使用元件 | 設定 |
|------|---------|------|
| 進入房間自動觸發 | `DialogueTrigger` | 放在 SpawnPoint 旁，`autoTrigger = true`, `oneShot = true` |
| 碰到區域觸發 | `DialogueTrigger` | 放在指定位置，`autoTrigger = true` |
| 按 E 互動觸發 | `DialogueInteractable` | 掛在 NPC / 物品節點上（group = "interactable"） |
| 碰到區域按 E | `DialogueTrigger` | `autoTrigger = false`，會顯示 promptText 提示 |
| 撿起物品後觸發 | `ClueObject` | 填寫 `Dialogue Id` 欄位 |

#### DialogueTrigger Inspector 屬性

| 屬性 | 型別 | 說明 |
|------|------|------|
| `Dialogue Id` | string | 要觸發的對話 JSON id（對應 `resources/dialogues/` 下的檔名） |
| `Auto Trigger` | boolean | true = 碰到就觸發，false = 顯示提示按 E 觸發 |
| `One Shot` | boolean | true = 只觸發一次（runtime 記憶） |
| `Prompt Text` | string | `autoTrigger = false` 時顯示的提示文字 |

#### DialogueInteractable Inspector 屬性

| 屬性 | 型別 | 說明 |
|------|------|------|
| `Dialogue Id` | string | 要觸發的對話 JSON id |
| （繼承 Interactable 屬性） | | `Prompt Text`、`Reusable` 等 |

### 對話流程

```
觸發對話 → DialogueManager.play(dialogueId)
    │  cc.resources.load("dialogues/" + id)（有快取機制）
    │  檢查 conditions（requireFlags / excludeFlags）
    │  不符合 → return，不觸發
    ▼
dialogue:start 事件
    ├── PlayerController 凍結移動（frozen = true）
    ├── Interactable 禁止 E 鍵互動（dialoguePlaying = true）
    └── NotebookPanel 鎖定（dialogueLocked = true，若已打開則自動關閉）
    │
    ▼
DialoguePanel 顯示第一行（姓名、文字、立繪）
    │
    ▼  Space / Enter / 點擊畫面
advance() → 下一行...（更新文字、切換表情和立繪明暗）
    │
    ▼  最後一行之後
endDialogue()
    ├── DialoguePanel.hide()
    ├── 逐一執行 onComplete actions
    │    setFlag     → GameState.setFlag()
    │    unlockDoor  → GameState.unlockDoor()
    │    lockDoor    → GameState.lockDoor()
    │    collectClue → GameState.collectClue()
    │    emitEvent   → EventBus.emit()
    └── dialogue:end 事件
         ├── PlayerController 解凍
         ├── Interactable 恢復互動
         └── NotebookPanel 解鎖
```

### 對話中的全域影響

對話系統透過 EventBus 事件（`dialogue:start` / `dialogue:end`）通知所有相關系統。以下元件會響應：

| 元件 | dialogue:start | dialogue:end |
|------|---------------|-------------|
| `PlayerController` | `frozen = true`，WASD 無效 | 恢復移動 |
| `Interactable`（及所有子類） | `dialoguePlaying = true`，E 鍵無效 | 恢復互動 |
| `NotebookPanel` | `dialogueLocked = true`，Tab/按鈕無效，已開啟則關閉 | 解鎖 |

新增需要在對話中暫停的系統時，只需監聽這兩個事件即可。

### 立繪顯示規則

- `activeSide = "left"` → 左立繪 opacity 255、右立繪 opacity 100
- `activeSide = "right"` → 反過來
- `activeSide = "none"` → 兩邊都 dim（旁白模式）
- `portraitLeft / Right = null` → 該側立繪 `node.active = false`（隱藏）

同一段對話中可以逐行切換表情和說話者，只要在每個 `DialogueLine` 中指定不同的 portrait 路徑和 activeSide。

### DialoguePanel 節點結構

```
DialoguePanel (group="ui", 掛 DialoguePanel.ts)
    └── PanelRoot                  panelRoot（active 控制整體顯隱）
         ├── PanelBG               cc.Sprite（半透明黑底，螢幕下方 ~1/3）
         ├── NameLabel             cc.Label（說話者姓名，左上角）
         ├── TextLabel             cc.Label（對話內容，自動換行）
         ├── PortraitLeft          cc.Sprite（左側立繪，螢幕左下）
         └── PortraitRight         cc.Sprite（右側立繪，螢幕右下）
```

DialoguePanel.ts Inspector 接線：

| 屬性 | 拖入 |
|------|------|
| `panelRoot` | PanelRoot 節點 |
| `nameLabel` | NameLabel 上的 cc.Label |
| `textLabel` | TextLabel 上的 cc.Label |
| `portraitLeft` | PortraitLeft 上的 cc.Sprite |
| `portraitRight` | PortraitRight 上的 cc.Sprite |

DialogueManager 節點是 UICanvas 下的獨立空節點，Inspector 的 `panel` 屬性拖入 DialoguePanel 節點。

### 遊戲狀態 Flags

`GameState` 的 `flags: Set<string>` 用於追蹤遊戲進度：

```typescript
GameState.instance.setFlag("intro-seen");    // 設定 flag
GameState.instance.hasFlag("intro-seen");    // 查詢 flag
```

Flags 不只對話使用，puzzle、ghost 等系統也可以查詢。對話的 conditions 機制基於 flags 運作。

### 新增對話的 Checklist

1. 在 `resources/dialogues/` 下建立 JSON 檔案，id 與檔名一致
2. 填寫 lines（speaker、text、portrait 路徑、activeSide）
3. 填寫 onComplete actions（需要什麼狀態變更）
4. 填寫 conditions（防重複觸發用 excludeFlags）
5. 在房間 Prefab 中建立觸發節點：
   - 區域觸發 → `DialogueTrigger`（group = "interactable" + BoxCollider）
   - NPC 互動 → `DialogueInteractable`（group = "interactable" + BoxCollider）
   - 物品撿起觸發 → `ClueObject` 填入 `Dialogue Id`
6. 如使用新立繪，放入 `resources/portraits/` 對應資料夾

---

## 陽台同步深蹲關卡

第三關使用 `assets/scripts/levels/Level3.ts` 管理 UI、MediaPipe、深蹲計數與後端同步。

### 節點接線

建議在 `UICanvas` 下建立 `Level3` 空節點並掛腳本：

| 屬性 | 用途 |
|------|------|
| `Api Base Url` | 後端 URL，預設 `http://localhost:8787` |
| `Room Id` / `Player Id` | 可由 Lobby 寫入 `localStorage`，或 demo 時在 Inspector 填入 |
| `Final Door Id` | 完成後呼叫 `GameState.unlockDoor()` 的門 ID，預設 `final-exit-door` |
| `Panel Root` | 第三關面板根節點 |
| `Status/Count/Peer/Sync Label` | 顯示偵測狀態、個人次數、隊友次數與同步提示 |
| `Start/Close Button` | 開始與關閉關卡 |
| `Fallback Controls` | debug/failure 時顯示的手動 +1 / Ready / Complete 控制 |

房間內的陽台互動物件可掛 `GestureLevelTrigger`，玩家按 E 後 emit `gesture-level:start` 開啟面板。

### MediaPipe 與 fallback

- `MediaPipePoseAdapter` 透過 CDN module script 載入 `@mediapipe/tasks-vision`，避免 Cocos 2.4 直接 import ESM。
- webcam 預覽與骨架點使用 DOM overlay 疊在 Cocos canvas 右上角，關卡關閉時會清除。
- `SquatDetector` 只吃 normalized landmarks，使用髖、膝、踝做 standing/down 狀態機。
- URL 帶 `?debugGesture=1`，或攝影機/模型載入失敗時，顯示 fallback controls，確保 demo 可以完成。
- 完成條件：每位玩家 5 次深蹲後，兩人 3 秒內同步蹲下 ready；後端完成 `level-03` 後解鎖逃生門。

---

## UI 系統

UI 節點放在 UICanvas 下，使用雙 Camera 架構（見上方）。**重要：UICanvas 和底下所有子節點的 group 都必須設為 `ui`**，否則會被 GameCamera 渲染（跟著玩家移動）。

### NotebookPanel（線索筆記本）

開啟方式（兩種）：
- **Tab 鍵**
- **UI 按鈕**：在 Inspector 的 `Toggle Button` 欄位拖入一個有 `cc.Button` 的節點（此按鈕必須放在 NotebookPanel 節點外面，因為 Panel 關閉時 `active = false` 會隱藏所有子節點）

開啟時從 `GameState.getAllClues()` 讀取並顯示所有已收集線索。

**對話中的行為**：監聽 `dialogue:start` / `dialogue:end` 事件。對話進行中 Tab 鍵和按鈕都被阻擋（`dialogueLocked = true`）。如果對話開始時筆記本已打開，會自動關閉。

### Toast 提示

Toast 同時處理兩種顯示模式：

**模式 1：短暫提示（`ui:toast`）**

```typescript
EventBus.emit("ui:toast", "獲得門禁卡！");
```

淡入 → 停留 `displayDuration` 秒（預設 2 秒）→ 淡出。用於：
- 對話結束後的成果提示
- 走到鎖住的門 → 「This door is locked.」
- 任何需要即時回饋但不值得開面板的場合

**模式 2：常駐提示（`ui:interaction-prompt`）**

```typescript
EventBus.emit("ui:interaction-prompt", "按 E 撿起文件");  // 顯示
EventBus.emit("ui:interaction-prompt", null);              // 隱藏
```

玩家靠近可互動物件時淡入並常駐，離開時淡出。由 Interactable 的 `onCollisionEnter` / `onCollisionExit` 自動管理。

兩種模式共用同一個 Toast 節點和 Label，不需要額外的 UI 元件。
