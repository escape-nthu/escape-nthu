import EventBus from "../core/EventBus";

const { ccclass, property } = cc._decorator;
const DEFAULT_API_BASE_URL = "https://escape-nthu-server-vcuhs5ugda-de.a.run.app";

type PlayerRole = "A" | "B";

type Vector2 = {
    x: number;
    y: number;
};

type RoomPlayer = {
    playerId: string;
    role: PlayerRole;
    connected: boolean;
    position?: Vector2;
};

type RoomState = {
    roomId: string;
    players: RoomPlayer[];
};

type RoomJoinResponse = {
    roomId: string;
    playerId: string;
    role: PlayerRole;
    state: RoomState;
};

type LobbyStartPayload = {
    apiBaseUrl: string;
    roomId?: string;
};

@ccclass
export default class RoomClient extends cc.Component {
    static instance: RoomClient | null = null;

    @property
    apiBaseUrl: string = DEFAULT_API_BASE_URL;

    @property(cc.Node)
    localPlayer: cc.Node | null = null;

    private socket: WebSocket | null = null;
    private roomId: string = "";
    private playerId: string = "";
    private role: PlayerRole = "A";
    private remotePlayers: Map<string, cc.Node> = new Map();
    private lastSentAt: number = 0;

    onLoad(): void {
        RoomClient.instance = this;
        EventBus.on("lobby:start-game", this.onLobbyStart, this);
        EventBus.on("player:position-updated", this.onLocalPlayerMoved, this);
        EventBus.on("clue:collected", this.onClueCollected, this);
        EventBus.on("room:transition-local", this.onLocalRoomTransition, this);
    }

    onDestroy(): void {
        EventBus.off("lobby:start-game", this.onLobbyStart, this);
        EventBus.off("player:position-updated", this.onLocalPlayerMoved, this);
        EventBus.off("clue:collected", this.onClueCollected, this);
        EventBus.off("room:transition-local", this.onLocalRoomTransition, this);
        this.disconnect();
        if (RoomClient.instance === this) {
            RoomClient.instance = null;
        }
    }

    isConnected(): boolean {
        return !!this.socket && this.socket.readyState === WebSocket.OPEN;
    }

    start(): void {
        if (!this.socket) {
            this.tryRestoreSession();
        }
    }

    private tryRestoreSession(): void {
        if (typeof localStorage === "undefined") return;
        const storedRoom = localStorage.getItem("escape-nthu:roomId");
        const storedPlayer = localStorage.getItem("escape-nthu:playerId");
        
        if (storedRoom && storedPlayer) {
            this.apiBaseUrl = this.normalizeApiBaseUrl(localStorage.getItem("escape-nthu:apiBaseUrl") || this.apiBaseUrl);
            this.roomId = storedRoom;
            this.playerId = storedPlayer;
            this.role = (localStorage.getItem("escape-nthu:role") as PlayerRole) || "A";
            this.connectSocket();
        }
    }

    private async onLobbyStart(payload: LobbyStartPayload): Promise<void> {
        this.apiBaseUrl = this.normalizeApiBaseUrl((payload && payload.apiBaseUrl) || this.apiBaseUrl);

        try {
            const session = payload && payload.roomId
                ? await this.joinRoom(payload.roomId)
                : await this.createRoom();

            this.roomId = session.roomId;
            this.playerId = session.playerId;
            this.role = session.role;
            this.persistSession();
            this.connectSocket();
            this.applyRoomState(session.state);
            EventBus.emit("network:room-connected", session);
            EventBus.emit("ui:toast", "連線成功！");
        } catch (error) {
            const message = error instanceof Error ? error.message : "多人連線初始化失敗";
            EventBus.emit("network:room-error", message);
            EventBus.emit("ui:toast", message);
        }
    }

    private async createRoom(): Promise<RoomJoinResponse> {
        return this.request("/api/rooms", {
            method: "POST",
            body: JSON.stringify({ preferredRole: "A" }),
        });
    }

    private async joinRoom(roomId: string): Promise<RoomJoinResponse> {
        return this.request(`/api/rooms/${encodeURIComponent(roomId.toUpperCase())}/join`, {
            method: "POST",
            body: JSON.stringify({ preferredRole: "B" }),
        });
    }

    private async request(path: string, init: RequestInit): Promise<RoomJoinResponse> {
        let response: Response;
        try {
            response = await fetch(`${this.apiBaseUrl}${path}`, {
                ...init,
                headers: {
                    "Content-Type": "application/json",
                    ...(init.headers || {}),
                },
            });
        } catch (_error) {
            throw new Error(`無法連線到後端 ${this.apiBaseUrl}，請到開發者設定確認 API URL`);
        }

        const payload = await response.json();

        if (!response.ok) {
            const message = payload && payload.error && payload.error.message
                ? payload.error.message
                : `後端回應 ${response.status}`;
            throw new Error(message);
        }

        return payload as RoomJoinResponse;
    }

