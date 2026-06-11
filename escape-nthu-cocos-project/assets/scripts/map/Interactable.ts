import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Interactable extends cc.Component {

    @property
    interactableId: string = "";

    @property
    promptText: string = "Press E to interact";

    protected playerInRange: boolean = false;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

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
        if (event.keyCode === cc.macro.KEY.e && this.playerInRange) {
            this.onInteract();
        }
    }

    protected onInteract(): void {
        // Override in subclasses
        EventBus.emit("interact", this.interactableId);
    }
}
