import Database from 'better-sqlite3';

export function migrate(db: Database.Database) {
  // First, create all tables (without indexes that depend on new columns)
  db.exec(`
    CREATE TABLE IF NOT EXISTS worlds(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    seed TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS regions(
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    center_x INTEGER NOT NULL,
    center_y INTEGER NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS tiles(
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    biome TEXT NOT NULL,
    elevation INTEGER NOT NULL,
    moisture INTEGER NOT NULL,
    temperature INTEGER NOT NULL,
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE,
    UNIQUE(world_id, x, y)
  );

    CREATE TABLE IF NOT EXISTS structures(
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
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS rivers(
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL, --JSON array of coordinates
      width INTEGER NOT NULL,
    source_elevation INTEGER NOT NULL,
    mouth_elevation INTEGER NOT NULL,
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS characters(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stats TEXT NOT NULL, --JSON
      hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    ac INTEGER NOT NULL,
    level INTEGER NOT NULL,
    faction_id TEXT,
    behavior TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS encounters(
    id TEXT PRIMARY KEY,
    region_id TEXT,
    tokens TEXT NOT NULL, --JSON
      round INTEGER NOT NULL,
    active_token_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(region_id) REFERENCES regions(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS patches(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    op TEXT NOT NULL,
    path TEXT NOT NULL,
    value TEXT, --JSON
      timestamp TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS battlefield(
    id TEXT PRIMARY KEY,
    encounter_id TEXT NOT NULL,
    grid_data TEXT NOT NULL, --JSON
      created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS audit_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor_id TEXT,
    target_id TEXT,
    details TEXT, --JSON
      timestamp TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS event_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL, --JSON
      timestamp TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS items(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    value INTEGER NOT NULL DEFAULT 0,
    properties TEXT, --JSON
      created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS inventory_items(
    character_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    equipped INTEGER NOT NULL DEFAULT 0, --boolean 0 / 1
      slot TEXT,
    PRIMARY KEY(character_id, item_id),
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS quests(
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    objectives TEXT NOT NULL, --JSON
      rewards TEXT NOT NULL, --JSON
      prerequisites TEXT NOT NULL, --JSON
      giver TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS quest_logs(
    character_id TEXT PRIMARY KEY,
    active_quests TEXT NOT NULL, --JSON array of IDs
      completed_quests TEXT NOT NULL, --JSON array of IDs
      failed_quests TEXT NOT NULL, --JSON array of IDs
      FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS calculations(
    id TEXT PRIMARY KEY,
    session_id TEXT,
    input TEXT NOT NULL,
    result TEXT NOT NULL, --JSON or string
      steps TEXT, --JSON array
      seed TEXT,
    timestamp TEXT NOT NULL,
    metadata TEXT-- JSON
  );

  CREATE TABLE IF NOT EXISTS turn_state(
    world_id TEXT PRIMARY KEY,
    current_turn INTEGER NOT NULL DEFAULT 1,
    turn_phase TEXT NOT NULL DEFAULT 'planning',
    phase_started_at TEXT NOT NULL,
    nations_ready TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS secrets(
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    public_description TEXT NOT NULL,
    secret_description TEXT NOT NULL,
    linked_entity_id TEXT,
    linked_entity_type TEXT,
    revealed INTEGER NOT NULL DEFAULT 0,
    revealed_at TEXT,
    revealed_by TEXT,
    reveal_conditions TEXT NOT NULL DEFAULT '[]', --JSON array of conditions
    sensitivity TEXT NOT NULL DEFAULT 'medium',
    leak_patterns TEXT NOT NULL DEFAULT '[]', --JSON array of keywords to avoid
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_secrets_world ON secrets(world_id);
  CREATE INDEX IF NOT EXISTS idx_secrets_revealed ON secrets(revealed);
  CREATE INDEX IF NOT EXISTS idx_secrets_linked ON secrets(linked_entity_id, linked_entity_type);

  -- Party management tables
  CREATE TABLE IF NOT EXISTS parties(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    world_id TEXT REFERENCES worlds(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dormant', 'archived')),
    current_location TEXT,
    current_quest_id TEXT REFERENCES quests(id) ON DELETE SET NULL,
    formation TEXT NOT NULL DEFAULT 'standard',
    position_x INTEGER,
    position_y INTEGER,
    current_poi TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_played_at TEXT
  );

  CREATE TABLE IF NOT EXISTS party_members(
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member', 'companion', 'hireling', 'prisoner', 'mount')),
    is_active INTEGER NOT NULL DEFAULT 0,
    position INTEGER,
    share_percentage INTEGER NOT NULL DEFAULT 100,
    joined_at TEXT NOT NULL,
    notes TEXT,
    UNIQUE(party_id, character_id)
  );

  CREATE INDEX IF NOT EXISTS idx_party_members_party ON party_members(party_id);
  CREATE INDEX IF NOT EXISTS idx_party_members_character ON party_members(character_id);
  CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);
  CREATE INDEX IF NOT EXISTS idx_parties_world ON parties(world_id);
  -- idx_parties_position moved to createPostMigrationIndexes (depends on position_x column)
  `);

  // Run migrations for existing databases that don't have the new columns
  // This MUST happen before creating indexes on new columns
  runMigrations(db);

  // Now create indexes that depend on migrated columns
  createPostMigrationIndexes(db);
}

function runMigrations(db: Database.Database) {
  // Check if character_type column exists and add it if missing
  const charColumns = db.prepare("PRAGMA table_info(characters)").all() as { name: string }[];
  const hasCharacterType = charColumns.some(col => col.name === 'character_type');
  
  if (!hasCharacterType) {
    console.error('[Migration] Adding character_type column to characters table');
    db.exec(`ALTER TABLE characters ADD COLUMN character_type TEXT DEFAULT 'pc';`);
  }

  // Check if party position columns exist and add them if missing
  const partyColumns = db.prepare("PRAGMA table_info(parties)").all() as { name: string }[];
  const hasPositionX = partyColumns.some(col => col.name === 'position_x');
  const hasPositionY = partyColumns.some(col => col.name === 'position_y');
  const hasCurrentPOI = partyColumns.some(col => col.name === 'current_poi');
  
  if (!hasPositionX) {
    console.error('[Migration] Adding position_x column to parties table');
    db.exec(`ALTER TABLE parties ADD COLUMN position_x INTEGER;`);
  }
  
  if (!hasPositionY) {
    console.error('[Migration] Adding position_y column to parties table');
    db.exec(`ALTER TABLE parties ADD COLUMN position_y INTEGER;`);
  }
  
  if (!hasCurrentPOI) {
    console.error('[Migration] Adding current_poi column to parties table');
    db.exec(`ALTER TABLE parties ADD COLUMN current_poi TEXT;`);
  }

  // Set safe default positions for existing parties (map center)
  db.exec(`
    UPDATE parties 
    SET position_x = 50, position_y = 50 
    WHERE position_x IS NULL;
  `);
}

function createPostMigrationIndexes(db: Database.Database) {
  // Create indexes that depend on columns added by migrations
  // Using try-catch since CREATE INDEX IF NOT EXISTS should handle duplicates
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_characters_type ON characters(character_type);`);
  } catch (e) {
    // Index may already exist or column may not exist in very old DBs
    console.error('[Migration] Note: Could not create idx_characters_type:', (e as Error).message);
  }
  
  // Create parties position index (depends on position_x, position_y columns added by migration)
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_parties_position ON parties(position_x, position_y);`);
  } catch (e) {
    console.error('[Migration] Note: Could not create idx_parties_position:', (e as Error).message);
  }
}
