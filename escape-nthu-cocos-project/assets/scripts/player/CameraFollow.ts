import RoomController from "../map/RoomController";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    target: cc.Node = null;

    @property
    smoothSpeed: number = 5;

    private roomSize: cc.Size = cc.size(0, 0);
    private halfViewW: number = 0;
    private halfViewH: number = 0;

    onLoad() {
        const visibleSize = cc.view.getVisibleSize();
        this.halfViewW = visibleSize.width / 2;
        this.halfViewH = visibleSize.height / 2;

        EventBus.on("room:changed", this.onRoomChanged, this);
    }

    onDestroy() {
        EventBus.off("room:changed", this.onRoomChanged, this);
    }

    private onRoomChanged(_roomId: string) {
        this.scheduleOnce(() => {
            const controllers = cc.director.getScene()
                .getComponentsInChildren(RoomController);
            for (const rc of controllers) {
                if (rc.node.active) {
                    this.roomSize = rc.getRoomSize();
                    return;
                }
            }
        }, 0);
    }

    lateUpdate(dt: number) {
        if (!this.target) return;

        const targetPos = this.target.position;
        let x = targetPos.x;
        let y = targetPos.y;

        if (this.roomSize.width > this.halfViewW * 2) {
            x = this.clamp(x, this.halfViewW, this.roomSize.width - this.halfViewW);
        } else {
            x = this.roomSize.width / 2;
        }

        if (this.roomSize.height > this.halfViewH * 2) {
            y = this.clamp(y, this.halfViewH, this.roomSize.height - this.halfViewH);
        } else {
            y = this.roomSize.height / 2;
        }

        const lerp = 1 - Math.exp(-this.smoothSpeed * dt);
        this.node.x += (x - this.node.x) * lerp;
        this.node.y += (y - this.node.y) * lerp;
    }

    private clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, val));
    }
}
