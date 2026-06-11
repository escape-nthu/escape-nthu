import EventBus from "../core/EventBus";
import GameState from "../core/GameState";
import MediaPipePoseAdapter from "../vision/MediaPipePoseAdapter";
import SquatDetector, { SquatFrameResult } from "../vision/SquatDetector";
import { PoseDetectionResult, PoseLandmark } from "../vision/VisionTypes";

const { ccclass, property } = cc._decorator;

type GestureProgress = {
    count: number;
    confidence: number;
    readyAt?: string;
};

type GestureChallenge = {
    targetCount: number;
    syncWindowMs: number;
    players: Record<string, GestureProgress>;
    completed: boolean;
};

type RoomStateSnapshot = {
    players: Array<{ playerId: string; role: string }>;
    completedLevels: string[];
    gestureChallenge?: GestureChallenge;
};

@ccclass
export default class BalconySquatLevel extends cc.Component {
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

    @property(cc.Node)
    startButton: cc.Node = null;

    @property(cc.Node)
    closeButton: cc.Node = null;

    @property(cc.Node)
    fallbackControls: cc.Node = null;

    @property(cc.Node)
    fallbackCountButton: cc.Node = null;

    @property(cc.Node)
    fallbackReadyButton: cc.Node = null;

    @property(cc.Node)
    fallbackCompleteButton: cc.Node = null;

    private detector: SquatDetector = new SquatDetector();
    private adapter: MediaPipePoseAdapter | null = null;
    private overlay: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private localCount: number = 0;
    private targetCount: number = 5;
    private peerCount: number = 0;
    private lastProgressSent: number = -1;
    private lastReadySentAt: number = 0;
    private running: boolean = false;
    private debugFallback: boolean = false;

    onLoad() {
        this.debugFallback = this.isDebugGestureEnabled();
        this.loadIdentityFromStorage();
        this.bindButton(this.startButton, this.startChallenge);
        this.bindButton(this.closeButton, this.closeChallenge);
        this.bindButton(this.fallbackCountButton, this.onFallbackCount);
        this.bindButton(this.fallbackReadyButton, this.onFallbackReady);
        this.bindButton(this.fallbackCompleteButton, this.onFallbackComplete);
        EventBus.on("gesture-level:start", this.startChallenge, this);
        EventBus.on("room:state", this.onRoomState, this);

        if (this.panelRoot) this.panelRoot.active = false;
        this.setFallbackVisible(this.debugFallback);
        if (this.autoStart) {
            this.startChallenge();
        }
    }

    onDestroy() {
        this.closeChallenge();
        EventBus.off("gesture-level:start", this.startChallenge, this);
        EventBus.off("room:state", this.onRoomState, this);
    }

    private async startChallenge(): Promise<void> {
        if (this.running) return;

        this.running = true;
        this.localCount = 0;
        this.peerCount = 0;
        this.lastProgressSent = -1;
        this.lastReadySentAt = 0;
        this.detector.reset();
        this.adapter = new MediaPipePoseAdapter();

        if (this.panelRoot) this.panelRoot.active = true;
        if (this.titleLabel) this.titleLabel.string = "陽台同步深蹲";
        this.setStatus("載入姿態辨識，請允許攝影機權限");
        this.updateProgressLabels();
        this.setFallbackVisible(this.debugFallback);

        try {
            const video = await this.adapter.start(this.onPoseResult);
            this.attachVideoOverlay(video);
            this.setStatus("請站直校準姿勢");
        } catch (error) {
            this.setStatus("攝影機或模型載入失敗，已切換 demo fallback");
            this.setFallbackVisible(true);
            EventBus.emit("ui:toast", "Gesture fallback enabled.");
        }
    }

    private closeChallenge = (): void => {
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

        if (this.panelRoot) this.panelRoot.active = false;
    };

    private onPoseResult = (result: PoseDetectionResult): void => {
        const frame = this.detector.process(result);
        this.localCount = frame.count;
        this.drawPose(result.landmarks);
        this.applyFrame(frame);
    };

    private applyFrame(frame: SquatFrameResult): void {
        this.setStatus(frame.message);
        this.updateProgressLabels();

        if (frame.justCompleted && frame.count !== this.lastProgressSent) {
            this.lastProgressSent = frame.count;
            this.postGestureProgress(frame.count, frame.confidence);
        }

        if (frame.count >= this.targetCount && frame.ready) {
            const now = Date.now();
            if (now - this.lastReadySentAt > 1000) {
                this.lastReadySentAt = now;
                this.postGestureReady(frame.confidence);
            }
        }
    }

    private onFallbackCount = (): void => {
        this.localCount += 1;
        this.detector.reset();
        this.postGestureProgress(this.localCount, 1);
        this.setStatus("Fallback: 有效深蹲 +1");
        this.updateProgressLabels();
    };

    private onFallbackReady = (): void => {
        this.postGestureReady(1);
        this.setStatus("Fallback: 已送出同步 ready");
    };

    private onFallbackComplete = (): void => {
        this.completeLevelDirectly();
    };

    private async postGestureProgress(count: number, confidence: number): Promise<void> {
        if (!this.hasRoomIdentity()) return;
        try {
            const body = await this.postJson("/api/levels/gesture/progress", {
                roomId: this.roomId,
                playerId: this.playerId,
                count,
                confidence,
            });
            this.onRoomState(body.state);
        } catch (error) {
            this.setStatus("進度同步失敗，請確認後端連線");
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

        if (state.gestureChallenge) {
            this.targetCount = state.gestureChallenge.targetCount;
            const local = state.gestureChallenge.players[this.playerId];
            if (local) this.localCount = local.count;
            this.peerCount = this.findPeerCount(state.gestureChallenge);
        }

        if (state.completedLevels.indexOf("level-03") >= 0 ||
            Boolean(state.gestureChallenge && state.gestureChallenge.completed)) {
            this.onCompleted();
        } else {
            this.updateProgressLabels();
        }
    }

    private onCompleted(): void {
        this.localCount = Math.max(this.localCount, this.targetCount);
        this.updateProgressLabels();
        this.setStatus("同步成功，逃生門已解鎖");
        if (GameState.instance) {
            GameState.instance.unlockDoor(this.finalDoorId);
        }
        EventBus.emit("ui:toast", "逃生門解鎖！");
        EventBus.emit("gesture-level:completed");
        this.closeChallenge();
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

    private updateProgressLabels(): void {
        if (this.countLabel) {
            this.countLabel.string = "你：" + Math.min(this.localCount, this.targetCount) + " / " + this.targetCount;
        }
        if (this.peerLabel) {
            this.peerLabel.string = "隊友：" + Math.min(this.peerCount, this.targetCount) + " / " + this.targetCount;
        }
        if (this.syncLabel) {
            this.syncLabel.string = this.localCount >= this.targetCount
                ? "達標後一起蹲下，3 秒內同步開門"
                : "完成 " + this.targetCount + " 次後進入同步階段";
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
