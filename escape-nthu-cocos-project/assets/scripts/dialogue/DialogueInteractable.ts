import Interactable from "../map/Interactable";
import DialogueManager from "./DialogueManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DialogueInteractable extends Interactable {

    @property
    dialogueId: string = "";

    protected onInteract(): void {
        const mgr = DialogueManager.instance;
        if (!mgr || mgr.isPlaying()) return;
        mgr.play(this.dialogueId);
    }
}