    private connectSocket(): void {
        this.disconnect();

        const wsUrl = this.toWebSocketUrl(this.apiBaseUrl, this.roomId, this.playerId);
        this.socket = new WebSocket(wsUrl);
        this.socket.onopen = () => {
            EventBus.emit("network:socket-open", { roomId: this.roomId, playerId: this.playerId, role: this.role });
            this.startPing();
        };
        this.socket.onmessage = (event) => this.handleSocketMessage(event.data);
        this.socket.onerror = () => {
            EventBus.emit("network:room-error", "WebSocket 連線失敗");
        };
        this.socket.onclose = () => {
            this.stopPing();
            EventBus.emit("network:socket-closed", { roomId: this.roomId, playerId: this.playerId });
        };
    }

    private pingTimer: number = 0;

    private startPing(): void {
        this.stopPing();
        this.pingTimer = window.setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.send({ type: "ping" });
            }
        }, 20000);
    }

    private stopPing(): void {
        if (this.pingTimer) {
            window.clearInterval(this.pingTimer);
            this.pingTimer = 0;
        }
    }

    private disconnect(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    private handleSocketMessage(raw: string): void {
        let event: { type: string; payload: any };
        try {
            event = JSON.parse(raw);
        } catch (_error) {
            return;
        }

        switch (event.type) {
            case "server:welcome":
                this.applyRoomState(event.payload.state);
                EventBus.emit("network:room-state", event.payload.state);
                return;
            case "room:state":
                this.applyRoomState(event.payload);
                EventBus.emit("network:room-state", event.payload);
                return;
            case "player:position":
                if (event.payload.playerId !== this.playerId) {
                    this.updateRemotePlayer(event.payload.playerId, event.payload.position);
                    EventBus.emit("network:player-position", event.payload);
                }
                return;
            case "clue:collected":
            case "level:completed":
                if (event.payload.state) {
                    this.applyRoomState(event.payload.state);
                    EventBus.emit("network:room-state", event.payload.state);
                }
                return;
            case "room:transition":
                if (event.payload.initiatorId !== this.playerId) {
                    EventBus.emit("network:room-transition", event.payload);
                }
                return;
            case "error":
                EventBus.emit("network:room-error", event.payload.message);
                return;
        }
    }

    private onLocalPlayerMoved(position: Vector2): void {
        if (!this.isConnected()) return;
        const now = Date.now();
        if (now - this.lastSentAt < 100) return;
        this.lastSentAt = now;
        this.send({
            type: "player:position",
            payload: { position },
        });
    }

    private onClueCollected(clueId: string): void {
        if (!this.isConnected() || !clueId) return;
        this.send({
            type: "clue:collect",
            payload: { clueId },
        });
    }

    private onLocalRoomTransition(payload: { targetRoomId: string; arrivalDoorId: string }): void {
        if (!this.isConnected()) return;
        this.send({
            type: "room:transition",
            payload,
        });
    }

    private send(event: Record<string, unknown>): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify(event));
    }

    private applyRoomState(state: RoomState): void {
        if (!state || !state.players) return;
        for (const player of state.players) {
            if (player.playerId !== this.playerId && player.position) {
                this.updateRemotePlayer(player.playerId, player.position);
            }
        }
    }

    private updateRemotePlayer(playerId: string, position: Vector2): void {
        const node = this.getRemotePlayerNode(playerId);
        node.setPosition(position.x, position.y);
    }

    private getRemotePlayerNode(playerId: string): cc.Node {
        let node = this.remotePlayers.get(playerId);
        if (node) return node;

        node = new cc.Node(`RemotePlayer-${playerId}`);
        node.group = "default";
        node.setContentSize(26, 26);
        node.parent = this.getWorldParent();

        const body = node.addComponent(cc.Graphics);
        body.fillColor = cc.color(88, 205, 255, 220);
        body.circle(0, 0, 13);
        body.fill();
        body.strokeColor = cc.color(255, 255, 255, 220);
        body.lineWidth = 3;
        body.circle(0, 0, 13);
        body.stroke();

        this.remotePlayers.set(playerId, node);
        return node;
    }

    private getWorldParent(): cc.Node {
        if (this.localPlayer) return this.localPlayer.parent || cc.director.getScene();

        const player = cc.find("Player") || cc.find("Canvas/Player");
        if (player) {
            this.localPlayer = player;
            return player.parent || cc.director.getScene();
        }

        return cc.director.getScene();
    }

    private toWebSocketUrl(apiBaseUrl: string, roomId: string, playerId: string): string {
        const base = apiBaseUrl.replace(/\/$/, "");
        const wsBase = base.indexOf("https://") === 0
            ? base.replace("https://", "wss://")
            : base.replace("http://", "ws://");

        return `${wsBase}/ws?roomId=${encodeURIComponent(roomId)}&playerId=${encodeURIComponent(playerId)}`;
    }

    private persistSession(): void {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem("escape-nthu:apiBaseUrl", this.apiBaseUrl);
        localStorage.setItem("escape-nthu:roomId", this.roomId);
        localStorage.setItem("escape-nthu:playerId", this.playerId);
        localStorage.setItem("escape-nthu:role", this.role);
    }

    private normalizeApiBaseUrl(value: string): string {
        const trimmed = (value || "").trim().replace(/\/$/, "");
        if (!trimmed) return DEFAULT_API_BASE_URL;

        const isHostedPage = typeof location !== "undefined" && location.protocol === "https:";
        const isLocalhostApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed);
        if (isHostedPage && isLocalhostApi) {
            return DEFAULT_API_BASE_URL;
        }

        return trimmed;
    }
}
