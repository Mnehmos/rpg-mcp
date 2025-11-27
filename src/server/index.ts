import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Tools, handleGenerateWorld, handleGetWorldState, handleApplyMapPatch, handleGetWorldMapOverview, handleGetRegionMap, handlePreviewMapPatch, setWorldPubSub } from './tools';
import { CombatTools, handleCreateEncounter, handleGetEncounterState, handleExecuteCombatAction, handleAdvanceTurn, handleEndEncounter, setCombatPubSub } from './combat-tools';
import { CRUDTools, handleCreateWorld, handleGetWorld, handleListWorlds, handleDeleteWorld, handleCreateCharacter, handleGetCharacter, handleUpdateCharacter, handleListCharacters, handleDeleteCharacter } from './crud-tools';
import { PubSub } from '../engine/pubsub';
import { registerEventTools } from './events';
import { AuditLogger } from './audit';

async function main() {
    // Create server instance
    const server = new McpServer({
        name: 'rpg-mcp',
        version: '1.0.0'
    });

    // Initialize PubSub
    const pubsub = new PubSub();
    setCombatPubSub(pubsub);
    setWorldPubSub(pubsub);

    // Register Event Tools
    registerEventTools(server, pubsub);

    // Initialize AuditLogger
    const auditLogger = new AuditLogger();

    // Register Core Tools
    server.tool(
        Tools.GENERATE_WORLD.name,
        Tools.GENERATE_WORLD.description,
        Tools.GENERATE_WORLD.inputSchema.shape,
        auditLogger.wrapHandler(Tools.GENERATE_WORLD.name, handleGenerateWorld)
    );

    server.tool(
        Tools.GET_WORLD_STATE.name,
        Tools.GET_WORLD_STATE.description,
        Tools.GET_WORLD_STATE.inputSchema.shape,
        auditLogger.wrapHandler(Tools.GET_WORLD_STATE.name, handleGetWorldState)
    );

    server.tool(
        Tools.APPLY_MAP_PATCH.name,
        Tools.APPLY_MAP_PATCH.description,
        Tools.APPLY_MAP_PATCH.inputSchema.shape,
        auditLogger.wrapHandler(Tools.APPLY_MAP_PATCH.name, handleApplyMapPatch)
    );

    server.tool(
        Tools.GET_WORLD_MAP_OVERVIEW.name,
        Tools.GET_WORLD_MAP_OVERVIEW.description,
        Tools.GET_WORLD_MAP_OVERVIEW.inputSchema.shape,
        auditLogger.wrapHandler(Tools.GET_WORLD_MAP_OVERVIEW.name, handleGetWorldMapOverview)
    );

    server.tool(
        Tools.GET_REGION_MAP.name,
        Tools.GET_REGION_MAP.description,
        Tools.GET_REGION_MAP.inputSchema.shape,
        auditLogger.wrapHandler(Tools.GET_REGION_MAP.name, handleGetRegionMap)
    );

    server.tool(
        Tools.PREVIEW_MAP_PATCH.name,
        Tools.PREVIEW_MAP_PATCH.description,
        Tools.PREVIEW_MAP_PATCH.inputSchema.shape,
        auditLogger.wrapHandler(Tools.PREVIEW_MAP_PATCH.name, handlePreviewMapPatch)
    );

    // Register Combat Tools
    server.tool(
        CombatTools.CREATE_ENCOUNTER.name,
        CombatTools.CREATE_ENCOUNTER.description,
        CombatTools.CREATE_ENCOUNTER.inputSchema.shape,
        auditLogger.wrapHandler(CombatTools.CREATE_ENCOUNTER.name, handleCreateEncounter)
    );

    server.tool(
        CombatTools.GET_ENCOUNTER_STATE.name,
        CombatTools.GET_ENCOUNTER_STATE.description,
        CombatTools.GET_ENCOUNTER_STATE.inputSchema.shape,
        auditLogger.wrapHandler(CombatTools.GET_ENCOUNTER_STATE.name, handleGetEncounterState)
    );

    server.tool(
        CombatTools.EXECUTE_COMBAT_ACTION.name,
        CombatTools.EXECUTE_COMBAT_ACTION.description,
        CombatTools.EXECUTE_COMBAT_ACTION.inputSchema.shape,
        auditLogger.wrapHandler(CombatTools.EXECUTE_COMBAT_ACTION.name, handleExecuteCombatAction)
    );

    server.tool(
        CombatTools.ADVANCE_TURN.name,
        CombatTools.ADVANCE_TURN.description,
        CombatTools.ADVANCE_TURN.inputSchema.shape,
        auditLogger.wrapHandler(CombatTools.ADVANCE_TURN.name, handleAdvanceTurn)
    );

    server.tool(
        CombatTools.END_ENCOUNTER.name,
        CombatTools.END_ENCOUNTER.description,
        CombatTools.END_ENCOUNTER.inputSchema.shape,
        auditLogger.wrapHandler(CombatTools.END_ENCOUNTER.name, handleEndEncounter)
    );

    // Register CRUD Tools
    server.tool(
        CRUDTools.CREATE_WORLD.name,
        CRUDTools.CREATE_WORLD.description,
        CRUDTools.CREATE_WORLD.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.CREATE_WORLD.name, handleCreateWorld)
    );

    server.tool(
        CRUDTools.GET_WORLD.name,
        CRUDTools.GET_WORLD.description,
        CRUDTools.GET_WORLD.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.GET_WORLD.name, handleGetWorld)
    );

    server.tool(
        CRUDTools.LIST_WORLDS.name,
        CRUDTools.LIST_WORLDS.description,
        CRUDTools.LIST_WORLDS.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.LIST_WORLDS.name, handleListWorlds)
    );

    server.tool(
        CRUDTools.DELETE_WORLD.name,
        CRUDTools.DELETE_WORLD.description,
        CRUDTools.DELETE_WORLD.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.DELETE_WORLD.name, handleDeleteWorld)
    );

    server.tool(
        CRUDTools.CREATE_CHARACTER.name,
        CRUDTools.CREATE_CHARACTER.description,
        CRUDTools.CREATE_CHARACTER.inputSchema as any, // Cast to any for union schema compatibility
        auditLogger.wrapHandler(CRUDTools.CREATE_CHARACTER.name, handleCreateCharacter)
    );

    server.tool(
        CRUDTools.GET_CHARACTER.name,
        CRUDTools.GET_CHARACTER.description,
        CRUDTools.GET_CHARACTER.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.GET_CHARACTER.name, handleGetCharacter)
    );

    server.tool(
        CRUDTools.UPDATE_CHARACTER.name,
        CRUDTools.UPDATE_CHARACTER.description,
        CRUDTools.UPDATE_CHARACTER.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.UPDATE_CHARACTER.name, handleUpdateCharacter)
    );

    server.tool(
        CRUDTools.LIST_CHARACTERS.name,
        CRUDTools.LIST_CHARACTERS.description,
        CRUDTools.LIST_CHARACTERS.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.LIST_CHARACTERS.name, handleListCharacters)
    );

    server.tool(
        CRUDTools.DELETE_CHARACTER.name,
        CRUDTools.DELETE_CHARACTER.description,
        CRUDTools.DELETE_CHARACTER.inputSchema.shape,
        auditLogger.wrapHandler(CRUDTools.DELETE_CHARACTER.name, handleDeleteCharacter)
    );

    // Connect transport
    const args = process.argv.slice(2);
    const transportType = args.includes('--tcp') ? 'tcp' : (args.includes('--unix') || args.includes('--socket')) ? 'unix' : 'stdio';

    if (transportType === 'tcp') {
        const { TCPServerTransport } = await import('./transport/tcp.js');
        const portIndex = args.indexOf('--port');
        const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

        const transport = new TCPServerTransport(port);
        await server.connect(transport);
        console.error(`RPG MCP Server running on TCP port ${port}`);
    } else if (transportType === 'unix') {
        const { UnixServerTransport } = await import('./transport/unix.js');
        let socketPath = '';
        const unixIndex = args.indexOf('--unix');
        const socketIndex = args.indexOf('--socket');

        if (unixIndex !== -1 && args[unixIndex + 1]) {
            socketPath = args[unixIndex + 1];
        } else if (socketIndex !== -1 && args[socketIndex + 1]) {
            socketPath = args[socketIndex + 1];
        }

        if (!socketPath) {
            // Default path based on OS
            socketPath = process.platform === 'win32' ? '\\\\.\\pipe\\rpg-mcp' : '/tmp/rpg-mcp.sock';
        }

        const transport = new UnixServerTransport(socketPath);
        await server.connect(transport);
        console.error(`RPG MCP Server running on Unix socket ${socketPath}`);
    } else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('RPG MCP Server running on stdio');
    }
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
