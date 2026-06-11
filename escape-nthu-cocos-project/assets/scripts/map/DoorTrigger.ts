import GameState from "../core/GameState";
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

        if (GameState.instance && GameState.instance.isDoorLocked(this.doorId)) {
            EventBus.emit("ui:toast", "This door is locked.");
            return;
        }

        EventBus.emit("door:enter", this.doorId);
    }
}
