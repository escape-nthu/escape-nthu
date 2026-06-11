import DialogueManager from "./DialogueManager";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DialogueTrigger extends cc.Component {

    @property
    dialogueId: string = "";

    @property
    autoTrigger: boolean = true;

    @property
    oneShot: boolean = true;

    @property
    promptText: string = "Press E to talk";

    private triggered: boolean = false;
    private playerInRange: boolean = false;

    onLoad() {
        if (!this.autoTrigger) {
            cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        }
    }

    onDestroy() {
        if (!this.autoTrigger) {
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        }
    }

    onCollisionEnter(other: cc.Collider, _self: cc.Collider) {
        if (other.node.group !== "player") return;
        if (this.oneShot && this.triggered) return;

        if (this.autoTrigger) {
            this.fire();
        } else {
            this.playerInRange = true;
            EventBus.emit("ui:interaction-prompt", this.promptText);
        }
    }

    onCollisionExit(other: cc.Collider, _self: cc.Collider) {
        if (other.node.group !== "player") return;
        if (!this.autoTrigger) {
            this.playerInRange = false;
            EventBus.emit("ui:interaction-prompt", null);
        }
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        if (event.keyCode === cc.macro.KEY.e && this.playerInRange) {
            if (this.oneShot && this.triggered) return;
            this.fire();
        }
    }

    private fire(): void {
        const mgr = DialogueManager.instance;
        if (!mgr || mgr.isPlaying()) return;

        this.triggered = true;
        mgr.play(this.dialogueId);
    }
}
