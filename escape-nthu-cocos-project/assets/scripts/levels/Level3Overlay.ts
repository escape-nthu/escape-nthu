import { HeadRhythmAction } from "../vision/HeadRhythmDetector";

type OverlayPhase = "rhythm" | "raiseHands" | "completed";
type AudioCue = "beat" | "hit" | "miss" | "phaseClear" | "complete";

export default class Level3Overlay {
    private readonly root: cc.Node;
    private readonly graphics: cc.Graphics;
    private readonly labels: Record<string, cc.Label> = {};
    private readonly audio: Level3AudioCue;
    private phase: OverlayPhase = "rhythm";
    private pattern: HeadRhythmAction[] = [];
    private currentStep: number = 0;
    private peerStep: number = 0;
    private role: string = "";
    private activeAction: HeadRhythmAction = "none";
    private detectorAction: HeadRhythmAction = "none";
    private timingProgress: number = 0;
    private hitWindowActive: boolean = false;
    private localReady: boolean = false;
    private peerReady: boolean = false;
    private flashTimer: number = 0;
    private flashColor: cc.Color = cc.color(255, 255, 255, 0);
    private scanTime: number = 0;
    private viewWidth: number = 960;
    private viewHeight: number = 640;

    constructor(parent: cc.Node, audioVolume: number, audioEnabled: boolean) {
        this.root = new cc.Node("Level3OverlayRoot");
        this.root.parent = parent;
        this.refreshViewport();
        this.root.setPosition(0, 0);
        this.root.zIndex = 999;
        this.graphics = this.root.addComponent(cc.Graphics);
        this.audio = new Level3AudioCue(audioVolume, audioEnabled);
        this.createLabels();
    }

    destroy(): void {
        this.audio.close();
        this.root.destroy();
    }

    update(dt: number): void {
        this.refreshViewport();
        this.scanTime += dt;
        this.flashTimer = Math.max(0, this.flashTimer - dt);
        this.draw();
    }

    showRhythm(pattern: HeadRhythmAction[], currentStep: number, peerStep: number, role: string): void {
        this.phase = "rhythm";
        this.pattern = pattern;
        this.currentStep = currentStep;
        this.peerStep = peerStep;
        this.role = role;
        this.updateRhythmLabels();
    }

    updateRhythm(
        activeAction: HeadRhythmAction,
        timingProgress: number,
        hitWindowActive: boolean,
        detectorAction: HeadRhythmAction,
    ): void {
        this.activeAction = activeAction;
        this.timingProgress = timingProgress;
        this.hitWindowActive = hitWindowActive;
        this.detectorAction = detectorAction;
        this.updateRhythmLabels();
    }

    showRaiseHands(localReady: boolean, peerReady: boolean): void {
        this.phase = "raiseHands";
        this.localReady = localReady;
        this.peerReady = peerReady;
        this.updateRaiseHandsLabels();
    }

    flashHit(): void {
        this.flashTimer = 0.22;
        this.flashColor = cc.color(85, 255, 209, 130);
        this.audio.play("hit");
    }

    flashMiss(): void {
        this.flashTimer = 0.28;
        this.flashColor = cc.color(255, 72, 120, 145);
        this.audio.play("miss");
    }

    flashPhaseClear(): void {
        this.flashTimer = 0.45;
        this.flashColor = cc.color(255, 216, 92, 150);
        this.audio.play("phaseClear");
    }

    flashComplete(): void {
        this.phase = "completed";
        this.flashTimer = 0.7;
        this.flashColor = cc.color(255, 255, 255, 190);
        this.setLabel("title", "SIGNAL LINK COMPLETE");
        this.setLabel("subtitle", "AIR WALL OPEN");
        this.audio.play("complete");
    }

    playBeat(): void {
        this.audio.play("beat");
    }

    private createLabels(): void {
        this.labels.title = this.createLabel("title", "SIGNAL CALIBRATION", 32, 0, 260, cc.color(239, 255, 255));
        this.labels.subtitle = this.createLabel("subtitle", "SYNC THE BALCONY SIGNAL", 16, 0, 225, cc.color(129, 255, 226));
        this.labels.left = this.createLabel("left", "", 18, -330, -230, cc.color(255, 216, 92));
        this.labels.right = this.createLabel("right", "", 18, 330, -230, cc.color(255, 124, 178));
        this.labels.center = this.createLabel("center", "", 24, 0, -230, cc.color(255, 255, 255));
        this.labels.status = this.createLabel("status", "", 18, 0, 160, cc.color(189, 228, 255));
        this.labels.hint = this.createLabel("hint", "", 15, 0, -275, cc.color(190, 198, 215));
        this.labels.nodLane = this.createLabel("nodLane", "NOD", 14, -382, 52, cc.color(85, 255, 209), 84);
        this.labels.shakeLane = this.createLabel("shakeLane", "SHAKE", 14, -382, -52, cc.color(255, 124, 178), 84);
    }

