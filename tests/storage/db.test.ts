
import { initDB } from '../../src/storage/db.js';
import { migrate } from '../../src/storage/migrations.js';
import fs from 'fs';

import { FIXED_TIMESTAMP } from '../fixtures';

const TEST_DB_PATH = 'test.db';

describe('Storage Layer', () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    afterEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('should initialize database connection', () => {
        const db = initDB(TEST_DB_PATH);
        expect(db).toBeDefined();
        expect(db.open).toBe(true);
        db.close();
    });

    it('should enable foreign keys', () => {
        const db = initDB(TEST_DB_PATH);
        const result = db.pragma('foreign_keys', { simple: true });
        expect(result).toBe(1);
        db.close();
    });

    it('should run migrations and create tables', () => {
        const db = initDB(TEST_DB_PATH);
        migrate(db);

        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tableNames = tables.map((t: any) => t.name);

        expect(tableNames).toContain('worlds');
        migrate(db);

        // Insert a region without a world (should fail if we had data, but we need a world first)
        // Actually, let's try to insert a region pointing to a non-existent world

        expect(() => {
            db.prepare(`
        INSERT INTO regions (id, world_id, name, type, center_x, center_y, color, created_at, updated_at)
        VALUES ('r1', 'non-existent-world', 'Region 1', 'kingdom', 0, 0, '#000', ?, ?)
      `).run(FIXED_TIMESTAMP, FIXED_TIMESTAMP);
        }).toThrow(); // Should throw SqliteError: FOREIGN KEY constraint failed

        db.close();
    });
});
