import FirebaseAuthClient, { AuthSession } from "../auth/FirebaseAuthClient";
import EventBus from "../core/EventBus";

const { ccclass } = cc._decorator;

type MenuMode = "home" | "auth" | "settings";

const STORAGE_VOLUME = "escape-nthu:volume";
const STORAGE_AUDIO_ENABLED = "escape-nthu:audioEnabled";
const STORAGE_API_BASE = "escape-nthu:apiBaseUrl";

@ccclass
export default class HomeMenu extends cc.Component {
    private overlay: cc.Node | null = null;
    private content: cc.Node | null = null;
    private statusLabel: cc.Label | null = null;
    private sessionLabel: cc.Label | null = null;
    private apiBaseEdit: cc.EditBox | null = null;
    private roomEdit: cc.EditBox | null = null;
    private firebaseKeyEdit: cc.EditBox | null = null;
    private emailEdit: cc.EditBox | null = null;
    private passwordEdit: cc.EditBox | null = null;
    private volumeLabel: cc.Label | null = null;
    private volume: number = 0.7;
    private audioEnabled: boolean = true;
    private mode: MenuMode = "home";
    private session: AuthSession | null = null;

    onLoad(): void {
        this.volume = this.loadNumber(STORAGE_VOLUME, 0.7);
        this.audioEnabled = this.loadBoolean(STORAGE_AUDIO_ENABLED, true);
        this.session = FirebaseAuthClient.getSavedSession();
        this.applyVolume();
        this.build();
        this.renderHome();
        EventBus.on("network:room-connected", this.onRoomConnected, this);
        EventBus.on("network:room-error", this.onRoomError, this);
    }

    onDestroy(): void {
        EventBus.off("network:room-connected", this.onRoomConnected, this);
        EventBus.off("network:room-error", this.onRoomError, this);
    }

    show(): void {
        if (this.overlay) this.overlay.active = true;
    }

    private build(): void {
        this.overlay = this.node.getChildByName("HomeMenuOverlay") || new cc.Node("HomeMenuOverlay");
        this.overlay.parent = this.node;
        this.overlay.group = "ui";
        this.overlay.setContentSize(960, 640);
        this.overlay.setPosition(0, 0);
        this.overlay.zIndex = 999;

        const bg = this.overlay.addComponent(cc.Graphics);
        bg.clear();
        bg.fillColor = cc.color(12, 16, 28, 238);
        bg.roundRect(-480, -320, 960, 640, 0);
        bg.fill();

        this.content = new cc.Node("HomeMenuContent");
        this.content.parent = this.overlay;
        this.content.group = "ui";
        this.content.setPosition(0, 32);

        const title = this.createLabel("逃離清大", 42, cc.color(246, 241, 222), true);
        title.node.name = "HomeMenuStaticTitle";
        title.node.parent = this.content;
        title.node.setPosition(0, 210);

        const subtitle = this.createLabel("Delta Protocol", 20, cc.color(120, 216, 255));
        subtitle.node.name = "HomeMenuStaticSubtitle";
        subtitle.node.parent = this.content;
        subtitle.node.setPosition(0, 168);

        this.statusLabel = this.createLabel("", 18, cc.color(255, 218, 125));
        this.statusLabel.node.name = "HomeMenuStaticStatus";
        this.statusLabel.node.parent = this.content;
        this.statusLabel.node.setPosition(0, -222);

        this.sessionLabel = this.createLabel("", 16, cc.color(184, 205, 226));
        this.sessionLabel.node.name = "HomeMenuStaticSession";
        this.sessionLabel.node.parent = this.content;
        this.sessionLabel.node.setPosition(0, 130);
    }

    private renderHome(): void {
        this.mode = "home";
        this.clearDynamic();
        this.refreshSessionLabel();
        this.createMenuButton("進入遊戲", 72, () => this.startGame());
        this.createMenuButton("遊戲音量設定", 16, () => this.renderSettings());
        this.createMenuButton("註冊", -40, () => this.renderAuth("register"));
        this.createMenuButton("登入", -96, () => this.renderAuth("login"));
        if (this.session) {
            this.createMenuButton("登出", -152, () => this.logout(), cc.color(92, 110, 130));
        }
    }

