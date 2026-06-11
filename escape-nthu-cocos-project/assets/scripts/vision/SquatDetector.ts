import { PoseDetectionResult, PoseLandmark } from "./VisionTypes";

export type SquatPhase = "calibrating" | "standing" | "down" | "lost";

export interface SquatDetectorOptions {
    calibrationMs: number;
    minVisibility: number;
    downGapRatio: number;
    standGapRatio: number;
    minHipDrop: number;
    minCompletionIntervalMs: number;
}

export interface SquatFrameResult {
    phase: SquatPhase;
    count: number;
    ready: boolean;
    justCompleted: boolean;
    confidence: number;
    message: string;
}

type BodySample = {
    hipY: number;
    kneeY: number;
    gap: number;
    confidence: number;
};

const DEFAULT_OPTIONS: SquatDetectorOptions = {
    calibrationMs: 1500,
    minVisibility: 0.45,
    downGapRatio: 0.62,
    standGapRatio: 0.82,
    minHipDrop: 0.08,
    minCompletionIntervalMs: 600,
};

const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

export default class SquatDetector {
    private readonly options: SquatDetectorOptions;
    private phase: SquatPhase = "calibrating";
    private countValue: number = 0;
    private calibrationStartedAt: number = 0;
    private calibrationSamples: BodySample[] = [];
    private standingHipY: number = 0;
    private standingGap: number = 0;
    private lastCompletedAt: number = 0;

    constructor(options?: Partial<SquatDetectorOptions>) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options || {});
    }

    get count(): number {
        return this.countValue;
    }

    reset(): void {
        this.phase = "calibrating";
        this.countValue = 0;
        this.calibrationStartedAt = 0;
        this.calibrationSamples = [];
        this.standingHipY = 0;
        this.standingGap = 0;
        this.lastCompletedAt = 0;
    }

    process(result: PoseDetectionResult): SquatFrameResult {
        const sample = this.sampleBody(result.landmarks);
        if (!sample) {
            this.phase = "lost";
            return this.frame(false, result.confidence, "請站進鏡頭中，讓髖部與膝蓋清楚可見");
        }

        if (this.phase === "calibrating" || this.standingGap <= 0) {
            return this.processCalibration(result.timestampMs, sample);
        }

        const isDown = sample.gap <= this.standingGap * this.options.downGapRatio ||
            sample.hipY >= this.standingHipY + this.options.minHipDrop;
        const isStanding = sample.gap >= this.standingGap * this.options.standGapRatio &&
            sample.hipY <= this.standingHipY + this.options.minHipDrop * 0.5;

        if (this.phase === "standing" && isDown) {
            this.phase = "down";
            return this.frame(false, sample.confidence, "保持蹲下，等待同步提示");
        }

        if (this.phase === "down" && isStanding) {
            const canCount = result.timestampMs - this.lastCompletedAt >= this.options.minCompletionIntervalMs;
            if (canCount) {
                this.countValue += 1;
                this.lastCompletedAt = result.timestampMs;
                this.phase = "standing";
                return this.frame(true, sample.confidence, "有效深蹲 +1");
            }
        }

        if (this.phase === "lost") {
            this.phase = isDown ? "down" : "standing";
        }

        return this.frame(false, sample.confidence, this.phase === "down" ? "已偵測到蹲下" : "請完整蹲下再站起");
    }

    private processCalibration(timestampMs: number, sample: BodySample): SquatFrameResult {
        if (this.calibrationStartedAt <= 0) {
            this.calibrationStartedAt = timestampMs;
        }

        this.calibrationSamples.push(sample);
        const elapsed = timestampMs - this.calibrationStartedAt;
        if (elapsed < this.options.calibrationMs) {
            return this.frame(false, sample.confidence, "請站直校準姿勢");
        }

        const samples = this.calibrationSamples;
        this.standingHipY = average(samples.map((item) => item.hipY));
        this.standingGap = Math.max(0.05, average(samples.map((item) => item.gap)));
        this.phase = "standing";
        return this.frame(false, sample.confidence, "校準完成，開始深蹲");
    }

    private frame(justCompleted: boolean, confidence: number, message: string): SquatFrameResult {
        return {
            phase: this.phase,
            count: this.countValue,
            ready: this.phase === "down",
            justCompleted,
            confidence,
            message,
        };
    }

    private sampleBody(landmarks: PoseLandmark[]): BodySample | null {
        const required = [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE]
            .map((index) => landmarks[index]);

        if (required.some((landmark) => !this.isVisible(landmark))) {
            return null;
        }

        const hipY = average([landmarks[LEFT_HIP].y, landmarks[RIGHT_HIP].y]);
        const kneeY = average([landmarks[LEFT_KNEE].y, landmarks[RIGHT_KNEE].y]);
        const confidence = average(required.map((landmark) => landmarkScore(landmark)));

        return {
            hipY,
            kneeY,
            gap: kneeY - hipY,
            confidence,
        };
    }

    private isVisible(landmark?: PoseLandmark): landmark is PoseLandmark {
        if (!landmark) return false;
        const score = landmarkScore(landmark);
        return score >= this.options.minVisibility;
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
