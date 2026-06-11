import Interactable from "./Interactable";
import GameState from "../core/GameState";
import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class ClueObject extends Interactable {

    @property
    clueId: string = "";

    @property
    clueText: string = "";

    @property
    clueCategory: string = "general";

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

        // Visual feedback: fade out the clue object
        cc.tween(this.node)
            .to(0.3, { opacity: 80 })
            .start();
    }
}
