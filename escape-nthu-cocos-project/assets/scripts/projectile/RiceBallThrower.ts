import EventBus from "../core/EventBus";
import GameState from "../core/GameState";
import RoomManager from "../map/RoomManager";
import RiceBallProjectile from "./RiceBallProjectile";

const { ccclass, property } = cc._decorator;

const AIM_LINE_LENGTH = 80;
const AIM_LINE_WIDTH = 3;
const AIM_DASH_LENGTH = 8;
const AIM_GAP_LENGTH = 5;
const AIM_ARROW_SIZE = 8;

@ccclass
export default class RiceBallThrower extends cc.Component {

    @property({ type: cc.Camera, tooltip: "GameCamera 的 cc.Camera 元件" })
    gameCamera: cc.Camera = null;

    @property({ type: cc.SpriteFrame, tooltip: "飯糰圖片" })
    riceBallSprite: cc.SpriteFrame = null;

    @property({ tooltip: "飯糰飛行速度 (px/s)" })
    projectileSpeed: number = 500;

    @property({ tooltip: "飯糰最大飛行距離 (px)" })
    projectileMaxDist: number = 600;

    @property({ tooltip: "飯糰碰撞箱大小" })
    projectileColliderSize: number = 16;

    private isAiming: boolean = false;
    private aimWorldPos: cc.Vec2 = cc.v2(0, 0);
    private aimIndicator: cc.Node = null;
    private aimGraphics: cc.Graphics = null;
    private dialogueLocked: boolean = false;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_DOWN, this.onMouseDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_UP, this.onMouseUp, this);
        EventBus.on("dialogue:start", this.onDialogueStart, this);
        EventBus.on("dialogue:end", this.onDialogueEnd, this);

        this.createAimIndicator();

        if (cc.game.canvas) {
            cc.game.canvas.oncontextmenu = (e: Event) => { e.preventDefault(); };
        }
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.MOUSE_DOWN, this.onMouseDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.MOUSE_UP, this.onMouseUp, this);
        EventBus.off("dialogue:start", this.onDialogueStart, this);
        EventBus.off("dialogue:end", this.onDialogueEnd, this);
    }

    private onDialogueStart() {
        this.dialogueLocked = true;
        if (this.isAiming) {
            this.isAiming = false;
            this.hideAimIndicator();
        }
    }
    private onDialogueEnd() { this.dialogueLocked = false; }

    private createAimIndicator(): void {
        this.aimIndicator = new cc.Node("AimIndicator");
        this.aimIndicator.group = "default";
        this.aimGraphics = this.aimIndicator.addComponent(cc.Graphics);
        this.aimGraphics.lineWidth = AIM_LINE_WIDTH;
        this.aimGraphics.strokeColor = cc.color(255, 255, 100, 200);
        this.aimGraphics.fillColor = cc.color(255, 255, 100, 200);
        this.aimIndicator.parent = this.node;
        this.aimIndicator.active = false;
    }

    private onMouseDown(event: cc.Event.EventMouse): void {
        if (event.getButton() !== cc.Event.EventMouse.BUTTON_RIGHT) return;
        if (this.dialogueLocked) return;

        const state = GameState.instance;
        if (!state || state.getRiceBallCount() <= 0) {
            EventBus.emit("ui:toast", "沒有飯糰了！");
            return;
        }

        this.isAiming = true;
        this.updateAimWorldPos(event);
        this.showAimIndicator();
    }

    private onMouseMove(event: cc.Event.EventMouse): void {
        if (!this.isAiming) return;
        this.updateAimWorldPos(event);
    }

    private onMouseUp(event: cc.Event.EventMouse): void {
        if (event.getButton() !== cc.Event.EventMouse.BUTTON_RIGHT) return;
        if (!this.isAiming) return;

        this.isAiming = false;
        this.hideAimIndicator();
        this.throwRiceBall();
    }

    private updateAimWorldPos(event: cc.Event.EventMouse): void {
        if (!this.gameCamera) return;
        const screenPos = cc.v2(event.getLocationX(), event.getLocationY());
        this.aimWorldPos = this.gameCamera.getScreenToWorldPoint(screenPos);
    }

    lateUpdate() {
        if (!this.isAiming || !this.aimGraphics) return;
        this.drawAimLine();
    }

    private showAimIndicator(): void {
        if (this.aimIndicator) this.aimIndicator.active = true;
    }

    private hideAimIndicator(): void {
        if (this.aimIndicator) {
            this.aimIndicator.active = false;
            if (this.aimGraphics) this.aimGraphics.clear();
        }
    }

    private drawAimLine(): void {
        const g = this.aimGraphics;
        g.clear();

        const dx = this.aimWorldPos.x - this.node.x;
        const dy = this.aimWorldPos.y - this.node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const dirX = dx / len;
        const dirY = dy / len;

        // Dashed line
        let drawn = 0;
        let drawing = true;
        while (drawn < AIM_LINE_LENGTH) {
            const segLen = drawing ? AIM_DASH_LENGTH : AIM_GAP_LENGTH;
            const end = Math.min(drawn + segLen, AIM_LINE_LENGTH);
            if (drawing) {
                g.moveTo(dirX * drawn, dirY * drawn);
                g.lineTo(dirX * end, dirY * end);
            }
            drawn = end;
            drawing = !drawing;
        }
        g.stroke();

        // Arrowhead at tip
        const tipX = dirX * AIM_LINE_LENGTH;
        const tipY = dirY * AIM_LINE_LENGTH;
        const perpX = -dirY;
        const perpY = dirX;
        const backX = tipX - dirX * AIM_ARROW_SIZE;
        const backY = tipY - dirY * AIM_ARROW_SIZE;

        g.moveTo(tipX, tipY);
        g.lineTo(backX + perpX * AIM_ARROW_SIZE * 0.5, backY + perpY * AIM_ARROW_SIZE * 0.5);
        g.lineTo(backX - perpX * AIM_ARROW_SIZE * 0.5, backY - perpY * AIM_ARROW_SIZE * 0.5);
        g.close();
        g.fill();
    }

    private throwRiceBall(): void {
        const state = GameState.instance;
        if (!state || !state.useRiceBall()) return;

        const rm = RoomManager.instance;
        if (!rm) return;

        const dx = this.aimWorldPos.x - this.node.x;
        const dy = this.aimWorldPos.y - this.node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const direction = cc.v2(dx / len, dy / len);

        const projNode = new cc.Node("RiceBallProjectile");
        projNode.group = "projectile";

        const sprite = projNode.addComponent(cc.Sprite);
        if (this.riceBallSprite) {
            sprite.spriteFrame = this.riceBallSprite;
        }
        projNode.setContentSize(this.projectileColliderSize, this.projectileColliderSize);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;

        const col = projNode.addComponent(cc.BoxCollider);
        col.size = cc.size(this.projectileColliderSize, this.projectileColliderSize);

        const proj = projNode.addComponent(RiceBallProjectile);
        proj.init(direction, this.projectileSpeed, this.projectileMaxDist);

        projNode.setPosition(this.node.x, this.node.y);
        projNode.parent = rm.node;
    }
}
