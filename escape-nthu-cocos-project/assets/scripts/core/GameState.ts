import EventBus from "./EventBus";

const { ccclass } = cc._decorator;

@ccclass
export default class GameState extends cc.Component {

    static instance: GameState = null;

    private collectedClues: Set<string> = new Set();
    private lockedDoors: Set<string> = new Set();

    onLoad() {
        if (GameState.instance) {
            this.node.destroy();
            return;
        }
        GameState.instance = this;
    }

    collectClue(clueId: string): boolean {
        if (this.collectedClues.has(clueId)) return false;
        this.collectedClues.add(clueId);
        EventBus.emit("clue:collected", clueId);
        return true;
    }

    hasClue(clueId: string): boolean {
        return this.collectedClues.has(clueId);
    }

    getAllClues(): string[] {
        return Array.from(this.collectedClues);
    }

    lockDoor(doorId: string): void {
        this.lockedDoors.add(doorId);
    }

    unlockDoor(doorId: string): void {
        this.lockedDoors.delete(doorId);
        EventBus.emit("door:unlocked", doorId);
    }

    isDoorLocked(doorId: string): boolean {
        return this.lockedDoors.has(doorId);
    }
}
