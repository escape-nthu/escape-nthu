import { PoseAdapterState, PoseDetectionResult, PoseLandmark } from "./VisionTypes";

type PoseResultCallback = (result: PoseDetectionResult) => void;

type MediaPipeWindow = Window & {
    EscapeNthuVision?: {
        FilesetResolver: {
            forVisionTasks(wasmRoot: string): Promise<unknown>;
        };
        PoseLandmarker: {
            createFromOptions(vision: unknown, options: Record<string, unknown>): Promise<unknown>;
        };
    };
};

const MEDIAPIPE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
const MEDIAPIPE_WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const POSE_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

let mediaPipeLoadPromise: Promise<void> | null = null;

export default class MediaPipePoseAdapter {
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private landmarker: any = null;
    private animationFrameId: number = 0;
    private callback: PoseResultCallback | null = null;
    private state: PoseAdapterState = { status: "idle", message: "尚未啟動攝影機" };
    private lastVideoTime: number = -1;
    private readonly boundLoop: () => void;

    constructor() {
        this.boundLoop = this.loop.bind(this);
    }

    getState(): PoseAdapterState {
        return {
            status: this.state.status,
            message: this.state.message,
        };
    }

    getVideoElement(): HTMLVideoElement | null {
        return this.video;
    }

    async start(callback: PoseResultCallback): Promise<HTMLVideoElement> {
        this.callback = callback;
        this.setState("loading", "載入 MediaPipe Pose 模型");
        await loadMediaPipe();
        await this.createLandmarker();
        await this.openCamera();
        this.setState("running", "姿態偵測中");
        this.loop();
        return this.video as HTMLVideoElement;
    }

    stop(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }

        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        if (this.video && this.video.parentElement) {
            this.video.parentElement.removeChild(this.video);
        }
        this.video = null;
        this.callback = null;
        this.lastVideoTime = -1;
        this.setState("stopped", "姿態偵測已停止");
    }

    private async createLandmarker(): Promise<void> {
        if (this.landmarker) {
            return;
        }

        const mediaPipe = (window as MediaPipeWindow).EscapeNthuVision;
        if (!mediaPipe) {
            throw new Error("MediaPipe module did not initialize");
        }

        const vision = await mediaPipe.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);
        this.landmarker = await mediaPipe.PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: POSE_MODEL_URL,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
    }

    private async openCamera(): Promise<void> {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API is not available in this browser");
        }

        this.setState("requesting-camera", "等待攝影機權限");
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
            },
            audio: false,
        });

        this.video = document.createElement("video");
        this.video.autoplay = true;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.srcObject = this.stream;
        this.video.style.position = "absolute";
        this.video.style.width = "1px";
        this.video.style.height = "1px";
        this.video.style.opacity = "0";
        this.video.style.pointerEvents = "none";
        document.body.appendChild(this.video);

        await this.video.play();
    }

    private loop(): void {
        if (!this.video || !this.landmarker || !this.callback) {
            return;
        }

        if (this.video.readyState >= 2 &&
            this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const timestampMs = performance.now();
            const result = this.landmarker.detectForVideo(this.video, timestampMs);
            const landmarks = normalizeLandmarks(result && result.landmarks && result.landmarks[0] ? result.landmarks[0] : []);
            if (landmarks.length > 0) {
                this.callback({
                    source: "mediapipe",
                    timestampMs,
                    landmarks,
                    confidence: average(landmarks.map((landmark) => landmarkScore(landmark))),
                });
            }
        }

        this.animationFrameId = requestAnimationFrame(this.boundLoop);
    }

    private setState(status: PoseAdapterState["status"], message: string): void {
        this.state = { status, message };
    }
}

function loadMediaPipe(): Promise<void> {
    const mediaPipeWindow = window as MediaPipeWindow;
    if (mediaPipeWindow.EscapeNthuVision) {
        return Promise.resolve();
    }

    if (mediaPipeLoadPromise) {
        return mediaPipeLoadPromise;
    }

    mediaPipeLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.type = "module";
        script.textContent = `
import { FilesetResolver, PoseLandmarker } from "${MEDIAPIPE_MODULE_URL}";
window.EscapeNthuVision = { FilesetResolver, PoseLandmarker };
window.dispatchEvent(new Event("escape-nthu:mediapipe-ready"));
`;

        const timeout = window.setTimeout(() => {
            reject(new Error("MediaPipe CDN load timed out"));
        }, 15000);

        window.addEventListener("escape-nthu:mediapipe-ready", () => {
            window.clearTimeout(timeout);
            resolve();
        }, { once: true });

        script.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("MediaPipe CDN load failed"));
        };

        document.head.appendChild(script);
    });

    return mediaPipeLoadPromise;
}

function normalizeLandmarks(rawLandmarks: unknown[]): PoseLandmark[] {
    return rawLandmarks.map((item) => {
        const landmark = item as PoseLandmark;
        return {
            x: landmark.x,
            y: landmark.y,
            z: landmark.z,
            visibility: landmark.visibility,
            presence: landmark.presence,
        };
    });
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
