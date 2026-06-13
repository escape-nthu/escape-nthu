import EventBus from "../core/EventBus";
import RoomManager from "../map/RoomManager";
import RoomController from "../map/RoomController";
import DoorTrigger from "../map/DoorTrigger";
import { ROOM_REGISTRY } from "../map/RoomRegistry";
import { NavGrid } from "./AStar";
import { buildGridFromRoom } from "./GridBuilder";
import GhostController from "./GhostController";
import AudioManager from "./AudioManager";
import GameState from "../core/GameState";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GhostChaseManager extends cc.Component {

    static instance: GhostChaseManager = null;

    @property({ tooltip: "遊戲開始後最短幾秒出現鬼" })
    minInitialDelay: number = 30;

    @property({ tooltip: "遊戲開始後最長幾秒出現鬼" })
    maxInitialDelay: number = 60;

    @property({ tooltip: "追逐結束後最短冷卻 (秒)" })
    minCooldown: number = 45;

    @property({ tooltip: "追逐結束後最長冷卻 (秒)" })
    maxCooldown: number = 90;

    @property({ tooltip: "單次追逐最長持續時間 (秒)" })
    maxChaseDuration: number = 20;

    @property({ tooltip: "鬼最多跟過幾個房間就放棄" })
    maxChaseRooms: number = 3;

    @property({ tooltip: "整場遊戲最多幾次追逐" })
    maxTotalChases: number = 3;

    @property({ tooltip: "跨房延遲 = 距離 × 此值 (秒/px)" })
    crossRoomDelayPerPixel: number = 0.003;

    @property({ tooltip: "跨房最短延遲 (秒)" })
    minCrossRoomDelay: number = 1.5;

    @property({ tooltip: "跨房最長延遲 (秒)" })
    maxCrossRoomDelay: number = 5.0;

    @property({ type: cc.Node, tooltip: "場景中的 Ghost 節點（需有 Sprite + BoxCollider + GhostController）" })
    ghostNodeRef: cc.Node = null;

    @property({ tooltip: "追逐 BGM 路徑 (resources/)" })
    chaseBgmPath: string = "audio/chase_bgm";

    @property({ type: cc.Node, tooltip: "Game Over 全屏遮罩節點" })
    gameOverOverlay: cc.Node = null;

    @property({ type: cc.Label, tooltip: "Game Over 文字 Label" })
    gameOverLabel: cc.Label = null;

    @property({ tooltip: "復活後多久再次允許鬼追逐 (秒)" })
    respawnGraceSeconds: number = 8;

    private ghostNode: cc.Node = null;
    private ghostCtrl: GhostController = null;
    private chaseActive: boolean = false;
    private totalChaseCount: number = 0;
    private currentChaseRoomCount: number = 0;
    private chaseDurationTimer: number = 0;
    private gridCache: Map<string, NavGrid> = new Map();
    private ghostRoomId: string = "";
    private ghostLastPos: cc.Vec2 = cc.v2(0, 0);
    private pendingSpawnCallback: Function | null = null;
    private nextChaseCallback: Function | null = null;
    private chaseEnabled: boolean = false;
    private gameOver: boolean = false;
    private respawnButtonNode: cc.Node | null = null;

    onLoad() {
        if (GhostChaseManager.instance) {
            this.node.destroy();
            return;
        }
        GhostChaseManager.instance = this;

        EventBus.on("room:changed", this.onRoomChanged, this);
        EventBus.on("ghost:caught", this.onGhostCaught, this);
        EventBus.on("ghost:hit-by-riceball", this.onGhostHitByRiceBall, this);
        EventBus.on("network:room-connected", this.onRoomConnected, this);
        EventBus.on("network:socket-open", this.onRoomConnected, this);
        EventBus.on("network:room-error", this.onRoomUnavailable, this);
        EventBus.on("network:socket-closed", this.onRoomUnavailable, this);

        if (this.ghostNodeRef) this.ghostNodeRef.active = false;
        if (this.gameOverOverlay) this.gameOverOverlay.active = false;
    }

    onDestroy() {
        EventBus.off("room:changed", this.onRoomChanged, this);
        EventBus.off("ghost:caught", this.onGhostCaught, this);
        EventBus.off("ghost:hit-by-riceball", this.onGhostHitByRiceBall, this);
        EventBus.off("network:room-connected", this.onRoomConnected, this);
        EventBus.off("network:socket-open", this.onRoomConnected, this);
        EventBus.off("network:room-error", this.onRoomUnavailable, this);
        EventBus.off("network:socket-closed", this.onRoomUnavailable, this);
    }

    update(dt: number) {
        if (!this.chaseActive || this.gameOver) return;

        this.chaseDurationTimer += dt;
        if (this.chaseDurationTimer >= this.maxChaseDuration) {
            this.endChase();
        }
    }

    private startChase(): void {
        if (!this.chaseEnabled) return;
        if (this.gameOver) return;
        if (this.totalChaseCount >= this.maxTotalChases) return;

        const rm = RoomManager.instance;
        if (!rm) return;

        const roomId = rm.getCurrentRoomId();
        const roomNode = rm.getLoadedRoom(roomId);
        if (!roomNode) return;

        const spawnDoor = this.pickFarthestDoor(roomId, roomNode, rm.localPlayer);
        if (!spawnDoor) return;

        this.totalChaseCount++;
        this.chaseActive = true;
        this.chaseDurationTimer = 0;
        this.currentChaseRoomCount = 0;
        this.ghostRoomId = roomId;

        const grid = this.getOrBuildGrid(roomId, roomNode);

        if (!this.ghostNode) {
            if (!this.ghostNodeRef) {
                cc.error("[GhostChaseManager] ghostNodeRef not set in Inspector");
                this.chaseActive = false;
                return;
            }
            this.ghostNode = this.ghostNodeRef;
            this.ghostCtrl = this.ghostNode.getComponent(GhostController);
            if (!this.ghostCtrl) {
                cc.error("[GhostChaseManager] Ghost node missing GhostController component");
                this.chaseActive = false;
                return;
            }
        }

        this.ghostNode.parent = rm.node;
        this.ghostCtrl.setGrid(grid);
        this.ghostCtrl.setTarget(rm.localPlayer);
        this.ghostCtrl.spawn(spawnDoor.position);

        EventBus.emit("chase:start");

        const audio = AudioManager.instance;
        if (audio) audio.playBGM(this.chaseBgmPath);
    }

    private endChase(): void {
        if (!this.chaseActive) return;
        this.chaseActive = false;

        if (this.pendingSpawnCallback) {
            this.unschedule(this.pendingSpawnCallback as any);
            this.pendingSpawnCallback = null;
        }

        if (this.ghostCtrl) {
            this.ghostCtrl.despawn();
        }

        EventBus.emit("chase:end");

        const audio = AudioManager.instance;
        if (audio) audio.fadeOutBGM(1.0);

        if (this.chaseEnabled && this.totalChaseCount < this.maxTotalChases) {
            this.scheduleNextChase(this.randomDelay(this.minCooldown, this.maxCooldown));
        }
    }

    private onRoomConnected(): void {
        if (this.gameOver || this.chaseEnabled) return;
        this.chaseEnabled = true;
        this.scheduleNextChase(this.randomDelay(this.minInitialDelay, this.maxInitialDelay));
    }

    private onRoomUnavailable(): void {
        this.chaseEnabled = false;
        this.clearNextChase();
        this.endChase();
    }

    private scheduleNextChase(delay: number): void {
        this.clearNextChase();
        const cb = () => {
            this.nextChaseCallback = null;
            this.startChase();
        };
        this.nextChaseCallback = cb;
        this.scheduleOnce(cb, delay);
    }

    private clearNextChase(): void {
        if (!this.nextChaseCallback) return;
        this.unschedule(this.nextChaseCallback as any);
        this.nextChaseCallback = null;
    }

    private randomDelay(min: number, max: number): number {
        return min + Math.random() * Math.max(0, max - min);
    }

    private onRoomChanged(newRoomId: string): void {
        if (!this.chaseActive || this.gameOver) return;
        if (newRoomId === this.ghostRoomId) return;

        this.currentChaseRoomCount++;

        if (this.currentChaseRoomCount >= this.maxChaseRooms) {
            this.endChase();
            return;
        }

        // Record ghost position before hiding (for delay calculation)
        if (this.ghostNode) {
            this.ghostLastPos = cc.v2(this.ghostNode.x, this.ghostNode.y);
        }

        if (this.ghostCtrl) {
            this.ghostCtrl.hide();
        }

        // Find which door connects old room to new room
        const arrivalDoorId = this.findArrivalDoorByRoom(this.ghostRoomId, newRoomId);
        const oldRoomId = this.ghostRoomId;
        this.ghostRoomId = newRoomId;

        // Calculate delay from ghost-to-player distance at moment of room change
        const rm = RoomManager.instance;
        let dist = 300;
        if (rm && rm.localPlayer) {
            const dx = rm.localPlayer.x - this.ghostLastPos.x;
            const dy = rm.localPlayer.y - this.ghostLastPos.y;
            dist = Math.sqrt(dx * dx + dy * dy);
        }
        const rawDelay = dist * this.crossRoomDelayPerPixel;
        const delay = Math.max(this.minCrossRoomDelay, Math.min(this.maxCrossRoomDelay, rawDelay));

        cc.log("[GhostChaseManager] room changed %s→%s, dist=%.0f, delay=%.1f, arrivalDoor=%s",
            oldRoomId, newRoomId, dist, delay, arrivalDoorId);

        if (this.pendingSpawnCallback) {
            this.unschedule(this.pendingSpawnCallback as any);
        }

        const cb = () => {
            this.pendingSpawnCallback = null;
            this.spawnGhostInRoom(newRoomId, arrivalDoorId);
        };
        this.pendingSpawnCallback = cb;
        this.scheduleOnce(cb, delay);
    }

    private spawnGhostInRoom(roomId: string, doorId: string): void {
        if (!this.chaseActive || this.gameOver) return;

        const rm = RoomManager.instance;
        if (!rm) return;

        if (rm.getCurrentRoomId() !== roomId) {
            this.endChase();
            return;
        }

        const roomNode = rm.getLoadedRoom(roomId);
        if (!roomNode) return;

        const grid = this.getOrBuildGrid(roomId, roomNode);
        const doorPos = this.getDoorPosition(roomNode, doorId);
        if (!doorPos) return;

        this.ghostCtrl.setGrid(grid);
        this.ghostCtrl.setTarget(rm.localPlayer);
        this.ghostCtrl.spawn(doorPos);
    }

    private onGhostHitByRiceBall(): void {
        if (!this.chaseActive || this.gameOver) return;
        const audio = AudioManager.instance;
        if (audio) audio.playSFX("audio/ghost_dissipate");
        this.endChase();
    }

    private onGhostCaught(): void {
        if (this.gameOver) return;
        this.gameOver = true;
        this.chaseActive = false;
        this.clearNextChase();
        if (this.pendingSpawnCallback) {
            this.unschedule(this.pendingSpawnCallback as any);
            this.pendingSpawnCallback = null;
        }

        const audio = AudioManager.instance;
        if (audio) audio.stopBGM();

        EventBus.emit("chase:end");
        if (this.ghostCtrl) this.ghostCtrl.despawn();

        const overlay = this.ensureGameOverOverlay();
        if (!overlay) return;

        overlay.active = true;
        overlay.opacity = 0;
        overlay.color = cc.Color.RED;

        if (this.gameOverLabel) {
            this.gameOverLabel.string = "GAME OVER";
        }

        this.ensureRespawnButton(overlay);
        cc.tween(overlay)
            .to(0.3, { opacity: 210 })
            .to(0.5, { opacity: 245, color: cc.Color.BLACK })
            .start();
    }

    private respawnPlayer = (): void => {
        if (!this.gameOver) return;

        cc.Tween.stopAllByTarget(this.gameOverOverlay);
        this.gameOver = false;
        this.chaseActive = false;
        this.chaseDurationTimer = 0;
        this.currentChaseRoomCount = 0;

        if (this.ghostCtrl) {
            this.ghostCtrl.despawn();
        } else if (this.ghostNodeRef) {
            this.ghostNodeRef.active = false;
        }

        if (this.gameOverOverlay) {
            this.gameOverOverlay.active = false;
        }

        this.movePlayerToCurrentRoomSpawn();
        EventBus.emit("ui:toast", "已復活");

        if (this.chaseEnabled && this.totalChaseCount < this.maxTotalChases) {
            this.scheduleNextChase(Math.max(0, this.respawnGraceSeconds));
        }
    };

    private ensureGameOverOverlay(): cc.Node | null {
        if (this.gameOverOverlay) return this.gameOverOverlay;

        const parent = cc.find("UICanvas") || cc.director.getScene();
        if (!parent) return null;

        const overlay = new cc.Node("GameOverOverlay");
        overlay.parent = parent;
        overlay.group = "ui";
        overlay.zIndex = 1000;
        overlay.setContentSize(10000, 10000);
        overlay.setPosition(0, 0);

        const bg = overlay.addComponent(cc.Graphics);
        bg.fillColor = cc.color(0, 0, 0, 230);
        bg.roundRect(-5000, -5000, 10000, 10000, 0);
        bg.fill();

        const labelNode = new cc.Node("GameOverLabel");
        labelNode.parent = overlay;
        labelNode.group = "ui";
        labelNode.setPosition(0, 96);
        const label = labelNode.addComponent(cc.Label);
        label.string = "GAME OVER";
        label.fontSize = 54;
        label.lineHeight = 64;
        label.enableBold = true;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;
        label.node.color = cc.color(255, 240, 220);

        this.gameOverOverlay = overlay;
        this.gameOverLabel = label;
        return overlay;
    }

    private ensureRespawnButton(overlay: cc.Node): void {
        if (this.respawnButtonNode && this.respawnButtonNode.isValid) {
            this.respawnButtonNode.active = true;
            return;
        }

        const buttonNode = new cc.Node("RespawnButton");
        buttonNode.parent = overlay;
        buttonNode.group = "ui";
        buttonNode.setContentSize(220, 54);
        buttonNode.setPosition(0, -150);

        const gfx = buttonNode.addComponent(cc.Graphics);
        gfx.fillColor = cc.color(38, 138, 112, 255);
        gfx.roundRect(-110, -27, 220, 54, 8);
        gfx.fill();
        gfx.strokeColor = cc.color(190, 255, 226, 220);
        gfx.lineWidth = 2;
        gfx.roundRect(-110, -27, 220, 54, 8);
        gfx.stroke();

        const button = buttonNode.addComponent(cc.Button);
        button.transition = cc.Button.Transition.SCALE;
        button.zoomScale = 0.96;
        buttonNode.on(cc.Node.EventType.TOUCH_END, this.respawnPlayer, this);
        buttonNode.on("click", this.respawnPlayer, this);

        const labelNode = new cc.Node("RespawnButtonLabel");
        labelNode.parent = buttonNode;
        labelNode.group = "ui";
        labelNode.setPosition(0, 0);
        const label = labelNode.addComponent(cc.Label);
        label.string = "復活";
        label.fontSize = 24;
        label.lineHeight = 30;
        label.enableBold = true;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;
        label.node.color = cc.color(255, 255, 255);

        this.respawnButtonNode = buttonNode;
    }

    private movePlayerToCurrentRoomSpawn(): void {
        const rm = RoomManager.instance;
        if (!rm || !rm.localPlayer) return;

        const roomId = rm.getCurrentRoomId();
        const roomNode = rm.getLoadedRoom(roomId);
        if (!roomNode) return;

        const spawnNode = roomNode.getChildByName("SpawnPointA") || roomNode.getChildByName("SpawnPoint");
        if (spawnNode) {
            rm.localPlayer.setPosition(spawnNode.position);
            return;
        }

        const rc = roomNode.getComponent(RoomController);
        if (rc) {
            rm.localPlayer.setPosition(rc.roomWidth / 2, rc.roomHeight / 2);
        } else {
            rm.localPlayer.setPosition(0, 0);
        }
    }

    private pickFarthestDoor(roomId: string, roomNode: cc.Node, player: cc.Node): { doorId: string; position: cc.Vec2 } | null {
        const roomDef = ROOM_REGISTRY.get(roomId);
        if (!roomDef || roomDef.doors.length === 0) return null;

        const doorTriggers = roomNode.getComponentsInChildren(DoorTrigger);
        let best: { doorId: string; position: cc.Vec2 } | null = null;
        let bestDist = -1;

        const state = GameState.instance;

        for (const def of roomDef.doors) {
            if (state && state.isDoorLocked(def.doorId)) continue;

            for (const dt of doorTriggers) {
                if (dt.doorId === def.doorId) {
                    const pos = cc.v2(dt.node.x, dt.node.y);
                    const dx = player.x - pos.x;
                    const dy = player.y - pos.y;
                    const dist = dx * dx + dy * dy;
                    if (dist > bestDist) {
                        bestDist = dist;
                        best = { doorId: def.doorId, position: pos };
                    }
                    break;
                }
            }
        }

        return best;
    }

    private findArrivalDoorByRoom(fromRoomId: string, toRoomId: string): string {
        const roomDef = ROOM_REGISTRY.get(fromRoomId);
        if (!roomDef) return "";

        const doorDef = roomDef.doors.find(d => d.connectsTo.roomId === toRoomId);
        if (!doorDef) return "";

        return doorDef.connectsTo.doorId;
    }

    private getDoorPosition(roomNode: cc.Node, doorId: string): cc.Vec2 | null {
        const doorTriggers = roomNode.getComponentsInChildren(DoorTrigger);
        for (const dt of doorTriggers) {
            if (dt.doorId === doorId) {
                return cc.v2(dt.node.x, dt.node.y);
            }
        }
        return null;
    }

    private getOrBuildGrid(roomId: string, roomNode: cc.Node): NavGrid {
        const cached = this.gridCache.get(roomId);
        if (cached) return cached;

        const rc = roomNode.getComponent(RoomController);
        const w = rc ? rc.roomWidth : 960;
        const h = rc ? rc.roomHeight : 640;
        const grid = buildGridFromRoom(roomNode, w, h);
        this.gridCache.set(roomId, grid);
        return grid;
    }
}
