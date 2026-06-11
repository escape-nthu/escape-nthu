import { DialogueLine } from "./DialogueData";

const { ccclass, property } = cc._decorator;

const ACTIVE_OPACITY = 255;
const DIM_OPACITY = 100;

@ccclass
export default class DialoguePanel extends cc.Component {

    @property(cc.Node)
    panelRoot: cc.Node = null;

    @property(cc.Label)
    nameLabel: cc.Label = null;

    @property(cc.Label)
    textLabel: cc.Label = null;

    @property(cc.Sprite)
    portraitLeft: cc.Sprite = null;

    @property(cc.Sprite)
    portraitRight: cc.Sprite = null;

    onLoad() {
        if (this.panelRoot) {
            this.panelRoot.active = false;
        }
    }

    showLine(line: DialogueLine): void {
        if (this.panelRoot) {
            this.panelRoot.active = true;
        }

        if (this.nameLabel) {
            this.nameLabel.string = line.speaker;
        }

        if (this.textLabel) {
            this.textLabel.string = line.text;
        }

        this.updatePortrait(this.portraitLeft, line.portraitLeft, line.activeSide === "left");
        this.updatePortrait(this.portraitRight, line.portraitRight, line.activeSide === "right");
    }

    hide(): void {
        if (this.panelRoot) {
            this.panelRoot.active = false;
        }
    }

    private updatePortrait(sprite: cc.Sprite, path: string | null, isActive: boolean): void {
        if (!sprite) return;

        if (!path) {
            sprite.node.active = false;
            return;
        }

        sprite.node.active = true;
        sprite.node.opacity = isActive ? ACTIVE_OPACITY : DIM_OPACITY;

        cc.resources.load(path, cc.SpriteFrame, (err: Error, frame: cc.SpriteFrame) => {
            if (err) {
                cc.warn(`Failed to load portrait: ${path}`);
                return;
            }
            if (sprite.isValid) {
                sprite.spriteFrame = frame;
            }
        });
    }
}
