/**
 * Trace Tools - Batch tracing and health checking for MCP tools
 * 
 * trace_tools - Run batch diagnostics on tool categories
 * trace_dependencies - Check repository/database dependencies
 */

import { z } from 'zod';
import { getDb } from '../storage/index.js';
import { buildToolRegistry } from './tool-registry.js';

// === TRACE TOOLS SCHEMA ===

export const TraceToolsSchema = z.object({
  categories: z.array(z.string()).optional().describe('Categories to trace (empty = all)'),
  includeDbCheck: z.boolean().default(true).describe('Check database table existence'),
  includeRepoCheck: z.boolean().default(true).describe('Check repository instantiation'),
  verbose: z.boolean().default(false).describe('Include detailed error messages'),
  maxToolsPerCategory: z.number().default(100).describe('Max tools to check per category')
});

export type TraceToolsArgs = z.infer<typeof TraceToolsSchema>;

interface TableCheckResult {
  name: string;
  exists: boolean;
  rowCount?: number;
  error?: string;
}

interface RepoCheckResult {
  name: string;
  canInstantiate: boolean;
  error?: string;
}

interface ToolCheckResult {
  name: string;
  category: string;
  hasSchema: boolean;
  hasHandler: boolean;
  schemaValid: boolean;
  error?: string;
}

interface TraceResult {
  timestamp: string;
  durationMs: number;
  summary: {
    totalTools: number;
    healthyTools: number;
    failedTools: number;
    tablesChecked: number;
    tablesExisting: number;
    tablesMissing: number;
    reposChecked: number;
    reposHealthy: number;
  };
  tables: TableCheckResult[];
  repos: RepoCheckResult[];
  tools: {
    healthy: string[];
    failed: ToolCheckResult[];
  };
  recommendations: string[];
}

// Known tables that should exist in a healthy rpg-mcp database
const EXPECTED_TABLES = [
  'worlds',
  'characters',
  'parties',
  'party_members',
  'items',
  'inventory',
  'quests',
  'quest_assignments',
  'encounters',
  'secrets',
  'auras',
  'narrative_notes',
  'npc_relationships',
  'conversation_memories',
  'pois',
  'room_nodes',
  'room_exits',
  'theft_records',
  'fence_registry',
  'corpses',
  'loot_tables',
  'event_inbox',
  'custom_effects',
  'synthesized_spells',
  'rest_log'
];

// Known repositories and their constructors
const REPO_CHECKS = [
  { name: 'CharacterRepository', path: '../storage/repos/character.repo.js' },
  { name: 'PartyRepository', path: '../storage/repos/party.repo.js' },
  { name: 'InventoryRepository', path: '../storage/repos/inventory.repo.js' },
  { name: 'ItemRepository', path: '../storage/repos/item.repo.js' },
  { name: 'QuestRepository', path: '../storage/repos/quest.repo.js' },
  { name: 'SecretRepository', path: '../storage/repos/secret.repo.js' },
  { name: 'AuraRepository', path: '../storage/repos/aura.repo.js' },
  { name: 'NpcMemoryRepository', path: '../storage/repos/npc-memory.repo.js' },
  { name: 'POIRepository', path: '../storage/repos/poi.repo.js' },
  { name: 'SpatialRepository', path: '../storage/repos/spatial.repo.js' },
  { name: 'TheftRepository', path: '../storage/repos/theft.repo.js' },
  { name: 'CorpseRepository', path: '../storage/repos/corpse.repo.js' },
  { name: 'EventInboxRepository', path: '../storage/repos/event-inbox.repo.js' },
];

async function checkTables(db: any, verbose: boolean): Promise<TableCheckResult[]> {
  const results: TableCheckResult[] = [];
  
  for (const tableName of EXPECTED_TABLES) {
    try {
      // Check if table exists
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(tableName);
      
      if (tableExists) {
        // Get row count
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
        results.push({
          name: tableName,
          exists: true,
          rowCount: countResult.count
        });
      } else {
        results.push({
          name: tableName,
          exists: false
        });
      }
    } catch (e: any) {
      results.push({
        name: tableName,
        exists: false,
        error: verbose ? e.message : 'Query failed'
      });
    }
  }
  
  return results;
}

