import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    target: cc.Node = null;

    @property
    smoothSpeed: number = 5;

    private needsSnap: boolean = true;

    onLoad() {
        EventBus.on("room:changed", this.onRoomChanged, this);
    }

    onDestroy() {
        EventBus.off("room:changed", this.onRoomChanged, this);
    }

    private onRoomChanged() {
        this.needsSnap = true;
    }

    /** 外部也可以手動呼叫，立刻對齊玩家 */
    snapToTarget() {
        if (!this.target) return;
        this.node.x = this.target.x;
        this.node.y = this.target.y;
    }

    lateUpdate(dt: number) {
        if (!this.target) return;

        if (this.needsSnap) {
            this.snapToTarget();
            this.needsSnap = false;
            return;
        }

        const tx = this.target.x;
        const ty = this.target.y;
        const lerp = 1 - Math.exp(-this.smoothSpeed * dt);
        this.node.x += (tx - this.node.x) * lerp;
        this.node.y += (ty - this.node.y) * lerp;
    }
}
