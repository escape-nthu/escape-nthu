import { PoseDetectionResult, PoseLandmark } from "./VisionTypes";

export type RaiseHandsPhase = "searching" | "raising" | "ready" | "lost";

export interface RaiseHandsDetectorOptions {
    minVisibility: number;
    wristAboveShoulderMargin: number;
    holdMs: number;
}

export interface RaiseHandsFrameResult {
    phase: RaiseHandsPhase;
    count: number;
    ready: boolean;
    justCompleted: boolean;
    confidence: number;
    progress: number;
    message: string;
}

const DEFAULT_OPTIONS: RaiseHandsDetectorOptions = {
    minVisibility: 0.45,
    wristAboveShoulderMargin: 0.04,
    holdMs: 2000,
};

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

export default class RaiseHandsDetector {
    private readonly options: RaiseHandsDetectorOptions;
    private phase: RaiseHandsPhase = "searching";
    private holdStartedAt: number = 0;
    private readyValue: number = 0;

    constructor(options?: Partial<RaiseHandsDetectorOptions>) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options || {});
    }

    reset(): void {
        this.phase = "searching";
        this.holdStartedAt = 0;
        this.readyValue = 0;
    }

    process(result: PoseDetectionResult): RaiseHandsFrameResult {
        const sample = this.sampleUpperBody(result.landmarks);
        if (!sample) {
            this.phase = "lost";
            this.holdStartedAt = 0;
            return this.frame(false, 0, result.confidence, "請讓肩膀和雙手進入鏡頭");
        }

        const handsRaised = sample.leftRaised && sample.rightRaised;
        if (!handsRaised) {
            this.phase = "searching";
            this.holdStartedAt = 0;
            return this.frame(false, 0, sample.confidence, "請同步舉起雙手");
        }

        if (this.holdStartedAt <= 0) {
            this.holdStartedAt = result.timestampMs;
            this.phase = "raising";
        }

        const progress = Math.min(1, (result.timestampMs - this.holdStartedAt) / this.options.holdMs);
        if (progress >= 1) {
            const justCompleted = this.readyValue === 0;
            this.readyValue = 1;
            this.phase = "ready";
            return this.frame(justCompleted, 1, sample.confidence, "雙手舉起完成，等待隊友同步");
        }

        this.phase = "raising";
        return this.frame(false, progress, sample.confidence, "保持雙手舉起，訊號校準中");
    }

    private frame(justCompleted: boolean, progress: number, confidence: number, message: string): RaiseHandsFrameResult {
        return {
            phase: this.phase,
            count: this.readyValue,
            ready: this.readyValue >= 1,
            justCompleted,
            confidence,
            progress,
            message,
        };
    }

    private sampleUpperBody(landmarks: PoseLandmark[]): {
        leftRaised: boolean;
        rightRaised: boolean;
        confidence: number;
    } | null {
        const required = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST]
            .map((index) => landmarks[index]);

        if (required.some((landmark) => !this.isVisible(landmark))) {
            return null;
        }

        const leftShoulder = landmarks[LEFT_SHOULDER];
        const rightShoulder = landmarks[RIGHT_SHOULDER];
        const leftWrist = landmarks[LEFT_WRIST];
        const rightWrist = landmarks[RIGHT_WRIST];
        const confidence = average(required.map((landmark) => landmarkScore(landmark)));

        return {
            leftRaised: leftWrist.y < leftShoulder.y - this.options.wristAboveShoulderMargin,
            rightRaised: rightWrist.y < rightShoulder.y - this.options.wristAboveShoulderMargin,
            confidence,
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
