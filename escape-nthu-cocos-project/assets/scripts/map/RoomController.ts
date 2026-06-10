const { ccclass, property } = cc._decorator;

@ccclass
export default class RoomController extends cc.Component {

    @property
    roomWidth: number = 960;

    @property
    roomHeight: number = 640;

    getRoomSize(): cc.Size {
        return cc.size(this.roomWidth, this.roomHeight);
    }
}
