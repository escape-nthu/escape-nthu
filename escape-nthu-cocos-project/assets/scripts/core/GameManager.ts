import HomeMenu from "../ui/HomeMenu";

const { ccclass, property } = cc._decorator;

// Group indices matching settings/project.json group-list
const GAME_GROUPS = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5);
const UI_GROUP = 1 << 6;

@ccclass
export default class GameManager extends cc.Component {

    @property(cc.Camera)
    gameCamera: cc.Camera = null;

    @property(cc.Camera)
    uiCamera: cc.Camera = null;

    onLoad() {
        const collisionMgr = cc.director.getCollisionManager();
        collisionMgr.enabled = true;
        collisionMgr.enabledDebugDraw = true; // TODO: disable for production

        if (this.gameCamera) {
            this.gameCamera.cullingMask = GAME_GROUPS;
            this.gameCamera.depth = 0;
            this.gameCamera.clearFlags =
                cc.Camera.ClearFlags.COLOR | cc.Camera.ClearFlags.DEPTH | cc.Camera.ClearFlags.STENCIL;
            this.gameCamera.backgroundColor = cc.color(20, 20, 30, 255);
        }

        if (this.uiCamera) {
            this.uiCamera.cullingMask = UI_GROUP;
            this.uiCamera.depth = 1;
            // Don't clear color so game world shows through; only clear depth
            this.uiCamera.clearFlags =
                cc.Camera.ClearFlags.DEPTH | cc.Camera.ClearFlags.STENCIL;
        }

        this.installHomeMenu();
    }

    private installHomeMenu(): void {
        const uiCanvas = cc.find("UICanvas") || this.node;
        if (!uiCanvas.getComponent(HomeMenu)) {
            uiCanvas.addComponent(HomeMenu);
        }
    }
}
