import { ROOM_REGISTRY, getInitialRoom } from "./RoomRegistry";
import DoorTrigger from "./DoorTrigger";
import RoomController from "./RoomController";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class RoomManager extends cc.Component {

    static instance: RoomManager = null;

    @property(cc.Node)
    localPlayer: cc.Node = null;

    private loadedRooms: Map<string, cc.Node> = new Map();
    private currentRoomId: string = "";
    private transitioning: boolean = false;

    @property({ tooltip: "轉場後封鎖門觸發的秒數，避免到達門立刻把玩家彈回上一個房間" })
    transitionLockDuration: number = 0.4;

    onLoad() {
        RoomManager.instance = this;
        EventBus.on("door:enter", this.onDoorEnter, this);
        EventBus.on("network:room-transition", this.onNetworkRoomTransition, this);
    }

    onDestroy() {
        EventBus.off("door:enter", this.onDoorEnter, this);
        EventBus.off("network:room-transition", this.onNetworkRoomTransition, this);
    }

    start() {
        const initial = getInitialRoom();
        this.enterRoom(initial.roomId, null);
    }

    getCurrentRoomId(): string {
        return this.currentRoomId;
    }

    getLoadedRoom(roomId: string): cc.Node | null {
        return this.loadedRooms.get(roomId) || null;
    }

    private onDoorEnter(doorId: string) {
        // 轉場進行中時忽略，避免到達門立刻再次觸發造成來回彈跳
        if (this.transitioning) return;

        const roomDef = ROOM_REGISTRY.get(this.currentRoomId);
        if (!roomDef) return;

        const doorDef = roomDef.doors.find(d => d.doorId === doorId);
        if (!doorDef) {
            cc.warn(`Door "${doorId}" not in registry for room "${this.currentRoomId}"`);
            return;
        }

        this.transitioning = true;
        this.enterRoom(doorDef.connectsTo.roomId, doorDef.connectsTo.doorId);
        EventBus.emit("room:transition-local", {
            targetRoomId: doorDef.connectsTo.roomId,
            arrivalDoorId: doorDef.connectsTo.doorId,
        });
    }

    private onNetworkRoomTransition(payload: { targetRoomId: string; arrivalDoorId: string }): void {
        if (!payload || !payload.targetRoomId || !payload.arrivalDoorId) return;
        this.enterRoom(payload.targetRoomId, payload.arrivalDoorId);
    }

    async enterRoom(targetRoomId: string, arrivalDoorId: string | null): Promise<void> {
        if (this.currentRoomId) {
            const current = this.loadedRooms.get(this.currentRoomId);
            if (current) current.active = false;
        }

        let target = this.loadedRooms.get(targetRoomId);
        if (!target) {
            const roomDef = ROOM_REGISTRY.get(targetRoomId);
            if (!roomDef) {
                cc.error(`Room "${targetRoomId}" not found in registry`);
                this.transitioning = false;
                return;
            }
            try {
                target = await this.loadPrefab(roomDef.prefabPath);
            } catch (e) {
                this.transitioning = false;
                return;
            }
            target.parent = this.node;
            this.loadedRooms.set(targetRoomId, target);
        }

        target.active = true;
        this.currentRoomId = targetRoomId;

        this.positionPlayerAtDoor(target, arrivalDoorId);
        EventBus.emit("room:changed", targetRoomId);

        // 重新定位玩家後，到達門的 collider 可能與出生點重疊而立刻觸發一次 enter，
        // 延遲解鎖把這次重疊觸發吞掉，避免被彈回上一個房間
        this.unschedule(this.releaseTransitionLock);
        this.scheduleOnce(this.releaseTransitionLock, this.transitionLockDuration);
    }

    private releaseTransitionLock = () => {
        this.transitioning = false;
    };

    private positionPlayerAtDoor(roomNode: cc.Node, doorId: string | null): void {
        if (!this.localPlayer) return;

        // 1. 從門切換進來 → 用門的 spawnOffset
        if (doorId) {
            const doorTriggers = roomNode.getComponentsInChildren(DoorTrigger);
            for (const dt of doorTriggers) {
                if (dt.doorId === doorId) {
                    this.localPlayer.setPosition(dt.spawnPoint);
                    return;
                }
            }
        }

        // 2. 初次進入或門缺少回程節點 → 優先用 Player A 測試出生點
        const spawnNode = roomNode.getChildByName("SpawnPointA") || roomNode.getChildByName("SpawnPoint");
        if (spawnNode) {
            this.localPlayer.setPosition(spawnNode.position);
            return;
        }

        // 3. 都沒有 → 用房間中心
        const rc = roomNode.getComponent(RoomController);
        if (rc) {
            this.localPlayer.setPosition(rc.roomWidth / 2, rc.roomHeight / 2);
        } else {
            this.localPlayer.setPosition(0, 0);
        }
    }

    private loadPrefab(path: string): Promise<cc.Node> {
        return new Promise((resolve, reject) => {
            cc.resources.load(path, cc.Prefab, (err: Error, prefab: cc.Prefab) => {
                if (err) {
                    cc.error(`Failed to load room prefab: ${path}`, err);
                    reject(err);
                    return;
                }
                resolve(cc.instantiate(prefab));
            });
        });
    }
}
