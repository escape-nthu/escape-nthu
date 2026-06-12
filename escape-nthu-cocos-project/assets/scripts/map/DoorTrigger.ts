import GameState from "../core/GameState";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DoorTrigger extends cc.Component {

    @property
    doorId: string = "";

    @property({ tooltip: "勾選 = 遊戲開始時此門上鎖，需透過密碼鎖或事件解鎖" })
    startsLocked: boolean = false;

    @property({ tooltip: "門鎖住時碰到門顯示的提示" })
    lockedMessage: string = "這扇門被鎖住了。";

    @property
    spawnOffsetX: number = 0;

    @property
    spawnOffsetY: number = -50;

    start() {
        if (this.startsLocked && GameState.instance) {
            GameState.instance.lockDoor(this.doorId);
        }
    }

    get spawnPoint(): cc.Vec2 {
        return cc.v2(
            this.node.x + this.spawnOffsetX,
            this.node.y + this.spawnOffsetY
        );
    }

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.node.group !== "player") return;

        if (GameState.instance && GameState.instance.isDoorLocked(this.doorId)) {
            EventBus.emit("ui:toast", this.lockedMessage);
            return;
        }

        EventBus.emit("door:enter", this.doorId);
    }
}
