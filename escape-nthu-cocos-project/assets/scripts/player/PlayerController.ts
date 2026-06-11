import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerController extends cc.Component {

    @property
    walkSpeed: number = 160;

    @property
    sprintSpeed: number = 280;

    private moveDir: cc.Vec2 = cc.v2(0, 0);
    private isSprinting: boolean = false;
    private frozen: boolean = false;

    private keyState = {
        w: false, a: false, s: false, d: false,
        shift: false,
    };

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        EventBus.on("dialogue:start", this.onFreeze, this);
        EventBus.on("dialogue:end", this.onUnfreeze, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        EventBus.off("dialogue:start", this.onFreeze, this);
        EventBus.off("dialogue:end", this.onUnfreeze, this);
    }

    private onFreeze() { this.frozen = true; }
    private onUnfreeze() { this.frozen = false; }

    update(dt: number) {
        if (this.frozen) return;
        this.moveDir.x = 0;
        this.moveDir.y = 0;

        if (this.keyState.w) this.moveDir.y += 1;
        if (this.keyState.s) this.moveDir.y -= 1;
        if (this.keyState.a) this.moveDir.x -= 1;
        if (this.keyState.d) this.moveDir.x += 1;

        if (this.moveDir.x !== 0 || this.moveDir.y !== 0) {
            this.moveDir = this.moveDir.normalize();
        }

        this.isSprinting = this.keyState.shift;
        const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

        this.node.x += this.moveDir.x * speed * dt;
        this.node.y += this.moveDir.y * speed * dt;
    }

    // cc.CollisionManager callbacks — push player out of walls
    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        this.resolveCollision(other, self);
    }

    onCollisionStay(other: cc.Collider, self: cc.Collider) {
        this.resolveCollision(other, self);
    }

    private resolveCollision(other: cc.Collider, self: cc.Collider) {
        if (other.node.group !== "wall") return;

        const o = other.world.aabb;
        const s = self.world.aabb;

        const overlapX = Math.min(s.xMax - o.xMin, o.xMax - s.xMin);
        const overlapY = Math.min(s.yMax - o.yMin, o.yMax - s.yMin);

        if (overlapX < overlapY) {
            self.node.x += (self.node.x < other.node.x ? -1 : 1) * overlapX;
        } else {
            self.node.y += (self.node.y < other.node.y ? -1 : 1) * overlapY;
        }
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        this.setKeyState(event.keyCode, true);
    }

    private onKeyUp(event: cc.Event.EventKeyboard) {
        this.setKeyState(event.keyCode, false);
    }

    private setKeyState(keyCode: number, pressed: boolean) {
        switch (keyCode) {
            case cc.macro.KEY.w: this.keyState.w = pressed; break;
            case cc.macro.KEY.a: this.keyState.a = pressed; break;
            case cc.macro.KEY.s: this.keyState.s = pressed; break;
            case cc.macro.KEY.d: this.keyState.d = pressed; break;
            case cc.macro.KEY.shift: this.keyState.shift = pressed; break;
        }
    }
}
