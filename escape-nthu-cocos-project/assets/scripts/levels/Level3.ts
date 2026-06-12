import EventBus from "../core/EventBus";
import GameState from "../core/GameState";
import Level3Overlay, { Level3Difficulty } from "./Level3Overlay";
import RoomManager from "../map/RoomManager";
import MediaPipePoseAdapter from "../vision/MediaPipePoseAdapter";
import HeadRhythmDetector, { HeadRhythmAction, HeadRhythmFrameResult } from "../vision/HeadRhythmDetector";
import RaiseHandsDetector, { RaiseHandsFrameResult } from "../vision/RaiseHandsDetector";
import { PoseDetectionResult, PoseLandmark } from "../vision/VisionTypes";

const { ccclass, property } = cc._decorator;

type GestureProgress = {
    count: number;
    confidence: number;
    readyAt?: string;
};

type RhythmProgress = {
    step: number;
    confidence: number;
    completed: boolean;
    mistakes: number;
};

type GestureChallenge = {
    targetCount: number;
    syncWindowMs: number;
    players: Record<string, GestureProgress>;
    rhythm?: {
        pattern: HeadRhythmAction[];
        targetSteps: number;
        players: Record<string, RhythmProgress>;
        completed: boolean;
    };
    completed: boolean;
};

type RoomStateSnapshot = {
    players: Array<{ playerId: string; role: string }>;
    completedLevels: string[];
    gestureChallenge?: GestureChallenge;
};

type Level3Phase = "rhythm" | "raiseHands" | "completed";

@ccclass
export default class Level3 extends cc.Component {
    @property
    apiBaseUrl: string = "http://localhost:8787";

    @property
    roomId: string = "";

    @property
    playerId: string = "";

    @property
    finalDoorId: string = "final-exit-door";

    @property
    autoStart: boolean = false;

    @property
    keyboardActivationRadius: number = 160;

    @property
    rhythmBpm: number = 30;

    @property
    difficulty: string = "normal";

    @property
    audioVolume: number = 0.18;

    @property
    audioEnabled: boolean = true;

    @property(cc.Node)
    panelRoot: cc.Node = null;

    @property(cc.Label)
    titleLabel: cc.Label = null;

    @property(cc.Label)
    statusLabel: cc.Label = null;

    @property(cc.Label)
    countLabel: cc.Label = null;

    @property(cc.Label)
    peerLabel: cc.Label = null;

    @property(cc.Label)
    syncLabel: cc.Label = null;

    @property(cc.Label)
    phaseLabel: cc.Label = null;

    @property(cc.Label)
    beatLabel: cc.Label = null;

    @property(cc.Label)
    patternLabel: cc.Label = null;

    @property(cc.Label)
    rhythmStatusLabel: cc.Label = null;

    @property(cc.Node)
    airWallNode: cc.Node = null;

    @property(cc.Node)
    heartCrownNode: cc.Node = null;

    @property(cc.Node)
    endingTriggerNode: cc.Node = null;

    @property(cc.Node)
    startButton: cc.Node = null;

    @property(cc.Node)
    closeButton: cc.Node = null;

    @property(cc.Node)
    fallbackControls: cc.Node = null;

    @property(cc.Node)
    fallbackCountButton: cc.Node = null;

    @property(cc.Node)
    fallbackRhythmCompleteButton: cc.Node = null;

    @property(cc.Node)
    fallbackReadyButton: cc.Node = null;

    @property(cc.Node)
    fallbackCompleteButton: cc.Node = null;

    @property(cc.AudioClip)
    hitClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    missClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    bgmClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    victoryClip: cc.AudioClip = null;

