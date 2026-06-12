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

    private ghostNode: cc.Node = null;
    private ghostCtrl: GhostController = null;
    private chaseActive: boolean = false;
    private totalChaseCount: number = 0;
    private currentChaseRoomCount: number = 0;
    private chaseDurationTimer: number = 0;
    private gridCache: Map<string, NavGrid> = new Map();
    private ghostRoomId: string = "";
    private ghostLastPos: cc.Vec2 = cc.v2(0, 0);
    private pendingSpawnCallback: Function = null;
    private gameOver: boolean = false;

    onLoad() {
        if (GhostChaseManager.instance) {
            this.node.destroy();
            return;
        }
        GhostChaseManager.instance = this;

        EventBus.on("room:changed", this.onRoomChanged, this);
        EventBus.on("ghost:caught", this.onGhostCaught, this);

        if (this.gameOverOverlay) this.gameOverOverlay.active = false;

        const delay = this.minInitialDelay + Math.random() * (this.maxInitialDelay - this.minInitialDelay);
        this.scheduleOnce(() => this.startChase(), delay);
    }

    onDestroy() {
        EventBus.off("room:changed", this.onRoomChanged, this);
        EventBus.off("ghost:caught", this.onGhostCaught, this);
    }

    update(dt: number) {
        if (!this.chaseActive || this.gameOver) return;

        this.chaseDurationTimer += dt;
        if (this.chaseDurationTimer >= this.maxChaseDuration) {
            this.endChase();
        }
    }

    private startChase(): void {
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

        if (this.totalChaseCount < this.maxTotalChases) {
            const delay = this.minCooldown + Math.random() * (this.maxCooldown - this.minCooldown);
            this.scheduleOnce(() => this.startChase(), delay);
        }
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

    private onGhostCaught(): void {
        if (this.gameOver) return;
        this.gameOver = true;
        this.chaseActive = false;

        const audio = AudioManager.instance;
        if (audio) audio.stopBGM();

        EventBus.emit("chase:end");

        if (this.gameOverOverlay) {
            this.gameOverOverlay.active = true;
            this.gameOverOverlay.opacity = 0;
            this.gameOverOverlay.color = cc.Color.RED;

            if (this.gameOverLabel) {
                this.gameOverLabel.string = "GAME OVER";
            }

            cc.tween(this.gameOverOverlay)
                .to(0.3, { opacity: 200 })
                .to(0.5, { opacity: 255, color: cc.Color.BLACK })
                .delay(1.0)
                .call(() => {
                    cc.director.loadScene("Game");
                })
                .start();
        } else {
            this.scheduleOnce(() => {
                cc.director.loadScene("Game");
            }, 2.0);
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