async function checkRepos(db: any, verbose: boolean): Promise<RepoCheckResult[]> {
  const results: RepoCheckResult[] = [];
  
  for (const repo of REPO_CHECKS) {
    try {
      // Dynamic import to test instantiation
      const module = await import(repo.path);
      const RepoClass = module[repo.name];
      
      if (RepoClass) {
        // Try to instantiate
        new RepoClass(db);
        results.push({
          name: repo.name,
          canInstantiate: true
        });
      } else {
        results.push({
          name: repo.name,
          canInstantiate: false,
          error: 'Class not exported'
        });
      }
    } catch (e: any) {
      results.push({
        name: repo.name,
        canInstantiate: false,
        error: verbose ? e.message : 'Import/instantiation failed'
      });
    }
  }
  
  return results;
}

function checkTools(categories: string[] | undefined, maxPerCategory: number, verbose: boolean): { healthy: string[]; failed: ToolCheckResult[] } {
  const registry = buildToolRegistry();
  const healthy: string[] = [];
  const failed: ToolCheckResult[] = [];
  
  const categoryCounts: Record<string, number> = {};
  
  for (const [toolName, toolDef] of Object.entries(registry)) {
    const category = toolDef.metadata.category;
    
    // Category filter
    if (categories && categories.length > 0 && !categories.includes(category)) {
      continue;
    }
    
    // Max per category limit
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    if (categoryCounts[category] > maxPerCategory) {
      continue;
    }
    
    try {
      // Check schema exists
      const hasSchema = !!toolDef.schema;
      
      // Check handler exists
      const hasHandler = !!toolDef.handler;
      
      // Validate schema is a Zod schema
      let schemaValid = false;
      try {
        // Try to parse empty object to test schema validity
        if (hasSchema && typeof toolDef.schema.safeParse === 'function') {
          schemaValid = true;
        }
      } catch {
        schemaValid = false;
      }
      
      if (hasSchema && hasHandler && schemaValid) {
        healthy.push(toolName);
      } else {
        failed.push({
          name: toolName,
          category,
          hasSchema,
          hasHandler,
          schemaValid,
          error: !hasSchema ? 'Missing schema' : !hasHandler ? 'Missing handler' : 'Invalid schema'
        });
      }
    } catch (e: any) {
      failed.push({
        name: toolName,
        category,
        hasSchema: false,
        hasHandler: false,
        schemaValid: false,
        error: verbose ? e.message : 'Check failed'
      });
    }
  }
  
  return { healthy, failed };
}