    private rhythmDetector: HeadRhythmDetector = new HeadRhythmDetector();
    private raiseHandsDetector: RaiseHandsDetector = new RaiseHandsDetector();
    private adapter: MediaPipePoseAdapter | null = null;
    private pixelOverlay: Level3Overlay | null = null;
    private overlay: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private localCount: number = 0;
    private targetCount: number = 1;
    private peerCount: number = 0;
    private phase: Level3Phase = "rhythm";
    private rhythmPattern: HeadRhythmAction[] = ["nod", "tilt", "nod", "nod"];
    private rhythmStep: number = 0;
    private peerRhythmStep: number = 0;
    private rhythmTargetSteps: number = 4;
    private localRole: string = "";
    private lastProgressSent: number = -1;
    private lastReadySentAt: number = 0;
    private rhythmBeatElapsed: number = 0;
    private rhythmClockActive: boolean = false;
    private currentDetectorAction: HeadRhythmAction = "none";
    private running: boolean = false;
    private debugFallback: boolean = false;
    private completionHandled: boolean = false;
    private sceneBgmId: number = -1;
    private syncEnergy: number = 0;
    private localIsRaising: boolean = false;
    private lastProgressReportedAt: number = 0;
    private lastState: RoomStateSnapshot | null = null;

    onLoad() {
        this.debugFallback = this.isDebugGestureEnabled();
        this.loadIdentityFromStorage();
        this.bindButton(this.startButton, this.startChallenge);
        this.bindButton(this.closeButton, this.closeChallenge);
        this.bindButton(this.fallbackCountButton, this.onFallbackCount);
        this.bindButton(this.fallbackRhythmCompleteButton, this.onFallbackRhythmComplete);
        this.bindButton(this.fallbackReadyButton, this.onFallbackReady);
        this.bindButton(this.fallbackCompleteButton, this.onFallbackComplete);
        EventBus.on("gesture-level:start", this.startChallenge, this);
        EventBus.on("room:state", this.onRoomState, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);

        if (this.panelRoot) this.panelRoot.active = false;
        this.setFallbackVisible(this.debugFallback);
        if (this.autoStart) {
            this.startChallenge();
        }
    }

    onEnable() {
        EventBus.on("room:changed", this.onRoomChanged, this);
        this.checkAndPlayBgm();
    }

    onDisable() {
        EventBus.off("room:changed", this.onRoomChanged, this);
        this.stopBgm();
    }

    start() {
        this.checkAndPlayBgm();
    }

