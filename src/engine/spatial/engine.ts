import { MinHeap } from './heap';

export interface Point {
    x: number;
    y: number;
    z?: number; // Optional z-coordinate for 3D support
}

export type Point3D = Required<Point>; // Point with mandatory z

export type DistanceMetric = 'euclidean' | 'manhattan' | 'chebyshev';

export type DiagonalCost = 'uniform' | 'alternating' | number;

export interface TerrainCostMap {
    /**
     * Returns the movement cost multiplier for a given tile.
     * @returns 1 = normal terrain, 2 = difficult terrain, Infinity = impassable
     */
    getTileCost(point: Point): number;
}

export interface PathfindingOptions {
    /** Maximum number of iterations to prevent infinite loops. Default: 10000 */
    maxIterations?: number;

    /** 
     * Diagonal movement cost. 
     * - 'uniform': cost 1 (default, Chebyshev)
     * - 'alternating': D&D 5e "5-10-5" rule (cost 1.5 average)
     * - number: custom cost for diagonal moves
     */
    diagonalCost?: DiagonalCost;

    /**
     * Custom movement cost function. Overrides diagonalCost if provided.
     * @param from Starting point
     * @param to Destination point
     * @returns Movement cost (typically 1 for normal, higher for difficult)
     */
    movementCostFn?: (from: Point, to: Point) => number;

    /**
     * Terrain cost map for variable terrain costs (difficult terrain, water, etc.)
     */
    terrainCosts?: TerrainCostMap;

    /**
     * Optional grid boundaries for validation.
     */
    bounds?: {
        min: Point;
        max: Point;
    };
}

export class SpatialEngine {
    // AoE shape cache for common radii
    private circleCache: Map<string, Point[]> = new Map();
    private readonly MAX_CACHED_RADIUS = 10;

    /**
     * Validates that a point has finite numeric coordinates and is within optional bounds.
     * @throws Error if coordinates are not finite numbers or out of bounds
     */
    private validatePoint(p: Point, paramName: string, bounds?: { min: Point, max: Point }): void {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            throw new Error(`Invalid ${paramName}: coordinates must be finite numbers (got x=${p.x}, y=${p.y})`);
        }
        if (p.z !== undefined && !Number.isFinite(p.z)) {
            throw new Error(`Invalid ${paramName}: z-coordinate must be a finite number (got z=${p.z})`);
        }

