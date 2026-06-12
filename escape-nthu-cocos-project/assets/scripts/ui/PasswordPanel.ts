import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class PasswordPanel extends cc.Component {

    @property(cc.Node)
    panelRoot: cc.Node = null;

    @property(cc.Label)
    hintLabel: cc.Label = null;

    @property(cc.EditBox)
    inputBox: cc.EditBox = null;

    @property(cc.Node)
    submitButton: cc.Node = null;

    @property(cc.Node)
    closeButton: cc.Node = null;

    private callback: ((input: string) => void) | null = null;

    onLoad() {
        if (this.panelRoot) this.panelRoot.active = false;

        EventBus.on("ui:password-panel:open", this.onOpen, this);

        if (this.submitButton) {
            this.submitButton.on("click", this.onSubmit, this);
        }
        if (this.closeButton) {
            this.closeButton.on("click", this.close, this);
        }
        if (this.inputBox) {
            this.inputBox.node.on("editing-return", this.onSubmit, this);
        }

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    onDestroy() {
        EventBus.off("ui:password-panel:open", this.onOpen, this);

        if (this.submitButton) {
            this.submitButton.off("click", this.onSubmit, this);
        }
        if (this.closeButton) {
            this.closeButton.off("click", this.close, this);
        }
        if (this.inputBox) {
            this.inputBox.node.off("editing-return", this.onSubmit, this);
        }

        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private onOpen(data: { hintText: string; callback: (input: string) => void }) {
        this.callback = data.callback;

        if (this.hintLabel) this.hintLabel.string = data.hintText;
        if (this.inputBox) this.inputBox.string = "";
        if (this.panelRoot) this.panelRoot.active = true;

        EventBus.emit("dialogue:start", "password-panel");
    }

    private onSubmit() {
        if (!this.callback || !this.inputBox) return;

        const input = this.inputBox.string.trim();
        if (!input) return;

        const cb = this.callback;
        this.close();
        this.scheduleOnce(() => { cb(input); }, 0);
    }

    close() {
        if (this.panelRoot) this.panelRoot.active = false;
        if (this.inputBox) this.inputBox.string = "";
        this.callback = null;

        EventBus.emit("dialogue:end", "password-panel");
    }

    private onKeyDown(event: cc.Event.EventKeyboard) {
        if (!this.panelRoot || !this.panelRoot.active) return;

        if (event.keyCode === cc.macro.KEY.enter) {
            this.onSubmit();
        } else if (event.keyCode === cc.macro.KEY.escape) {
            this.close();
        }
    }
}
