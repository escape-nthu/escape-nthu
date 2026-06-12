import EventBus from "../core/EventBus";
import Interactable from "../map/Interactable";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GestureLevelTrigger extends Interactable {
    @property
    activationRadius: number = 96;

    private playerNode: cc.Node = null;

    onLoad() {
        super.onLoad();
        if (!this.promptText || this.promptText === "Press E to interact") {
            this.promptText = "按 E 啟動姿態偵測";
        }
    }

    update(): void {
        const near = this.isPlayerNear();
        if (near === this.playerInRange) return;

        this.playerInRange = near;
        EventBus.emit("ui:interaction-prompt", near ? this.promptText : null);
    }

    protected onInteract(): void {
        EventBus.emit("gesture-level:start");
    }

    private isPlayerNear(): boolean {
        const player = this.getPlayerNode();
        if (!player) return false;
        const playerWorld = player.convertToWorldSpaceAR(cc.Vec2.ZERO);
        const triggerWorld = this.node.convertToWorldSpaceAR(cc.Vec2.ZERO);
        return playerWorld.sub(triggerWorld).mag() <= this.activationRadius;
    }

    private getPlayerNode(): cc.Node {
        if (this.playerNode && cc.isValid(this.playerNode)) return this.playerNode;

        const scene = cc.director.getScene();
        if (!scene) return null;
        this.playerNode = this.findNodeByGroup(scene, "player");
        return this.playerNode;
    }

    private findNodeByGroup(root: cc.Node, group: string): cc.Node {
        if (root.group === group) return root;
        for (let i = 0; i < root.children.length; i += 1) {
            const found = this.findNodeByGroup(root.children[i], group);
            if (found) return found;
        }
        return null;
    }
}
