/**
 * Narrative Tools Test Suite
 * 
 * Tests the Narrative Memory Layer functionality:
 * - CRUD operations for narrative notes
 * - Filtering by type, status, and tags
 * - Context retrieval for LLM injection
 */

import Database from 'better-sqlite3';
import { getDb, closeDb, migrate } from '../src/storage/index';

// We'll test the handlers directly
import {
  handleAddNarrativeNote,
  handleSearchNarrativeNotes,
  handleUpdateNarrativeNote,
  handleGetNarrativeNote,
  handleDeleteNarrativeNote,
  handleGetNarrativeContextNotes
} from '../src/server/narrative-tools';

// Mock context
const mockCtx = { sessionId: 'test-session' };

// Test database setup
let db: Database.Database;
const TEST_WORLD_ID = 'test-world-001';

describe('Narrative Tools', () => {
  beforeAll(() => {
    // Use getDb(':memory:') to set the singleton that handlers will use
    db = getDb(':memory:');
    
    // Create test world
    db.prepare(`
      INSERT INTO worlds (id, name, seed, width, height, created_at, updated_at)
      VALUES (?, 'Test World', 'test-seed', 100, 100, datetime('now'), datetime('now'))
    `).run(TEST_WORLD_ID);
  });

  afterAll(() => {
    closeDb();
  });

  describe('add_narrative_note', () => {
    it('should create a plot_thread note', async () => {
      const result = await handleAddNarrativeNote({
        worldId: TEST_WORLD_ID,
        type: 'plot_thread',
        content: 'The Black Ship approaches from the east',
        metadata: { urgency: 'high', hooks: ['sailor rumors', 'dock activity'] },
        tags: ['faction:pirates', 'location:harbor']
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.noteId).toBeDefined();
      expect(parsed.type).toBe('plot_thread');
    });

    it('should create a canonical_moment note', async () => {
      const result = await handleAddNarrativeNote({
        worldId: TEST_WORLD_ID,
        type: 'canonical_moment',
        content: '"I WILL REMEMBER YOU. I WILL REMEMBER MERCY."',
        metadata: { speaker: 'The Deep God', participants: ['Marcus', 'Cassia'], location: 'Silent Isle' },
        visibility: 'player_visible'
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should create an npc_voice note', async () => {
      const result = await handleAddNarrativeNote({
        worldId: TEST_WORLD_ID,
        type: 'npc_voice',
        content: 'Cassia speaks in short, sailor-profanity-laced sentences',
        metadata: { 
          speech_pattern: 'Direct, profane',
          vocabulary: ['blood', 'salt', 'coin'],
          current_goal: 'Survive and repay her debt to the Deep'
        },
        entityId: 'cassia-001',
        entityType: 'character'
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should create a foreshadowing note', async () => {
      const result = await handleAddNarrativeNote({
        worldId: TEST_WORLD_ID,
        type: 'foreshadowing',
        content: 'The Temple of Neptunus has been too quiet',
        metadata: { 
          target: 'Cult activity at the temple',
          hints_given: ['Empty streets near temple'],
          hints_remaining: ['Priests acting strangely', 'Mysterious chanting at night'],
          trigger: 'When they arrive at the temple district'
        }
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });
  });

  describe('search_narrative_notes', () => {
    it('should find notes by type', async () => {
      const result = await handleSearchNarrativeNotes({
        worldId: TEST_WORLD_ID,
        type: 'plot_thread'
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBeGreaterThan(0);
      expect(parsed.notes.every((n: any) => n.type === 'plot_thread')).toBe(true);
    });

    it('should find notes by text query', async () => {
      const result = await handleSearchNarrativeNotes({
        worldId: TEST_WORLD_ID,
        query: 'Black Ship'
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBeGreaterThan(0);
    });

    it('should filter by tags', async () => {
      const result = await handleSearchNarrativeNotes({
        worldId: TEST_WORLD_ID,
        tags: ['faction:pirates']
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBeGreaterThan(0);
    });

    it('should filter by entity', async () => {
      const result = await handleSearchNarrativeNotes({
        worldId: TEST_WORLD_ID,
        entityId: 'cassia-001'
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBeGreaterThan(0);
      expect(parsed.notes[0].entity_id).toBe('cassia-001');
    });
  });

  describe('update_narrative_note', () => {
    let testNoteId: string;

    beforeAll(async () => {
      // Create a note to update
      const result = await handleAddNarrativeNote({
        worldId: TEST_WORLD_ID,
        type: 'plot_thread',
        content: 'Test plot thread for updating',
        status: 'active'
      }, mockCtx);
      testNoteId = JSON.parse(result.content[0].text).noteId;
    });

    it('should update status to resolved', async () => {
      const result = await handleUpdateNarrativeNote({
        noteId: testNoteId,
        status: 'resolved'
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);

      // Verify the update
      const getResult = await handleGetNarrativeNote({ noteId: testNoteId }, mockCtx);
      const note = JSON.parse(getResult.content[0].text);
      expect(note.status).toBe('resolved');
    });

    it('should merge metadata', async () => {
      const result = await handleUpdateNarrativeNote({
        noteId: testNoteId,
        metadata: { resolution: 'Players defeated the pirates' }
      }, mockCtx);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);

      // Verify metadata merge
      const getResult = await handleGetNarrativeNote({ noteId: testNoteId }, mockCtx);
      const note = JSON.parse(getResult.content[0].text);
      expect(note.metadata.resolution).toBe('Players defeated the pirates');
    });
  });

  describe('get_narrative_context_notes', () => {
    it('should return aggregated context for LLM injection', async () => {
      const result = await handleGetNarrativeContextNotes({
        worldId: TEST_WORLD_ID,
        includeTypes: ['plot_thread', 'canonical_moment', 'npc_voice', 'foreshadowing'],
        maxPerType: 5,
        statusFilter: ['active']
      }, mockCtx);

      const text = result.content[0].text;
      
      // Should contain section headers
      expect(text).toContain('FORESHADOWING HINTS');
      expect(text).toContain('ACTIVE PLOT THREADS');
      expect(text).toContain('NPC VOICE NOTES');
      expect(text).toContain('CANONICAL MOMENTS');
    });

    it('should respect player visibility filter', async () => {
      const result = await handleGetNarrativeContextNotes({
        worldId: TEST_WORLD_ID,
        includeTypes: ['canonical_moment'],
        forPlayer: true
      }, mockCtx);

      const text = result.content[0].text;
      // Should only include the player_visible canonical moment
      expect(text).toContain('REMEMBER MERCY');
    });
  });

  describe('delete_narrative_note', () => {
    it('should delete a note', async () => {
      // Create a note to delete
      const createResult = await handleAddNarrativeNote({
        worldId: TEST_WORLD_ID,
        type: 'session_log',
        content: 'Temporary note for deletion test'
      }, mockCtx);
      const noteId = JSON.parse(createResult.content[0].text).noteId;

      // Delete it
      const deleteResult = await handleDeleteNarrativeNote({ noteId }, mockCtx);
      const parsed = JSON.parse(deleteResult.content[0].text);
      expect(parsed.deleted).toBe(true);

      // Verify deletion
      const getResult = await handleGetNarrativeNote({ noteId }, mockCtx);
      const getResultParsed = JSON.parse(getResult.content[0].text);
      expect(getResultParsed.error).toBe('Note not found');
    });
  });
});
