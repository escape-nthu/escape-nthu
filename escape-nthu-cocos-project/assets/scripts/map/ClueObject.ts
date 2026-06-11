import Interactable from "./Interactable";
import GameState from "../core/GameState";
import EventBus from "../core/EventBus";
import DialogueManager from "../dialogue/DialogueManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class ClueObject extends Interactable {

    @property
    clueId: string = "";

    @property
    clueText: string = "";

    @property
    clueCategory: string = "general";

    @property({ tooltip: "撿起後觸發的對話 ID（留空 = 不觸發對話）" })
    dialogueId: string = "";

    private collected: boolean = false;

    protected onInteract(): void {
        if (this.collected) return;

        const state = GameState.instance;
        if (state && state.hasClue(this.clueId)) {
            this.collected = true;
            return;
        }

        if (state) {
            state.collectClue({
                clueId: this.clueId,
                text: this.clueText,
                category: this.clueCategory,
            });
        }

        this.collected = true;

        EventBus.emit("ui:show-clue", {
            clueId: this.clueId,
            text: this.clueText,
            category: this.clueCategory,
        });

        cc.tween(this.node)
            .to(0.3, { opacity: 80 })
            .start();

        if (this.dialogueId) {
            const mgr = DialogueManager.instance;
            if (mgr && !mgr.isPlaying()) {
                mgr.play(this.dialogueId);
            }
        }
    }
}
