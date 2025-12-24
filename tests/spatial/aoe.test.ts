import { SpatialEngine } from '../../src/engine/spatial/engine';

describe('SpatialEngine - Area of Effect', () => {
    const engine = new SpatialEngine();

    describe('getDistance', () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 3, y: 4 };

        it('should calculate Euclidean distance', () => {
            expect(engine.getDistance(p1, p2, 'euclidean')).toBe(5);
        });

        it('should calculate Manhattan distance', () => {
            expect(engine.getDistance(p1, p2, 'manhattan')).toBe(7);
        });

        it('should calculate Chebyshev distance', () => {
            expect(engine.getDistance(p1, p2, 'chebyshev')).toBe(4);
        });
    });

    describe('getCircleTiles', () => {
        it('should return only center for radius 0', () => {
            const center = { x: 5, y: 5 };
            const tiles = engine.getCircleTiles(center, 0);
            expect(tiles).toHaveLength(1);
            expect(tiles[0]).toEqual(center);
        });

        it('should return 5 tiles for radius 1 (cross shape)', () => {
            // Radius 1 means distance <= 1.
            // (5,5) -> dist 0
            // (5,4), (5,6), (4,5), (6,5) -> dist 1
            // Diagonals (4,4) -> dist sqrt(2) ~ 1.414 > 1
            const center = { x: 5, y: 5 };
            const tiles = engine.getCircleTiles(center, 1);
            expect(tiles).toHaveLength(5);
        });

        it('should include diagonals for radius 1.5', () => {
            // Radius 1.5 covers diagonals (1.414 < 1.5)
            // Should be 3x3 square = 9 tiles
            const center = { x: 5, y: 5 };
            const tiles = engine.getCircleTiles(center, 1.5);
            expect(tiles).toHaveLength(9);
        });
    });

    describe('getConeTiles', () => {
        it('should return tiles in a 90-degree cone facing East', () => {
            // Origin (0,0), Direction (1,0), Length 2
            // Should include (0,0), (1,0), (2,0), (1,-1), (1,1), (2,-1), (2,1), (2,-2), (2,2)
            // Wait, cone logic can be complex.
            // Simple logic: Angle between vector(origin->tile) and direction vector <= 45 degrees (half angle of 90).
            // And distance <= length.

            const origin = { x: 0, y: 0 };
            const direction = { x: 1, y: 0 };
            const tiles = engine.getConeTiles(origin, direction, 2, 90);

            // (0,0) - origin
            // (1,0) - dist 1, angle 0
            // (2,0) - dist 2, angle 0
            // (1,1) - dist 1.41, angle 45 -> included
            // (1,-1) - dist 1.41, angle 45 -> included
            // (2,1) - dist 2.23 > 2? No, Euclidean dist.
            // (2,2) - dist 2.82 > 2.

            // Let's verify specific tiles
            const hasTile = (x: number, y: number) => tiles.some(t => t.x === x && t.y === y);

            expect(hasTile(0, 0)).toBe(true);
            expect(hasTile(1, 0)).toBe(true);
            expect(hasTile(2, 0)).toBe(true);
            expect(hasTile(1, 1)).toBe(true);
            expect(hasTile(1, -1)).toBe(true);

            // (2,2) is dist 2.82, so excluded by length 2
            expect(hasTile(2, 2)).toBe(false);
        });
    });

    describe('getLineTiles', () => {
        it('should return tiles on a horizontal line', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 3, y: 0 };
            const tiles = engine.getLineTiles(start, end);

            expect(tiles).toHaveLength(4); // 0,0 to 3,0 inclusive
            expect(tiles).toContainEqual({ x: 0, y: 0 });
            expect(tiles).toContainEqual({ x: 3, y: 0 });
        });

        it('should return tiles on a diagonal line', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 2, y: 2 };
            const tiles = engine.getLineTiles(start, end);

            // 0,0; 1,1; 2,2
            expect(tiles).toHaveLength(3);
            expect(tiles).toContainEqual({ x: 1, y: 1 });
        });
    });
});
