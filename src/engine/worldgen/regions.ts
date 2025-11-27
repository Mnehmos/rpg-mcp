import seedrandom from 'seedrandom';
import { BiomeType } from '../../schema/biome';

export interface Region {
    id: number;
    name: string; // Placeholder for now
    capital: { x: number; y: number };
    area: number;
    biome: BiomeType; // Dominant biome
}

export interface RegionMap {
    regions: Region[];
    regionMap: Int32Array; // Maps index to region ID
}

export interface RegionGenerationOptions {
    seed: string;
    width: number;
    height: number;
    elevation: Uint8Array;
    biomes: BiomeType[][];
    numRegions?: number;
    seaLevel?: number;
}

// Helper to convert 2D coords to 1D index
const toIndex = (x: number, y: number, width: number) => y * width + x;
const fromIndex = (index: number, width: number) => ({ x: index % width, y: Math.floor(index / width) });

export function generateRegions(options: RegionGenerationOptions): RegionMap {
    const {
        seed,
        width,
        height,
        elevation,
        biomes,
        numRegions = 10,
        seaLevel = 20
    } = options;

    const size = width * height;
    const rng = seedrandom(seed);
    const regionMap = new Int32Array(size).fill(-1);
    const regions: Region[] = [];

    // 1. Pick Seeds (Capitals)
    // Only pick land tiles
    const landIndices: number[] = [];
    for (let i = 0; i < size; i++) {
        if (elevation[i] >= seaLevel) {
            landIndices.push(i);
        }
    }

    // Shuffle land indices to pick random seeds
    // Fisher-Yates shuffle (partial)
    for (let i = landIndices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [landIndices[i], landIndices[j]] = [landIndices[j], landIndices[i]];
    }

    // Select top N as seeds
    // Ensure seeds are somewhat spaced out? For now, just random is fine for MVP.
    // A better approach is Poisson Disk, but let's stick to simple random for now.
    // To avoid clumping, we can check distance to existing seeds.

    const seeds: number[] = [];
    const minDistance = Math.sqrt(size) / numRegions; // Heuristic

    for (const idx of landIndices) {
        if (seeds.length >= numRegions) break;

        const { x, y } = fromIndex(idx, width);
        let tooClose = false;
        for (const seedIdx of seeds) {
            const s = fromIndex(seedIdx, width);
            const dist = Math.sqrt((x - s.x) ** 2 + (y - s.y) ** 2);
            if (dist < minDistance) {
                tooClose = true;
                break;
            }
        }

        if (!tooClose) {
            seeds.push(idx);
        }
    }

    // If we couldn't find enough spaced seeds, just fill with random ones
    if (seeds.length < numRegions) {
        for (const idx of landIndices) {
            if (seeds.length >= numRegions) break;
            if (!seeds.includes(idx)) {
                seeds.push(idx);
            }
        }
    }

    // Initialize regions
    const queues: number[][] = []; // One queue per region

    seeds.forEach((seedIdx, id) => {
        const { x, y } = fromIndex(seedIdx, width);
        regions.push({
            id,
            name: `Region ${id + 1}`,
            capital: { x, y },
            area: 0,
            biome: biomes[y][x]
        });
        regionMap[seedIdx] = id;
        queues.push([seedIdx]);
    });

    // 2. Multi-Source BFS (Flood Fill)
    // We process one step for each region in round-robin to ensure even growth
    let active = true;
    while (active) {
        active = false;
        for (let id = 0; id < regions.length; id++) {
            const queue = queues[id];
            if (queue.length === 0) continue;

            // Process a batch of pixels (e.g., the current "frontier")
            // For true round-robin, we should process only the current depth, but popping one is simpler
            // and creates roughly circular regions if we randomize order or do it layer by layer.
            // Let's do a "layer" approach: process all currently in queue, add neighbors to next_queue

            const nextQueue: number[] = [];

            // Process entire current frontier to grow uniformly
            while (queue.length > 0) {
                const currIdx = queue.shift()!;
                const { x, y } = fromIndex(currIdx, width);

                const neighbors = [
                    { nx: x, ny: y - 1 },
                    { nx: x + 1, ny: y },
                    { nx: x, ny: y + 1 },
                    { nx: x - 1, ny: y }
                ];

                for (const { nx, ny } of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = toIndex(nx, ny, width);

                        // If unassigned and land
                        if (regionMap[nIdx] === -1 && elevation[nIdx] >= seaLevel) {
                            regionMap[nIdx] = id;
                            nextQueue.push(nIdx);
                            regions[id].area++;
                            active = true;
                        }
                    }
                }
            }
            queues[id] = nextQueue;
        }
    }

    // 3. Post-processing: Fill gaps?
    // The BFS should fill all reachable land. Unreachable islands might be left -1.
    // We can optionally assign them to the nearest region or leave them wild.
    // For now, let's leave them as -1 (Wildlands).

    return { regions, regionMap };
}
