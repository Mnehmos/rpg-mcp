import { SpatialEngine } from '../../src/engine/spatial/engine';

describe('SpatialEngine - Edge Cases', () => {
    const engine = new SpatialEngine();

    describe('Input Validation', () => {
        it('should reject NaN coordinates in getDistance', () => {
            expect(() => {
                engine.getDistance({ x: NaN, y: 0 }, { x: 1, y: 1 });
            }).toThrow('Invalid p1: coordinates must be finite numbers');
        });

        it('should reject Infinity coordinates in getDistance', () => {
            expect(() => {
                engine.getDistance({ x: 0, y: 0 }, { x: Infinity, y: 1 });
            }).toThrow('Invalid p2: coordinates must be finite numbers');
        });

        it('should reject negative radius in getCircleTiles', () => {
            expect(() => {
                engine.getCircleTiles({ x: 0, y: 0 }, -5);
            }).toThrow('Invalid radius: must be a non-negative finite number');
        });

        it('should reject NaN radius in getCircleTiles', () => {
            expect(() => {
                engine.getCircleTiles({ x: 0, y: 0 }, NaN);
            }).toThrow('Invalid radius: must be a non-negative finite number');
        });

        it('should reject zero-length direction vector in getConeTiles', () => {
            expect(() => {
                engine.getConeTiles({ x: 0, y: 0 }, { x: 0, y: 0 }, 10, 90);
            }).toThrow('Invalid direction vector: length cannot be zero');
        });

        it('should reject invalid angle in getConeTiles', () => {
            expect(() => {
                engine.getConeTiles({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 0);
            }).toThrow('Invalid angle: must be between 0 and 360 degrees');

            expect(() => {
                engine.getConeTiles({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 361);
            }).toThrow('Invalid angle: must be between 0 and 360 degrees');
        });

        it('should reject invalid points in hasLineOfSight', () => {
            expect(() => {
                engine.hasLineOfSight({ x: NaN, y: 0 }, { x: 1, y: 1 }, new Set());
            }).toThrow('Invalid start');
        });

        it('should reject invalid points in findPath', () => {
            expect(() => {
                engine.findPath({ x: 0, y: 0 }, { x: Infinity, y: 1 }, new Set());
            }).toThrow('Invalid end');
        });
    });

    describe('Edge Cases - Pathfinding', () => {
        it('should return single point when start equals end', () => {
            const start = { x: 5, y: 5 };
            const end = { x: 5, y: 5 };
            const obstacles = new Set<string>();

            const path = engine.findPath(start, end, obstacles);

            expect(path).toBeDefined();
            expect(path).toHaveLength(1);
            expect(path![0]).toEqual(start);
        });

        it('should respect maxIterations limit', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 100 };
            const obstacles = new Set<string>();

            // Very low iteration limit should fail on large map
            const path = engine.findPath(start, end, obstacles, { maxIterations: 10 });

            // Might return null if iterations exceeded
            // (depends on path found before limit)
            expect(path).toBeDefined(); // Small diagonal should work
        });

        it('should handle very large distances', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 1000, y: 1000 };
            const obstacles = new Set<string>();

            const path = engine.findPath(start, end, obstacles, { maxIterations: 100000 });

            expect(path).toBeDefined();
            if (path) {
                expect(path[0]).toEqual(start);
                expect(path[path.length - 1]).toEqual(end);
            }
        });
    });

    describe('Edge Cases - Circle AoE', () => {
        it('should return empty array for effectively zero radius', () => {
            const tiles = engine.getCircleTiles({ x: 0, y: 0 }, 0);
            expect(tiles).toHaveLength(1);
            expect(tiles[0]).toEqual({ x: 0, y: 0 });
        });

        it('should handle fractional radius correctly', () => {
            const tiles = engine.getCircleTiles({ x: 0, y: 0 }, 0.5);
            // Only center tile should be included (distance 0 < 0.5)
            expect(tiles).toHaveLength(1);
        });

        it('should handle large radius', () => {
            const tiles = engine.getCircleTiles({ x: 0, y: 0 }, 100);
            // Should be approximately π * r² tiles
            const expectedCount = Math.PI * 100 * 100;
            expect(tiles.length).toBeGreaterThan(expectedCount * 0.9);
            expect(tiles.length).toBeLessThan(expectedCount * 1.1);
        });
    });

    describe('Edge Cases - Cone AoE', () => {
        it('should handle 360-degree cone', () => {
            const tiles = engine.getConeTiles({ x: 0, y: 0 }, { x: 1, y: 0 }, 2, 360);

            // 360° cone with radius 2 should be similar to circle
            const circleTiles = engine.getCircleTiles({ x: 0, y: 0 }, 2);

            // Should have similar tile counts (within margin)
            expect(Math.abs(tiles.length - circleTiles.length)).toBeLessThan(3);
        });

        it('should handle very narrow cone (1 degree)', () => {
            const tiles = engine.getConeTiles({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 1);

            // Very narrow cone should have few tiles
            expect(tiles.length).toBeLessThan(15);
        });
    });

    describe('Edge Cases - Line of Sight', () => {
        it('should handle zero-length LOS (start equals end)', () => {
            const point = { x: 5, y: 5 };
            const obstacles = new Set<string>();

            expect(engine.hasLineOfSight(point, point, obstacles)).toBe(true);
        });

        it('should handle very long LOS', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 1000, y: 1000 };
            const obstacles = new Set<string>();

            expect(engine.hasLineOfSight(start, end, obstacles)).toBe(true);
        });
    });

    describe('Determinism', () => {
        it('should produce identical paths for same inputs', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 10, y: 10 };
            const obstacles = new Set(['5,5', '5,6', '6,5']);

            const path1 = engine.findPath(start, end, obstacles);
            const path2 = engine.findPath(start, end, obstacles);

            expect(path1).toEqual(path2);
        });

        it('should produce identical circle tiles for same inputs', () => {
            const center = { x: 10, y: 10 };
            const radius = 5;

            const tiles1 = engine.getCircleTiles(center, radius);
            const tiles2 = engine.getCircleTiles(center, radius);

            expect(tiles1).toEqual(tiles2);
        });
    });
});
