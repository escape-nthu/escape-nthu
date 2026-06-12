import EventBus from "../core/EventBus";
import GameState, { ClueEntry } from "../core/GameState";

const { ccclass, property } = cc._decorator;

@ccclass
export default class NotebookPanel extends cc.Component {

    @property(cc.Node)
    contentNode: cc.Node = null;

    @property(cc.Prefab)
    clueEntryPrefab: cc.Prefab = null;

    @property({ type: cc.Node, tooltip: "放在 Panel 外面的開關按鈕，需要有 cc.Button" })
    toggleButton: cc.Node = null;

    private isOpen: boolean = false;
    private dialogueLocked: boolean = false;
    private chaseLocked: boolean = false;

    onLoad() {
        this.node.active = false;
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.on("clue:collected", this.onClueCollected, this);
        EventBus.on("dialogue:start", this.onDialogueStart, this);
        EventBus.on("dialogue:end", this.onDialogueEnd, this);
        EventBus.on("chase:start", this.onChaseStart, this);
        EventBus.on("chase:end", this.onChaseEnd, this);

        if (this.toggleButton) {
            this.toggleButton.on("click", this.toggle, this);
        }
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.off("clue:collected", this.onClueCollected, this);
        EventBus.off("dialogue:start", this.onDialogueStart, this);
        EventBus.off("dialogue:end", this.onDialogueEnd, this);
        EventBus.off("chase:start", this.onChaseStart, this);
        EventBus.off("chase:end", this.onChaseEnd, this);

        if (this.toggleButton) {
            this.toggleButton.off("click", this.toggle, this);
        }
    }

    private onDialogueStart() {
        this.dialogueLocked = true;
        if (this.isOpen) {
            this.isOpen = false;
            this.node.active = false;
        }
    }

    private onDialogueEnd() {
        this.dialogueLocked = false;
    }

    private onChaseStart() {
        this.chaseLocked = true;
        if (this.isOpen) {
            this.isOpen = false;
            this.node.active = false;
        }
    }

    private onChaseEnd() {
        this.chaseLocked = false;
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        if (event.keyCode === cc.macro.KEY.tab) {
            event.stopPropagation();
            this.toggle();
        }
    }

    toggle() {
        if (this.dialogueLocked || this.chaseLocked) return;
        this.isOpen = !this.isOpen;
        this.node.active = this.isOpen;
        if (this.isOpen) {
            this.refreshDisplay();
        }
    }

    private onClueCollected(_clueId: string) {
        if (this.isOpen) {
            this.refreshDisplay();
        }
    }

    private refreshDisplay() {
        if (!this.contentNode) return;
        this.contentNode.removeAllChildren();

        const state = GameState.instance;
        if (!state) return;

        const entries: ClueEntry[] = state.getAllClues();

        for (const entry of entries) {
            if (this.clueEntryPrefab) {
                const node = cc.instantiate(this.clueEntryPrefab);
                const label = node.getComponentInChildren(cc.Label);
                if (label) {
                    label.string = `[${entry.category}] ${entry.text}`;
                }
                this.contentNode.addChild(node);
            } else {
                // Fallback: create a simple label node
                const node = new cc.Node("clue_" + entry.clueId);
                const label = node.addComponent(cc.Label);
                label.string = `[${entry.category}] ${entry.text}`;
                label.fontSize = 18;
                label.lineHeight = 24;
                label.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
                this.contentNode.addChild(node);
            }
        }
    }
}
