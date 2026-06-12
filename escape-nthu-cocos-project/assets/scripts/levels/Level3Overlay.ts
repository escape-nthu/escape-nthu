import { HeadRhythmAction } from "../vision/HeadRhythmDetector";

type OverlayPhase = "rhythm" | "raiseHands" | "completed";
type AudioCue = "beat" | "hit" | "miss" | "phaseClear" | "complete" | "bgm";
export type Level3Difficulty = "easy" | "normal" | "hard";

export type Level3OverlayOptions = {
    audioVolume: number;
    audioEnabled: boolean;
    hitClip: cc.AudioClip | null;
    missClip: cc.AudioClip | null;
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
    private localVisualCharge: number = 0;
    private peerVisualCharge: number = 0;
    private syncEnergy: number = 0;
    private visualEnergy: number = 0;
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
            options.hitClip,
            options.missClip,
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
        
        // Smoothly interpolate visual charges
        this.localVisualCharge = cc.misc.lerp(this.localVisualCharge, this.localReady ? 1.0 : 0.0, dt * 8);
        this.peerVisualCharge = cc.misc.lerp(this.peerVisualCharge, this.peerReady ? 1.0 : 0.0, dt * 8);
        this.visualEnergy = cc.misc.lerp(this.visualEnergy, this.syncEnergy / 100, dt * 5);

        this.draw();
    }

    showRhythm(pattern: HeadRhythmAction[], currentStep: number, peerStep: number, role: string): void {
        this.phase = "rhythm";
        this.pattern = pattern;
        this.currentStep = currentStep;
        this.peerStep = peerStep;
        this.role = role;

        const leftLabel = this.labels.left;
        if (leftLabel) leftLabel.node.setPosition(-330, -230);
        const rightLabel = this.labels.right;
        if (rightLabel) rightLabel.node.setPosition(330, -230);
        const centerLabel = this.labels.center;
        if (centerLabel) centerLabel.node.setPosition(0, -230);

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

    showRaiseHands(localReady: boolean, peerReady: boolean, energy: number = 0): void {
        this.phase = "raiseHands";
        this.localReady = localReady;
        this.peerReady = peerReady;
        this.syncEnergy = energy;

        const leftLabel = this.labels.left;
        if (leftLabel) leftLabel.node.setPosition(-180, 70);
        const rightLabel = this.labels.right;
        if (rightLabel) rightLabel.node.setPosition(180, 70);
        const centerLabel = this.labels.center;
        if (centerLabel) centerLabel.node.setPosition(0, 110);

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
        this.labels.subtitle = this.createLabel("subtitle", "跟著節拍完成點頭與歪頭", 16, 0, 246, cc.color(129, 255, 226));
        this.labels.left = this.createLabel("left", "", 18, -330, -230, cc.color(255, 216, 92));
        this.labels.right = this.createLabel("right", "", 18, 330, -230, cc.color(255, 124, 178));
        this.labels.center = this.createLabel("center", "", 24, 0, -230, cc.color(255, 255, 255));
        this.labels.status = this.createLabel("status", "", 18, 0, 160, cc.color(189, 228, 255));
        this.labels.hint = this.createLabel("hint", "", 15, 0, -304, cc.color(190, 198, 215));
        this.labels.nodLane = this.createLabel("nodLane", "點頭", 14, -406, 52, cc.color(85, 255, 209), 84);
        this.labels.tiltLane = this.createLabel("tiltLane", "歪頭", 14, -406, -52, cc.color(255, 124, 178), 84);
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
        this.setLabel("left", "你：" + (this.localReady ? "已舉起" : "未舉起"));

        if (this.difficulty === "demo") {
            this.setLabel("right", "");
            this.setLabel("status", "保持舉起雙手，直到蓄能完成");
        } else {
            this.setLabel("right", "隊友：" + (this.peerReady ? "已舉起" : "未舉起"));
            this.setLabel("status", "兩位玩家需要同時保持舉起，直到蓄能完成");
        }
        
        const energyText = "蓄能進度: " + Math.floor(this.syncEnergy) + "%";
        this.setLabel("center", this.syncEnergy > 0 ? energyText : "舉起雙手以蓄能");
        
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
        const laneY = { nod: 52, tilt: -52 };
        this.drawLane(g, laneY.nod, cc.color(85, 255, 209));
        this.drawLane(g, laneY.tilt, cc.color(255, 124, 178));

        const targetX = 265;
        const blockX = -395 + this.timingProgress * 660;
        const blockY = this.activeAction === "tilt" ? laneY.tilt : laneY.nod;
        const blockColor = this.activeAction === "tilt" ? cc.color(255, 124, 178) : cc.color(85, 255, 209);

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
        // Draw futuristic background sync grid
        g.lineWidth = 1;
        g.strokeColor = cc.color(189, 228, 255, 25);
        // Vertical lines
        for (let x = -320; x <= 320; x += 40) {
            g.moveTo(x, -160);
            g.lineTo(x, 100);
            g.stroke();
        }
        // Horizontal lines
        for (let y = -160; y <= 100; y += 40) {
            g.moveTo(-320, y);
            g.lineTo(320, y);
            g.stroke();
        }

        // Draw HUD connection waves/circuits between nodes and core
        g.lineWidth = 2;
        g.strokeColor = cc.color(75, 86, 130, 100);
        g.moveTo(-180, -30);
        g.lineTo(-60, -30);
        g.moveTo(180, -30);
        g.lineTo(60, -30);
        g.stroke();

        // If local is ready, show active circuit animation
        if (this.localReady) {
            g.strokeColor = cc.color(85, 255, 209);
            const dotX = -180 + 120 * ((this.scanTime * 1.5) % 1);
            g.fillColor = cc.color(85, 255, 209);
            g.arc(dotX, -30, 4, 0, Math.PI * 2, false);
            g.fill();
        }
        // If peer is ready, show active circuit animation
        if (this.peerReady) {
            g.strokeColor = cc.color(255, 124, 178);
            const dotX = 180 - 120 * ((this.scanTime * 1.5) % 1);
            g.fillColor = cc.color(255, 124, 178);
            g.arc(dotX, -30, 4, 0, Math.PI * 2, false);
            g.fill();
        }

        // Draw Left Local Sync Circular HUD
        this.drawSciFiCircle(g, -180, -30, 64, this.localVisualCharge, cc.color(85, 255, 209));

        // Draw Right Peer Sync Circular HUD
        this.drawSciFiCircle(g, 180, -30, 64, this.peerVisualCharge, cc.color(255, 124, 178));

        // Draw Central Quantum Core / Gate
        this.drawCentralCore(g, 0, -30);
    }

    private drawSciFiCircle(g: cc.Graphics, cx: number, cy: number, radius: number, charge: number, color: cc.Color): void {
        // 1. Draw outer dashed boundary or tech ticks
        g.lineWidth = 1.5;
        g.strokeColor = cc.color(color.r, color.g, color.b, 60);
        g.arc(cx, cy, radius + 10, 0, Math.PI * 2, false);
        g.stroke();

        // Draw crosshairs
        g.strokeColor = cc.color(color.r, color.g, color.b, 40);
        g.moveTo(cx - radius - 15, cy);
        g.lineTo(cx - radius - 5, cy);
        g.moveTo(cx + radius + 5, cy);
        g.lineTo(cx + radius + 15, cy);
        g.moveTo(cx, cy - radius - 15);
        g.lineTo(cx, cy - radius - 5);
        g.moveTo(cx, cy + radius + 5);
        g.lineTo(cx, cy + radius + 15);
        g.stroke();

        // 2. Draw inner background circle
        g.lineWidth = 6;
        g.strokeColor = cc.color(15, 25, 45, 180);
        g.arc(cx, cy, radius, 0, Math.PI * 2, false);
        g.stroke();

        // 3. Draw active charge arc
        if (charge > 0.01) {
            g.lineWidth = 8;
            g.strokeColor = color;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + Math.PI * 2 * charge;
            g.arc(cx, cy, radius, startAngle, endAngle, false);
            g.stroke();
        }

        // 4. Draw central core blinking dot
        const pulse = 0.6 + 0.4 * Math.sin(this.scanTime * 6);
        g.fillColor = cc.color(color.r, color.g, color.b, Math.floor((40 + 160 * charge) * pulse));
        g.arc(cx, cy, radius - 15, 0, Math.PI * 2, false);
        g.fill();
    }

    private drawCentralCore(g: cc.Graphics, cx: number, cy: number): void {
        const isReady = this.syncEnergy >= 100;
        const pulseSpeed = isReady ? 12 : 3;
        const pulse = 0.7 + 0.3 * Math.sin(this.scanTime * pulseSpeed);
        const rotationAngle = this.scanTime * 0.8;

        // Draw outer containment brackets (rotating)
        g.lineWidth = 2;
        g.strokeColor = isReady ? cc.color(255, 216, 92) : cc.color(75, 86, 130, 150);
        
        const bracketRadius = 55;
        for (let i = 0; i < 3; i++) {
            const angle = rotationAngle + (i * Math.PI * 2) / 3;
            g.arc(cx, cy, bracketRadius, angle - 0.3, angle + 0.3, false);
            g.stroke();
        }

        // Draw inner status shape
        if (isReady) {
            g.lineWidth = 3;
            g.strokeColor = cc.color(255, 216, 92);
            g.fillColor = cc.color(255, 216, 92, Math.floor(180 * pulse));
            
            const waveRadius = 15 + 35 * ((this.scanTime * 2) % 1);
            g.strokeColor = cc.color(255, 216, 92, Math.floor(120 * (1 - ((this.scanTime * 2) % 1))));
            g.arc(cx, cy, waveRadius, 0, Math.PI * 2, false);
            g.stroke();

            g.fillColor = cc.color(255, 216, 92, 220);
            this.drawDiamond(g, cx, cy, 20);
        } else {
            g.lineWidth = 2;
            g.strokeColor = cc.color(255, 216, 92, 100);
            g.fillColor = cc.color(255, 216, 92, 40);
            this.drawDiamond(g, cx, cy, 14);

            g.strokeColor = cc.color(189, 228, 255, 80);
            g.arc(cx, cy, 30, 0, Math.PI * 2, false);
            g.stroke();

            if (this.visualEnergy > 0.01) {
                g.lineWidth = 6;
                g.strokeColor = cc.color(85, 255, 209);
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + Math.PI * 2 * this.visualEnergy;
                g.arc(cx, cy, 36, startAngle, endAngle, false);
                g.stroke();
            }
        }
    }

    private drawDiamond(g: cc.Graphics, x: number, y: number, size: number): void {
        g.moveTo(x, y + size);
        g.lineTo(x + size, y);
        g.lineTo(x, y - size);
        g.lineTo(x - size, y);
        g.close();
        g.fill();
        g.stroke();
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
        if (action === "tilt") return "歪頭";
        return "-";
    }
}

class Level3AudioCue {
    private readonly volume: number;
    private readonly enabled: boolean;
    private readonly hitClip: cc.AudioClip | null;
    private readonly missClip: cc.AudioClip | null;

    constructor(
        volume: number,
        enabled: boolean,
        hitClip: cc.AudioClip | null,
        missClip: cc.AudioClip | null,
    ) {
        this.volume = volume;
        this.enabled = enabled;
        this.hitClip = hitClip;
        this.missClip = missClip;
    }

    play(cue: AudioCue): void {
        if (!this.enabled) return;

        if (cue === "hit" && this.hitClip) {
            cc.audioEngine.play(this.hitClip, false, this.volume);
        } else if (cue === "miss" && this.missClip) {
            cc.audioEngine.play(this.missClip, false, this.volume);
        }
    }

    close(): void {
        // No manual audio cleanup needed since sound effects are fire-and-forget.
    }
}
