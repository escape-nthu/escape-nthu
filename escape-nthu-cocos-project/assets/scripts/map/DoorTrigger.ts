import GameState from "../core/GameState";
import RoomManager from "./RoomManager";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DoorTrigger extends cc.Component {

    @property
    doorId: string = "";

    @property
    spawnOffsetX: number = 0;

    @property
    spawnOffsetY: number = -50;

    get spawnPoint(): cc.Vec2 {
        return cc.v2(
            this.node.x + this.spawnOffsetX,
            this.node.y + this.spawnOffsetY
        );
    }

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.node.group !== "player") return;

        // 玩家剛從這扇門進來，還沒離開碰撞範圍 → 不觸發
        const rm = RoomManager.instance;
        if (rm && rm.arrivalDoorId === this.doorId) return;

        if (GameState.instance && GameState.instance.isDoorLocked(this.doorId)) {
            EventBus.emit("ui:toast", "This door is locked.");
            return;
        }

        EventBus.emit("door:enter", this.doorId);
    }

    onCollisionExit(other: cc.Collider, self: cc.Collider) {
        if (other.node.group !== "player") return;

        // 玩家離開了到達門的碰撞範圍 → 下次走回來可以正常觸發
        const rm = RoomManager.instance;
        if (rm && rm.arrivalDoorId === this.doorId) {
            rm.arrivalDoorId = null;
        }
    }
}
