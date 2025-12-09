/**
 * Narrative Tools - Session Notes & Memory Layer
 * 
 * Implements the "Narrative Memory Layer" for tracking:
 * - Plot Threads: Active storylines, quests, hooks
 * - Canonical Moments: Verbatim quotes, key decisions, immutable history
 * - NPC Voices: Speech patterns, vocabulary, secrets
 * - Foreshadowing: Hints to drop, secrets to reveal later
 * - Session Logs: General summaries and mini-updates
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { SessionContext } from './types.js';
import { getDb } from '../storage/index.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const NoteTypeEnum = z.enum([
  'plot_thread',
  'canonical_moment', 
  'npc_voice',
  'foreshadowing',
  'session_log'
]);

const NoteStatusEnum = z.enum([
  'active',
  'resolved',
  'dormant',
  'archived'
]);

const VisibilityEnum = z.enum([
  'dm_only',
  'player_visible'
]);

// Type-specific metadata schemas
const PlotThreadMetadata = z.object({
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  hooks: z.array(z.string()).optional().default([]),
  resolution_conditions: z.array(z.string()).optional().default([])
});

const CanonicalMomentMetadata = z.object({
  speaker: z.string().optional(),
  participants: z.array(z.string()).optional().default([]),
  location: z.string().optional(),
  session_number: z.number().optional()
});

const NpcVoiceMetadata = z.object({
  speech_pattern: z.string().optional(),
  vocabulary: z.array(z.string()).optional().default([]),
  mannerisms: z.array(z.string()).optional().default([]),
  current_goal: z.string().optional(),
  secrets: z.array(z.string()).optional().default([])
});

const ForeshadowingMetadata = z.object({
  target: z.string().describe('What this foreshadows'),
  hints_given: z.array(z.string()).optional().default([]),
  hints_remaining: z.array(z.string()).optional().default([]),
  trigger: z.string().optional().describe('When to reveal fully')
});

const SessionLogMetadata = z.object({
  session_number: z.number().optional(),
  xp_awarded: z.number().optional(),
  player_count: z.number().optional()
});

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const AddNarrativeNoteSchema = z.object({
  worldId: z.string().describe('World/campaign ID to associate the note with'),
  type: NoteTypeEnum.describe('Category of note'),
  content: z.string().min(1).describe('Main text content of the note'),
  metadata: z.record(z.any()).optional().default({}).describe('Type-specific structured data'),
  visibility: VisibilityEnum.optional().default('dm_only'),
  tags: z.array(z.string()).optional().default([]).describe('Tags for filtering (e.g., "faction:legion")'),
  entityId: z.string().optional().describe('Link to a character/NPC/location'),
  entityType: z.enum(['character', 'npc', 'location', 'item']).optional(),
  status: NoteStatusEnum.optional().default('active')
});

export const SearchNarrativeNotesSchema = z.object({
  worldId: z.string().describe('World/campaign ID'),
  query: z.string().optional().describe('Text search in content'),
  type: NoteTypeEnum.optional().describe('Filter by note type'),
  status: NoteStatusEnum.optional().describe('Filter by status'),
  tags: z.array(z.string()).optional().describe('Filter by tags (AND logic)'),
  entityId: z.string().optional().describe('Filter by linked entity'),
  visibility: VisibilityEnum.optional().describe('Filter by visibility'),
  limit: z.number().optional().default(20).describe('Max results to return'),
  orderBy: z.enum(['created_at', 'updated_at']).optional().default('created_at')
});

export const UpdateNarrativeNoteSchema = z.object({
  noteId: z.string().describe('ID of the note to update'),
  content: z.string().optional().describe('New content (if changing)'),
  metadata: z.record(z.any()).optional().describe('Merge into existing metadata'),
  status: NoteStatusEnum.optional().describe('Change status (e.g., resolve a plot thread)'),
  visibility: VisibilityEnum.optional(),
  tags: z.array(z.string()).optional().describe('Replace tags')
});

export const GetNarrativeNoteSchema = z.object({
  noteId: z.string().describe('ID of the note to retrieve')
});

export const DeleteNarrativeNoteSchema = z.object({
  noteId: z.string().describe('ID of the note to delete')
});

export const GetNarrativeContextSchema = z.object({
  worldId: z.string().describe('World/campaign ID'),
  includeTypes: z.array(NoteTypeEnum).optional().default(['plot_thread', 'canonical_moment', 'npc_voice', 'foreshadowing']),
  maxPerType: z.number().optional().default(5).describe('Max notes per type to include'),
  statusFilter: z.array(NoteStatusEnum).optional().default(['active']).describe('Only include notes with these statuses'),
  forPlayer: z.boolean().optional().default(false).describe('If true, only return player_visible notes')
});

// Tool definitions for registry
export const NarrativeTools = {
  ADD_NARRATIVE_NOTE: {
    name: 'add_narrative_note',
    description: 'Create a typed narrative note (plot thread, canonical moment, NPC voice, foreshadowing, or session log). Used to build long-term narrative memory.',
    inputSchema: AddNarrativeNoteSchema
  },
  SEARCH_NARRATIVE_NOTES: {
    name: 'search_narrative_notes',
    description: 'Search and filter narrative notes by type, status, tags, or text content. Returns matching notes for context building.',
    inputSchema: SearchNarrativeNotesSchema
  },
  UPDATE_NARRATIVE_NOTE: {
    name: 'update_narrative_note',
    description: 'Update an existing narrative note. Common use: marking a plot_thread as resolved.',
    inputSchema: UpdateNarrativeNoteSchema
  },
  GET_NARRATIVE_NOTE: {
    name: 'get_narrative_note',
    description: 'Retrieve a single narrative note by ID.',
    inputSchema: GetNarrativeNoteSchema
  },
  DELETE_NARRATIVE_NOTE: {
    name: 'delete_narrative_note',
    description: 'Delete a narrative note. Use sparingly - prefer archiving via status update.',
    inputSchema: DeleteNarrativeNoteSchema
  },
  GET_NARRATIVE_CONTEXT: {
    name: 'get_narrative_context_notes',
    description: 'Retrieve aggregated narrative context for LLM prompt injection. Returns active plot threads, recent canonical moments, NPC voices, and pending foreshadowing.',
    inputSchema: GetNarrativeContextSchema
  }
} as const;

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleAddNarrativeNote(args: unknown, _ctx: SessionContext) {
  const parsed = NarrativeTools.ADD_NARRATIVE_NOTE.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');

  const id = uuidv4();
  const now = new Date().toISOString();

  // Validate metadata against type-specific schema
  let validatedMetadata = parsed.metadata;
  try {
    switch (parsed.type) {
      case 'plot_thread':
        validatedMetadata = PlotThreadMetadata.parse(parsed.metadata);
        break;
      case 'canonical_moment':
        validatedMetadata = CanonicalMomentMetadata.parse(parsed.metadata);
        break;
      case 'npc_voice':
        validatedMetadata = NpcVoiceMetadata.parse(parsed.metadata);
        break;
      case 'foreshadowing':
        validatedMetadata = ForeshadowingMetadata.parse(parsed.metadata);
        break;
      case 'session_log':
        validatedMetadata = SessionLogMetadata.parse(parsed.metadata);
        break;
    }
  } catch (e) {
    // Allow flexible metadata, just warn
    console.warn(`[NarrativeNote] Metadata validation warning for type ${parsed.type}:`, e);
  }

  db.prepare(`
    INSERT INTO narrative_notes (id, world_id, type, content, metadata, visibility, tags, entity_id, entity_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    parsed.worldId,
    parsed.type,
    parsed.content,
    JSON.stringify(validatedMetadata),
    parsed.visibility,
    JSON.stringify(parsed.tags),
    parsed.entityId || null,
    parsed.entityType || null,
    parsed.status,
    now,
    now
  );

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: true,
        noteId: id,
        type: parsed.type,
        message: `Created ${parsed.type} note: "${parsed.content.substring(0, 50)}..."`
      })
    }]
  };
}

export async function handleSearchNarrativeNotes(args: unknown, _ctx: SessionContext) {
  const parsed = NarrativeTools.SEARCH_NARRATIVE_NOTES.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');

  let sql = `SELECT * FROM narrative_notes WHERE world_id = ?`;
  const params: any[] = [parsed.worldId];

  if (parsed.type) {
    sql += ` AND type = ?`;
    params.push(parsed.type);
  }

  if (parsed.status) {
    sql += ` AND status = ?`;
    params.push(parsed.status);
  }

  if (parsed.visibility) {
    sql += ` AND visibility = ?`;
    params.push(parsed.visibility);
  }

  if (parsed.entityId) {
    sql += ` AND entity_id = ?`;
    params.push(parsed.entityId);
  }

  if (parsed.query) {
    sql += ` AND content LIKE ?`;
    params.push(`%${parsed.query}%`);
  }

  // Tag filtering (AND logic - all specified tags must be present)
  if (parsed.tags && parsed.tags.length > 0) {
    for (const tag of parsed.tags) {
      sql += ` AND tags LIKE ?`;
      params.push(`%"${tag}"%`);
    }
  }

  sql += ` ORDER BY ${parsed.orderBy} DESC LIMIT ?`;
  params.push(parsed.limit);

  const notes = db.prepare(sql).all(...params) as any[];

  // Parse JSON fields
  const results = notes.map(note => ({
    ...note,
    metadata: JSON.parse(note.metadata || '{}'),
    tags: JSON.parse(note.tags || '[]')
  }));

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        count: results.length,
        notes: results
      })
    }]
  };
}

export async function handleUpdateNarrativeNote(args: unknown, _ctx: SessionContext) {
  const parsed = NarrativeTools.UPDATE_NARRATIVE_NOTE.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');

  // First get the existing note
  const existing = db.prepare('SELECT * FROM narrative_notes WHERE id = ?').get(parsed.noteId) as any;
  if (!existing) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: 'Note not found' })
      }],
      isError: true
    };
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (parsed.content !== undefined) {
    updates.push('content = ?');
    params.push(parsed.content);
  }

  if (parsed.status !== undefined) {
    updates.push('status = ?');
    params.push(parsed.status);
  }

  if (parsed.visibility !== undefined) {
    updates.push('visibility = ?');
    params.push(parsed.visibility);
  }

  if (parsed.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(parsed.tags));
  }

  if (parsed.metadata !== undefined) {
    // Merge with existing metadata
    const existingMeta = JSON.parse(existing.metadata || '{}');
    const merged = { ...existingMeta, ...parsed.metadata };
    updates.push('metadata = ?');
    params.push(JSON.stringify(merged));
  }

  if (updates.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ success: true, message: 'No updates provided' })
      }]
    };
  }

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(parsed.noteId);

  db.prepare(`UPDATE narrative_notes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: true,
        noteId: parsed.noteId,
        message: `Updated note. Changes: ${updates.slice(0, -1).join(', ')}`
      })
    }]
  };
}

export async function handleGetNarrativeNote(args: unknown, _ctx: SessionContext) {
  const parsed = NarrativeTools.GET_NARRATIVE_NOTE.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');

  const note = db.prepare('SELECT * FROM narrative_notes WHERE id = ?').get(parsed.noteId) as any;

  if (!note) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: 'Note not found' })
      }],
      isError: true
    };
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        ...note,
        metadata: JSON.parse(note.metadata || '{}'),
        tags: JSON.parse(note.tags || '[]')
      })
    }]
  };
}

export async function handleDeleteNarrativeNote(args: unknown, _ctx: SessionContext) {
  const parsed = NarrativeTools.DELETE_NARRATIVE_NOTE.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');

  const result = db.prepare('DELETE FROM narrative_notes WHERE id = ?').run(parsed.noteId);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: result.changes > 0,
        deleted: result.changes > 0,
        message: result.changes > 0 ? 'Note deleted' : 'Note not found'
      })
    }]
  };
}

export async function handleGetNarrativeContextNotes(args: unknown, _ctx: SessionContext) {
  const parsed = NarrativeTools.GET_NARRATIVE_CONTEXT.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');

  const sections: { title: string; notes: any[]; priority: number }[] = [];

  // Priority order: foreshadowing > plot_thread > npc_voice > canonical_moment > session_log
  const typePriority: Record<string, number> = {
    'foreshadowing': 100,
    'plot_thread': 90,
    'npc_voice': 80,
    'canonical_moment': 70,
    'session_log': 50
  };

  const typeLabels: Record<string, string> = {
    'foreshadowing': '🔮 FORESHADOWING HINTS',
    'plot_thread': '📜 ACTIVE PLOT THREADS',
    'npc_voice': '🗣️ NPC VOICE NOTES',
    'canonical_moment': '⭐ CANONICAL MOMENTS',
    'session_log': '📝 SESSION LOGS'
  };

  for (const noteType of parsed.includeTypes) {
    let sql = `SELECT * FROM narrative_notes WHERE world_id = ? AND type = ?`;
    const params: any[] = [parsed.worldId, noteType];

    // Status filter
    if (parsed.statusFilter.length > 0) {
      sql += ` AND status IN (${parsed.statusFilter.map(() => '?').join(',')})`;
      params.push(...parsed.statusFilter);
    }

    // Visibility filter for player-facing context
    if (parsed.forPlayer) {
      sql += ` AND visibility = 'player_visible'`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parsed.maxPerType);

    const notes = db.prepare(sql).all(...params) as any[];

    if (notes.length > 0) {
      sections.push({
        title: typeLabels[noteType] || noteType.toUpperCase(),
        notes: notes.map(n => ({
          id: n.id,
          content: n.content,
          metadata: JSON.parse(n.metadata || '{}'),
          tags: JSON.parse(n.tags || '[]'),
          status: n.status,
          entityId: n.entity_id,
          entityType: n.entity_type,
          createdAt: n.created_at
        })),
        priority: typePriority[noteType] || 0
      });
    }
  }

  // Sort by priority (highest first)
  sections.sort((a, b) => b.priority - a.priority);

  // Format for LLM injection
  let contextText = '';
  for (const section of sections) {
    contextText += `--- ${section.title} ---\n`;
    for (const note of section.notes) {
      contextText += `• ${note.content}`;
      if (note.metadata && Object.keys(note.metadata).length > 0) {
        const metaStr = Object.entries(note.metadata)
          .filter(([_, v]) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true))
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ');
        if (metaStr) contextText += ` [${metaStr}]`;
      }
      if (note.tags && note.tags.length > 0) {
        contextText += ` #${note.tags.join(' #')}`;
      }
      contextText += '\n';
    }
    contextText += '\n';
  }

  return {
    content: [{
      type: 'text' as const,
      text: contextText.trim() || '(No narrative notes found for this world)'
    }]
  };
}
