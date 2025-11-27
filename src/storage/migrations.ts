import Database from 'better-sqlite3';

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      seed TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      center_x INTEGER NOT NULL,
      center_y INTEGER NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tiles (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      biome TEXT NOT NULL,
      elevation INTEGER NOT NULL,
      moisture INTEGER NOT NULL,
      temperature INTEGER NOT NULL,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
      UNIQUE(world_id, x, y)
    );

    CREATE TABLE IF NOT EXISTS structures (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      region_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      population INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rivers (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL, -- JSON array of coordinates
      width INTEGER NOT NULL,
      source_elevation INTEGER NOT NULL,
      mouth_elevation INTEGER NOT NULL,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stats TEXT NOT NULL, -- JSON
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      ac INTEGER NOT NULL,
      level INTEGER NOT NULL,
      faction_id TEXT,
      behavior TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS encounters (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      tokens TEXT NOT NULL, -- JSON
      round INTEGER NOT NULL,
      active_token_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS patches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      op TEXT NOT NULL,
      path TEXT NOT NULL,
      value TEXT, -- JSON
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS battlefield (
      id TEXT PRIMARY KEY,
      encounter_id TEXT NOT NULL,
      grid_data TEXT NOT NULL, -- JSON
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_id TEXT,
      target_id TEXT,
      details TEXT, -- JSON
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL, -- JSON
      timestamp TEXT NOT NULL
    );
  `);
}