    private renderSettings(): void {
        if (!this.content) return;
        this.mode = "settings";
        this.clearDynamic();
        this.refreshSessionLabel();
        this.volumeLabel = this.createLabel("", 20, cc.color(246, 241, 222));
        this.volumeLabel.node.name = "HomeMenuDynamicVolume";
        this.volumeLabel.node.parent = this.content;
        this.volumeLabel.node.setPosition(0, 60);
        this.refreshVolumeLabel();

        this.createMenuButton("音量 -", 8, () => this.adjustVolume(-0.1), cc.color(48, 98, 132), -76);
        this.createMenuButton("音量 +", 8, () => this.adjustVolume(0.1), cc.color(48, 132, 104), 76);
        this.createMenuButton(this.audioEnabled ? "關閉音效" : "開啟音效", -50, () => this.toggleAudio(), cc.color(84, 82, 132));
        this.createMenuButton("返回", -108, () => this.renderHome(), cc.color(92, 110, 130));
    }

    private renderAuth(intent: "register" | "login"): void {
        this.mode = "auth";
        this.clearDynamic();
        this.refreshSessionLabel();

        this.firebaseKeyEdit = this.createEditBox("Firebase Web API Key", FirebaseAuthClient.getConfiguredApiKey(), 82, false);
        this.emailEdit = this.createEditBox("Email", this.session ? this.session.email : "", 28, false);
        this.passwordEdit = this.createEditBox("Password", "", -26, true);
        this.createMenuButton(intent === "register" ? "建立帳號" : "登入帳號", -90, async () => this.submitAuth(intent));
        this.createMenuButton("返回", -148, () => this.renderHome(), cc.color(92, 110, 130));
    }

    private async submitAuth(intent: "register" | "login"): Promise<void> {
        if (!this.firebaseKeyEdit || !this.emailEdit || !this.passwordEdit) return;
        const apiKey = this.firebaseKeyEdit.string.trim();
        FirebaseAuthClient.saveApiKey(apiKey);
        this.setStatus(intent === "register" ? "註冊中..." : "登入中...");

        const result = intent === "register"
            ? await FirebaseAuthClient.register(this.emailEdit.string, this.passwordEdit.string, apiKey)
            : await FirebaseAuthClient.login(this.emailEdit.string, this.passwordEdit.string, apiKey);

        this.setStatus(result.message);
        if (result.ok) {
            this.session = result.session || null;
            this.renderHome();
        }
    }

