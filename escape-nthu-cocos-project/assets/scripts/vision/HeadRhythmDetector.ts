import { PoseDetectionResult, PoseLandmark } from "./VisionTypes";

export type HeadRhythmAction = "nod" | "shake" | "none";
export type HeadRhythmPhase = "calibrating" | "neutral" | "moved" | "lost";

export interface HeadRhythmDetectorOptions {
    calibrationMs: number;
    minVisibility: number;
    nodThreshold: number;
    shakeThreshold: number;
    neutralThreshold: number;
    actionCooldownMs: number;
}

export interface HeadRhythmFrameResult {
    phase: HeadRhythmPhase;
    action: HeadRhythmAction;
    justDetected: boolean;
    confidence: number;
    message: string;
}

type HeadSample = {
    relativeX: number;
    relativeY: number;
    confidence: number;
};

const DEFAULT_OPTIONS: HeadRhythmDetectorOptions = {
    calibrationMs: 900,
    minVisibility: 0.45,
    nodThreshold: 0.055,
    shakeThreshold: 0.06,
    neutralThreshold: 0.03,
    actionCooldownMs: 450,
};

const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

export default class HeadRhythmDetector {
    private readonly options: HeadRhythmDetectorOptions;
    private phase: HeadRhythmPhase = "calibrating";
    private calibrationStartedAt: number = 0;
    private samples: HeadSample[] = [];
    private baseX: number = 0;
    private baseY: number = 0;
    private waitingForNeutral: boolean = false;
    private lastActionAt: number = 0;

    constructor(options?: Partial<HeadRhythmDetectorOptions>) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options || {});
    }

    reset(): void {
        this.phase = "calibrating";
        this.calibrationStartedAt = 0;
        this.samples = [];
        this.baseX = 0;
        this.baseY = 0;
        this.waitingForNeutral = false;
        this.lastActionAt = 0;
    }

    process(result: PoseDetectionResult): HeadRhythmFrameResult {
        const sample = this.sampleHead(result.landmarks);
        if (!sample) {
            this.phase = "lost";
            return this.frame("none", false, result.confidence, "請讓臉和肩膀進入鏡頭");
        }

        if (this.phase === "calibrating" || this.samples.length === 0) {
            return this.processCalibration(result.timestampMs, sample);
        }

        const dx = sample.relativeX - this.baseX;
        const dy = sample.relativeY - this.baseY;
        const isNeutral = Math.abs(dx) < this.options.neutralThreshold &&
            Math.abs(dy) < this.options.neutralThreshold;

        if (isNeutral) {
            this.waitingForNeutral = false;
            this.phase = "neutral";
            return this.frame("none", false, sample.confidence, "等待下一個頭部動作");
        }

        if (this.waitingForNeutral || result.timestampMs - this.lastActionAt < this.options.actionCooldownMs) {
            this.phase = "moved";
            return this.frame("none", false, sample.confidence, "回到正中間準備下一拍");
        }

        const action = this.detectAction(dx, dy);
        if (action === "none") {
            this.phase = "moved";
            return this.frame("none", false, sample.confidence, "動作再明顯一點");
        }

        this.phase = "moved";
        this.waitingForNeutral = true;
        this.lastActionAt = result.timestampMs;
        return this.frame(action, true, sample.confidence, action === "nod" ? "偵測到點頭" : "偵測到搖頭");
    }

    private processCalibration(timestampMs: number, sample: HeadSample): HeadRhythmFrameResult {
        if (this.calibrationStartedAt <= 0) {
            this.calibrationStartedAt = timestampMs;
        }

        this.samples.push(sample);
        if (timestampMs - this.calibrationStartedAt < this.options.calibrationMs) {
            return this.frame("none", false, sample.confidence, "請正對鏡頭校準頭部位置");
        }

        this.baseX = average(this.samples.map((item) => item.relativeX));
        this.baseY = average(this.samples.map((item) => item.relativeY));
        this.phase = "neutral";
        return this.frame("none", false, sample.confidence, "頭部校準完成，跟著節奏開始");
    }

    private detectAction(dx: number, dy: number): HeadRhythmAction {
        if (Math.abs(dy) >= this.options.nodThreshold && Math.abs(dy) >= Math.abs(dx)) {
            return "nod";
        }
        if (Math.abs(dx) >= this.options.shakeThreshold) {
            return "shake";
        }
        return "none";
    }

    private frame(
        action: HeadRhythmAction,
        justDetected: boolean,
        confidence: number,
        message: string,
    ): HeadRhythmFrameResult {
        return {
            phase: this.phase,
            action,
            justDetected,
            confidence,
            message,
        };
    }

    private sampleHead(landmarks: PoseLandmark[]): HeadSample | null {
        const nose = landmarks[NOSE];
        const leftShoulder = landmarks[LEFT_SHOULDER];
        const rightShoulder = landmarks[RIGHT_SHOULDER];
        if (!this.isVisible(nose) || !this.isVisible(leftShoulder) || !this.isVisible(rightShoulder)) {
            return null;
        }

        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const shoulderWidth = Math.max(0.1, Math.abs(leftShoulder.x - rightShoulder.x));

        return {
            relativeX: (nose.x - shoulderCenterX) / shoulderWidth,
            relativeY: (nose.y - shoulderCenterY) / shoulderWidth,
            confidence: average([landmarkScore(nose), landmarkScore(leftShoulder), landmarkScore(rightShoulder)]),
        };
    }

    private isVisible(landmark?: PoseLandmark): landmark is PoseLandmark {
        if (!landmark) return false;
        return landmarkScore(landmark) >= this.options.minVisibility;
    }
}

function landmarkScore(landmark: PoseLandmark): number {
    if (typeof landmark.visibility === "number") return landmark.visibility;
    if (typeof landmark.presence === "number") return landmark.presence;
    return 1;
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