    onDestroy() {
        this.stopBgm();
        this.closeChallenge();
        EventBus.off("gesture-level:start", this.startChallenge, this);
        EventBus.off("room:state", this.onRoomState, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private onRoomChanged(roomId: string) {
        if (roomId === "Room_level3") {
            this.checkAndPlayBgm();
        } else {
            this.stopBgm();
        }
    }

    private checkAndPlayBgm() {
        if (RoomManager.instance && RoomManager.instance.getCurrentRoomId() === "Room_level3") {
            if (this.sceneBgmId === -1 && this.bgmClip && this.audioEnabled) {
                this.sceneBgmId = cc.audioEngine.play(this.bgmClip, true, this.audioVolume);
            }
        } else {
            this.stopBgm();
        }
    }

    private stopBgm() {
        if (this.sceneBgmId !== -1) {
            cc.audioEngine.stop(this.sceneBgmId);
            this.sceneBgmId = -1;
        }
    }

    private async startChallenge(): Promise<void> {
        if (this.running) return;

        this.running = true;
        this.phase = "rhythm";
        this.localCount = 0;
        this.peerCount = 0;
        this.rhythmStep = 0;
        this.peerRhythmStep = 0;
        this.lastProgressSent = -1;
        this.lastReadySentAt = 0;
        this.rhythmBeatElapsed = 0;
        this.rhythmClockActive = false;
        this.currentDetectorAction = "none";
        this.completionHandled = false;
        this.applyDifficulty(this.normalizeDifficulty(this.difficulty));
        this.rhythmDetector.reset();
        this.raiseHandsDetector.reset();
        this.adapter = new MediaPipePoseAdapter();
        this.createPixelOverlay();

        if (this.panelRoot) this.panelRoot.active = true;
        if (this.titleLabel) this.titleLabel.string = "陽台訊號校準";
        this.setStatus("載入姿態辨識，請允許攝影機權限");
        this.updateProgressLabels();
        this.updatePixelOverlay();
        if (this.pixelOverlay) this.pixelOverlay.playBeat();
        this.setFallbackVisible(this.debugFallback);

        try {
            const video = await this.adapter.start(this.onPoseResult);
            this.attachVideoOverlay(video);
            this.rhythmClockActive = true;
            this.setStatus("請正對鏡頭，準備完成頭部節奏");
        } catch (error) {
            this.setStatus("攝影機或模型載入失敗，已切換 demo fallback");
            this.setFallbackVisible(true);
            EventBus.emit("ui:toast", "已啟用手勢 demo 模式");
        }
    }

    private closeChallenge = (): void => {
        this.unschedule(this.closeChallenge);
        this.running = false;
        if (this.adapter) {
            this.adapter.stop();
            this.adapter = null;
        }

        if (this.overlay && this.overlay.parentElement) {
            this.overlay.parentElement.removeChild(this.overlay);
        }
        this.overlay = null;
        this.canvas = null;

        if (this.pixelOverlay) {
            this.pixelOverlay.destroy();
            this.pixelOverlay = null;
        }

        if (this.panelRoot) this.panelRoot.active = false;
    };

    private onKeyDown(event: cc.Event.EventKeyboard): void {
        if (this.running) {
            if (event.keyCode === cc.macro.KEY.p) {
                if (this.phase === "rhythm") {
                    this.onFallbackRhythmComplete();
                } else if (this.phase === "raiseHands") {
                    this.completeLevelDirectly();
                }
                return;
            }
            if (event.keyCode !== cc.macro.KEY.escape) return;
            this.setStatus("已離開姿態偵測，回到地圖");
            this.closeChallenge();
            return;
        }

        if (event.keyCode === cc.macro.KEY.e && this.canStartFromKeyboard()) {
            this.startChallenge();
        }
    }

    update(dt: number): void {
        if (!this.running) return;

        if (this.rhythmClockActive && this.phase === "rhythm" && this.rhythmStep < this.rhythmTargetSteps) {
            this.rhythmBeatElapsed += dt;
            const beatSeconds = this.getRhythmBeatSeconds();
            if (this.rhythmBeatElapsed >= beatSeconds) {
                this.handleRhythmMiss("節奏錯過，從第一拍重來", 0.45);
            }
        }

        this.updatePixelOverlay();
        if (this.pixelOverlay) this.pixelOverlay.update(dt);
    }

    private onPoseResult = (result: PoseDetectionResult): void => {
        this.drawPose(result.landmarks);
        if (this.phase === "rhythm") {
            if (this.rhythmStep >= this.rhythmTargetSteps) return;
            this.applyRhythmFrame(this.rhythmDetector.process(result));
        } else if (this.phase === "raiseHands") {
            if (this.hasSentRaiseHandsReady()) return;
            this.applyRaiseHandsFrame(this.raiseHandsDetector.process(result));
        }
    };

    private applyRhythmFrame(frame: HeadRhythmFrameResult): void {
        this.currentDetectorAction = frame.action;
        this.setStatus(frame.message);
        if (this.rhythmStatusLabel) this.rhythmStatusLabel.string = this.actionLabel(frame.action);

        if (frame.justDetected) {
            const expected = this.rhythmPattern[this.rhythmStep] || "nod";
            if (!this.isRhythmHitWindowActive()) {
                this.handleRhythmMiss("還沒進判定框，從第一拍重來", frame.confidence);
            } else if (frame.action === expected) {
                this.rhythmStep = Math.min(this.rhythmTargetSteps, this.rhythmStep + 1);
                this.rhythmBeatElapsed = 0;
                this.setStatus("第 " + this.rhythmStep + " 拍成功");
                if (this.pixelOverlay) {
                    this.pixelOverlay.flashHit();
                    this.pixelOverlay.playBeat();
                }
                this.postRhythmProgress(this.rhythmStep, frame.confidence, false);
            } else if (frame.action !== "none") {
                this.handleRhythmMiss("節奏錯誤，從第一拍重來", frame.confidence);
            }
        }

        this.updateProgressLabels();
    }

    private applyRaiseHandsFrame(frame: RaiseHandsFrameResult): void {
        this.setStatus(frame.message);
        
        const handsRaised = frame.phase === "raising" || frame.phase === "ready" || frame.ready;
        const now = Date.now();
        
        if (handsRaised !== this.localIsRaising || now - this.lastProgressReportedAt > 300) {
            this.localIsRaising = handsRaised;
            this.lastProgressReportedAt = now;
            this.postGestureProgress(handsRaised ? 1 : 0, frame.confidence, handsRaised);
        }

        this.localCount = handsRaised ? 1 : 0;
        this.updateProgressLabels();
        this.updatePixelOverlay();
    }

    private onFallbackCount = (): void => {
        if (this.phase === "rhythm") {
            this.rhythmStep = Math.min(this.rhythmTargetSteps, this.rhythmStep + 1);
            this.rhythmBeatElapsed = 0;
            if (this.pixelOverlay) this.pixelOverlay.flashHit();
            this.postRhythmProgress(this.rhythmStep, 1, false);
            this.setStatus("Demo：第一階段 +1");
        } else if (this.phase === "raiseHands") {
            this.localCount = 1;
            this.raiseHandsDetector.reset();
            this.postGestureProgress(this.localCount, 1);
            this.setStatus("Demo：已達成舉手姿勢");
        }
        this.updateProgressLabels();
    };

    private onFallbackRhythmComplete = (): void => {
        this.rhythmStep = this.rhythmTargetSteps;
        this.rhythmBeatElapsed = 0;
        this.phase = "raiseHands";
        this.rhythmClockActive = false;
        this.raiseHandsDetector.reset();
        if (this.pixelOverlay) this.pixelOverlay.flashPhaseClear();
        this.postRhythmProgress(this.rhythmStep, 1, false);
        this.setStatus("Phase 1 完成，請同步舉起雙手");
        this.updateProgressLabels();
    };

    private onFallbackReady = (): void => {
        if (this.phase !== "raiseHands") {
            this.setStatus("請先完成 Phase 1 頭部節奏");
            return;
        }
        this.postGestureReady(1);
        this.setStatus("Demo：已送出同步準備");
    };

    private onFallbackComplete = (): void => {
        this.completeLevelDirectly();
    };

    private async postGestureProgress(count: number, confidence: number, isRaising = false): Promise<void> {
        if (!this.hasRoomIdentity()) return;
        try {
            const body = await this.postJson("/api/levels/gesture/progress", {
                roomId: this.roomId,
                playerId: this.playerId,
                count,
                confidence,
                isRaising,
            });
            this.onRoomState(body.state);
        } catch (error) {
            // Silently ignore periodic api errors to avoid log spamming
        }
    }

    private async postRhythmProgress(step: number, confidence: number, mistake: boolean): Promise<void> {
        if (!this.hasRoomIdentity()) return;
        try {
            const body = await this.postJson("/api/levels/gesture/rhythm/progress", {
                roomId: this.roomId,
                playerId: this.playerId,
                step,
                confidence,
                mistake,
            });
            this.onRoomState(body.state);
        } catch (error) {
            this.setStatus("節奏同步失敗，請確認後端連線");
        }
    }

    private async postGestureReady(confidence: number): Promise<void> {
        if (!this.hasRoomIdentity()) return;
        try {
            const body = await this.postJson("/api/levels/gesture/ready", {
                roomId: this.roomId,
                playerId: this.playerId,
                confidence,
            });
            this.onRoomState(body.state);
        } catch (error) {
            this.setStatus("同步 ready 失敗，請確認後端連線");
        }
    }

    private async completeLevelDirectly(): Promise<void> {
        if (!this.hasRoomIdentity()) return;
        try {
            const body = await this.postJson("/api/levels/level-03/complete", {
                roomId: this.roomId,
                playerId: this.playerId,
            });
            this.onRoomState(body.state);
        } catch (error) {
            this.setStatus("手動完成失敗，請確認後端連線");
        }
    }

    private onRoomState(state: RoomStateSnapshot): void {
        if (!state) return;
        this.lastState = state;

        this.updateLocalRole(state);

        if (state.gestureChallenge) {
            this.targetCount = state.gestureChallenge.targetCount;
            const local = state.gestureChallenge.players[this.playerId];
            if (local) this.localCount = local.count;
            this.peerCount = this.findPeerCount(state.gestureChallenge);
            this.syncEnergy = state.gestureChallenge.energy ?? 0;

            if (state.gestureChallenge.rhythm) {
                this.rhythmPattern = state.gestureChallenge.rhythm.pattern;
                this.rhythmTargetSteps = state.gestureChallenge.rhythm.targetSteps;
                const rhythmLocal = state.gestureChallenge.rhythm.players[this.playerId];
                if (rhythmLocal) this.rhythmStep = rhythmLocal.step;
                this.peerRhythmStep = this.findPeerRhythmStep(state.gestureChallenge);
                if (state.gestureChallenge.rhythm.completed && this.phase === "rhythm") {
                    this.phase = "raiseHands";
                    this.rhythmBeatElapsed = 0;
                    this.rhythmClockActive = false;
                    this.raiseHandsDetector.reset();
                    if (this.pixelOverlay) this.pixelOverlay.flashPhaseClear();
                    this.setStatus("Phase 1 完成，請同步舉起雙手");
                }
            }
        }

        if (state.completedLevels.indexOf("level-03") >= 0 ||
            Boolean(state.gestureChallenge && state.gestureChallenge.completed)) {
            this.onCompleted();
        } else {
            this.updateProgressLabels();
        }
    }

    private onCompleted(): void {
        if (this.completionHandled) return;
        this.completionHandled = true;
        this.phase = "completed";
        this.localCount = Math.max(this.localCount, this.targetCount);
        this.updateProgressLabels();
        this.setStatus("同步成功，逃生門已解鎖");
        if (this.pixelOverlay) this.pixelOverlay.flashComplete();
        if (this.airWallNode) this.airWallNode.active = false;
        if (this.heartCrownNode) this.heartCrownNode.active = true;
        if (this.endingTriggerNode) this.endingTriggerNode.active = true;
        if (GameState.instance) {
            GameState.instance.unlockDoor(this.finalDoorId);
        }
        EventBus.emit("ui:toast", "逃生門解鎖！");
        EventBus.emit("gesture-level:completed");

        this.stopBgm();
        if (this.victoryClip && this.audioEnabled) {
            cc.audioEngine.play(this.victoryClip, false, this.audioVolume);
        }

        this.scheduleOnce(this.closeChallenge, 0.9);
    }

    private findPeerCount(challenge: GestureChallenge): number {
        let best = 0;
        for (const playerId in challenge.players) {
            if (!Object.prototype.hasOwnProperty.call(challenge.players, playerId)) continue;
            if (playerId === this.playerId) continue;
            best = Math.max(best, challenge.players[playerId].count);
        }
        return best;
    }

    private findPeerRhythmStep(challenge: GestureChallenge): number {
        if (!challenge.rhythm) return 0;
        let best = 0;
        for (const playerId in challenge.rhythm.players) {
            if (!Object.prototype.hasOwnProperty.call(challenge.rhythm.players, playerId)) continue;
            if (playerId === this.playerId) continue;
            best = Math.max(best, challenge.rhythm.players[playerId].step);
        }
        return best;
    }

    private updateProgressLabels(): void {
        if (this.phaseLabel) {
            this.phaseLabel.string = this.phase === "rhythm"
                ? "Phase 1 訊號校準"
                : this.phase === "raiseHands"
                    ? "Phase 2 同步開門"
                    : "通關完成";
        }

        if (this.beatLabel) {
            this.beatLabel.string = this.phase === "rhythm"
                ? (Math.min(this.rhythmStep + 1, this.rhythmTargetSteps) + " / " + this.rhythmTargetSteps)
                : "-";
        }

        if (this.patternLabel) {
            this.patternLabel.string = this.phase === "rhythm"
                ? this.patternText()
                : "雙手舉過肩膀並維持 2 秒";
        }

        if (this.countLabel) {
            this.countLabel.string = this.phase === "rhythm"
                ? "你：" + this.rhythmStep + " / " + this.rhythmTargetSteps
                : "你：" + (this.localIsRaising ? "已舉起" : "未舉起");
        }
        if (this.peerLabel) {
            const peerRaising = this.lastState ? this.findPeerRaising(this.lastState) : false;
            this.peerLabel.string = this.phase === "rhythm"
                ? "隊友：" + this.peerRhythmStep + " / " + this.rhythmTargetSteps
                : "隊友：" + (peerRaising ? "已舉起" : "未舉起");
        }
        if (this.syncLabel) {
            this.syncLabel.string = this.phase === "rhythm"
                ? "完成節奏後才能進入同步舉手"
                : "雙手舉起進行同步蓄能";
        }

        this.updatePixelOverlay();
    }

    private createPixelOverlay(): void {
        if (this.pixelOverlay) {
            this.pixelOverlay.destroy();
            this.pixelOverlay = null;
        }

        const parent = this.node.parent || this.node;
        this.pixelOverlay = new Level3Overlay(parent, {
            audioVolume: this.audioVolume,
            audioEnabled: this.audioEnabled,
            hitClip: this.hitClip,
            missClip: this.missClip,
            difficulty: this.normalizeDifficulty(this.difficulty),
            onDifficultyChange: this.onDifficultyChange,
        });
    }

    private updatePixelOverlay(): void {
        if (!this.pixelOverlay) return;
        this.pixelOverlay.setDifficulty(this.normalizeDifficulty(this.difficulty));
        if (this.phase === "rhythm") {
            const expected = this.rhythmPattern[this.rhythmStep] || "nod";
            this.pixelOverlay.showRhythm(this.rhythmPattern, this.rhythmStep, this.peerRhythmStep, this.localRole);
            this.pixelOverlay.updateRhythm(
                expected,
                this.getRhythmTimingProgress(),
                this.isRhythmHitWindowActive(),
                this.currentDetectorAction,
            );
        } else if (this.phase === "raiseHands") {
            const peerRaising = this.lastState ? this.findPeerRaising(this.lastState) : false;
            this.pixelOverlay.showRaiseHands(this.localIsRaising, peerRaising, this.syncEnergy);
        }
    }

    private findPeerRaising(state: RoomStateSnapshot): boolean {
        if (!state.gestureChallenge) return false;
        for (const playerId in state.gestureChallenge.players) {
            if (playerId === this.playerId) continue;
            if (state.gestureChallenge.players[playerId].isRaising) {
                return true;
            }
        }
        return false;
    }

    private getRhythmBeatSeconds(): number {
        const bpm = Math.max(20, this.rhythmBpm || 30);
        return 60 / bpm;
    }

    private getRhythmTimingProgress(): number {
        const progress = this.rhythmBeatElapsed / this.getRhythmBeatSeconds();
        return Math.max(0, Math.min(1, progress));
    }

    private isRhythmHitWindowActive(): boolean {
        const progress = this.getRhythmTimingProgress();
        return progress >= 0.64 && progress <= 0.96;
    }

    private hasSentRaiseHandsReady(): boolean {
        return this.localCount >= this.targetCount && this.lastReadySentAt > 0;
    }

    private handleRhythmMiss(message: string, confidence: number): void {
        this.rhythmStep = 0;
        this.rhythmBeatElapsed = 0;
        this.currentDetectorAction = "none";
        this.rhythmDetector.reset();
        this.setStatus(message);
        if (this.pixelOverlay) {
            this.pixelOverlay.flashMiss();
            this.pixelOverlay.playBeat();
        }
        this.postRhythmProgress(0, confidence, true);
        this.updateProgressLabels();
    }

    private onDifficultyChange = (difficulty: Level3Difficulty): void => {
        this.applyDifficulty(difficulty);
        this.rhythmBeatElapsed = 0;
        this.currentDetectorAction = "none";
        this.rhythmDetector.reset();
        this.setStatus("難度已切換為：" + this.difficultyLabel(difficulty));
        this.updateProgressLabels();
    };

    private applyDifficulty(difficulty: Level3Difficulty): void {
        this.difficulty = difficulty;
        this.rhythmBpm = this.bpmForDifficulty(difficulty);
        if (this.pixelOverlay) this.pixelOverlay.setDifficulty(difficulty);
    }

    private normalizeDifficulty(value: string): Level3Difficulty {
        if (value === "easy" || value === "normal" || value === "hard") return value;
        return "normal";
    }

    private bpmForDifficulty(difficulty: Level3Difficulty): number {
        if (difficulty === "easy") return 24;
        if (difficulty === "hard") return 36;
        return 30;
    }

    private difficultyLabel(difficulty: Level3Difficulty): string {
        if (difficulty === "easy") return "簡單";
        if (difficulty === "hard") return "挑戰";
        return "普通";
    }

    private getLevel3AudioUrls(fileName: string): string[] {
        return [
            "res/raw-assets/Art/Level3/" + fileName,
            "/res/raw-assets/Art/Level3/" + fileName,
            "assets/Art/Level3/" + fileName,
            "./assets/Art/Level3/" + fileName,
            "/assets/Art/Level3/" + fileName,
        ];
    }

    private canStartFromKeyboard(): boolean {
        if (RoomManager.instance && RoomManager.instance.getCurrentRoomId() === "Room_level3") {
            return true;
        }
        return this.isNearLevel3GestureTrigger();
    }

    private isNearLevel3GestureTrigger(): boolean {
        const player = this.findNodeByGroup(cc.director.getScene(), "player");
        const trigger = this.findNearestLevel3Trigger();
        if (!player || !trigger) return false;

        const playerWorld = player.convertToWorldSpaceAR(cc.Vec2.ZERO);
        const triggerWorld = trigger.convertToWorldSpaceAR(cc.Vec2.ZERO);
        return playerWorld.sub(triggerWorld).mag() <= this.keyboardActivationRadius;
    }

    private findNearestLevel3Trigger(): cc.Node {
        const scene = cc.director.getScene();
        return this.findNodeByName(scene, "controller-left") ||
            this.findNodeByName(scene, "controller-right") ||
            this.findNodeByName(scene, "Level3_gesture");
    }

    private findNodeByName(root: cc.Node, name: string): cc.Node {
        if (!root) return null;
        if (root.name === name) return root;
        for (let i = 0; i < root.children.length; i += 1) {
            const found = this.findNodeByName(root.children[i], name);
            if (found) return found;
        }
        return null;
    }

    private findNodeByGroup(root: cc.Node, group: string): cc.Node {
        if (!root) return null;
        if (root.group === group) return root;
        for (let i = 0; i < root.children.length; i += 1) {
            const found = this.findNodeByGroup(root.children[i], group);
            if (found) return found;
        }
        return null;
    }

    private patternText(): string {
        if (this.localRole === "B") {
            return "聽隊友提示，在每一拍做出動作";
        }

        const labels: string[] = [];
        for (let i = 0; i < this.rhythmPattern.length; i += 1) {
            labels.push(this.actionLabel(this.rhythmPattern[i]));
        }
        return labels.join(" → ");
    }

    private actionLabel(action: HeadRhythmAction): string {
        if (action === "nod") return "點頭";
        if (action === "tilt") return "歪頭";
        return "等待";
    }

    private updateLocalRole(state: RoomStateSnapshot): void {
        for (let i = 0; i < state.players.length; i += 1) {
            if (state.players[i].playerId === this.playerId) {
                this.localRole = state.players[i].role;
                return;
            }
        }
    }

    private attachVideoOverlay(video: HTMLVideoElement): void {
        if (!this.overlay) {
            this.overlay = document.createElement("div");
            this.overlay.style.position = "fixed";
            this.overlay.style.right = "16px";
            this.overlay.style.top = "16px";
            this.overlay.style.width = "240px";
            this.overlay.style.height = "180px";
            this.overlay.style.background = "rgba(0, 0, 0, 0.72)";
            this.overlay.style.border = "1px solid rgba(255, 255, 255, 0.4)";
            this.overlay.style.zIndex = "20";
            this.overlay.style.pointerEvents = "none";
            document.body.appendChild(this.overlay);

            this.canvas = document.createElement("canvas");
            this.canvas.width = 240;
            this.canvas.height = 180;
            this.canvas.style.position = "absolute";
            this.canvas.style.left = "0";
            this.canvas.style.top = "0";
            this.overlay.appendChild(this.canvas);
        }

        video.style.position = "absolute";
        video.style.left = "0";
        video.style.top = "0";
        video.style.width = "240px";
        video.style.height = "180px";
        video.style.opacity = "1";
        video.style.objectFit = "cover";
        video.style.transform = "scaleX(-1)";
        this.overlay.insertBefore(video, this.canvas);
    }

    private drawPose(landmarks: PoseLandmark[]): void {
        if (!this.canvas) return;
        const ctx = this.canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "rgba(123, 220, 255, 0.95)";
        for (let i = 0; i < landmarks.length; i += 1) {
            const landmark = landmarks[i];
            if (!landmark || landmark.visibility !== undefined && landmark.visibility < 0.45) continue;
            ctx.beginPath();
            ctx.arc((1 - landmark.x) * this.canvas.width, landmark.y * this.canvas.height, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private setStatus(message: string): void {
        if (this.statusLabel) this.statusLabel.string = message;
    }

    private setFallbackVisible(visible: boolean): void {
        if (this.fallbackControls) this.fallbackControls.active = visible;
    }

    private bindButton(node: cc.Node, handler: () => void): void {
        if (!node) return;
        node.on(cc.Node.EventType.TOUCH_END, handler, this);
    }

    private async postJson(path: string, payload: Record<string, unknown>): Promise<any> {
        const response = await fetch(this.apiBaseUrl + path, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error("Request failed with " + response.status);
        }
        return response.json();
    }

    private hasRoomIdentity(): boolean {
        if (this.roomId && this.playerId) return true;
        this.loadIdentityFromStorage();
        if (this.roomId && this.playerId) return true;
        this.setStatus("缺少 roomId/playerId，請從 Lobby 進入或在 Inspector 設定");
        this.setFallbackVisible(this.debugFallback);
        return false;
    }

    private loadIdentityFromStorage(): void {
        if (typeof localStorage === "undefined") return;
        this.roomId = this.roomId || localStorage.getItem("escape-nthu:roomId") || "";
        this.playerId = this.playerId || localStorage.getItem("escape-nthu:playerId") || "";
    }

    private isDebugGestureEnabled(): boolean {
        if (typeof location === "undefined") return false;
        return location.search.indexOf("debugGesture=1") >= 0;
    }
}