        if (bounds) {
            if (p.x < bounds.min.x || p.x > bounds.max.x ||
                p.y < bounds.min.y || p.y > bounds.max.y) {
                throw new Error(`Invalid ${paramName}: out of bounds (got ${p.x},${p.y}; bounds: ${bounds.min.x},${bounds.min.y} to ${bounds.max.x},${bounds.max.y})`);
            }
            if (p.z !== undefined && (bounds.min.z !== undefined && bounds.max.z !== undefined)) {
                if (p.z < bounds.min.z || p.z > bounds.max.z) {
                    throw new Error(`Invalid ${paramName}: z-coordinate out of bounds`);
                }
            }
        }
    }

    /**
     * Calculates distance between two points using the specified metric.
     * Automatically handles 2D and 3D points.
     * 
     * @param p1 First point
     * @param p2 Second point
     * @param metric Distance metric to use (default: 'euclidean')
     * @returns Distance between points
     * 
     * @example
     * ```typescript
     * const engine = new SpatialEngine();
     * // 2D
     * engine.getDistance({x: 0, y: 0}, {x: 3, y: 4}); // 5
     * // 3D
     * engine.getDistance({x: 0, y: 0, z: 0}, {x: 3, y: 4, z: 12}); // 13
     * ```
     */
    getDistance(p1: Point, p2: Point, metric: DistanceMetric = 'euclidean'): number {
        this.validatePoint(p1, 'p1');
        this.validatePoint(p2, 'p2');

        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);
        const dz = Math.abs((p1.z ?? 0) - (p2.z ?? 0));

        switch (metric) {
            case 'manhattan': return dx + dy + dz;
            case 'chebyshev': return Math.max(dx, dy, dz);
            case 'euclidean': return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
    }

    /**
     * Returns all tiles within a given radius of a center point.
     * Uses Euclidean distance for circular shape.
     * Automatically caches results for radii <= 10 for performance.
     * 
     * @param center Center point of the circle
     * @param radius Radius in grid units (must be non-negative)
     * @param useCache Whether to use caching (default: true)
     * @returns Array of points within the radius
     * 
     * @example
     * ```typescript
     * const engine = new SpatialEngine();
     * // Get tiles in a 5-unit radius (cached)
     * const tiles = engine.getCircleTiles({x: 10, y: 10}, 5);
     * // Large radius without caching
     * const largeTiles = engine.getCircleTiles({x: 0, y: 0}, 50, false);
     * ```
     */
    getCircleTiles(center: Point, radius: number, useCache: boolean = true): Point[] {
        this.validatePoint(center, 'center');
        if (!Number.isFinite(radius) || radius < 0) {
            throw new Error(`Invalid radius: must be a non-negative finite number (got ${radius})`);
        }

        // Use cache for small radii
        if (useCache && radius <= this.MAX_CACHED_RADIUS && !center.z) {
            const cacheKey = radius.toString();

            if (!this.circleCache.has(cacheKey)) {
                // Compute relative to origin and cache
                const origin = { x: 0, y: 0 };
                const offsets = this.computeCircleTiles(origin, radius);
                this.circleCache.set(cacheKey, offsets);
            }

            // Apply cached offsets to actual center
            const offsets = this.circleCache.get(cacheKey)!;
            return offsets.map(offset => ({
                x: center.x + offset.x,
                y: center.y + offset.y
            }));
        }

        // Compute directly for large radii or 3D
        return this.computeCircleTiles(center, radius);
    }

    /**
     * Internal method to compute circle tiles without caching.
     * @private
     */
    private computeCircleTiles(center: Point, radius: number): Point[] {
        const tiles: Point[] = [];
        const rCeil = Math.ceil(radius);

        if (center.z !== undefined) {
            // 3D sphere
            for (let x = center.x - rCeil; x <= center.x + rCeil; x++) {
                for (let y = center.y - rCeil; y <= center.y + rCeil; y++) {
                    for (let z = center.z - rCeil; z <= center.z + rCeil; z++) {
                        const p = { x, y, z };
                        if (this.getDistance(center, p) <= radius) {
                            tiles.push(p);
                        }
                    }
                }
            }
        } else {
            // 2D circle
            for (let x = center.x - rCeil; x <= center.x + rCeil; x++) {
                for (let y = center.y - rCeil; y <= center.y + rCeil; y++) {
                    const p = { x, y };
                    if (this.getDistance(center, p) <= radius) {
                        tiles.push(p);
                    }
                }
            }
        }

        return tiles;
    }

    /**
     * Returns tiles within a cone defined by origin, direction, length, and angle.
     * 
     * @param origin Origin point of the cone (typically the caster's position)
     * @param direction Direction vector (NOT a target point). For example, {x: 1, y: 0} points East.
     * @param length Maximum distance from origin in grid units
     * @param angleDegrees Total angle of the cone in degrees (e.g., 90 for a quarter-circle)
     * @returns Array of points within the cone
     * 
     * @example
     * ```typescript
     * const engine = new SpatialEngine();
     * // 90-degree cone facing East, 10 units long
     * const tiles = engine.getConeTiles(
     *     {x: 0, y: 0},           // origin
     *     {x: 1, y: 0},           // direction vector (East)
     *     10,                     // length
     *     90                      // angle in degrees
     * );
     * ```
     */
    getConeTiles(origin: Point, direction: Point, length: number, angleDegrees: number): Point[] {
        this.validatePoint(origin, 'origin');
        this.validatePoint(direction, 'direction');
        if (!Number.isFinite(length) || length < 0) {
            throw new Error(`Invalid length: must be non-negative (got ${length})`);
        }
        if (!Number.isFinite(angleDegrees) || angleDegrees <= 0 || angleDegrees > 360) {
            throw new Error(`Invalid angle: must be between 0 and 360 degrees (got ${angleDegrees})`);
        }

        const tiles: Point[] = [];
        const halfAngleRad = (angleDegrees / 2) * (Math.PI / 180);

        // Normalize direction vector
        const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y + (direction.z ?? 0) * (direction.z ?? 0));
        if (dirLen === 0) {
            throw new Error('Invalid direction vector: length cannot be zero');
        }
        const dirNorm = {
            x: direction.x / dirLen,
            y: direction.y / dirLen,
            z: (direction.z ?? 0) / dirLen
        };

        // Bounding box optimization
        const lCeil = Math.ceil(length);

        if (origin.z !== undefined) {
            // 3D cone
            for (let x = origin.x - lCeil; x <= origin.x + lCeil; x++) {
                for (let y = origin.y - lCeil; y <= origin.y + lCeil; y++) {
                    for (let z = origin.z - lCeil; z <= origin.z + lCeil; z++) {
                        const p = { x, y, z };
                        if (this.isInCone(origin, p, dirNorm, length, halfAngleRad)) {
                            tiles.push(p);
                        }
                    }
                }
            }
        } else {
            // 2D cone
            for (let x = origin.x - lCeil; x <= origin.x + lCeil; x++) {
                for (let y = origin.y - lCeil; y <= origin.y + lCeil; y++) {
                    const p = { x, y };
                    if (this.isInCone(origin, p, dirNorm, length, halfAngleRad)) {
                        tiles.push(p);
                    }
                }
            }
        }

        return tiles;
    }

    /**
     * Helper to check if a point is within a cone.
     * @private
     */
    private isInCone(origin: Point, p: Point, dirNorm: Point, length: number, halfAngleRad: number): boolean {
        const dist = this.getDistance(origin, p);

        if (dist > length) return false;
        if (dist === 0) return true;

        // Vector from origin to point
        const px = p.x - origin.x;
        const py = p.y - origin.y;
        const pz = (p.z ?? 0) - (origin.z ?? 0);

        // Dot product
        const dot = px * dirNorm.x + py * dirNorm.y + pz * (dirNorm.z ?? 0);
        // Cosine of angle = dot / dist
        const cosTheta = dot / dist;

        // Check angle (with epsilon for floating-point precision)
        return cosTheta >= Math.cos(halfAngleRad) - 0.0001;
    }

    /**
     * Returns tiles along a line from start to end using Bresenham's algorithm.
     * 
     * @param start Start point of the line
     * @param end End point of the line
     * @returns Array of points along the line (including endpoints)
     */
    getLineTiles(start: Point, end: Point): Point[] {
        this.validatePoint(start, 'start');
        this.validatePoint(end, 'end');
        return this.bresenhamLine(start, end);
    }

    /**
     * Finds the shortest path between start and end using A* algorithm with binary heap optimization.
     * Supports custom movement costs including diagonal costs and terrain modifiers.
     * 
     * @param start Starting point
     * @param end Target point
     * @param obstacles Set of blocked tiles in "x,y" or "x,y,z" format
     * @param options Optional configuration
     * @returns Array of points representing the path, or null if no path exists
     * 
     * @example
     * ```typescript
     * const engine = new SpatialEngine();
     * const obstacles = new Set(['5,5', '5,6', '5,7']); // Wall
     * 
     * // Basic pathfinding
     * const path1 = engine.findPath({x: 0, y: 0}, {x: 10, y: 0}, obstacles);
     * 
     * // With D&D 5e diagonal costs
     * const path2 = engine.findPath({x: 0, y: 0}, {x: 10, y: 10}, obstacles, {
     *     diagonalCost: 'alternating' // 5-10-5 rule
     * });
     * 
     * // With terrain costs
     * const terrainMap = { getTileCost: (p) => p.y > 5 ? 2 : 1 }; // Difficult terrain above y=5
     * const path3 = engine.findPath({x: 0, y: 0}, {x: 10, y: 10}, obstacles, {
     *     terrainCosts: terrainMap
     * });
     * ```
     */
    findPath(start: Point, end: Point, obstacles: Set<string>, options: PathfindingOptions = {}): Point[] | null {
        this.validatePoint(start, 'start', options.bounds);
        this.validatePoint(end, 'end', options.bounds);

        const maxIterations = options.maxIterations ?? 10000;
        const startKey = this.pointToKey(start);
        const endKey = this.pointToKey(end);
        const is3D = start.z !== undefined || end.z !== undefined;

        // Special case: start equals end
        if (startKey === endKey) {
            return [start];
        }

        // If end is blocked, no path possible
        if (obstacles.has(endKey)) {
            return null;
        }

        // Create cost function based on options
        const getCost = this.createCostFunction(options);

        // Initialize A* data structures
        const openHeap = new MinHeap<Point>(this.pointToKey);
        const closedSet = new Set<string>();
        const cameFrom = new Map<string, Point>();
        const gScore = new Map<string, number>();

        gScore.set(startKey, 0);
        const fScore = this.getDistance(start, end, 'chebyshev');
        openHeap.insert(start, fScore);

        let iterations = 0;

        while (!openHeap.isEmpty()) {
            iterations++;
            if (iterations > maxIterations) {
                return null;
            }

            const current = openHeap.extractMin()!;
            const currentKey = this.pointToKey(current);

            // Goal reached
            if (this.pointsEqual(current, end)) {
                return this.reconstructPath(cameFrom, current);
            }

            closedSet.add(currentKey);

            // Get neighbors (8 for 2D, 26 for 3D)
            const neighbors = this.getNeighbors(current, is3D);

            for (const neighbor of neighbors) {
                const neighborKey = this.pointToKey(neighbor);

                if (obstacles.has(neighborKey) || closedSet.has(neighborKey)) {
                    continue;
                }

                // Calculate cost
                const baseCost = getCost(current, neighbor);
                const terrainMultiplier = options.terrainCosts?.getTileCost(neighbor) ?? 1;

                if (terrainMultiplier === Infinity) {
                    continue; // Impassable terrain
                }

                const moveCost = baseCost * terrainMultiplier;
                const tentativeG = gScore.get(currentKey)! + moveCost;

                if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    const f = tentativeG + this.getDistance(neighbor, end, 'chebyshev');

                    openHeap.insert(neighbor, f);
                }
            }
        }

        return null;
    }

    /**
     * Creates a cost function based on pathfinding options.
     * @private
     */
    private createCostFunction(options: PathfindingOptions): (from: Point, to: Point) => number {
        if (options.movementCostFn) {
            return options.movementCostFn;
        }

        const diagCost = options.diagonalCost ?? 'uniform';

        return (from: Point, to: Point) => {
            const dx = Math.abs(to.x - from.x);
            const dy = Math.abs(to.y - from.y);
            const dz = Math.abs((to.z ?? 0) - (from.z ?? 0));

            const isDiagonal = (dx + dy + dz) > 1; // More than one axis changed

            if (diagCost === 'uniform') {
                return 1;
            } else if (diagCost === 'alternating') {
                // D&D 5e "5-10-5" rule simplified to 1.5 average cost
                return isDiagonal ? 1.5 : 1;
            } else {
                // Custom diagonal cost (number)
                return isDiagonal ? diagCost : 1;
            }
        };
    }

    /**
     * Gets neighboring tiles (8 for 2D, 26 for 3D).
     * @private
     */
    private getNeighbors(point: Point, is3D: boolean): Point[] {
        const neighbors: Point[] = [];
        const deltas = is3D ? [-1, 0, 1] : [-1, 0, 1];

        for (const dx of deltas) {
            for (const dy of deltas) {
                if (is3D && point.z !== undefined) {
                    for (const dz of [-1, 0, 1]) {
                        if (dx === 0 && dy === 0 && dz === 0) continue;
                        neighbors.push({
                            x: point.x + dx,
                            y: point.y + dy,
                            z: point.z + dz
                        });
                    }
                } else {
                    if (dx === 0 && dy === 0) continue;
                    neighbors.push({
                        x: point.x + dx,
                        y: point.y + dy
                    });
                }
            }
        }

        return neighbors;
    }

    /**
     * Smooths a path by removing unnecessary waypoints using line-of-sight checks.
     * Uses the "string pulling" algorithm.
     * 
     * @param path Original path from pathfinding
     * @param obstacles Obstacle set used for LOS checks
     * @returns Smoothed path with fewer waypoints
     * 
     * @example
     * ```typescript
     * const obstacles = new Set(['5,5']);
     * const path = engine.findPath({x: 0, y: 0}, {x: 10, y: 10}, obstacles);
     * const smoothed = engine.smoothPath(path!, obstacles);
     * // smoothed.length <= path.length
     * ```
     */
    smoothPath(path: Point[], obstacles: Set<string>): Point[] {
        if (path.length <= 2) return path;

        const smoothed: Point[] = [path[0]];
        let current = 0;

        while (current < path.length - 1) {
            // Try to skip ahead as far as possible
            let farthest = current + 1;

            for (let i = path.length - 1; i > current + 1; i--) {
                if (this.hasLineOfSight(path[current], path[i], obstacles)) {
                    farthest = i;
                    break;
                }
            }

            smoothed.push(path[farthest]);
            current = farthest;
        }

        return smoothed;
    }

    /**
     * Computes field of view (all visible tiles) from an origin using shadowcasting.
     * This is much more efficient than calling hasLineOfSight multiple times.
     * 
     * @param origin Viewer position
     * @param range Maximum vision range
     * @param obstacles Set of opaque tiles
     * @returns Set of visible tile keys in "x,y" format
     * 
     * @example
     * ```typescript
     * const obstacles = new Set(['5,5', '6,5']);
     * const fov = engine.getFieldOfView({x: 0, y: 0}, 10, obstacles);
     * console.log(fov.has('3,3')); // true - visible
     * console.log(fov.has('7,5')); // false - blocked by wall
     * ```
     */
    getFieldOfView(origin: Point, range: number, obstacles: Set<string>): Set<string> {
        const visible = new Set<string>();
        visible.add(this.pointToKey(origin));

        // Process all 8 octants
        for (let octant = 0; octant < 8; octant++) {
            this.castLight(origin, range, 1, 1.0, 0.0, octant, obstacles, visible);
        }

        return visible;
    }

    /**
     * Recursive shadowcasting for one octant.
     * Based on the algorithm by Björn Bergström.
     * @private
     */
    private castLight(
        origin: Point,
        range: number,
        row: number,
        startSlope: number,
        endSlope: number,
        octant: number,
        obstacles: Set<string>,
        visible: Set<string>
    ): void {
        if (startSlope < endSlope) return;

        let nextStartSlope = startSlope;

        for (let i = row; i <= range; i++) {
            let blocked = false;

            for (let dy = -i; dy <= 0; dy++) {
                const dx = -i - dy;

                // Transform based on octant
                const tile = this.transformOctant(origin, dx, dy, octant);
                const dist = this.getDistance(origin, tile);

                if (dist > range) continue;

                const lSlope = (dy - 0.5) / (dx + 0.5);
                const rSlope = (dy + 0.5) / (dx - 0.5);

                if (startSlope < rSlope) {
                    continue;
                } else if (endSlope > lSlope) {
                    break;
                }

                const tileKey = this.pointToKey(tile);
                visible.add(tileKey);

                if (blocked) {
                    if (obstacles.has(tileKey)) {
                        nextStartSlope = rSlope;
                        continue;
                    } else {
                        blocked = false;
                        startSlope = nextStartSlope;
                    }
                } else if (obstacles.has(tileKey) && i < range) {
                    blocked = true;
                    this.castLight(origin, range, i + 1, startSlope, lSlope, octant, obstacles, visible);
                    nextStartSlope = rSlope;
                }
            }

            if (blocked) break;
        }
    }

    /**
     * Transforms coordinates based on octant for shadowcasting.
     * @private
     */
    private transformOctant(origin: Point, dx: number, dy: number, octant: number): Point {
        // Octant transformations for 8-way symmetry
        switch (octant) {
            case 0: return { x: origin.x + dx, y: origin.y + dy };
            case 1: return { x: origin.x + dy, y: origin.y + dx };
            case 2: return { x: origin.x - dy, y: origin.y + dx };
            case 3: return { x: origin.x - dx, y: origin.y + dy };
            case 4: return { x: origin.x - dx, y: origin.y - dy };
            case 5: return { x: origin.x - dy, y: origin.y - dx };
            case 6: return { x: origin.x + dy, y: origin.y - dx };
            case 7: return { x: origin.x + dx, y: origin.y - dy };
            default: return origin;
        }
    }

    /**
     * Checks if there is a clear line of sight between start and end points.
     * Uses Bresenham's line algorithm to check for obstacles on the path.
     * The start and end points themselves are not checked (you can see *to* an obstacle).
     * 
     * @param start The starting point (viewer position)
     * @param end The ending point (target position)
     * @param obstacles Set of blocked tiles in "x,y" format
     * @returns true if the path is clear, false if blocked
     */
    hasLineOfSight(start: Point, end: Point, obstacles: Set<string>): boolean {
        this.validatePoint(start, 'start');
        this.validatePoint(end, 'end');

        const line = this.bresenhamLine(start, end);

        // Check all points except start and end
        for (let i = 1; i < line.length - 1; i++) {
            const p = line[i];
            if (obstacles.has(this.pointToKey(p))) {
                return false;
            }
        }

        return true;
    }

    /**
     * Bresenham's line algorithm implementation.
     * Returns all points on the line from start to end (inclusive).
     * 
     * @private
     * @param start Start point
     * @param end End point
     * @returns Array of points on the line
     */
    private bresenhamLine(start: Point, end: Point): Point[] {
        const points: Point[] = [];
        let x0 = start.x;
        let y0 = start.y;
        const x1 = end.x;
        const y1 = end.y;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push({ x: x0, y: y0 });

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }

        return points;
    }

    /**
     * Reconstructs the path from A* cameFrom map.
     * 
     * @private
     * @param cameFrom Map of point keys to their predecessors
     * @param current The goal point
     * @returns Array of points from start to goal
     */
    private reconstructPath(cameFrom: Map<string, Point>, current: Point): Point[] {
        const totalPath = [current];
        let curr = current;

        while (true) {
            const currKey = this.pointToKey(curr);
            if (!cameFrom.has(currKey)) break;

            curr = cameFrom.get(currKey)!;
            totalPath.unshift(curr);
        }

        return totalPath;
    }

    /**
     * Converts a point to a string key.
     * @private
     */
    private pointToKey(p: Point): string {
        return p.z !== undefined ? `${p.x},${p.y},${p.z}` : `${p.x},${p.y}`;
    }

    /**
     * Checks if two points are equal.
     * @private
     */
    private pointsEqual(p1: Point, p2: Point): boolean {
        return p1.x === p2.x && p1.y === p2.y && (p1.z ?? 0) === (p2.z ?? 0);
    }
}
