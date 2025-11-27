import { GeneratedWorld } from '../worldgen/index';
import { PatchCommand, CommandType } from './schema';

/**
 * Applies a list of patch commands to a generated world.
 * Mutates the world object in place for performance.
 */
export function applyPatch(world: GeneratedWorld, commands: PatchCommand[]): GeneratedWorld {
    for (const command of commands) {
        applyCommand(world, command);
    }
    return world;
}

function applyCommand(world: GeneratedWorld, command: PatchCommand) {
    switch (command.command) {
        case CommandType.ADD_STRUCTURE: {
            const { type, x, y, name } = command.args;
            world.structures.push({
                type,
                location: { x, y },
                name,
                score: 100 // Manual placement gets max score
            });
            break;
        }

        case CommandType.SET_BIOME: {
            const { x, y, type } = command.args;
            if (isValidCoordinate(world, x, y)) {
                world.biomes[y][x] = type;
            }
            break;
        }

        case CommandType.EDIT_TILE: {
            const { x, y, elevation, moisture, temperature } = command.args;
            if (isValidCoordinate(world, x, y)) {
                const idx = y * world.width + x;
                if (elevation !== undefined) world.elevation[idx] = elevation;
                if (moisture !== undefined) world.moisture[idx] = moisture;
                if (temperature !== undefined) world.temperature[idx] = temperature;
            }
            break;
        }

        case CommandType.MOVE_STRUCTURE: {
            const { id, x, y } = command.args;
            // Assuming 'id' matches 'name' for now as we don't have explicit IDs yet
            // In a real system, structures would have unique UUIDs
            const structure = world.structures.find(s => s.name === id);
            if (structure) {
                structure.location = { x, y };
            } else {
                throw new Error(`Structure not found: ${id}`);
            }
            break;
        }

        case CommandType.ADD_ROAD:
        case CommandType.ADD_ANNOTATION:
            // Not implemented yet
            break;
    }
}

function isValidCoordinate(world: GeneratedWorld, x: number, y: number): boolean {
    return x >= 0 && x < world.width && y >= 0 && y < world.height;
}
