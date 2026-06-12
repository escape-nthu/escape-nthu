import Interactable from "./Interactable";
import GameState from "../core/GameState";
import EventBus from "../core/EventBus";
import DialogueManager from "../dialogue/DialogueManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class PasswordLock extends Interactable {

    @property({ tooltip: "正確密碼" })
    password: string = "";

    @property({ tooltip: "解鎖成功後開啟的門 ID" })
    doorId: string = "";

    @property({ tooltip: "輸入框上方的提示文字" })
    hintText: string = "請輸入密碼";

    @property({ tooltip: "解鎖成功後顯示的 Toast 訊息" })
    successMessage: string = "門已解鎖！";

    @property({ tooltip: "密碼錯誤時的 Toast 訊息" })
    failMessage: string = "密碼錯誤。";

    @property({ tooltip: "解鎖成功後觸發的對話 ID（留空 = 不觸發）" })
    dialogueId: string = "";

    private unlocked: boolean = false;

    protected onInteract(): void {
        if (this.unlocked) {
            EventBus.emit("ui:toast", "這裡已經解鎖了。");
            return;
        }

        if (GameState.instance && !GameState.instance.isDoorLocked(this.doorId)) {
            this.unlocked = true;
            EventBus.emit("ui:toast", "這裡已經解鎖了。");
            return;
        }

        EventBus.emit("ui:password-panel:open", {
            hintText: this.hintText,
            callback: (input: string) => this.onSubmit(input),
        });
    }

    private onSubmit(input: string): void {
        if (input === this.password) {
            this.unlocked = true;

            if (GameState.instance) {
                GameState.instance.unlockDoor(this.doorId);
            }

            EventBus.emit("ui:toast", this.successMessage);

            if (this.dialogueId) {
                const mgr = DialogueManager.instance;
                cc.log("[PasswordLock] dialogueId=%s, mgr=%s, isPlaying=%s",
                    this.dialogueId, !!mgr, mgr ? mgr.isPlaying() : "N/A");
                if (mgr && !mgr.isPlaying()) {
                    mgr.play(this.dialogueId);
                }
            }
        } else {
            EventBus.emit("ui:toast", this.failMessage);
        }
    }
}
