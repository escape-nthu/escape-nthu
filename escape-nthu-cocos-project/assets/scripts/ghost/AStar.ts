export interface NavGrid {
    width: number;
    height: number;
    blocked: boolean[];
    cellSize: number;
    originX: number;
    originY: number;
}

export interface PathNode {
    col: number;
    row: number;
}

const SQRT2 = Math.SQRT2;

interface AStarNode {
    col: number;
    row: number;
    g: number;
    f: number;
    parent: AStarNode | null;
}

const DIRS: [number, number, number][] = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [-1, -1, SQRT2],
];

function octile(dx: number, dy: number): number {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    return adx > ady
        ? adx + (SQRT2 - 1) * ady
        : ady + (SQRT2 - 1) * adx;
}

function idx(grid: NavGrid, col: number, row: number): number {
    return row * grid.width + col;
}

function inBounds(grid: NavGrid, col: number, row: number): boolean {
    return col >= 0 && col < grid.width && row >= 0 && row < grid.height;
}

function findNearestWalkable(grid: NavGrid, col: number, row: number): PathNode {
    if (inBounds(grid, col, row) && !grid.blocked[idx(grid, col, row)]) {
        return { col, row };
    }
    for (let r = 1; r <= Math.max(grid.width, grid.height); r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const nc = col + dx;
                const nr = row + dy;
                if (inBounds(grid, nc, nr) && !grid.blocked[idx(grid, nc, nr)]) {
                    return { col: nc, row: nr };
                }
            }
        }
    }
    return { col, row };
}

export function findPath(grid: NavGrid, start: PathNode, end: PathNode): PathNode[] | null {
    const s = findNearestWalkable(grid, start.col, start.row);
    const e = findNearestWalkable(grid, end.col, end.row);

    if (s.col === e.col && s.row === e.row) return [e];

    const open: AStarNode[] = [];
    const closed = new Uint8Array(grid.width * grid.height);

    const startNode: AStarNode = {
        col: s.col, row: s.row,
        g: 0, f: octile(e.col - s.col, e.row - s.row),
        parent: null,
    };
    open.push(startNode);

    while (open.length > 0) {
        let bestIdx = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < open[bestIdx].f) bestIdx = i;
        }
        const cur = open[bestIdx];
        open[bestIdx] = open[open.length - 1];
        open.pop();

        if (cur.col === e.col && cur.row === e.row) {
            const path: PathNode[] = [];
            let n: AStarNode | null = cur;
            while (n) {
                path.push({ col: n.col, row: n.row });
                n = n.parent;
            }
            path.reverse();
            return path;
        }

        const ci = idx(grid, cur.col, cur.row);
        if (closed[ci]) continue;
        closed[ci] = 1;

        for (const [dc, dr, cost] of DIRS) {
            const nc = cur.col + dc;
            const nr = cur.row + dr;
            if (!inBounds(grid, nc, nr)) continue;

            const ni = idx(grid, nc, nr);
            if (grid.blocked[ni] || closed[ni]) continue;

            if (dc !== 0 && dr !== 0) {
                if (grid.blocked[idx(grid, cur.col + dc, cur.row)] ||
                    grid.blocked[idx(grid, cur.col, cur.row + dr)]) {
                    continue;
                }
            }

            const ng = cur.g + cost;
            const nf = ng + octile(e.col - nc, e.row - nr);

            open.push({
                col: nc, row: nr,
                g: ng, f: nf,
                parent: cur,
            });
        }
    }

    return null;
}

export function worldToGrid(grid: NavGrid, wx: number, wy: number): PathNode {
    return {
        col: Math.floor((wx - grid.originX) / grid.cellSize),
        row: Math.floor((wy - grid.originY) / grid.cellSize),
    };
}

export function gridToWorld(grid: NavGrid, col: number, row: number): cc.Vec2 {
    return cc.v2(
        grid.originX + (col + 0.5) * grid.cellSize,
        grid.originY + (row + 0.5) * grid.cellSize,
    );
}
