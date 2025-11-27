import seedrandom from 'seedrandom';
import { BiomeType } from '../../schema/biome';
import { StructureType } from '../../schema/structure';

export interface StructureLocation {
    type: StructureType;
    location: { x: number; y: number };
    name: string;
    score: number;
}

export interface StructureGenerationOptions {
    seed: string;
    width: number;
    height: number;
    elevation: Uint8Array;
    biomes: BiomeType[][];
    riverMap: Uint8Array; // 1 if river, 0 if not
    numCities?: number;
    numTowns?: number;
    numDungeons?: number;
}

// Helper to convert 2D coords to 1D index
const toIndex = (x: number, y: number, width: number) => y * width + x;
const fromIndex = (index: number, width: number) => ({ x: index % width, y: Math.floor(index / width) });

export function placeStructures(options: StructureGenerationOptions): StructureLocation[] {
    const {
        seed,
        width,
        height,
        elevation,
        biomes,
        riverMap,
        numCities = 5,
        numTowns = 10,
        numDungeons = 5
    } = options;

    const size = width * height;
    const rng = seedrandom(seed);
    const structures: StructureLocation[] = [];
    const occupied = new Uint8Array(size).fill(0); // 1 if occupied

    // 1. Calculate Habitability Score
    const habitability = new Float32Array(size);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = toIndex(x, y, width);

            // Ocean is uninhabitable for cities/towns
            if (elevation[idx] < 20) { // Assuming 20 is sea level, passed implicitly or standard
                habitability[idx] = -1;
                continue;
            }

            let score = 0;

            // River bonus
            if (riverMap[idx] > 0) score += 20;

            // Biome suitability
            const biome = biomes[y][x];
            switch (biome) {
                case BiomeType.GRASSLAND:
                case BiomeType.FOREST:
                    score += 10;
                    break;
                case BiomeType.SAVANNA:
                case BiomeType.TAIGA:
                    score += 5;
                    break;
                case BiomeType.DESERT:
                case BiomeType.SWAMP:
                case BiomeType.TUNDRA:
                case BiomeType.GLACIER:
                    score -= 10;
                    break;
            }

            // Flatness bonus (check neighbors)
            let maxSlope = 0;
            const neighbors = [
                { nx: x, ny: y - 1 },
                { nx: x + 1, ny: y },
                { nx: x, ny: y + 1 },
                { nx: x - 1, ny: y }
            ];

            for (const { nx, ny } of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = toIndex(nx, ny, width);
                    const slope = Math.abs(elevation[idx] - elevation[nIdx]);
                    if (slope > maxSlope) maxSlope = slope;
                }
            }

            if (maxSlope < 5) score += 10;
            else if (maxSlope > 20) score -= 20;

            habitability[idx] = Math.max(0, score);
        }
    }

    // 2. Place Cities (Highest Habitability)
    // Find candidates
    const candidates: { idx: number; score: number }[] = [];
    for (let i = 0; i < size; i++) {
        if (habitability[i] > 0) {
            candidates.push({ idx: i, score: habitability[i] });
        }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    let citiesPlaced = 0;
    for (const candidate of candidates) {
        if (citiesPlaced >= numCities) break;

        // Check minimum distance to other structures
        if (isTooClose(candidate.idx, structures, width, 10)) continue;

        const { x, y } = fromIndex(candidate.idx, width);
        structures.push({
            type: StructureType.CITY,
            location: { x, y },
            name: `City ${citiesPlaced + 1}`,
            score: candidate.score
        });
        occupied[candidate.idx] = 1;
        citiesPlaced++;
    }

    // 3. Place Towns (Random Weighted by Habitability)
    // We can just pick random spots and check score threshold, or reservoir sampling
    let townsPlaced = 0;
    let attempts = 0;
    while (townsPlaced < numTowns && attempts < numTowns * 20) {
        attempts++;
        const idx = Math.floor(rng() * size);

        if (habitability[idx] > 10 && occupied[idx] === 0) {
            if (isTooClose(idx, structures, width, 5)) continue;

            const { x, y } = fromIndex(idx, width);
            structures.push({
                type: StructureType.TOWN,
                location: { x, y },
                name: `Town ${townsPlaced + 1}`,
                score: habitability[idx]
            });
            occupied[idx] = 1;
            townsPlaced++;
        }
    }

    // 4. Place Dungeons (Low Habitability or Random Remote)
    let dungeonsPlaced = 0;
    attempts = 0;
    while (dungeonsPlaced < numDungeons && attempts < numDungeons * 20) {
        attempts++;
        const idx = Math.floor(rng() * size);

        // Dungeons can be on land, maybe even in difficult terrain
        if (elevation[idx] >= 20 && occupied[idx] === 0) {
            // Prefer lower habitability or just remote
            // Relaxed condition: < 40
            if (habitability[idx] < 40) {
                if (isTooClose(idx, structures, width, 5)) continue;

                const { x, y } = fromIndex(idx, width);
                structures.push({
                    type: StructureType.DUNGEON,
                    location: { x, y },
                    name: `Dungeon ${dungeonsPlaced + 1}`,
                    score: habitability[idx]
                });
                occupied[idx] = 1;
                dungeonsPlaced++;
            }
        }
    }

    return structures;
}

function isTooClose(
    idx: number,
    structures: StructureLocation[],
    width: number,
    minDistance: number
): boolean {
    const { x, y } = fromIndex(idx, width);

    for (const structure of structures) {
        const dx = x - structure.location.x;
        const dy = y - structure.location.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) return true;
    }

    return false;
}