export async function handleTraceTools(args: TraceToolsArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const startTime = Date.now();
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');
  
  // Run checks
  const tableResults = args.includeDbCheck ? await checkTables(db, args.verbose) : [];
  const repoResults = args.includeRepoCheck ? await checkRepos(db, args.verbose) : [];
  const toolResults = checkTools(args.categories, args.maxToolsPerCategory, args.verbose);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  const missingTables = tableResults.filter(t => !t.exists);
  if (missingTables.length > 0) {
    recommendations.push(`${missingTables.length} tables missing. Run tools that use these features to auto-create: ${missingTables.map(t => t.name).join(', ')}`);
  }
  
  const failedRepos = repoResults.filter(r => !r.canInstantiate);
  if (failedRepos.length > 0) {
    recommendations.push(`${failedRepos.length} repositories failed to instantiate: ${failedRepos.map(r => r.name).join(', ')}`);
  }
  
  if (toolResults.failed.length > 0) {
    recommendations.push(`${toolResults.failed.length} tools have issues: ${toolResults.failed.map(t => t.name).join(', ')}`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All checks passed! MCP server is healthy.');
  }
  
  const result: TraceResult = {
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    summary: {
      totalTools: toolResults.healthy.length + toolResults.failed.length,
      healthyTools: toolResults.healthy.length,
      failedTools: toolResults.failed.length,
      tablesChecked: tableResults.length,
      tablesExisting: tableResults.filter(t => t.exists).length,
      tablesMissing: missingTables.length,
      reposChecked: repoResults.length,
      reposHealthy: repoResults.filter(r => r.canInstantiate).length
    },
    tables: tableResults,
    repos: repoResults,
    tools: toolResults,
    recommendations
  };
  
  // Format output
  let output = `# MCP TRACE REPORT\n`;
  output += `Generated: ${result.timestamp}\n`;
  output += `Duration: ${result.durationMs}ms\n\n`;
  
  output += `## SUMMARY\n`;
  output += `| Metric | Value |\n`;
  output += `|--------|-------|\n`;
  output += `| Tools Checked | ${result.summary.totalTools} |\n`;
  output += `| Tools Healthy | ${result.summary.healthyTools} ✅ |\n`;
  output += `| Tools Failed | ${result.summary.failedTools} ${result.summary.failedTools > 0 ? '❌' : '✅'} |\n`;
  output += `| Tables Existing | ${result.summary.tablesExisting}/${result.summary.tablesChecked} |\n`;
  output += `| Repos Healthy | ${result.summary.reposHealthy}/${result.summary.reposChecked} |\n\n`;
  
  if (missingTables.length > 0) {
    output += `## MISSING TABLES\n`;
    for (const t of missingTables) {
      output += `- ❌ ${t.name}${t.error ? ` (${t.error})` : ''}\n`;
    }
    output += '\n';
  }
  
  if (failedRepos.length > 0) {
    output += `## FAILED REPOSITORIES\n`;
    for (const r of failedRepos) {
      output += `- ❌ ${r.name}${r.error ? `: ${r.error}` : ''}\n`;
    }
    output += '\n';
  }
  
  if (toolResults.failed.length > 0) {
    output += `## FAILED TOOLS\n`;
    for (const t of toolResults.failed) {
      output += `- ❌ ${t.name} (${t.category}): ${t.error}\n`;
    }
    output += '\n';
  }
  
  output += `## RECOMMENDATIONS\n`;
  for (const rec of recommendations) {
    output += `- ${rec}\n`;
  }
  
  return {
    content: [{ type: 'text', text: output }]
  };
}

// === TRACE DEPENDENCIES SCHEMA ===

export const TraceDependenciesSchema = z.object({
  toolName: z.string().describe('Tool to trace dependencies for'),
  checkLive: z.boolean().default(false).describe('Actually call the tool with minimal args to test')
});

export type TraceDependenciesArgs = z.infer<typeof TraceDependenciesSchema>;

export async function handleTraceDependencies(args: TraceDependenciesArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const registry = buildToolRegistry();
  const tool = registry[args.toolName];
  
  if (!tool) {
    return {
      content: [{
        type: 'text',
        text: `❌ Tool not found: ${args.toolName}\n\nUse search_tools to find valid tool names.`
      }]
    };
  }
  
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');
  
  let output = `# DEPENDENCY TRACE: ${args.toolName}\n\n`;
  output += `**Category:** ${tool.metadata.category}\n`;
  output += `**Description:** ${tool.metadata.description}\n\n`;
  
  // Analyze schema for required params
  output += `## REQUIRED PARAMETERS\n`;
  try {
    const shape = tool.schema.shape || {};
    const required: string[] = [];
    const optional: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as any;
      if (zodType.isOptional?.() || zodType._def?.typeName === 'ZodOptional' || zodType._def?.defaultValue !== undefined) {
        optional.push(key);
      } else {
        required.push(key);
      }
    }
    
    if (required.length > 0) {
      output += `Required: ${required.join(', ')}\n`;
    }
    if (optional.length > 0) {
      output += `Optional: ${optional.join(', ')}\n`;
    }
  } catch (e: any) {
    output += `⚠️ Could not analyze schema: ${e.message}\n`;
  }
  
  output += '\n';
  
  // Check related tables based on tool category/name
  output += `## DATABASE DEPENDENCIES\n`;
  const toolLower = args.toolName.toLowerCase();
  const relatedTables: string[] = [];
  
  // Infer related tables from tool name
  if (toolLower.includes('character')) relatedTables.push('characters');
  if (toolLower.includes('party')) relatedTables.push('parties', 'party_members');
  if (toolLower.includes('inventory') || toolLower.includes('item')) relatedTables.push('items', 'inventory');
  if (toolLower.includes('quest')) relatedTables.push('quests', 'quest_assignments');
  if (toolLower.includes('combat') || toolLower.includes('encounter')) relatedTables.push('encounters');
  if (toolLower.includes('secret')) relatedTables.push('secrets');
  if (toolLower.includes('aura')) relatedTables.push('auras');
  if (toolLower.includes('npc') || toolLower.includes('relationship')) relatedTables.push('npc_relationships', 'conversation_memories');
  if (toolLower.includes('poi') || toolLower.includes('location')) relatedTables.push('pois');
  if (toolLower.includes('room') || toolLower.includes('spatial')) relatedTables.push('room_nodes', 'room_exits');
  if (toolLower.includes('theft') || toolLower.includes('steal')) relatedTables.push('theft_records', 'fence_registry');
  if (toolLower.includes('corpse') || toolLower.includes('loot')) relatedTables.push('corpses', 'loot_tables');
  if (toolLower.includes('event')) relatedTables.push('event_inbox');
  if (toolLower.includes('world')) relatedTables.push('worlds');
  if (toolLower.includes('narrative')) relatedTables.push('narrative_notes');
  if (toolLower.includes('context')) {
    relatedTables.push('worlds', 'characters', 'parties', 'inventory', 'items', 
      'quests', 'encounters', 'secrets', 'event_inbox', 'narrative_notes',
      'npc_relationships', 'pois', 'auras', 'room_nodes');
  }
  
  // Check each related table
  for (const tableName of [...new Set(relatedTables)]) {
    try {
      const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
      if (exists) {
        const count = (db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as any).c;
        output += `✅ ${tableName} (${count} rows)\n`;
      } else {
        output += `❌ ${tableName} (MISSING)\n`;
      }
    } catch (e: any) {
      output += `⚠️ ${tableName}: ${e.message}\n`;
    }
  }
  
  if (relatedTables.length === 0) {
    output += `(No specific table dependencies inferred)\n`;
  }
  
  // Live check if requested
  if (args.checkLive) {
    output += `\n## LIVE CHECK\n`;
    try {
      // Try to call with empty/minimal args to see what error we get
      const result = await tool.handler({}, { sessionId: 'trace-test' });
      output += `✅ Tool executed successfully (may have returned validation error)\n`;
      if (result && typeof result === 'object') {
        output += `Response type: ${result.content ? 'MCP content' : 'direct object'}\n`;
      }
    } catch (e: any) {
      output += `❌ Execution error: ${e.message}\n`;
      if (e.issues) {
        output += `Validation issues: ${JSON.stringify(e.issues, null, 2)}\n`;
      }
    }
  }
  
  return {
    content: [{ type: 'text', text: output }]
  };
}

// === TOOL DEFINITIONS ===

export const TraceTools = {
  TRACE_TOOLS: {
    name: 'trace_tools',
    description: 'Run batch diagnostics on MCP tools - checks tool health, database tables, and repository instantiation.',
    inputSchema: TraceToolsSchema
  },
  TRACE_DEPENDENCIES: {
    name: 'trace_dependencies',
    description: 'Trace dependencies for a specific tool - shows required tables, parameters, and optionally does a live test.',
    inputSchema: TraceDependenciesSchema
  }
};
