import { SpatialEngine, Point } from '../../src/engine/spatial/engine';

describe('SpatialEngine - Pathfinding', () => {
    const engine = new SpatialEngine();

    const createObstacles = (points: Point[]): Set<string> => {
        return new Set(points.map(p => `${p.x},${p.y}`));
    };

    describe('findPath', () => {
        it('should find a simple straight path', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 3, y: 0 };
            const obstacles = new Set<string>();

            const path = engine.findPath(start, end, obstacles);

            expect(path).toBeDefined();
            expect(path).toHaveLength(4); // 0,0 -> 1,0 -> 2,0 -> 3,0
            expect(path![0]).toEqual(start);
            expect(path![path!.length - 1]).toEqual(end);
        });

        it('should find a path around an obstacle', () => {
            // Start (0,0), End (2,0)
            // Obstacle at (1,0)
            // Should go (0,0) -> (1,1) -> (2,0) or (0,0) -> (1,-1) -> (2,0)
            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 0 };
            const obstacles = createObstacles([{ x: 1, y: 0 }]);

            const path = engine.findPath(start, end, obstacles);

            expect(path).toBeDefined();
            expect(path!.length).toBeGreaterThan(0);
            expect(path![0]).toEqual(start);
            expect(path![path!.length - 1]).toEqual(end);

            // Should not contain obstacle
            const hasObstacle = path!.some(p => p.x === 1 && p.y === 0);
            expect(hasObstacle).toBe(false);
        });

        it('should return null if no path exists', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 0 };
            // Surround start with obstacles
            const obstacles = createObstacles([
                { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
                { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }
            ]);

            const path = engine.findPath(start, end, obstacles);
            expect(path).toBeNull();
        });

        it('should prefer shorter paths (diagonal)', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 2 };
            const obstacles = new Set<string>();

            const path = engine.findPath(start, end, obstacles);

            // Should go 0,0 -> 1,1 -> 2,2 (length 3)
            // Not 0,0 -> 1,0 -> 2,0 -> 2,1 -> 2,2 (length 5)
            expect(path).toHaveLength(3);
        });
    });
});
