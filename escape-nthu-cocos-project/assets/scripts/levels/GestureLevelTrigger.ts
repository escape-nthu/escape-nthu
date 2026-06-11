import EventBus from "../core/EventBus";
import Interactable from "../map/Interactable";

const { ccclass } = cc._decorator;

@ccclass
export default class GestureLevelTrigger extends Interactable {
    protected onInteract(): void {
        EventBus.emit("gesture-level:start");
    }
}
