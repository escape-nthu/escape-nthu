const { ccclass, property } = cc._decorator;

@ccclass
export default class GameManager extends cc.Component {

    @property(cc.Node)
    roomContainer: cc.Node = null;

    onLoad() {
        const collisionMgr = cc.director.getCollisionManager();
        collisionMgr.enabled = true;
        collisionMgr.enabledDebugDraw = true; // TODO: disable for production
    }
}