    private startGame(): void {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_API_BASE, this.getApiBaseUrl());
        }
        this.setStatus("連線後端並準備房間中...");
        EventBus.emit("lobby:start-game", {
            apiBaseUrl: this.getApiBaseUrl(),
            roomId: this.getRoomId(),
            auth: this.session,
            volume: this.volume,
            audioEnabled: this.audioEnabled,
        });
    }

    private onRoomConnected(payload: { roomId: string; role: string }): void {
        this.setStatus(`已進入房間 ${payload.roomId}，你是 Player ${payload.role}`);
        if (this.overlay) this.overlay.active = false;
    }

    private onRoomError(message: string): void {
        this.show();
        this.setStatus(message || "多人連線失敗");
    }

    private logout(): void {
        FirebaseAuthClient.logout();
        this.session = null;
        this.setStatus("已登出，可用訪客身分進入遊戲");
        this.renderHome();
    }

    private getApiBaseUrl(): string {
        return (this.apiBaseEdit && this.apiBaseEdit.string.trim()) || this.loadString(STORAGE_API_BASE, "http://localhost:8787");
    }

    private getRoomId(): string {
        return this.roomEdit ? this.roomEdit.string.trim().toUpperCase() : "";
    }

    private clearDynamic(): void {
        if (!this.content) return;
        const content = this.content;
        for (let i = content.children.length - 1; i >= 0; i -= 1) {
            const child = content.children[i];
            if (child.name.indexOf("HomeMenuDynamic") === 0) {
                child.destroy();
            }
        }

        this.apiBaseEdit = this.createEditBox("後端 API URL", this.loadString(STORAGE_API_BASE, "http://localhost:8787"), 118, false);
        this.roomEdit = this.createEditBox("房號（空白建立新房）", this.loadString("escape-nthu:roomId", ""), 64, false);
    }

    private createMenuButton(text: string, y: number, handler: () => void, color = cc.color(35, 120, 180), x = 0): cc.Node | null {
        if (!this.content) return null;
        const buttonNode = new cc.Node(`HomeMenuDynamicButton-${text}`);
        buttonNode.parent = this.content;
        buttonNode.group = "ui";
        buttonNode.setContentSize(x === 0 ? 230 : 130, 42);
        buttonNode.setPosition(x, y);

        const gfx = buttonNode.addComponent(cc.Graphics);
        gfx.fillColor = color;
        gfx.roundRect(-buttonNode.width / 2, -buttonNode.height / 2, buttonNode.width, buttonNode.height, 6);
        gfx.fill();

        const button = buttonNode.addComponent(cc.Button);
        button.transition = cc.Button.Transition.SCALE;
        button.zoomScale = 0.96;
        buttonNode.on("click", handler, this);

        const label = this.createLabel(text, 18, cc.color(255, 255, 255), true);
        label.node.parent = buttonNode;
        label.node.setPosition(0, -1);
        return buttonNode;
    }

    private createEditBox(placeholder: string, value: string, y: number, password: boolean): cc.EditBox | null {
        if (!this.content) return null;
        const node = new cc.Node(`HomeMenuDynamicEdit-${placeholder}`);
        node.parent = this.content;
        node.group = "ui";
        node.setContentSize(330, 38);
        node.setPosition(0, y);

        const bg = node.addComponent(cc.Graphics);
        bg.fillColor = cc.color(232, 238, 245, 245);
        bg.roundRect(-165, -19, 330, 38, 5);
        bg.fill();

        const edit = node.addComponent(cc.EditBox);
        edit.string = value;
        edit.placeholder = placeholder;
        edit.fontSize = 16;
        edit.placeholderFontSize = 16;
        edit.maxLength = password ? 64 : 160;
        edit.inputFlag = password ? cc.EditBox.InputFlag.PASSWORD : cc.EditBox.InputFlag.DEFAULT;
        edit.textLabel && (edit.textLabel.node.color = cc.color(20, 28, 40));
        edit.placeholderLabel && (edit.placeholderLabel.node.color = cc.color(100, 110, 124));
        return edit;
    }

    private createLabel(text: string, fontSize: number, color: cc.Color, bold = false): cc.Label {
        const node = new cc.Node(`HomeMenuLabel-${text}`);
        node.group = "ui";
        const label = node.addComponent(cc.Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;
        label.node.color = color;
        if (bold) {
            label.enableBold = true;
        }
        return label;
    }

    private adjustVolume(delta: number): void {
        this.volume = Math.max(0, Math.min(1, Math.round((this.volume + delta) * 10) / 10));
        this.saveAudio();
        this.applyVolume();
        this.renderSettings();
    }

    private toggleAudio(): void {
        this.audioEnabled = !this.audioEnabled;
        this.saveAudio();
        this.applyVolume();
        this.renderSettings();
    }

    private refreshVolumeLabel(): void {
        if (!this.volumeLabel) return;
        this.volumeLabel.string = `音量 ${Math.round(this.volume * 100)}% / 音效 ${this.audioEnabled ? "開" : "關"}`;
    }

    private refreshSessionLabel(): void {
        if (!this.sessionLabel) return;
        this.sessionLabel.string = this.session ? `目前登入：${this.session.email}` : "目前模式：訪客";
    }

    private setStatus(message: string): void {
        if (this.statusLabel) this.statusLabel.string = message;
    }

    private applyVolume(): void {
        cc.audioEngine.setEffectsVolume(this.audioEnabled ? this.volume : 0);
        cc.audioEngine.setMusicVolume(this.audioEnabled ? this.volume : 0);
    }

    private saveAudio(): void {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(STORAGE_VOLUME, String(this.volume));
        localStorage.setItem(STORAGE_AUDIO_ENABLED, this.audioEnabled ? "1" : "0");
    }

    private loadString(key: string, fallback: string): string {
        if (typeof localStorage === "undefined") return fallback;
        return localStorage.getItem(key) || fallback;
    }

    private loadNumber(key: string, fallback: number): number {
        const raw = this.loadString(key, "");
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    }

    private loadBoolean(key: string, fallback: boolean): boolean {
        const raw = this.loadString(key, "");
        if (raw === "1") return true;
        if (raw === "0") return false;
        return fallback;
    }
}
