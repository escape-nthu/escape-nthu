import { DialogueSequence, DialogueAction } from "./DialogueData";
import DialoguePanel from "./DialoguePanel";
import GameState from "../core/GameState";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DialogueManager extends cc.Component {

    static instance: DialogueManager = null;

    @property(DialoguePanel)
    panel: DialoguePanel = null;

    private cache: Map<string, DialogueSequence> = new Map();
    private currentSeq: DialogueSequence = null;
    private currentIndex: number = 0;
    private playing: boolean = false;
    private chaseBlocked: boolean = false;

    onLoad() {
        if (DialogueManager.instance) {
            this.node.destroy();
            return;
        }
        DialogueManager.instance = this;

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.advance, this);
        EventBus.on("chase:start", this.onChaseStart, this);
        EventBus.on("chase:end", this.onChaseEnd, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        this.node.off(cc.Node.EventType.TOUCH_END, this.advance, this);
        EventBus.off("chase:start", this.onChaseStart, this);
        EventBus.off("chase:end", this.onChaseEnd, this);
    }

    private onChaseStart() { this.chaseBlocked = true; }
    private onChaseEnd() { this.chaseBlocked = false; }

    isPlaying(): boolean {
        return this.playing;
    }

    play(dialogueId: string): void {
        if (this.playing) {
            cc.warn("[DialogueManager] play(%s) ignored — already playing", dialogueId);
            return;
        }
        if (this.chaseBlocked) {
            cc.warn("[DialogueManager] play(%s) blocked — chase active", dialogueId);
            return;
        }

        cc.log("[DialogueManager] play(%s)", dialogueId);

        const cached = this.cache.get(dialogueId);
        if (cached) {
            this.startSequence(cached);
            return;
        }

        cc.resources.load("dialogues/" + dialogueId, cc.JsonAsset, (err: Error, asset: cc.JsonAsset) => {
            if (err) {
                cc.error("[DialogueManager] Failed to load dialogue: %s", dialogueId, err);
                return;
            }
            cc.log("[DialogueManager] loaded %s, starting sequence", dialogueId);
            const seq = asset.json as DialogueSequence;
            this.cache.set(dialogueId, seq);
            this.startSequence(seq);
        });
    }

    private startSequence(seq: DialogueSequence): void {
        if (!this.checkConditions(seq)) return;

        this.currentSeq = seq;
        this.currentIndex = 0;
        this.playing = true;

        EventBus.emit("dialogue:start", seq.id);
        this.showCurrentLine();
    }

    advance(): void {
        if (!this.playing) return;

        this.currentIndex++;
        if (this.currentIndex >= this.currentSeq.lines.length) {
            this.endDialogue();
        } else {
            this.showCurrentLine();
        }
    }

    private showCurrentLine(): void {
        const line = this.currentSeq.lines[this.currentIndex];
        if (this.panel) {
            this.panel.showLine(line);
        }
    }

    private endDialogue(): void {
        if (this.panel) {
            this.panel.hide();
        }

        const actions = this.currentSeq.onComplete;
        for (const action of actions) {
            this.executeAction(action);
        }

        const seqId = this.currentSeq.id;
        this.currentSeq = null;
        this.currentIndex = 0;
        this.playing = false;

        EventBus.emit("dialogue:end", seqId);
    }

    private executeAction(action: DialogueAction): void {
        const state = GameState.instance;
        if (!state) return;

        switch (action.type) {
            case "setFlag":
                if (action.flag) state.setFlag(action.flag);
                break;
            case "unlockDoor":
                if (action.doorId) state.unlockDoor(action.doorId);
                break;
            case "lockDoor":
                if (action.doorId) state.lockDoor(action.doorId);
                break;
            case "collectClue":
                if (action.clueId) {
                    state.collectClue({
                        clueId: action.clueId,
                        text: action.text || "",
                        category: action.category || "general",
                    });
                }
                break;
            case "emitEvent":
                if (action.event) {
                    EventBus.emit(action.event, action.data);
                }
                break;
        }
    }

    private checkConditions(seq: DialogueSequence): boolean {
        const state = GameState.instance;
        if (!state || !seq.conditions) return true;

        const { requireFlags, excludeFlags } = seq.conditions;

        if (requireFlags) {
            for (const flag of requireFlags) {
                if (!state.hasFlag(flag)) return false;
            }
        }

        if (excludeFlags) {
            for (const flag of excludeFlags) {
                if (state.hasFlag(flag)) return false;
            }
        }

        return true;
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        if (!this.playing) return;
        if (event.keyCode === cc.macro.KEY.space || event.keyCode === cc.macro.KEY.enter) {
            this.advance();
        }
    }
}
