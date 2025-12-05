import Database from 'better-sqlite3';
import { existsSync, unlinkSync } from 'fs';

export interface DatabaseIntegrityResult {
    ok: boolean;
    errors: string[];
}

/**
 * Check database integrity using SQLite's integrity_check pragma.
 */
export function checkDatabaseIntegrity(db: Database.Database): DatabaseIntegrityResult {
    try {
        const result = db.pragma('integrity_check') as { integrity_check: string }[];
        const errors = result
            .map(row => row.integrity_check)
            .filter(msg => msg !== 'ok');

        return {
            ok: errors.length === 0,
            errors
        };
    } catch (e) {
        return {
            ok: false,
            errors: [(e as Error).message]
        };
    }
}

/**
 * Attempt to recover a corrupted database by creating a fresh one.
 * Returns true if recovery was needed and performed.
 */
function handleCorruptedDatabase(path: string, error: Error): void {
    console.error(`[Database] CRITICAL: Database corruption detected at ${path}`);
    console.error(`[Database] Error: ${error.message}`);

    // Check for WAL files
    const walPath = `${path}-wal`;
    const shmPath = `${path}-shm`;

    console.error('[Database] Attempting recovery by removing corrupted files...');

    try {
        if (existsSync(path)) {
            unlinkSync(path);
            console.error(`[Database] Removed corrupted database: ${path}`);
        }
        if (existsSync(walPath)) {
            unlinkSync(walPath);
            console.error(`[Database] Removed WAL file: ${walPath}`);
        }
        if (existsSync(shmPath)) {
            unlinkSync(shmPath);
            console.error(`[Database] Removed SHM file: ${shmPath}`);
        }
        console.error('[Database] Recovery complete. A fresh database will be created.');
    } catch (cleanupError) {
        console.error(`[Database] Failed to clean up corrupted files: ${(cleanupError as Error).message}`);
        throw new Error(`Database is corrupted and cleanup failed. Please manually delete: ${path}, ${walPath}, ${shmPath}`);
    }
}

export function initDB(path: string): Database.Database {
    console.error(`[Database] Opening database: ${path}`);

    let db: Database.Database;

    try {
        db = new Database(path);
    } catch (e) {
        const error = e as Error;
        // If we can't even open the database, it's likely corrupted
        if (error.message.includes('SQLITE_CORRUPT') || error.message.includes('malformed')) {
            handleCorruptedDatabase(path, error);
            // Try again with fresh database
            db = new Database(path);
        } else {
            throw e;
        }
    }

    // Set pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run integrity check on existing databases
    const integrity = checkDatabaseIntegrity(db);
    if (!integrity.ok) {
        console.error('[Database] Integrity check failed:');
        integrity.errors.forEach(err => console.error(`  - ${err}`));

        // Close the corrupted database
        db.close();

        // Handle the corruption
        handleCorruptedDatabase(path, new Error(integrity.errors.join(', ')));

        // Create fresh database
        db = new Database(path);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        console.error('[Database] Fresh database created after corruption recovery');
    } else {
        console.error('[Database] Integrity check passed');
    }

    return db;
}
