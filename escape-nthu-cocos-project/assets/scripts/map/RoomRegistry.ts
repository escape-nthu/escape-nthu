export interface DoorDef {
    doorId: string;
    connectsTo: { roomId: string; doorId: string };
}

export interface RoomDef {
    roomId: string;
    displayName: string;
    prefabPath: string;
    doors: DoorDef[];
    initialRoom?: boolean;
}

const rooms: [string, RoomDef][] = [
    ["delta-1f-hallway", {
        roomId: "delta-1f-hallway",
        displayName: "Delta Building 1F Hallway",
        prefabPath: "prefabs/rooms/Delta1FHallway",
        initialRoom: true,
        doors: [
            { doorId: "door-to-2f", connectsTo: { roomId: "delta-2f-hallway", doorId: "door-from-1f" } },
            { doorId: "door-to-lab", connectsTo: { roomId: "delta-lab-301", doorId: "door-from-hallway" } },
        ],
    }],
    ["delta-2f-hallway", {
        roomId: "delta-2f-hallway",
        displayName: "Delta Building 2F Hallway",
        prefabPath: "prefabs/rooms/Delta2FHallway",
        doors: [
            { doorId: "door-from-1f", connectsTo: { roomId: "delta-1f-hallway", doorId: "door-to-2f" } },
            { doorId: "door-to-server", connectsTo: { roomId: "cs-server-room", doorId: "door-from-2f" } },
        ],
    }],
    ["delta-lab-301", {
        roomId: "delta-lab-301",
        displayName: "Delta Lab 301",
        prefabPath: "prefabs/rooms/DeltaLab301",
        doors: [
            { doorId: "door-from-hallway", connectsTo: { roomId: "delta-1f-hallway", doorId: "door-to-lab" } },
        ],
    }],
    ["cs-server-room", {
        roomId: "cs-server-room",
        displayName: "CS Server Room",
        prefabPath: "prefabs/rooms/CSServerRoom",
        doors: [
            { doorId: "door-from-2f", connectsTo: { roomId: "delta-2f-hallway", doorId: "door-to-server" } },
        ],
    }],
];

export const ROOM_REGISTRY: Map<string, RoomDef> = new Map(rooms);

export function getInitialRoom(): RoomDef {
    for (const [, def] of ROOM_REGISTRY) {
        if (def.initialRoom) return def;
    }
    return ROOM_REGISTRY.values().next().value;
}
