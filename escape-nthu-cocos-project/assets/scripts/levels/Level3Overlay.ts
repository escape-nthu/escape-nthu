import { HeadRhythmAction } from "../vision/HeadRhythmDetector";

type OverlayPhase = "rhythm" | "raiseHands" | "completed";
type AudioCue = "beat" | "hit" | "miss" | "phaseClear" | "complete";
export type Level3Difficulty = "easy" | "normal" | "hard";

export type Level3OverlayOptions = {
    audioVolume: number;
    audioEnabled: boolean;
    hitSoundUrls: string[];
    missSoundUrls: string[];
    difficulty: Level3Difficulty;
    onDifficultyChange: (difficulty: Level3Difficulty) => void;
};

export default class Level3Overlay {
    private readonly root: cc.Node;
    private readonly graphics: cc.Graphics;
    private readonly labels: Record<string, cc.Label> = {};
    private readonly difficultyButtons: Array<{ difficulty: Level3Difficulty; x: number; y: number; w: number; h: number }> = [];
    private readonly audio: Level3AudioCue;
    private readonly onDifficultyChange: (difficulty: Level3Difficulty) => void;
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
    private difficulty: Level3Difficulty = "normal";

    constructor(parent: cc.Node, options: Level3OverlayOptions) {
        this.root = new cc.Node("Level3OverlayRoot");
        this.root.parent = parent;
        this.refreshViewport();
        this.root.setPosition(0, 0);
        this.root.zIndex = 999;
        this.graphics = this.root.addComponent(cc.Graphics);
        this.audio = new Level3AudioCue(
            options.audioVolume,
            options.audioEnabled,
            options.hitSoundUrls,
            options.missSoundUrls,
        );
        this.difficulty = options.difficulty;
        this.onDifficultyChange = options.onDifficultyChange;
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
        this.setLabel("title", "訊號同步完成");
        this.setLabel("subtitle", "空氣牆已開啟");
        this.audio.play("complete");
    }

    playBeat(): void {
        this.audio.play("beat");
    }

    setDifficulty(difficulty: Level3Difficulty): void {
        this.difficulty = difficulty;
        this.updateDifficultyLabels();
    }

