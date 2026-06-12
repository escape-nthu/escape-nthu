import { NavGrid } from "./AStar";

const CELL_SIZE = 32;
const MARGIN = 64;

export function buildGridFromRoom(roomNode: cc.Node, roomWidth: number, roomHeight: number): NavGrid {
    const colliders = roomNode.getComponentsInChildren(cc.BoxCollider);
    const walls: { minX: number; minY: number; maxX: number; maxY: number }[] = [];

    let boundsMinX = 0;
    let boundsMinY = 0;
    let boundsMaxX = roomWidth;
    let boundsMaxY = roomHeight;

    for (const col of colliders) {
        if (col.node.group !== "wall") continue;

        const worldPos = col.node.convertToWorldSpaceAR(cc.v2(0, 0));
        const localPos = roomNode.convertToNodeSpaceAR(worldPos);

        const cx = localPos.x + col.offset.x;
        const cy = localPos.y + col.offset.y;
        const halfW = col.size.width / 2;
        const halfH = col.size.height / 2;

        const minX = cx - halfW;
        const maxX = cx + halfW;
        const minY = cy - halfH;
        const maxY = cy + halfH;

        walls.push({ minX, minY, maxX, maxY });

        boundsMinX = Math.min(boundsMinX, minX);
        boundsMinY = Math.min(boundsMinY, minY);
        boundsMaxX = Math.max(boundsMaxX, maxX);
        boundsMaxY = Math.max(boundsMaxY, maxY);
    }

    const originX = boundsMinX - MARGIN;
    const originY = boundsMinY - MARGIN;
    const gridW = boundsMaxX + MARGIN - originX;
    const gridH = boundsMaxY + MARGIN - originY;

    const cols = Math.ceil(gridW / CELL_SIZE);
    const rows = Math.ceil(gridH / CELL_SIZE);
    const blocked = new Array<boolean>(rows * cols).fill(false);

    const pad = CELL_SIZE * 0.5;

    for (const w of walls) {
        const gMinCol = Math.max(0, Math.floor((w.minX - pad - originX) / CELL_SIZE));
        const gMaxCol = Math.min(cols - 1, Math.floor((w.maxX + pad - originX) / CELL_SIZE));
        const gMinRow = Math.max(0, Math.floor((w.minY - pad - originY) / CELL_SIZE));
        const gMaxRow = Math.min(rows - 1, Math.floor((w.maxY + pad - originY) / CELL_SIZE));

        for (let r = gMinRow; r <= gMaxRow; r++) {
            for (let c = gMinCol; c <= gMaxCol; c++) {
                blocked[r * cols + c] = true;
            }
        }
    }

    return { width: cols, height: rows, blocked, cellSize: CELL_SIZE, originX, originY };
}
