const { ccclass, property } = cc._decorator;

import DoorTrigger from "./DoorTrigger";

@ccclass
export default class RoomController extends cc.Component {

    @property(cc.TiledMap)
    tiledMap: cc.TiledMap = null;

    private mapPixelHeight: number = 0;

    onLoad() {
        if (!this.tiledMap) {
            cc.warn("RoomController: no TiledMap assigned");
            return;
        }
        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();
        this.mapPixelHeight = mapSize.height * tileSize.height;

        this.buildCollision();
        this.buildDoors();
    }

    getMapPixelSize(): cc.Size {
        if (!this.tiledMap) return cc.size(0, 0);
        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();
        return cc.size(mapSize.width * tileSize.width, mapSize.height * tileSize.height);
    }

    private buildCollision(): void {
        const group = this.tiledMap.getObjectGroup("collision");
        if (!group) return;

        const objects = group.getObjects();
        for (const obj of objects) {
            const node = new cc.Node("wall_" + (obj.name || obj.id));
            node.group = "wall";
            node.setPosition(
                obj.x + obj.width / 2,
                this.mapPixelHeight - obj.y - obj.height / 2
            );

            const collider = node.addComponent(cc.BoxCollider);
            collider.size = cc.size(obj.width, obj.height);
            collider.offset = cc.v2(0, 0);

            node.parent = this.node;
        }
    }

    private buildDoors(): void {
        const group = this.tiledMap.getObjectGroup("doors");
        if (!group) return;

        const objects = group.getObjects();
        for (const obj of objects) {
            const node = new cc.Node("door_" + obj.name);
            node.group = "door";

            const cx = obj.x + obj.width / 2;
            const cy = this.mapPixelHeight - obj.y - obj.height / 2;
            node.setPosition(cx, cy);

            const collider = node.addComponent(cc.BoxCollider);
            collider.size = cc.size(obj.width, obj.height);
            collider.offset = cc.v2(0, 0);

            const door = node.addComponent(DoorTrigger);
            door.doorId = obj.name;

            // Spawn point: use custom properties if set, otherwise door center
            const props = obj.properties || {};
            const spawnX = props.spawnX != null ? props.spawnX : cx;
            const spawnY = props.spawnY != null
                ? this.mapPixelHeight - props.spawnY
                : cy;
            door.spawnPoint = cc.v2(spawnX, spawnY);

            node.parent = this.node;
        }
    }
}