    private createLabels(): void {
        this.labels.title = this.createLabel("title", "陽台訊號校準", 32, 0, 286, cc.color(239, 255, 255));
        this.labels.subtitle = this.createLabel("subtitle", "跟著節拍完成點頭與搖頭", 16, 0, 246, cc.color(129, 255, 226));
        this.labels.left = this.createLabel("left", "", 18, -330, -230, cc.color(255, 216, 92));
        this.labels.right = this.createLabel("right", "", 18, 330, -230, cc.color(255, 124, 178));
        this.labels.center = this.createLabel("center", "", 24, 0, -230, cc.color(255, 255, 255));
        this.labels.status = this.createLabel("status", "", 18, 0, 160, cc.color(189, 228, 255));
        this.labels.hint = this.createLabel("hint", "", 15, 0, -304, cc.color(190, 198, 215));
        this.labels.nodLane = this.createLabel("nodLane", "點頭", 14, -406, 52, cc.color(85, 255, 209), 84);
        this.labels.shakeLane = this.createLabel("shakeLane", "搖頭", 14, -406, -52, cc.color(255, 124, 178), 84);
        this.labels.difficultyTitle = this.createLabel("difficultyTitle", "難度", 14, 246, 286, cc.color(190, 198, 215), 54);
        this.createDifficultyButton("easy", "簡單", 302, 286, cc.color(85, 255, 209));
        this.createDifficultyButton("normal", "普通", 362, 286, cc.color(255, 216, 92));
        this.createDifficultyButton("hard", "挑戰", 422, 286, cc.color(255, 124, 178));
        this.updateDifficultyLabels();
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

    private createDifficultyButton(
        difficulty: Level3Difficulty,
        text: string,
        x: number,
        y: number,
        color: cc.Color,
    ): void {
        const label = this.createLabel("difficulty-" + difficulty, text, 13, x, y, color, 50);
        const node = label.node;
        node.setContentSize(54, 30);
        node.on(cc.Node.EventType.TOUCH_END, () => {
            this.setDifficulty(difficulty);
            this.onDifficultyChange(difficulty);
        });
        this.difficultyButtons.push({ difficulty, x: x - 27, y: y - 15, w: 54, h: 30 });
    }

    private updateRhythmLabels(): void {
        this.setLabel("title", "陽台訊號校準");
        this.setLabel("subtitle", "第一階段 / 頭部節奏");
        this.setLabel("left", "你 " + this.currentStep + " / " + this.pattern.length);
        this.setLabel("right", "隊友 " + this.peerStep + " / " + this.pattern.length);
        this.setLabel("center", this.actionText(this.activeAction));
        this.setLabel("status", this.role === "B" ? "聽隊友提示，在節拍內做動作" : this.patternText());
        this.setLabel("hint", this.hitWindowActive ? "判定！偵測到：" + this.actionText(this.detectorAction) : "等待方塊進入判定框");
    }

    private updateRaiseHandsLabels(): void {
        this.setLabel("title", "同步之門");
        this.setLabel("subtitle", "第二階段 / 雙手舉起");
        this.setLabel("left", "你 " + (this.localReady ? "準備完成" : "充能中"));
        this.setLabel("right", "隊友 " + (this.peerReady ? "準備完成" : "等待中"));
        this.setLabel("center", this.localReady ? "保持訊號" : "舉起雙手");
        this.setLabel("status", "兩位玩家需要在 3 秒內同步完成");
        this.setLabel("hint", "雙手保持高於肩膀");
    }

    private setLabel(key: string, value: string): void {
        const label = this.labels[key];
        if (label) label.string = value;
    }

    private updateDifficultyLabels(): void {
        this.setDifficultyLabel("easy", "簡單");
        this.setDifficultyLabel("normal", "普通");
        this.setDifficultyLabel("hard", "挑戰");
    }

    private setDifficultyLabel(difficulty: Level3Difficulty, text: string): void {
        const label = this.labels["difficulty-" + difficulty];
        if (!label) return;
        label.string = this.difficulty === difficulty ? ">" + text + "<" : text;
        label.node.opacity = this.difficulty === difficulty ? 255 : 185;
    }

    private draw(): void {
        const g = this.graphics;
        g.clear();
        this.drawBackdrop(g);
        this.drawFrame(g);
        this.drawDifficultyControls(g);
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

    private drawDifficultyControls(g: cc.Graphics): void {
        for (let i = 0; i < this.difficultyButtons.length; i += 1) {
            const button = this.difficultyButtons[i];
            const active = button.difficulty === this.difficulty;
            this.fillRect(g, button.x, button.y, button.w, button.h, active ? cc.color(255, 216, 92, 72) : cc.color(5, 8, 18, 190));
            this.strokeRect(g, button.x, button.y, button.w, button.h, active ? cc.color(255, 216, 92) : cc.color(75, 86, 130), active ? 3 : 2);
        }
    }

    private drawRhythm(g: cc.Graphics): void {
        const laneY = { nod: 52, shake: -52 };
        this.drawLane(g, laneY.nod, cc.color(85, 255, 209));
        this.drawLane(g, laneY.shake, cc.color(255, 124, 178));

        const targetX = 265;
        const blockX = -395 + this.timingProgress * 660;
        const blockY = this.activeAction === "shake" ? laneY.shake : laneY.nod;
        const blockColor = this.activeAction === "shake" ? cc.color(255, 124, 178) : cc.color(85, 255, 209);

        this.strokeRect(g, targetX - 34, -104, 68, 208, this.hitWindowActive ? cc.color(255, 216, 92) : cc.color(189, 228, 255), 4);
        this.fillRect(g, blockX - 28, blockY - 22, 56, 44, blockColor);
        this.strokeRect(g, blockX - 28, blockY - 22, 56, 44, cc.color(255, 255, 255), 2);

        const progressW = this.pattern.length > 0 ? 260 * (this.currentStep / this.pattern.length) : 0;
        this.strokeRect(g, -130, -174, 260, 18, cc.color(189, 228, 255), 2);
        this.fillRect(g, -130, -174, progressW, 18, cc.color(85, 255, 209, 230));
    }

    private drawLane(g: cc.Graphics, y: number, color: cc.Color): void {
        this.strokeRect(g, -410, y - 28, 720, 56, cc.color(75, 86, 130), 2);
        this.fillRect(g, -406, y - 24, 712, 48, cc.color(12, 17, 34, 190));
        this.fillRect(g, -406, y + 22, 712, 2, color);
        this.drawPixelTextBox(g, -406, y, color);
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

    private drawPixelTextBox(g: cc.Graphics, x: number, y: number, color: cc.Color): void {
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
            labels.push(this.actionText(this.pattern[i]));
        }
        return labels.join(" / ");
    }

    private actionText(action: HeadRhythmAction): string {
        if (action === "nod") return "點頭";
        if (action === "shake") return "搖頭";
        return "-";
    }
}

class Level3AudioCue {
    private context: AudioContext | null = null;
    private readonly volume: number;
    private readonly enabled: boolean;
    private readonly hitSoundUrls: string[];
    private readonly missSoundUrls: string[];
    private hitBuffer: AudioBuffer | null = null;
    private missBuffer: AudioBuffer | null = null;
    private hitLoadStarted: boolean = false;
    private missLoadStarted: boolean = false;

    constructor(volume: number, enabled: boolean, hitSoundUrls: string[], missSoundUrls: string[]) {
        this.volume = volume;
        this.enabled = enabled;
        this.hitSoundUrls = hitSoundUrls;
        this.missSoundUrls = missSoundUrls;
        if (enabled) {
            this.loadSample("hit");
            this.loadSample("miss");
        }
    }

    play(cue: AudioCue): void {
        if (!this.enabled) return;
        const context = this.getContext();
        if (!context) return;
        if ((cue === "hit" || cue === "miss") && this.playSample(cue, context)) return;

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

    private playSample(cue: "hit" | "miss", context: AudioContext): boolean {
        const buffer = cue === "hit" ? this.hitBuffer : this.missBuffer;
        if (!buffer) {
            this.loadSample(cue);
            return false;
        }

        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = Math.max(0, Math.min(1, this.volume));
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
        return true;
    }

    private loadSample(cue: "hit" | "miss"): void {
        if (cue === "hit" && this.hitLoadStarted) return;
        if (cue === "miss" && this.missLoadStarted) return;
        if (cue === "hit") this.hitLoadStarted = true;
        if (cue === "miss") this.missLoadStarted = true;

        const context = this.getContext();
        if (!context) return;
        const urls = cue === "hit" ? this.hitSoundUrls : this.missSoundUrls;
        this.loadFirstAvailable(urls, context, (buffer) => {
            if (cue === "hit") this.hitBuffer = buffer;
            if (cue === "miss") this.missBuffer = buffer;
        });
    }

    private loadFirstAvailable(urls: string[], context: AudioContext, done: (buffer: AudioBuffer) => void): void {
        let index = 0;
        const tryNext = () => {
            if (index >= urls.length) return;
            const url = urls[index];
            index += 1;
            fetch(url)
                .then((response) => {
                    if (!response.ok) throw new Error("Audio request failed");
                    return response.arrayBuffer();
                })
                .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
                .then(done)
                .catch(tryNext);
        };
        tryNext();
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
