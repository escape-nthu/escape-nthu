import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Toast extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    @property
    displayDuration: number = 2;

    onLoad() {
        this.node.opacity = 0;
        EventBus.on("ui:toast", this.show, this);
        EventBus.on("ui:interaction-prompt", this.onPrompt, this);
    }

    onDestroy() {
        EventBus.off("ui:toast", this.show, this);
        EventBus.off("ui:interaction-prompt", this.onPrompt, this);
    }

    show(message: string) {
        if (!this.label) return;

        this.label.string = message;
        cc.Tween.stopAllByTarget(this.node);

        cc.tween(this.node)
            .set({ opacity: 0 })
            .to(0.15, { opacity: 255 })
            .delay(this.displayDuration)
            .to(0.3, { opacity: 0 })
            .start();
    }

    private onPrompt(text: string | null) {
        if (!this.label) return;

        cc.Tween.stopAllByTarget(this.node);

        if (text) {
            this.label.string = text;
            cc.tween(this.node)
                .to(0.15, { opacity: 255 })
                .start();
        } else {
            cc.tween(this.node)
                .to(0.15, { opacity: 0 })
                .start();
        }
    }
}
