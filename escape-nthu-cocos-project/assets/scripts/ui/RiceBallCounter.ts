import EventBus from "../core/EventBus";
import GameState from "../core/GameState";

const { ccclass, property } = cc._decorator;

@ccclass
export default class RiceBallCounter extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    onLoad() {
        EventBus.on("riceball:count-changed", this.refresh, this);
        this.refresh();
    }

    onDestroy() {
        EventBus.off("riceball:count-changed", this.refresh, this);
    }

    private refresh(): void {
        const count = GameState.instance ? GameState.instance.getRiceBallCount() : 0;
        if (this.label) {
            this.label.string = `x ${count}`;
        }
        this.node.active = count > 0;
    }
}
