import Database from 'better-sqlite3';

export function initDB(path: string = 'rpg.db'): Database.Database {
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
}
