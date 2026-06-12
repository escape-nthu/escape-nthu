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
    ["Room_temp_1", {
        roomId: "Room_temp_1",
        displayName: "Room_temp_1",
        prefabPath: "prefabs/rooms/Room_temp_1",
        initialRoom: true,
        doors: [
            { doorId: "door_1a", connectsTo: { roomId: "Room_temp_2", doorId: "door_1b" } }
        ],
    }],
    ["Room_temp_2", {
        roomId: "Room_temp_2",
        displayName: "Room_temp_2",
        prefabPath: "prefabs/rooms/Room_temp_2",
        doors: [
            { doorId: "door_1b", connectsTo: { roomId: "Room_temp_1", doorId: "door_1a" } },
            { doorId: "door_to_level3", connectsTo: { roomId: "Room_level3", doorId: "door_level3_back" } }
        ],
    }],
    ["Room_level3", {
        roomId: "Room_level3",
        displayName: "陽台同步深蹲",
        prefabPath: "prefabs/rooms/Room_level3",
        doors: [
            { doorId: "door_level3_back", connectsTo: { roomId: "Room_temp_2", doorId: "door_to_level3" } }
        ],
    }]
];

export const ROOM_REGISTRY: Map<string, RoomDef> = new Map(rooms);

export function getInitialRoom(): RoomDef {
    for (const [, def] of ROOM_REGISTRY) {
        if (def.initialRoom) return def;
    }
    return ROOM_REGISTRY.values().next().value;
}
