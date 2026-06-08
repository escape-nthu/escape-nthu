import { ROOM_REGISTRY, getInitialRoom } from "./RoomRegistry";
import DoorTrigger from "./DoorTrigger";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class RoomManager extends cc.Component {

    static instance: RoomManager = null;

    @property(cc.Node)
    localPlayer: cc.Node = null;

    private loadedRooms: Map<string, cc.Node> = new Map();
    private currentRoomId: string = "";

    onLoad() {
        RoomManager.instance = this;
        EventBus.on("door:enter", this.onDoorEnter, this);
    }

    onDestroy() {
        EventBus.off("door:enter", this.onDoorEnter, this);
    }

    start() {
        const initial = getInitialRoom();
        this.enterRoom(initial.roomId, null);
    }

    getCurrentRoomId(): string {
        return this.currentRoomId;
    }

    private onDoorEnter(doorId: string) {
        const roomDef = ROOM_REGISTRY.get(this.currentRoomId);
        if (!roomDef) return;

        const doorDef = roomDef.doors.find(d => d.doorId === doorId);
        if (!doorDef) {
            cc.warn(`Door "${doorId}" not in registry for room "${this.currentRoomId}"`);
            return;
        }

        this.enterRoom(doorDef.connectsTo.roomId, doorDef.connectsTo.doorId);
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
                return;
            }
            target = await this.loadPrefab(roomDef.prefabPath);
            target.parent = this.node;
            this.loadedRooms.set(targetRoomId, target);
        }

        target.active = true;
        this.currentRoomId = targetRoomId;

        this.positionPlayerAtDoor(target, arrivalDoorId);
        EventBus.emit("room:changed", targetRoomId);
    }

    private positionPlayerAtDoor(roomNode: cc.Node, doorId: string | null): void {
        if (!this.localPlayer) return;

        if (doorId) {
            const doorTriggers = roomNode.getComponentsInChildren(DoorTrigger);
            for (const dt of doorTriggers) {
                if (dt.doorId === doorId) {
                    this.localPlayer.setPosition(dt.spawnPoint);
                    return;
                }
            }
        }

        // Fallback: use room center or (0, 0)
        this.localPlayer.setPosition(0, 0);
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
