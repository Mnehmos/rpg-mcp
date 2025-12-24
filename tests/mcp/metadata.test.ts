import { Tools } from '../../src/server/tools';
import { CombatTools } from '../../src/server/combat-tools';
import { CRUDTools } from '../../src/server/crud-tools';
import { z } from 'zod';

describe('Tool Metadata & Schema Validation', () => {
    const allTools = [
        ...Object.values(Tools),
        ...Object.values(CombatTools),
        ...Object.values(CRUDTools)
    ];

    it('should have name, description, and inputSchema for all tools', () => {
        for (const tool of allTools) {
            expect(tool.name).toBeDefined();
            expect(typeof tool.name).toBe('string');
            expect(tool.description).toBeDefined();
            expect(typeof tool.description).toBe('string');
            expect(tool.inputSchema).toBeDefined();
            expect(tool.inputSchema).toBeInstanceOf(z.ZodType);
        }
    });

    it('should have usage examples in descriptions (Advanced Tool Use)', () => {
        // We decided to put examples in descriptions.
        // Check a few key tools.
        const toolsWithExamples = [
            Tools.GENERATE_WORLD,
            Tools.APPLY_MAP_PATCH,
            CombatTools.CREATE_ENCOUNTER,
            CombatTools.EXECUTE_COMBAT_ACTION,
            CRUDTools.CREATE_WORLD,
            CRUDTools.CREATE_CHARACTER
        ];

        for (const tool of toolsWithExamples) {
            expect(tool.description).toContain('Example');
        }
    });

    it('should validate inputs correctly', () => {
        // Test generate_world schema
        const schema = Tools.GENERATE_WORLD.inputSchema;

        // Valid
        expect(() => schema.parse({ seed: 'test', width: 50, height: 50 })).not.toThrow();

        // Invalid (width too small)
        expect(() => schema.parse({ seed: 'test', width: 5, height: 50 })).toThrow();

        // Invalid (missing field)
        expect(() => schema.parse({ seed: 'test', width: 50 })).toThrow();
    });

    it('should validate combat tool inputs', () => {
        const schema = CombatTools.CREATE_ENCOUNTER.inputSchema;

        // Valid
        expect(() => schema.parse({
            seed: 'test',
            participants: [{ id: '1', name: 'p1', initiativeBonus: 0, hp: 10, maxHp: 10 }]
        })).not.toThrow();

        // Invalid (empty participants)
        expect(() => schema.parse({
            seed: 'test',
            participants: []
        })).toThrow();
    });
});
