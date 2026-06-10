# Frontend Architecture: Game Scene

本文件說明 Game 場景的節點結構、碰撞系統、房間管理與地圖設計流程。

引擎版本：**Cocos Creator 2.4.8**。所有 API 和寫法以此版本為準。

---

## 目錄

1. [場景節點結構](#場景節點結構)
2. [雙 Camera 架構](#雙-camera-架構)
3. [碰撞系統](#碰撞系統)
4. [玩家移動](#玩家移動)
5. [房間製作方式](#房間製作方式)
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
1. 建立空節點，命名必須與 `RoomRegistry.ts` 中的 `doorId` 一致（如 `door-to-2f`）
2. Group 設為 `door`
3. 加入 `cc.BoxCollider`，size 設為門口大小（如 `64 × 48`）
4. 加入 `DoorTrigger` 腳本
   - `Door Id` 填入與節點同名的 doorId
   - `Spawn Point` 設為進入此門時玩家應出現的座標（相對於房間原點）

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
    ├── ③ 把 Player 移動到目標門的 spawnPoint 位置
    │
    └── ④ EventBus.emit("room:changed") → CameraFollow 更新房間邊界
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
// 如果 A 的 door-x 連到 B 的 door-y，
// 那 B 的 door-y 也要連回 A 的 door-x

["room-a", {
    doors: [{ doorId: "door-x", connectsTo: { roomId: "room-b", doorId: "door-y" } }]
}],
["room-b", {
    doors: [{ doorId: "door-y", connectsTo: { roomId: "room-a", doorId: "door-x" } }]
}],
```

### 新增房間的 Checklist

- [ ] 在編輯器中建好房間節點樹（Background, Walls, Doors, Interactables）
- [ ] RoomRoot 掛 RoomController，設定正確的 roomWidth / roomHeight
- [ ] 牆壁節點的 group = "wall"，BoxCollider size 覆蓋牆壁
- [ ] 門節點的 group = "door"，DoorTrigger 的 doorId 與 Registry 一致
- [ ] 門節點的 DoorTrigger.spawnPoint 設定正確（玩家進門後出現的位置）
- [ ] 存成 Prefab 到 `resources/prefabs/rooms/`，路徑吻合 Registry 的 prefabPath
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
