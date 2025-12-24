import { SpatialEngine, Point } from '../../src/engine/spatial/engine';

describe('SpatialEngine - Line of Sight', () => {
    const engine = new SpatialEngine();

    // Helper to create a set of obstacle strings "x,y"
    const createObstacles = (points: Point[]): Set<string> => {
        return new Set(points.map(p => `${p.x},${p.y}`));
    };

    describe('hasLineOfSight', () => {
        it('should have LOS when no obstacles exist', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 5, y: 0 };
            const obstacles = new Set<string>();

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(true);
        });

        it('should be blocked by an obstacle in a horizontal path', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 5, y: 0 };
            const obstacles = createObstacles([{ x: 2, y: 0 }]);

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(false);
        });

        it('should be blocked by an obstacle in a vertical path', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 0, y: 5 };
            const obstacles = createObstacles([{ x: 0, y: 2 }]);

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(false);
        });

        it('should be blocked by an obstacle in a diagonal path', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 3, y: 3 };
            const obstacles = createObstacles([{ x: 2, y: 2 }]);

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(false);
        });

        it('should have LOS if obstacle is not on the path', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 5, y: 0 };
            const obstacles = createObstacles([{ x: 2, y: 1 }]); // One tile above

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(true);
        });

        it('should allow LOS to adjacent tiles even if "blocked" (sanity check)', () => {
            // Usually you can always see adjacent tiles unless there's a wall BETWEEN them, 
            // but in tile-based logic, if the target IS the wall, you can see it.
            // If the target is BEHIND a wall, you can't.
            // Here we test seeing TO an obstacle (should be true) vs THROUGH it.

            // Actually, hasLineOfSight usually means "can I see the center of the target tile?"
            // If the target tile is an obstacle, you can see it.
            // If there is an obstacle between start and end, you cannot.

            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 0 };
            const obstacles = createObstacles([{ x: 1, y: 0 }]); // Obstacle in between

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(false);
        });

        it('should allow LOS to the obstacle itself', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 0 };
            const obstacles = createObstacles([{ x: 2, y: 0 }]); // Target is obstacle

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(true);
        });
    });
});