    private createLabel(
        name: string,
        text: string,
        size: number,
        x: number,
        y: number,
        color: cc.Color,
        width: number = 760,
    ): cc.Label {
        const node = new cc.Node(name);
        node.parent = this.root;
        node.setPosition(x, y);
        node.setContentSize(width, size + 10);
        const label = node.addComponent(cc.Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 6;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;
        node.color = color;
        return label;
    }

    private updateRhythmLabels(): void {
        this.setLabel("title", "SIGNAL CALIBRATION");
        this.setLabel("subtitle", "PHASE 1 / HEAD RHYTHM");
        this.setLabel("left", "YOU " + this.currentStep + " / " + this.pattern.length);
        this.setLabel("right", "PARTNER " + this.peerStep + " / " + this.pattern.length);
        this.setLabel("center", this.actionText(this.activeAction));
        this.setLabel("status", this.role === "B" ? "FOLLOW YOUR PARTNER'S CALL" : this.patternText());
        this.setLabel("hint", this.hitWindowActive ? "HIT NOW / DETECTED " + this.actionText(this.detectorAction) : "WAIT FOR THE FRAME");
    }

    private updateRaiseHandsLabels(): void {
        this.setLabel("title", "SYNC GATE");
        this.setLabel("subtitle", "PHASE 2 / RAISE BOTH HANDS");
        this.setLabel("left", "YOU " + (this.localReady ? "READY" : "CHARGING"));
        this.setLabel("right", "PARTNER " + (this.peerReady ? "READY" : "WAITING"));
        this.setLabel("center", this.localReady ? "HOLD SIGNAL" : "RAISE HANDS");
        this.setLabel("status", "BOTH PLAYERS READY WITHIN 3 SECONDS");
        this.setLabel("hint", "KEEP YOUR HANDS ABOVE SHOULDERS");
    }

    private setLabel(key: string, value: string): void {
        const label = this.labels[key];
        if (label) label.string = value;
    }

    private draw(): void {
        const g = this.graphics;
        g.clear();
        this.drawBackdrop(g);
        this.drawFrame(g);
        if (this.phase === "rhythm") {
            this.drawRhythm(g);
        } else if (this.phase === "raiseHands") {
            this.drawSyncGate(g);
        } else {
            this.drawComplete(g);
        }
        this.drawFlash(g);
    }

    private drawBackdrop(g: cc.Graphics): void {
        const halfW = this.viewWidth / 2;
        const halfH = this.viewHeight / 2;
        g.fillColor = cc.color(5, 8, 18, 226);
        g.rect(-halfW, -halfH, this.viewWidth, this.viewHeight);
        g.fill();

        g.fillColor = cc.color(18, 22, 52, 145);
        for (let y = -halfH; y <= halfH; y += 24) {
            g.rect(-halfW, y + (this.scanTime * 18) % 24, this.viewWidth, 2);
            g.fill();
        }
    }

    private drawFrame(g: cc.Graphics): void {
        this.strokeRect(g, -420, -270, 840, 540, cc.color(85, 255, 209), 4);
        this.strokeRect(g, -398, -248, 796, 496, cc.color(255, 124, 178), 2);
        this.fillRect(g, -390, 196, 780, 3, cc.color(255, 216, 92, 210));
        this.fillRect(g, -390, -204, 780, 3, cc.color(85, 255, 209, 210));
    }

    private drawRhythm(g: cc.Graphics): void {
        const laneY = { nod: 52, shake: -52 };
        this.drawLane(g, "NOD", laneY.nod, cc.color(85, 255, 209));
        this.drawLane(g, "SHAKE", laneY.shake, cc.color(255, 124, 178));

        const targetX = 200;
        const blockX = -290 + this.timingProgress * 490;
        const blockY = this.activeAction === "shake" ? laneY.shake : laneY.nod;
        const blockColor = this.activeAction === "shake" ? cc.color(255, 124, 178) : cc.color(85, 255, 209);

        this.strokeRect(g, targetX - 34, -104, 68, 208, this.hitWindowActive ? cc.color(255, 216, 92) : cc.color(189, 228, 255), 4);
        this.fillRect(g, blockX - 28, blockY - 22, 56, 44, blockColor);
        this.strokeRect(g, blockX - 28, blockY - 22, 56, 44, cc.color(255, 255, 255), 2);

        const progressW = this.pattern.length > 0 ? 260 * (this.currentStep / this.pattern.length) : 0;
        this.strokeRect(g, -130, -174, 260, 18, cc.color(189, 228, 255), 2);
        this.fillRect(g, -130, -174, progressW, 18, cc.color(85, 255, 209, 230));
    }

    private drawLane(g: cc.Graphics, label: string, y: number, color: cc.Color): void {
        this.strokeRect(g, -320, y - 28, 560, 56, cc.color(75, 86, 130), 2);
        this.fillRect(g, -316, y - 24, 552, 48, cc.color(12, 17, 34, 190));
        this.fillRect(g, -316, y + 22, 552, 2, color);
        this.drawPixelTextBox(g, label, -382, y, color);
    }

    private drawSyncGate(g: cc.Graphics): void {
        this.drawChargeBar(g, -245, 34, this.localReady, cc.color(85, 255, 209));
        this.drawChargeBar(g, -245, -68, this.peerReady, cc.color(255, 124, 178));
        this.strokeRect(g, -90, -126, 180, 252, cc.color(255, 216, 92), 4);
        this.fillRect(g, -76, -112, 152, this.localReady && this.peerReady ? 224 : 78, cc.color(255, 216, 92, 160));
    }

    private drawChargeBar(g: cc.Graphics, x: number, y: number, ready: boolean, color: cc.Color): void {
        this.strokeRect(g, x, y, 490, 38, cc.color(189, 228, 255), 2);
        this.fillRect(g, x + 4, y + 4, ready ? 482 : 160, 30, color);
    }

    private drawComplete(g: cc.Graphics): void {
        this.strokeRect(g, -170, -88, 340, 176, cc.color(255, 216, 92), 4);
        this.fillRect(g, -156, -74, 312, 148, cc.color(85, 255, 209, 80));
    }

    private drawPixelTextBox(g: cc.Graphics, text: string, x: number, y: number, color: cc.Color): void {
        this.fillRect(g, x - 42, y - 18, 84, 36, cc.color(5, 8, 18, 235));
        this.strokeRect(g, x - 42, y - 18, 84, 36, color, 2);
    }

    private drawFlash(g: cc.Graphics): void {
        if (this.flashTimer <= 0) return;
        const halfW = this.viewWidth / 2;
        const halfH = this.viewHeight / 2;
        const alpha = Math.min(210, Math.floor(this.flashTimer * 420));
        g.fillColor = cc.color(this.flashColor.r, this.flashColor.g, this.flashColor.b, alpha);
        g.rect(-halfW, -halfH, this.viewWidth, this.viewHeight);
        g.fill();
    }

    private refreshViewport(): void {
        const size = cc.view.getVisibleSize();
        this.viewWidth = Math.max(960, size.width);
        this.viewHeight = Math.max(640, size.height);
        this.root.setContentSize(this.viewWidth, this.viewHeight);
    }

    private fillRect(g: cc.Graphics, x: number, y: number, w: number, h: number, color: cc.Color): void {
        g.fillColor = color;
        g.rect(x, y, w, h);
        g.fill();
    }

    private strokeRect(g: cc.Graphics, x: number, y: number, w: number, h: number, color: cc.Color, width: number): void {
        g.strokeColor = color;
        g.lineWidth = width;
        g.rect(x, y, w, h);
        g.stroke();
    }

    private patternText(): string {
        const labels: string[] = [];
        for (let i = 0; i < this.pattern.length; i += 1) {
            labels.push(this.actionText(this.pattern[i]).toUpperCase());
        }
        return labels.join("  /  ");
    }

    private actionText(action: HeadRhythmAction): string {
        if (action === "nod") return "NOD";
        if (action === "shake") return "SHAKE";
        return "-";
    }
}

class Level3AudioCue {
    private context: AudioContext | null = null;
    private readonly volume: number;
    private readonly enabled: boolean;

    constructor(volume: number, enabled: boolean) {
        this.volume = volume;
        this.enabled = enabled;
    }

    play(cue: AudioCue): void {
        if (!this.enabled) return;
        const context = this.getContext();
        if (!context) return;

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = cue === "miss" ? "sawtooth" : "square";
        oscillator.frequency.value = this.frequencyFor(cue);
        gain.gain.value = Math.max(0, Math.min(1, this.volume));
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + this.durationFor(cue));
        oscillator.stop(context.currentTime + this.durationFor(cue));
    }

    close(): void {
        this.context = null;
    }

    private getContext(): AudioContext | null {
        const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtor) return null;
        if (!this.context) {
            this.context = new AudioCtor();
        }
        const context = this.context;
        if (!context) return null;
        if (context.state === "suspended") {
            context.resume();
        }
        return context;
    }

    private frequencyFor(cue: AudioCue): number {
        switch (cue) {
            case "beat": return 330;
            case "hit": return 660;
            case "miss": return 150;
            case "phaseClear": return 880;
            case "complete": return 1040;
        }
    }

    private durationFor(cue: AudioCue): number {
        return cue === "complete" || cue === "phaseClear" ? 0.28 : 0.11;
    }
}
