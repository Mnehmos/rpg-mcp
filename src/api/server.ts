import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ToolRegistry } from "./registry.js";

export class RpgMcpServer {
    private server: McpServer;
    private registry: ToolRegistry;

    constructor(registry: ToolRegistry) {
        this.registry = registry;
        this.server = new McpServer({
            name: "rpg-mcp",
            version: "1.0.0"
        });

        this.registerTools();
    }

    private registerTools(): void {
        const tools = this.registry.getRegisteredTools();

        for (const tool of tools) {
            this.server.tool(
                tool.name,
                tool.description,
                // The SDK expects a Zod schema shape or a Zod schema. 
                // Based on docs, it takes (name, description, schema, handler).
                // We need to ensure the schema is passed correctly.
                // The SDK's type definition for tool() is generic.
                // It seems to accept the Zod schema object directly.
                tool.schema as any,
                async (args: any) => {
                    try {
                        const result = await tool.handler(args);
                        // MCP expects a specific response format
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                                }
                            ]
                        };
                    } catch (error: any) {
                        // Log to stderr to avoid corrupting stdio transport
                        console.error(`Error executing tool ${tool.name}:`, error);
                        throw error; // SDK handles error responses
                    }
                }
            );
        }
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("RPG MCP Server started on stdio");
    }
}
