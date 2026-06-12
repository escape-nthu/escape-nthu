import EventBus from "../core/EventBus";
import GameState from "../core/GameState";

const { ccclass, property } = cc._decorator;

@ccclass
export default class RiceBallPickup extends cc.Component {

    @property({ tooltip: "撿起獲得的飯糰數量" })
    amount: number = 1;

    @property({ tooltip: "提示文字" })
    promptText: string = "按 E 撿起飯糰";

    private playerInRange: boolean = false;
    private collected: boolean = false;
    private dialoguePlaying: boolean = false;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.on("dialogue:start", this.onDialogueStart, this);
        EventBus.on("dialogue:end", this.onDialogueEnd, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.off("dialogue:start", this.onDialogueStart, this);
        EventBus.off("dialogue:end", this.onDialogueEnd, this);
    }

    private onDialogueStart() { this.dialoguePlaying = true; }
    private onDialogueEnd() { this.dialoguePlaying = false; }

    onCollisionEnter(other: cc.Collider, _self: cc.Collider) {
        if (other.node.group !== "player") return;
        this.playerInRange = true;
        EventBus.emit("ui:interaction-prompt", this.promptText);
    }

    onCollisionExit(other: cc.Collider, _self: cc.Collider) {
        if (other.node.group !== "player") return;
        this.playerInRange = false;
        EventBus.emit("ui:interaction-prompt", null);
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        if (this.dialoguePlaying) return;
        if (this.collected) return;
        if (event.keyCode !== cc.macro.KEY.e || !this.playerInRange) return;

        this.collected = true;

        const state = GameState.instance;
        if (state) state.addRiceBalls(this.amount);

        EventBus.emit("ui:interaction-prompt", null);
        EventBus.emit("ui:toast", `撿起了 ${this.amount} 個飯糰`);
        EventBus.emit("riceball:collected", this.amount);

        cc.tween(this.node)
            .to(0.3, { opacity: 0, scale: 0.5 })
            .call(() => { this.node.destroy(); })
            .start();
    }
}
