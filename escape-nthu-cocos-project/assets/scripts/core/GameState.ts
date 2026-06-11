import EventBus from "./EventBus";

const { ccclass } = cc._decorator;

export interface ClueEntry {
    clueId: string;
    text: string;
    category: string;
}

@ccclass
export default class GameState extends cc.Component {

    static instance: GameState = null;

    private collectedClues: Map<string, ClueEntry> = new Map();
    private lockedDoors: Set<string> = new Set();
    private flags: Set<string> = new Set();

    onLoad() {
        if (GameState.instance) {
            this.node.destroy();
            return;
        }
        GameState.instance = this;
    }

    collectClue(entry: ClueEntry): boolean {
        if (this.collectedClues.has(entry.clueId)) return false;
        this.collectedClues.set(entry.clueId, entry);
        EventBus.emit("clue:collected", entry.clueId);
        return true;
    }

    hasClue(clueId: string): boolean {
        return this.collectedClues.has(clueId);
    }

    getClue(clueId: string): ClueEntry | undefined {
        return this.collectedClues.get(clueId);
    }

    getAllClues(): ClueEntry[] {
        return Array.from(this.collectedClues.values());
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

    setFlag(flag: string): void {
        this.flags.add(flag);
        EventBus.emit("flag:set", flag);
    }

    hasFlag(flag: string): boolean {
        return this.flags.has(flag);
    }
}
