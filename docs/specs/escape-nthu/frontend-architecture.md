# Frontend Architecture: Game Scene

本文件說明 Game 場景的節點結構、碰撞系統、房間管理與地圖設計流程。

引擎版本：**Cocos Creator 2.4.8**。所有 API 和寫法以此版本為準。

---

## 目錄

1. [場景節點結構](#場景節點結構)
2. [雙 Camera 架構](#雙-camera-架構)
3. [碰撞系統](#碰撞系統)
4. [玩家移動](#玩家移動)
5. [Tilemap 地圖製作](#tilemap-地圖製作)
6. [房間管理與切換](#房間管理與切換)
7. [地圖格局設計指南](#地圖格局設計指南)
8. [互動物件](#互動物件)

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
     ├── GameState                  GameState（線索/門鎖狀態 singleton）
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

## Tilemap 地圖製作

每個房間是一個獨立的 `.tmx` 檔案，用 [Tiled 編輯器](https://www.mapeditor.org/) 製作。

### 基本設定

- Orientation: Orthogonal
- Tile Size: 32 × 32 px
- Render Order: Right Down

### 圖層規劃

每個 TMX 必須包含以下圖層（由下到上）：

| 圖層名         | 類型          | 說明 |
|----------------|--------------|------|
| `ground`       | Tile Layer   | 地板渲染（走廊、地磚、地毯） |
| `walls`        | Tile Layer   | 牆壁渲染 |
| `decoration`   | Tile Layer   | 裝飾物（海報、書架、管線），不影響碰撞 |
| `collision`    | Object Layer | 矩形物件，標記不可通行區域 |
| `doors`        | Object Layer | 矩形物件，標記門/出口觸發區 |
| `interactables`| Object Layer | 點或矩形，標記線索物件和 NPC 位置 |
| `spawn`        | Object Layer | 點物件，標記玩家出生位置 |

### collision 圖層

放置矩形物件覆蓋所有牆壁區域。`RoomController` 會在 runtime 讀取這些矩形，為每個矩形建立一個帶 `cc.BoxCollider` 的節點（group = "wall"）。

> Tiled 座標系 Y 軸向下，Cocos Y 軸向上。`RoomController` 會自動轉換：
> `cocosY = mapPixelHeight - tiledY - objectHeight`

### doors 圖層

每個門是一個矩形物件：
- **name**：doorId，對應 `RoomRegistry.ts` 中的定義（例如 `door-to-2f`）
- **自訂屬性**（Custom Properties）：
  - `spawnX` (int)：進門後玩家 X 座標（可選，預設為門的中心）
  - `spawnY` (int)：進門後玩家 Y 座標（可選，Tiled 座標系）

### interactables 圖層

每個互動物件是一個矩形或點物件：
- **name**：物件識別名
- **自訂屬性**：
  - `type` (string)：`"clue"` / `"npc"` / `"terminal"`
  - `clueId` (string)：線索 ID
  - `clueText` (string)：線索描述文字
  - `category` (string)：分類（`algorithm` / `general` / `ai-hint`）

---

## 房間管理與切換

### 核心概念

大地圖由多個獨立房間組成。每個房間是一個 Prefab（內含 TiledMap + RoomController）。所有房間共存於同一個 Game 場景中，透過 `node.active` 切換顯示。

### 相關腳本

| 腳本 | 職責 |
|------|------|
| `RoomRegistry.ts` | 靜態資料：所有房間的定義和門的連接關係 |
| `RoomManager.ts` | 載入/快取/切換房間 prefab，定位玩家 |
| `RoomController.ts` | 解析 TMX 的 collision 和 doors 圖層，建立碰撞節點 |
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
    ├── ③ 把 Player 移動到目標門的 spawnPoint 位置
    │
    └── ④ EventBus.emit("room:changed") → CameraFollow 更新地圖邊界
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

```
                    ┌──────────────────┐
                    │ delta-2f-hallway │
                    └───────┬──────────┘
                     door-from-1f / door-to-server
                            │                    \
                    door-to-2f                 door-from-2f
                            │                      \
┌──────────────────┐        │         ┌──────────────────┐
│  delta-lab-301   │◄───────┤         │  cs-server-room  │
└──────────────────┘        │         └──────────────────┘
  door-from-hallway  door-to-lab
                            │
                    ┌───────┴──────────┐
                    │ delta-1f-hallway │  ← 初始房間
                    └──────────────────┘
```

先決定：
- 有幾個房間
- 哪些門連哪些門
- 哪些門需要鑰匙（解謎後）才能開

### Step 2：為每個房間建立 TMX

在 Tiled 編輯器中，每個房間獨立一個 `.tmx` 檔。房間大小可以不同：

| 房間 | 建議 Tile 大小 | 風格 |
|------|---------------|------|
| 走廊 | 30 × 10 | 長條型 |
| 實驗室 | 20 × 15 | 方形，有桌椅 |
| 伺服器室 | 15 × 15 | 小房間，密集機櫃 |

確保每個 TMX 都有完整的圖層（ground, walls, decoration, collision, doors, spawn）。

### Step 3：在 RoomRegistry.ts 註冊

每個房間加入 `ROOM_REGISTRY`，門的連接必須**雙向定義**：

```typescript
// 如果 A 的 door-x 連到 B 的 door-y，
// 那 B 的 door-y 也要連回 A 的 door-x

["room-a", {
    doors: [{ doorId: "door-x", connectsTo: { roomId: "room-b", doorId: "door-y" } }]
}],
["room-b", {
    doors: [{ doorId: "door-y", connectsTo: { roomId: "room-a", doorId: "door-x" } }]
}],
```

### Step 4：建立 Prefab

1. 在 Cocos 場景中建節點，掛 `cc.TiledMap`（指定 .tmx）+ `RoomController`
2. 存成 Prefab 到 `assets/resources/prefabs/rooms/`
3. Prefab 名稱和路徑必須吻合 `RoomRegistry.ts` 中的 `prefabPath`

### 新增房間的 Checklist

- [ ] Tiled 中建好 .tmx，放到 `assets/maps/`
- [ ] collision 圖層覆蓋所有牆壁
- [ ] doors 圖層的每扇門 name 與 Registry doorId 一致
- [ ] 在 Cocos 編輯器中建 prefab，存到 `resources/prefabs/rooms/`
- [ ] 在 `RoomRegistry.ts` 加入房間定義和雙向門連接
- [ ] Preview 測試：能走進門並正確切換

---

## 互動物件

### 基底元件：Interactable

掛在帶 `cc.BoxCollider`（group = "interactable"）的節點上。行為：

1. 玩家進入碰撞範圍 → 畫面顯示提示文字（「按 E 互動」）
2. 玩家按 E 鍵 → 觸發 `onInteract()`（子類覆寫）
3. 玩家離開範圍 → 提示消失

### 線索物件：ClueObject

繼承 Interactable，互動時：
1. 呼叫 `GameState.collectClue(clueId)`
2. 發出 `"ui:show-clue"` 事件（NotebookPanel 接收並記錄）
3. 物件淡出（opacity 降低），表示已撿取

### Toast 提示

畫面下方短暫顯示一行文字（2 秒後自動消失）。用途：
- 走到鎖住的門 → 「這扇門被鎖住了」
- 撿到線索 → 「獲得線索：圖論筆記」
- 任何需要即時回饋但不值得開面板的場合
