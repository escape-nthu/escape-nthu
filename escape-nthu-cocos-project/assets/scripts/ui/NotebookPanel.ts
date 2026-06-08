import EventBus from "../core/EventBus";
import GameState from "../core/GameState";

const { ccclass, property } = cc._decorator;

interface ClueEntry {
    clueId: string;
    text: string;
    category: string;
}

@ccclass
export default class NotebookPanel extends cc.Component {

    @property(cc.Node)
    contentNode: cc.Node = null;

    @property(cc.Prefab)
    clueEntryPrefab: cc.Prefab = null;

    private isOpen: boolean = false;
    private clueEntries: ClueEntry[] = [];

    onLoad() {
        this.node.active = false;
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.on("ui:show-clue", this.onShowClue, this);
        EventBus.on("clue:collected", this.onClueCollected, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        EventBus.off("ui:show-clue", this.onShowClue, this);
        EventBus.off("clue:collected", this.onClueCollected, this);
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        if (event.keyCode === cc.macro.KEY.tab) {
            event.stopPropagation();
            this.toggle();
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.node.active = this.isOpen;
        if (this.isOpen) {
            this.refreshDisplay();
        }
    }

    private onShowClue(data: ClueEntry) {
        if (!this.clueEntries.find(e => e.clueId === data.clueId)) {
            this.clueEntries.push(data);
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

        for (const entry of this.clueEntries) {
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
