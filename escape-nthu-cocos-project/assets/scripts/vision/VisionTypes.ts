export type PoseAdapterStatus =
    "idle" |
    "loading" |
    "requesting-camera" |
    "running" |
    "failed" |
    "stopped";

export interface PoseLandmark {
    x: number;
    y: number;
    z?: number;
    visibility?: number;
    presence?: number;
}

export interface PoseDetectionResult {
    source: "mediapipe" | "debug";
    timestampMs: number;
    landmarks: PoseLandmark[];
    confidence: number;
}

export interface PoseAdapterState {
    status: PoseAdapterStatus;
    message: string;
}
