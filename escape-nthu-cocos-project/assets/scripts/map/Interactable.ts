import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Interactable extends cc.Component {

    @property
    interactableId: string = "";

    @property
    promptText: string = "Press E to interact";

    @property({ tooltip: "允許重複互動，取消勾選則互動完成後銷毀節點" })
    reusable: boolean = true;

    protected playerInRange: boolean = false;
    private dialoguePlaying: boolean = false;
    private chaseActive: boolean = false;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.on("dialogue:start", this.onDialogueStart, this);
        EventBus.on("dialogue:end", this.onDialogueEnd, this);
        EventBus.on("chase:start", this.onChaseStart, this);
        EventBus.on("chase:end", this.onChaseEnd, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.off("dialogue:start", this.onDialogueStart, this);
        EventBus.off("dialogue:end", this.onDialogueEnd, this);
        EventBus.off("chase:start", this.onChaseStart, this);
        EventBus.off("chase:end", this.onChaseEnd, this);
    }

    private onDialogueStart() { this.dialoguePlaying = true; }
    private onDialogueEnd() { this.dialoguePlaying = false; }
    private onChaseStart() { this.chaseActive = true; }
    private onChaseEnd() { this.chaseActive = false; }

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
        if (this.dialoguePlaying || this.chaseActive) return;
        if (event.keyCode === cc.macro.KEY.e && this.playerInRange) {
            this.onInteract();
            if (!this.reusable) {
                EventBus.emit("ui:interaction-prompt", null);
                this.node.destroy();
            }
        }
    }

    protected onInteract(): void {
        // Override in subclasses
        EventBus.emit("interact", this.interactableId);
    }
}
