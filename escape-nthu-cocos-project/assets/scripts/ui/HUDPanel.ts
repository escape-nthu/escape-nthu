import EventBus from "../core/EventBus";
import RoomClient from "../net/RoomClient";

const { ccclass, property } = cc._decorator;

@ccclass
export default class HUDPanel extends cc.Component {
    @property(cc.Label)
    label: cc.Label = null;

    onLoad() {
        // Register event listeners
        EventBus.on("network:room-connected", this.onRoomConnected, this);
        EventBus.on("network:socket-open", this.onSocketOpen, this);
        EventBus.on("network:room-error", this.onRoomDisconnected, this);
        EventBus.on("network:socket-closed", this.onRoomDisconnected, this);
        EventBus.on("lobby:start-game", this.onLobbyStart, this);

        this.node.group = "ui";
        if (this.label) this.label.node.group = "ui";

        // Hide initially
        this.node.active = false;

        // Check if already connected on load
        this.checkInitialState();
    }

    onDestroy() {
        EventBus.off("network:room-connected", this.onRoomConnected, this);
        EventBus.off("network:socket-open", this.onSocketOpen, this);
        EventBus.off("network:room-error", this.onRoomDisconnected, this);
        EventBus.off("network:socket-closed", this.onRoomDisconnected, this);
        EventBus.off("lobby:start-game", this.onLobbyStart, this);
    }

    private onRoomConnected(payload: { roomId: string; role: string }): void {
        this.updateHUDText(payload.roomId, payload.role);
        this.node.active = true;
        const widget = this.getComponent(cc.Widget);
        if (widget) widget.updateAlignment();
    }

    private onSocketOpen(payload: { roomId: string; role: string }): void {
        this.onRoomConnected(payload);
    }

    private onLobbyStart(): void {
        this.node.active = false;
    }

    private onRoomDisconnected(): void {
        if (RoomClient.instance && RoomClient.instance.isConnected()) return;
        this.node.active = false;
    }

    private updateHUDText(roomId: string, role: string): void {
        if (!this.label) return;
        const roleText = role === "A" ? "Player A (房主)" : "Player B (隊友)";
        this.label.string = `房號: ${roomId.toUpperCase()}\n身分: ${roleText}`;
    }

    private checkInitialState(): void {
        if (!RoomClient.instance) return;
        const session = RoomClient.instance.getSessionInfo();
        if (session) {
            this.onRoomConnected(session);
        }
    }
}
