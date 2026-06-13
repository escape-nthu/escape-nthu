import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

type MoveDirection = "down" | "up" | "left" | "right";

@ccclass
export default class PlayerController extends cc.Component {

    @property
    walkSpeed: number = 160;

    @property
    sprintSpeed: number = 280;

    @property(cc.Sprite)
    visualSprite: cc.Sprite | null = null;

    @property(cc.SpriteFrame)
    idleFrame: cc.SpriteFrame | null = null;

    @property([cc.SpriteFrame])
    walkDownFrames: cc.SpriteFrame[] = [];

    @property([cc.SpriteFrame])
    walkUpFrames: cc.SpriteFrame[] = [];

    @property([cc.SpriteFrame])
    walkLeftFrames: cc.SpriteFrame[] = [];

    @property([cc.SpriteFrame])
    walkRightFrames: cc.SpriteFrame[] = [];

    @property
    walkAnimationFps: number = 8;

    private moveDir: cc.Vec2 = cc.v2(0, 0);
    private isSprinting: boolean = false;
    private frozen: boolean = true;
    private lastDirection: MoveDirection = "down";
    private animationTimer: number = 0;
    private animationFrameIndex: number = 0;

    private keyState = {
        up: false, down: false, left: false, right: false,
        shift: false,
    };

    onLoad() {
        this.ensureVisualSprite();
        this.showIdleFrame();

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        EventBus.on("dialogue:start", this.onFreeze, this);
        EventBus.on("dialogue:end", this.onUnfreeze, this);
        EventBus.on("lobby:start-game", this.onUnfreeze, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        EventBus.off("dialogue:start", this.onFreeze, this);
        EventBus.off("dialogue:end", this.onUnfreeze, this);
        EventBus.off("lobby:start-game", this.onUnfreeze, this);
    }

    private onFreeze() {
        this.frozen = true;
        this.resetMovement();
        this.showIdleFrame();
    }

    private onUnfreeze() { this.frozen = false; }

    update(dt: number) {
        if (this.frozen) {
            this.showIdleFrame();
            return;
        }

        this.moveDir.x = 0;
        this.moveDir.y = 0;

        if (this.keyState.up) this.moveDir.y += 1;
        if (this.keyState.down) this.moveDir.y -= 1;
        if (this.keyState.left) this.moveDir.x -= 1;
        if (this.keyState.right) this.moveDir.x += 1;

        if (this.moveDir.x !== 0 || this.moveDir.y !== 0) {
            this.moveDir = this.moveDir.normalize();
        }

        this.isSprinting = this.keyState.shift;
        const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

        this.node.x += this.moveDir.x * speed * dt;
        this.node.y += this.moveDir.y * speed * dt;

        if (this.moveDir.x !== 0 || this.moveDir.y !== 0) {
            this.updateFacingDirection();
            this.updateWalkAnimation(dt);
            EventBus.emit("player:position-updated", { x: this.node.x, y: this.node.y });
        } else {
            this.showIdleFrame();
        }
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
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this.keyState.up = pressed;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this.keyState.left = pressed;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                this.keyState.down = pressed;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this.keyState.right = pressed;
                break;
            case cc.macro.KEY.shift: this.keyState.shift = pressed; break;
        }
    }

    private ensureVisualSprite(): void {
        if (this.visualSprite) return;

        const spriteNode = this.node.getChildByName("PlayerSprite");
        this.visualSprite = spriteNode
            ? spriteNode.getComponent(cc.Sprite)
            : this.node.getComponentInChildren(cc.Sprite);

        if (!this.idleFrame && this.visualSprite) {
            this.idleFrame = this.visualSprite.spriteFrame;
        }
    }

    private resetMovement(): void {
        this.moveDir.x = 0;
        this.moveDir.y = 0;
        this.keyState.up = false;
        this.keyState.down = false;
        this.keyState.left = false;
        this.keyState.right = false;
        this.keyState.shift = false;
    }

    private updateFacingDirection(): void {
        const previousDirection = this.lastDirection;

        if (Math.abs(this.moveDir.x) > Math.abs(this.moveDir.y)) {
            this.lastDirection = this.moveDir.x > 0 ? "right" : "left";
        } else if (this.moveDir.y !== 0) {
            this.lastDirection = this.moveDir.y > 0 ? "up" : "down";
        }

        if (this.lastDirection !== previousDirection) {
            this.animationTimer = 0;
            this.animationFrameIndex = 0;
        }
    }

    private updateWalkAnimation(dt: number): void {
        const frames = this.getFramesForDirection(this.lastDirection);
        if (!this.visualSprite || frames.length === 0) return;

        const fps = Math.max(1, this.walkAnimationFps);
        this.animationTimer += dt;
        if (this.animationTimer >= 1 / fps) {
            this.animationTimer = 0;
            this.animationFrameIndex = (this.animationFrameIndex + 1) % frames.length;
        }

        this.visualSprite.spriteFrame = frames[this.animationFrameIndex % frames.length];
    }

    private showIdleFrame(): void {
        if (!this.visualSprite || !this.idleFrame) return;

        this.animationTimer = 0;
        this.animationFrameIndex = 0;
        this.visualSprite.spriteFrame = this.idleFrame;
    }

    private getFramesForDirection(direction: MoveDirection): cc.SpriteFrame[] {
        switch (direction) {
            case "up": return this.walkUpFrames;
            case "left": return this.walkLeftFrames;
            case "right": return this.walkRightFrames;
            case "down":
            default:
                return this.walkDownFrames;
        }
    }
}
