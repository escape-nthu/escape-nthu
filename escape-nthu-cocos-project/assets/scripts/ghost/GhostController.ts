import { NavGrid, PathNode, findPath, worldToGrid, gridToWorld } from "./AStar";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

enum GhostState {
    IDLE,
    SPAWNING,
    CHASING,
    TRANSITIONING,
    DESPAWNING,
}

@ccclass
export default class GhostController extends cc.Component {

    @property({ tooltip: "移動速度 (px/s)" })
    moveSpeed: number = 120;

    @property({ tooltip: "重新計算路徑間隔 (秒)" })
    pathRecalcInterval: number = 0.4;

    @property({ tooltip: "抓到玩家的判定距離 (px)" })
    catchDistance: number = 40;

    private state: GhostState = GhostState.IDLE;
    private grid: NavGrid = null;
    private path: PathNode[] = null;
    private pathIndex: number = 0;
    private targetPlayer: cc.Node = null;
    private pathTimer: number = 0;

    setGrid(grid: NavGrid): void {
        this.grid = grid;
        this.path = null;
        this.pathIndex = 0;
    }

    setTarget(player: cc.Node): void {
        this.targetPlayer = player;
    }

    getState(): GhostState {
        return this.state;
    }

    isChasing(): boolean {
        return this.state === GhostState.CHASING;
    }

    spawn(position: cc.Vec2): void {
        this.node.setPosition(position);
        this.node.active = true;
        this.node.opacity = 0;
        this.node.scaleX = 1.5;
        this.node.scaleY = 1.5;
        this.state = GhostState.SPAWNING;
        this.path = null;
        this.pathIndex = 0;
        this.pathTimer = 0;

        cc.tween(this.node)
            .to(0.5, { opacity: 255, scaleX: 1, scaleY: 1 }, { easing: "sineOut" })
            .call(() => { this.state = GhostState.CHASING; })
            .start();
    }

    despawn(callback?: () => void): void {
        if (this.state === GhostState.IDLE || this.state === GhostState.DESPAWNING) {
            if (callback) callback();
            return;
        }
        this.state = GhostState.DESPAWNING;
        cc.Tween.stopAllByTarget(this.node);

        cc.tween(this.node)
            .to(0.4, { opacity: 0, scaleY: 0.5 }, { easing: "sineIn" })
            .call(() => {
                this.node.active = false;
                this.state = GhostState.IDLE;
                if (callback) callback();
            })
            .start();
    }

    hide(): void {
        cc.Tween.stopAllByTarget(this.node);
        this.node.active = false;
        this.state = GhostState.TRANSITIONING;
        this.path = null;
    }

    update(dt: number) {
        if (this.state !== GhostState.CHASING) return;
        if (!this.grid || !this.targetPlayer) return;

        this.pathTimer += dt;
        if (this.pathTimer >= this.pathRecalcInterval || !this.path) {
            this.pathTimer = 0;
            this.recalcPath();
        }

        this.moveAlongPath(dt);
        this.checkCatch();
    }

    private recalcPath(): void {
        const ghostPos = worldToGrid(this.grid, this.node.x, this.node.y);
        const playerPos = worldToGrid(this.grid, this.targetPlayer.x, this.targetPlayer.y);
        this.path = findPath(this.grid, ghostPos, playerPos);
        this.pathIndex = this.path && this.path.length > 1 ? 1 : 0;
    }

    private moveAlongPath(dt: number): void {
        if (!this.path || this.pathIndex >= this.path.length) return;

        const target = gridToWorld(this.grid, this.path[this.pathIndex].col, this.path[this.pathIndex].row);
        const dx = target.x - this.node.x;
        const dy = target.y - this.node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
            this.pathIndex++;
            return;
        }

        if (dx > 0.1) {
            this.node.scaleX = Math.abs(this.node.scaleX);
        } else if (dx < -0.1) {
            this.node.scaleX = -Math.abs(this.node.scaleX);
        }

        const step = this.moveSpeed * dt;
        if (step >= dist) {
            this.node.x = target.x;
            this.node.y = target.y;
            this.pathIndex++;
        } else {
            this.node.x += (dx / dist) * step;
            this.node.y += (dy / dist) * step;
        }
    }

    private checkCatch(): void {
        if (!this.targetPlayer) return;
        const dx = this.targetPlayer.x - this.node.x;
        const dy = this.targetPlayer.y - this.node.y;
        if (dx * dx + dy * dy < this.catchDistance * this.catchDistance) {
            this.state = GhostState.IDLE;
            EventBus.emit("ghost:caught");
        }
    }

    onCollisionStay(other: cc.Collider, self: cc.Collider) {
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
}
