import { PatchCommand, PatchCommandSchema } from './schema';

/**
 * Parse a DSL script into a list of commands.
 * 
 * Syntax:
 * COMMAND key=value key2="string value"
 * 
 * - Lines starting with # are comments
 * - Empty lines are ignored
 * - Keys and values are separated by =
 * - String values with spaces must be quoted
 */
export function parseDSL(script: string): PatchCommand[] {
    const lines = script.split('\n');
    const commands: PatchCommand[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
            continue;
        }

        try {
            const command = parseLine(line);
            commands.push(command);
        } catch (error: any) {
            throw new Error(`Error on line ${i + 1}: ${error.message}`);
        }
    }

    return commands;
}

function parseLine(line: string): PatchCommand {
    // Split by spaces, but respect quotes
    // Regex: Match key="value" (quoted) OR key=value (unquoted) OR simple tokens
    const tokens = line.match(/[a-zA-Z0-9_]+=(?:"[^"]*"|\S+)|\S+/g) || [];

    if (tokens.length === 0) {
        throw new Error('Empty command');
    }

    const commandName = tokens[0];
    const args: Record<string, string> = {};

    for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const eqIndex = token.indexOf('=');

        if (eqIndex === -1) {
            throw new Error(`Invalid argument format: ${token}. Expected key=value`);
        }

        const key = token.substring(0, eqIndex);
        let value = token.substring(eqIndex + 1);

        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }

        args[key] = value;
    }

    // Validate against schema
    // We construct a raw object first, then let Zod handle coercion and validation
    const rawCommand = {
        command: commandName,
        args: args
    };

    const result = PatchCommandSchema.safeParse(rawCommand);

    if (!result.success) {
        const errorMessages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid command arguments: ${errorMessages}`);
    }

    return result.data;
}
