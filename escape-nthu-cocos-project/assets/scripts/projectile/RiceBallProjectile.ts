import EventBus from "../core/EventBus";

const { ccclass } = cc._decorator;

@ccclass
export default class RiceBallProjectile extends cc.Component {

    private direction: cc.Vec2 = cc.v2(1, 0);
    private speed: number = 500;
    private maxDistance: number = 600;
    private distanceTraveled: number = 0;
    private alive: boolean = true;

    init(direction: cc.Vec2, speed: number, maxDistance: number): void {
        this.direction = direction.normalize();
        this.speed = speed;
        this.maxDistance = maxDistance;
    }

    update(dt: number) {
        if (!this.alive) return;

        const step = this.speed * dt;
        this.node.x += this.direction.x * step;
        this.node.y += this.direction.y * step;
        this.distanceTraveled += step;

        if (this.distanceTraveled >= this.maxDistance) {
            this.destroyProjectile();
        }
    }

    onCollisionEnter(other: cc.Collider, _self: cc.Collider) {
        if (!this.alive) return;

        if (other.node.group === "ghost") {
            EventBus.emit("ghost:hit-by-riceball");
            EventBus.emit("ui:toast", "鬼被飯糰擊中消散了！");
            this.destroyProjectile();
        } else if (other.node.group === "wall") {
            this.destroyProjectile();
        }
    }

    private destroyProjectile(): void {
        if (!this.alive) return;
        this.alive = false;
        cc.Tween.stopAllByTarget(this.node);
        this.node.destroy();
    }
}
