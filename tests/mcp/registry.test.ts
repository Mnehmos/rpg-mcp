import { z } from 'zod';
import { ToolRegistry } from '../../src/api/registry';

describe('ToolRegistry', () => {
    it('should register a tool and retrieve its metadata', () => {
        const registry = new ToolRegistry();
        const schema = z.object({
            name: z.string(),
            age: z.number().int().positive()
        });

        registry.registerTool(
            'test_tool',
            'A test tool description',
            schema,
            async (args) => {
                return `Hello ${args.name}, you are ${args.age}`;
            }
        );

        const tools = registry.getTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('test_tool');
        expect(tools[0].description).toBe('A test tool description');
        expect(tools[0].inputSchema).toBeDefined();
    });

    it('should execute a registered tool', async () => {
        const registry = new ToolRegistry();
        const schema = z.object({
            x: z.number(),
            y: z.number()
        });

        registry.registerTool(
            'add',
            'Adds two numbers',
            schema,
            async ({ x, y }) => x + y
        );

        const result = await registry.executeTool('add', { x: 5, y: 3 });
        expect(result).toBe(8);
    });

    it('should throw error for unknown tool', async () => {
        const registry = new ToolRegistry();
        await expect(registry.executeTool('unknown', {})).rejects.toThrow('Tool not found: unknown');
    });

    it('should validate tool arguments against schema', async () => {
        const registry = new ToolRegistry();
        const schema = z.object({
            required_field: z.string()
        });

        registry.registerTool(
            'validate_me',
            'Validation test',
            schema,
            async (args) => args
        );

        // Missing required field
        await expect(registry.executeTool('validate_me', {})).rejects.toThrow();

        // Invalid type
        await expect(registry.executeTool('validate_me', { required_field: 123 })).rejects.toThrow();
    });
});
