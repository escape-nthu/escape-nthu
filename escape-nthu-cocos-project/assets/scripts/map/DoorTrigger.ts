import GameState from "../core/GameState";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DoorTrigger extends cc.Component {

    @property
    doorId: string = "";

    spawnPoint: cc.Vec2 = cc.v2(0, 0);

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.node.group !== "player") return;

        if (GameState.instance && GameState.instance.isDoorLocked(this.doorId)) {
            EventBus.emit("ui:toast", "This door is locked.");
            return;
        }

        EventBus.emit("door:enter", this.doorId);
    }
}
