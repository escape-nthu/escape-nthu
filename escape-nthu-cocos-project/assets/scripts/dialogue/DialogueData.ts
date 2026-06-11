export interface DialogueLine {
    speaker: string;
    text: string;
    portraitLeft: string | null;
    portraitRight: string | null;
    activeSide: "left" | "right" | "none";
}

export interface DialogueAction {
    type: "setFlag" | "unlockDoor" | "lockDoor" | "collectClue" | "emitEvent";
    flag?: string;
    doorId?: string;
    clueId?: string;
    text?: string;
    category?: string;
    event?: string;
    data?: any;
}

export interface DialogueSequence {
    id: string;
    lines: DialogueLine[];
    onComplete: DialogueAction[];
    conditions?: {
        requireFlags?: string[];
        excludeFlags?: string[];
    };
}
