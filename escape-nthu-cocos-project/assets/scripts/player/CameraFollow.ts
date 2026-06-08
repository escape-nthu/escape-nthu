import RoomController from "../map/RoomController";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    target: cc.Node = null;

    @property
    smoothSpeed: number = 5;

    private mapSize: cc.Size = cc.size(0, 0);
    private halfViewW: number = 0;
    private halfViewH: number = 0;

    onLoad() {
        const canvas = cc.Canvas.instance;
        if (canvas) {
            this.halfViewW = canvas.designResolution.width / 2;
            this.halfViewH = canvas.designResolution.height / 2;
        }

        EventBus.on("room:changed", this.onRoomChanged, this);
    }

    onDestroy() {
        EventBus.off("room:changed", this.onRoomChanged, this);
    }

    private onRoomChanged(_roomId: string) {
        this.scheduleOnce(() => {
            const roomControllers = cc.director.getScene()
                .getComponentsInChildren(RoomController);
            for (const rc of roomControllers) {
                if (rc.node.active) {
                    this.mapSize = rc.getMapPixelSize();
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

        // Clamp camera to map bounds if map is larger than viewport
        if (this.mapSize.width > this.halfViewW * 2) {
            x = this.clamp(x, this.halfViewW, this.mapSize.width - this.halfViewW);
        } else {
            x = this.mapSize.width / 2;
        }

        if (this.mapSize.height > this.halfViewH * 2) {
            y = this.clamp(y, this.halfViewH, this.mapSize.height - this.halfViewH);
        } else {
            y = this.mapSize.height / 2;
        }

        const lerp = 1 - Math.exp(-this.smoothSpeed * dt);
        this.node.x += (x - this.node.x) * lerp;
        this.node.y += (y - this.node.y) * lerp;
    }

    private clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, val));
    }
}
