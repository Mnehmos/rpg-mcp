import { z } from 'zod';

export interface ToolMetadata {
    name: string;
    description: string;
    inputSchema: any; // JSON Schema
}

type ToolHandler<T = any> = (args: T) => Promise<any>;

export interface RegisteredTool {
    name: string;
    description: string;
    schema: z.ZodType<any>;
    handler: ToolHandler;
}

export class ToolRegistry {
    private tools: Map<string, RegisteredTool> = new Map();

    /**
     * Registers a new tool with the registry.
     * 
     * @param name Unique name of the tool
     * @param description Human-readable description
     * @param schema Zod schema for input validation
     * @param handler Function to execute when tool is called
     */
    registerTool<T>(
        name: string,
        description: string,
        schema: z.ZodType<T>,
        handler: (args: T) => Promise<any>
    ): void {
        if (this.tools.has(name)) {
            throw new Error(`Tool already registered: ${name}`);
        }

        this.tools.set(name, {
            name,
            description,
            schema,
            handler
        });
    }

    /**
     * Returns all registered tools with their handlers and schemas.
     * Used by the MCP server to register tools with the SDK.
     */
    getRegisteredTools(): RegisteredTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Retrieves metadata for all registered tools.
     * Used to populate the MCP `list_tools` capability.
     */
    getTools(): ToolMetadata[] {
        return Array.from(this.tools.values()).map(tool => {
            // Convert Zod schema to JSON Schema (simplified for now)
            // In a real implementation, we'd use zod-to-json-schema
            // For now, we'll just return a placeholder or basic structure
            // The official SDK might handle this conversion, but we need to provide it

            // NOTE: The official SDK handles Zod conversion internally if we use its helpers.
            // But since we are building a registry to wrap it, we might need to expose it.
            // For this implementation, let's assume we pass the Zod schema to the SDK later.
            // But for getTools() return type, we need something serializable.

            return {
                name: tool.name,
                description: tool.description,
                inputSchema: {} // Placeholder, actual schema conversion happens in SDK integration
            };
        });
    }

    /**
     * Executes a registered tool by name.
     * Validates arguments against the tool's schema before execution.
     * 
     * @param name Name of the tool to execute
     * @param args Arguments to pass to the tool
     * @returns The result of the tool execution
     */
    async executeTool(name: string, args: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        // Validate arguments
        const validatedArgs = tool.schema.parse(args);

        // Execute handler
        return tool.handler(validatedArgs);
    }
}
