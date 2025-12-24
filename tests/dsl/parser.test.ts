import { parseDSL } from '../../src/engine/dsl/parser';
import { CommandType } from '../../src/engine/dsl/schema';
import { StructureType } from '../../src/schema/structure';
import { BiomeType } from '../../src/schema/biome';

describe('DSL Parser', () => {
    it('should parse valid ADD_STRUCTURE command', () => {
        const script = `ADD_STRUCTURE type="city" x=10 y=20 name="New City"`;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(1);
        expect(commands[0]).toEqual({
            command: CommandType.ADD_STRUCTURE,
            args: {
                type: StructureType.CITY,
                x: 10,
                y: 20,
                name: 'New City'
            }
        });
    });

    it('should parse valid SET_BIOME command', () => {
        const script = `SET_BIOME x=5 y=5 type="temperate_deciduous_forest"`;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(1);
        expect(commands[0]).toEqual({
            command: CommandType.SET_BIOME,
            args: {
                x: 5,
                y: 5,
                type: BiomeType.FOREST
            }
        });
    });

    it('should parse valid EDIT_TILE command with optional args', () => {
        const script = `EDIT_TILE x=1 y=1 elevation=100`;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(1);
        expect(commands[0]).toEqual({
            command: CommandType.EDIT_TILE,
            args: {
                x: 1,
                y: 1,
                elevation: 100
            }
        });
    });

    it('should parse valid ADD_ROAD command', () => {
        const script = `ADD_ROAD from_x=10 from_y=10 to_x=20 to_y=20`;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(1);
        expect(commands[0]).toEqual({
            command: CommandType.ADD_ROAD,
            args: {
                from_x: 10,
                from_y: 10,
                to_x: 20,
                to_y: 20
            }
        });
    });

    it('should parse valid MOVE_STRUCTURE command', () => {
        const script = `MOVE_STRUCTURE id="city-1" x=30 y=30`;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(1);
        expect(commands[0]).toEqual({
            command: CommandType.MOVE_STRUCTURE,
            args: {
                id: 'city-1',
                x: 30,
                y: 30
            }
        });
    });

    it('should parse valid ADD_ANNOTATION command', () => {
        const script = `ADD_ANNOTATION x=50 y=50 text="Here be dragons"`;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(1);
        expect(commands[0]).toEqual({
            command: CommandType.ADD_ANNOTATION,
            args: {
                x: 50,
                y: 50,
                text: 'Here be dragons'
            }
        });
    });

    it('should handle multiple commands and comments', () => {
        const script = `
      # This is a comment
      ADD_STRUCTURE type="town" x=10 y=10 name="Town A"
      
      # Another comment
      SET_BIOME x=10 y=10 type="hot_desert"
    `;
        const commands = parseDSL(script);

        expect(commands).toHaveLength(2);
        expect(commands[0].command).toBe(CommandType.ADD_STRUCTURE);
        expect(commands[1].command).toBe(CommandType.SET_BIOME);
    });

    it('should throw error for invalid syntax (missing equals)', () => {
        const script = `ADD_STRUCTURE type "city"`;
        expect(() => parseDSL(script)).toThrow('Invalid argument format');
    });

    it('should throw error for invalid schema (missing required arg)', () => {
        const script = `ADD_STRUCTURE x=10 y=20`; // Missing type and name
        expect(() => parseDSL(script)).toThrow('Invalid command arguments');
    });

    it('should throw error for invalid enum value', () => {
        const script = `ADD_STRUCTURE type="invalid_type" x=10 y=20 name="Test"`;
        expect(() => parseDSL(script)).toThrow('Invalid command arguments');
    });

    it('should throw error for negative coordinates', () => {
        const script = `ADD_STRUCTURE type="city" x=-5 y=10 name="Test"`;
        expect(() => parseDSL(script)).toThrow('Coordinates must be non-negative');
    });

    it('should throw error for empty name', () => {
        const script = `ADD_STRUCTURE type="city" x=10 y=10 name=""`;
        expect(() => parseDSL(script)).toThrow('Name cannot be empty');
    });

    it('should throw error for empty structure ID', () => {
        const script = `MOVE_STRUCTURE id="" x=10 y=10`;
        expect(() => parseDSL(script)).toThrow('Structure ID cannot be empty');
    });

    it('should throw error for empty annotation text', () => {
        const script = `ADD_ANNOTATION x=10 y=10 text=""`;
        expect(() => parseDSL(script)).toThrow('Annotation text cannot be empty');
    });

    it('should handle quoted strings with spaces', () => {
        const script = `ADD_STRUCTURE type="city" x=0 y=0 name="City With Spaces"`;
        const commands = parseDSL(script);
        if (commands[0].command === CommandType.ADD_STRUCTURE) {
            expect(commands[0].args.name).toBe('City With Spaces');
        } else {
            throw new Error('Expected ADD_STRUCTURE command');
        }
    });

    describe('Positional Arguments', () => {
        it('should parse ADD_STRUCTURE with positional args', () => {
            const script = `ADD_STRUCTURE city 10 20 "My City"`;
            const commands = parseDSL(script);
            expect(commands).toHaveLength(1);
            expect(commands[0]).toEqual({
                command: CommandType.ADD_STRUCTURE,
                args: {
                    type: StructureType.CITY,
                    x: 10,
                    y: 20,
                    name: 'My City'
                }
            });
        });

        it('should parse ADD_STRUCTURE with positional args and default name', () => {
            const script = `ADD_STRUCTURE village 5 5`;
            const commands = parseDSL(script);
            expect(commands).toHaveLength(1);
            expect(commands[0]).toEqual({
                command: CommandType.ADD_STRUCTURE,
                args: {
                    type: StructureType.VILLAGE,
                    x: 5,
                    y: 5,
                    name: 'village' // Defaulted to type
                }
            });
        });

        it('should parse SET_BIOME with positional args', () => {
            const script = `SET_BIOME grassland 15 15`;
            const commands = parseDSL(script);
            expect(commands).toHaveLength(1);
            expect(commands[0]).toEqual({
                command: CommandType.SET_BIOME,
                args: {
                    type: BiomeType.GRASSLAND,
                    x: 15,
                    y: 15
                }
            });
        });

        it('should parse EDIT_TILE with positional args', () => {
            const script = `EDIT_TILE 2 2 50`;
            const commands = parseDSL(script);
            expect(commands).toHaveLength(1);
            expect(commands[0]).toEqual({
                command: CommandType.EDIT_TILE,
                args: {
                    x: 2,
                    y: 2,
                    elevation: 50
                }
            });
        });
    });
});
