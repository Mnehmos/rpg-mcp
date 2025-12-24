import { z } from 'zod';
import { SessionContext } from './types.js';
import { getDb } from '../storage/index.js';
import { SecretRepository } from '../storage/repos/secret.repo.js';
import { CharacterRepository } from '../storage/repos/character.repo.js';
import { PartyRepository } from '../storage/repos/party.repo.js';
import { InventoryRepository } from '../storage/repos/inventory.repo.js';
import { ItemRepository } from '../storage/repos/item.repo.js';
import { QuestRepository } from '../storage/repos/quest.repo.js';
import { EventInboxRepository } from '../storage/repos/event-inbox.repo.js';
import { SpatialRepository } from '../storage/repos/spatial.repo.js';
import { NpcMemoryRepository } from '../storage/repos/npc-memory.repo.js';
import { AuraRepository } from '../storage/repos/aura.repo.js';
import { POIRepository } from '../storage/repos/poi.repo.js';

// Schemas
export const GetNarrativeContextSchema = z.object({
  worldId: z.string().describe('Active world ID'),
  characterId: z.string().optional().describe('Active character ID (if any)'),
  encounterId: z.string().optional().describe('Active encounter ID (if any)'),
  partyId: z.string().optional().describe('Active party ID (if any)'),
  maxEvents: z.number().default(5).describe('Number of recent history events to include'),
  forPlayer: z.boolean().default(false).describe('If true, exclude DM-only content like secrets'),
  verbosity: z.enum(['minimal', 'standard', 'detailed']).default('standard').describe('Context detail level'),
  // Staleness thresholds (in hours) - 0 means "always include"
  relationshipStaleHours: z.number().default(168).describe('Exclude NPC relationships older than N hours (default: 168 = 1 week)'),
  nearbyPoiRadius: z.number().default(10).describe('Radius in map tiles to search for nearby POIs'),
  includeRestTracking: z.boolean().default(true).describe('Include time since last rest info')
});

export const ContextTools = {
  GET_NARRATIVE_CONTEXT: {
    name: 'get_narrative_context',
    description: 'Aggregates comprehensive narrative context (Character, World, Combat, Secrets) for the LLM system prompt.',
    inputSchema: GetNarrativeContextSchema
  }
} as const;

// Types helpers
interface NarrativeSection {
  title: string;
  content: string;
  priority: number; // Higher means closer to the top/more important
}

// Utility: Calculate ability modifier
function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Utility: Format conditions list
function formatConditions(conditions: any[]): string {
  if (!conditions || conditions.length === 0) return 'None';
  return conditions.map(c => typeof c === 'string' ? c : c.name).join(', ');
}

// Utility: Check if timestamp is stale (older than N hours)
function isStale(timestamp: string, maxAgeHours: number): boolean {
  if (maxAgeHours <= 0) return false; // 0 means "always fresh"
  const age = Date.now() - new Date(timestamp).getTime();
  return age > maxAgeHours * 60 * 60 * 1000;
}

// Utility: Format time ago
function formatTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// Utility: Get cardinal direction from dx/dy
function getCardinalDirection(dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return '';
  
  // Note: In most game coords, -Y is North
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  if (angle >= -22.5 && angle < 22.5) return 'E';
  if (angle >= 22.5 && angle < 67.5) return 'SE';
  if (angle >= 67.5 && angle < 112.5) return 'S';
  if (angle >= 112.5 && angle < 157.5) return 'SW';
  if (angle >= 157.5 || angle < -157.5) return 'W';
  if (angle >= -157.5 && angle < -112.5) return 'NW';
  if (angle >= -112.5 && angle < -67.5) return 'N';
  if (angle >= -67.5 && angle < -22.5) return 'NE';
  
  return '';
}

// Handler
export async function handleGetNarrativeContext(args: unknown, _ctx: SessionContext) {
  const parsed = ContextTools.GET_NARRATIVE_CONTEXT.inputSchema.parse(args);
  const db = getDb(process.env.RPG_DATA_DIR ? `${process.env.RPG_DATA_DIR}/rpg.db` : 'rpg.db');
  
  // Initialize repositories
  const charRepo = new CharacterRepository(db);
  const partyRepo = new PartyRepository(db);
  const inventoryRepo = new InventoryRepository(db);
  const itemRepo = new ItemRepository(db);
  const questRepo = new QuestRepository(db);
  const eventRepo = new EventInboxRepository(db);
  const spatialRepo = new SpatialRepository(db);
  const secretRepo = new SecretRepository(db);
  const npcMemoryRepo = new NpcMemoryRepository(db);
  const auraRepo = new AuraRepository(db);
  const poiRepo = new POIRepository(db);
  
  const sections: NarrativeSection[] = [];
  const isDetailed = parsed.verbosity === 'detailed';
  const isMinimal = parsed.verbosity === 'minimal';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. WORLD & ENVIRONMENT
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(parsed.worldId) as any;
    if (world) {
      let envContext = `**${world.name}**`;
      
      const env = typeof world.environment === 'string' 
        ? (world.environment ? JSON.parse(world.environment) : {})
        : (world.environment || {});
      
      const envParts: string[] = [];
      if (env.timeOfDay) envParts.push(env.timeOfDay);
      if (env.weatherConditions) envParts.push(env.weatherConditions);
      if (env.season) envParts.push(env.season);
      if (env.date) envParts.push(env.date);
      if (env.temperature) envParts.push(env.temperature);
      if (env.lighting) envParts.push(`Lighting: ${env.lighting}`);
      
      if (envParts.length > 0) {
        envContext += `\n${envParts.join(' • ')}`;
      }
      
      sections.push({
        title: '🌍 WORLD',
        content: envContext,
        priority: 10
      });
    }
  } catch (e) {
    console.warn('Failed to load world context', e);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ACTIVE CHARACTER
  // ═══════════════════════════════════════════════════════════════════════════
  let activeCharacter: any = null;
  if (parsed.characterId) {
    try {
      activeCharacter = charRepo.findById(parsed.characterId);
      if (activeCharacter) {
        const stats = activeCharacter.stats;
        
        // Basic info line
        let charContent = `**${activeCharacter.name}** — Level ${activeCharacter.level} ${activeCharacter.race} ${activeCharacter.characterClass || 'Adventurer'}`;
        charContent += `\nHP: ${activeCharacter.hp}/${activeCharacter.maxHp} | AC: ${activeCharacter.ac}`;
        
        // Stats with modifiers
        if (stats && !isMinimal) {
          charContent += `\nSTR ${stats.str}(${getModifier(stats.str)}) DEX ${stats.dex}(${getModifier(stats.dex)}) CON ${stats.con}(${getModifier(stats.con)}) INT ${stats.int}(${getModifier(stats.int)}) WIS ${stats.wis}(${getModifier(stats.wis)}) CHA ${stats.cha}(${getModifier(stats.cha)})`;
        }
        
        // Conditions
        const conditions = activeCharacter.conditions || [];
        if (conditions.length > 0) {
          charContent += `\n**Conditions:** ${formatConditions(conditions)}`;
        }
        
        // Concentration
        if (activeCharacter.concentratingOn) {
          charContent += `\n**Concentrating:** ${activeCharacter.concentratingOn}`;
        }

        // Resistances/Immunities/Vulnerabilities (if any)
        if (isDetailed) {
          if (activeCharacter.resistances?.length > 0) {
            charContent += `\n**Resistances:** ${activeCharacter.resistances.join(', ')}`;
          }
          if (activeCharacter.immunities?.length > 0) {
            charContent += `\n**Immunities:** ${activeCharacter.immunities.join(', ')}`;
          }
          if (activeCharacter.vulnerabilities?.length > 0) {
            charContent += `\n**Vulnerabilities:** ${activeCharacter.vulnerabilities.join(', ')}`;
          }
        }
        
        sections.push({
          title: '👤 ACTIVE CHARACTER',
          content: charContent,
          priority: 50
        });
      }
    } catch (e) {
      console.warn('Failed to load character context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. INVENTORY & EQUIPMENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.characterId && !isMinimal) {
    try {
      const inventory = inventoryRepo.getInventory(parsed.characterId);
      if (inventory && inventory.items.length > 0) {
        const equippedItems: string[] = [];
        const carriedItems: string[] = [];
        
        for (const invItem of inventory.items) {
          const item = itemRepo.findById(invItem.itemId);
          if (item) {
            const itemName = invItem.quantity > 1 ? `${item.name} (×${invItem.quantity})` : item.name;
            if (invItem.equipped && invItem.slot) {
              equippedItems.push(`**${invItem.slot}:** ${itemName}`);
            } else if (isDetailed) {
              carriedItems.push(itemName);
            }
          }
        }
        
        let invContent = '';
        if (equippedItems.length > 0) {
          invContent += equippedItems.join('\n');
        }
        if (isDetailed && carriedItems.length > 0) {
          invContent += `\n**Carried:** ${carriedItems.join(', ')}`;
        }
        
        // Currency
        const currency = inventory.currency;
        if (currency && (currency.gold > 0 || currency.silver > 0 || currency.copper > 0)) {
          const coinParts = [];
          if (currency.gold > 0) coinParts.push(`${currency.gold} gp`);
          if (currency.silver > 0) coinParts.push(`${currency.silver} sp`);
          if (currency.copper > 0) coinParts.push(`${currency.copper} cp`);
          invContent += `\n**Wealth:** ${coinParts.join(', ')}`;
        }
        
        if (invContent.trim()) {
          sections.push({
            title: '🎒 EQUIPMENT',
            content: invContent.trim(),
            priority: 40
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load inventory context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PARTY
  // ═══════════════════════════════════════════════════════════════════════════
  let party: any = null;
  if (parsed.partyId || parsed.characterId) {
    try {
      // Try to find party by ID or by character membership
      if (parsed.partyId) {
        party = partyRepo.findById(parsed.partyId);
      } else if (parsed.characterId) {
        // Find party containing this character
        const characterParties = partyRepo.findPartiesByCharacter(parsed.characterId);
        if (characterParties.length > 0) {
          party = characterParties[0];
        }
      }
      
      if (party) {
        const members = partyRepo.findMembersByParty(party.id);
        let partyContent = `**${party.name}**`;
        
        if (party.currentLocation) {
          partyContent += ` — ${party.currentLocation}`;
        }
        
        if (members.length > 0 && !isMinimal) {
          const memberNames = members.map(m => {
            const char = charRepo.findById(m.characterId);
            if (!char) return null;
            const role = m.role !== 'member' ? ` (${m.role})` : '';
            const hp = `${char.hp}/${char.maxHp}`;
            return `${char.name}${role} [${hp} HP]`;
          }).filter(Boolean);
          
          partyContent += `\n**Members:** ${memberNames.join(', ')}`;
        }
        
        if (party.formation && isDetailed) {
          partyContent += `\n**Formation:** ${party.formation}`;
        }
        
        sections.push({
          title: '🎪 PARTY',
          content: partyContent,
          priority: 35
        });
      }
    } catch (e) {
      console.warn('Failed to load party context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CURRENT LOCATION (Room/POI)
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeCharacter?.currentRoomId && !isMinimal) {
    try {
      const room = spatialRepo.findById(activeCharacter.currentRoomId);
      if (room) {
        let locContent = `**${room.name}**`;
        if (room.baseDescription) {
          // Truncate long descriptions
          const desc = room.baseDescription.length > 300 
            ? room.baseDescription.substring(0, 297) + '...'
            : room.baseDescription;
          locContent += `\n${desc}`;
        }
        
        // Exits are stored in the room object itself
        if (room.exits && room.exits.length > 0) {
          const exitDirs = room.exits.map((e: any) => e.direction).join(', ');
          locContent += `\n**Exits:** ${exitDirs}`;
        }
        
        // Atmospherics
        if (room.atmospherics && room.atmospherics.length > 0) {
          locContent += `\n**Atmosphere:** ${room.atmospherics.join(', ')}`;
        }
        
        sections.push({
          title: '📍 LOCATION',
          content: locContent,
          priority: 30
        });
      }
    } catch (e) {
      console.warn('Failed to load location context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. COMBAT STATE (Highest Priority when active)
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.encounterId) {
    try {
      const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(parsed.encounterId) as any;
      if (encounter && encounter.status === 'active') {
        const state = typeof encounter.state === 'string' ? JSON.parse(encounter.state) : encounter.state;
        
        if (state && typeof state === 'object') {
          const round = state.round ?? 1;
          let combatContent = `⚠️ **COMBAT ACTIVE** — Round ${round}`;
          
          const participants = state.participants || [];
          const allies = participants.filter((p: any) => !p.isEnemy && p.hp > 0);
          const enemies = participants.filter((p: any) => p.isEnemy && p.hp > 0);
          const defeated = participants.filter((p: any) => p.hp <= 0);
          
          // Current turn
          if (state.currentTurn !== undefined && participants[state.currentTurn]) {
            combatContent += `\n**Current Turn:** ${participants[state.currentTurn].name}`;
          }
          
          // Initiative order summary
          if (!isMinimal) {
            combatContent += `\n\n**Allies:** ${allies.map((p: any) => `${p.name} (${p.hp}HP)`).join(', ') || 'None'}`;
            combatContent += `\n**Enemies:** ${enemies.map((p: any) => `${p.name} (${p.hp}HP)`).join(', ') || 'None'}`;
            if (defeated.length > 0) {
              combatContent += `\n**Defeated:** ${defeated.map((p: any) => p.name).join(', ')}`;
            }
          }
          
          // Lair action pending
          if (state.isLairActionPending) {
            combatContent += `\n\n🏰 **LAIR ACTION PENDING** at initiative 20`;
          }
          
          sections.push({
            title: '⚔️ COMBAT',
            content: combatContent,
            priority: 100 // Highest priority - combat is immediate
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load combat context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ACTIVE QUESTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.characterId && !isMinimal) {
    try {
      const questLog = questRepo.getFullQuestLog(parsed.characterId);
      const activeQuests = questLog.quests.filter(q => q.logStatus === 'active');
      
      if (activeQuests.length > 0) {
        let questContent = '';
        for (const quest of activeQuests.slice(0, isDetailed ? 5 : 3)) {
          questContent += `**${quest.name}**`;
          if (quest.objectives && quest.objectives.length > 0) {
            const incomplete = quest.objectives.filter((o: any) => !o.completed);
            if (incomplete.length > 0) {
              questContent += `: ${incomplete[0].description}`;
              if (incomplete.length > 1) {
                questContent += ` (+${incomplete.length - 1} more)`;
              }
            }
          }
          questContent += '\n';
        }
        
        if (activeQuests.length > (isDetailed ? 5 : 3)) {
          questContent += `*...and ${activeQuests.length - (isDetailed ? 5 : 3)} more quests*`;
        }
        
        sections.push({
          title: '📜 ACTIVE QUESTS',
          content: questContent.trim(),
          priority: 25
        });
      }
    } catch (e) {
      console.warn('Failed to load quest context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. NPC RELATIONSHIPS (With staleness trimming)
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.characterId && !isMinimal) {
    try {
      const relationships = npcMemoryRepo.getCharacterRelationships(parsed.characterId);
      
      // Filter out stale relationships
      const freshRelationships = relationships.filter(r => 
        !isStale(r.lastInteractionAt, parsed.relationshipStaleHours)
      );
      
      if (freshRelationships.length > 0) {
        let relContent = '';
        const dispositionEmoji: Record<string, string> = {
          'hostile': '😠',
          'unfriendly': '😒',
          'neutral': '😐',
          'friendly': '🙂',
          'helpful': '😊'
        };
        
        for (const rel of freshRelationships.slice(0, isDetailed ? 8 : 4)) {
          const npc = charRepo.findById(rel.npcId);
          const npcName = npc?.name || 'Unknown NPC';
          const emoji = dispositionEmoji[rel.disposition] || '•';
          const timeAgo = formatTimeAgo(rel.lastInteractionAt);
          
          relContent += `${emoji} **${npcName}** — ${rel.familiarity}, ${rel.disposition} (${timeAgo})\n`;
        }
        
        if (freshRelationships.length > (isDetailed ? 8 : 4)) {
          relContent += `*...and ${freshRelationships.length - (isDetailed ? 8 : 4)} more NPCs*`;
        }
        
        sections.push({
          title: '🤝 NPC RELATIONSHIPS',
          content: relContent.trim(),
          priority: 22
        });
      }
    } catch (e) {
      console.warn('Failed to load NPC relationships', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. NEARBY POIS (When party has map position)
  // ═══════════════════════════════════════════════════════════════════════════
  if (party && !isMinimal) {
    try {
      const partyPos = partyRepo.getPartyPosition(party.id);
      
      if (partyPos && partyPos.x !== null && partyPos.y !== null) {
        const nearbyPois = poiRepo.findNearby(parsed.worldId, partyPos.x, partyPos.y, parsed.nearbyPoiRadius);
        
        // Exclude current POI
        const otherPois = nearbyPois.filter(p => p.id !== partyPos.poiId);
        
        if (otherPois.length > 0) {
          let poiContent = '';
          const iconEmoji: Record<string, string> = {
            'city': '🏙️', 'town': '🏘️', 'village': '🏚️', 'castle': '🏰',
            'fort': '🏯', 'tower': '🗼', 'dungeon': '⬛', 'cave': '🕳️',
            'ruins': '🏛️', 'temple': '⛪', 'shrine': '🛕', 'inn': '🏨',
            'market': '🏪', 'mine': '⛏️', 'farm': '🌾', 'camp': '⛺',
            'portal': '🌀', 'monument': '🗿', 'tree': '🌲', 'mountain': '⛰️',
            'lake': '💧', 'waterfall': '🌊', 'bridge': '🌉', 'crossroads': '✚'
          };
          
          for (const poi of otherPois.slice(0, isDetailed ? 6 : 3)) {
            const emoji = iconEmoji[poi.icon || ''] || '📍';
            // Calculate rough distance
            const dx = poi.x - partyPos.x;
            const dy = poi.y - partyPos.y;
            const dist = Math.round(Math.sqrt(dx*dx + dy*dy));
            const direction = getCardinalDirection(dx, dy);
            
            poiContent += `${emoji} **${poi.name}** — ${dist} tiles ${direction}`;
            if (poi.discoveryState === 'rumored') poiContent += ' *(rumored)*';
            if (poi.discoveryState === 'unknown') poiContent += ' *(unexplored)*';
            poiContent += '\n';
          }
          
          if (otherPois.length > (isDetailed ? 6 : 3)) {
            poiContent += `*...and ${otherPois.length - (isDetailed ? 6 : 3)} more locations nearby*`;
          }
          
          sections.push({
            title: '🗺️ NEARBY LOCATIONS',
            content: poiContent.trim(),
            priority: 18
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load nearby POIs', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. ACTIVE AURAS AFFECTING CHARACTER
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.characterId && !isMinimal) {
    try {
      const allAuras = auraRepo.findAll();
      
      if (allAuras.length > 0) {
        // Filter auras that affect this character (simplified - owner's auras)
        // Full spatial checking would require encounter context
        const relevantAuras = allAuras.filter(a => 
          a.ownerId === parsed.characterId ||  // Character's own auras
          a.affectsAllies // Or ally auras that might affect them
        );
        
        if (relevantAuras.length > 0) {
          let auraContent = '';
          for (const aura of relevantAuras.slice(0, 5)) {
            const ownerName = aura.ownerId === parsed.characterId 
              ? 'You' 
              : charRepo.findById(aura.ownerId)?.name || 'Unknown';
            
            auraContent += `• **${aura.spellName}** (${ownerName})`;
            auraContent += ` — ${aura.radius}ft radius`;
            if (aura.requiresConcentration) auraContent += ' ⚡';
            auraContent += '\n';
          }
          
          sections.push({
            title: '✨ ACTIVE AURAS',
            content: auraContent.trim(),
            priority: 45 // High priority - affects combat
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load aura context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. REST & EXHAUSTION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.characterId && parsed.includeRestTracking && !isMinimal) {
    try {
      // Get last rest time from character or lookup
      const char = activeCharacter || charRepo.findById(parsed.characterId);
      
      if (char) {
        let restContent = '';
        
        // Check for exhaustion condition
        const exhaustionLevels = (char.conditions || [])
          .filter((c: any) => {
            const name = typeof c === 'string' ? c : c.name;
            return name.toLowerCase().includes('exhaust');
          });
        
        if (exhaustionLevels.length > 0) {
          restContent += `⚠️ **Exhaustion:** ${formatConditions(exhaustionLevels)}\n`;
        }
        
        // Check last rest from rest_log table (if exists)
        try {
          const lastRest = db.prepare(`
            SELECT * FROM rest_log 
            WHERE character_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
          `).get(parsed.characterId) as any;
          
          if (lastRest) {
            const restType = lastRest.rest_type === 'long' ? 'Long rest' : 'Short rest';
            restContent += `💤 **Last rest:** ${restType} ${formatTimeAgo(lastRest.created_at)}`;
          }
        } catch {
          // rest_log table may not exist - that's fine
        }
        
        // Hit dice remaining (if tracked on character)
        if (char.hitDice !== undefined && char.maxHitDice !== undefined) {
          restContent += `\n🎲 **Hit Dice:** ${char.hitDice}/${char.maxHitDice} remaining`;
        }
        
        if (restContent.trim()) {
          sections.push({
            title: '😴 REST STATUS',
            content: restContent.trim(),
            priority: 28
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load rest tracking', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. RECENT EVENTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (parsed.maxEvents > 0 && !isMinimal) {
    try {
      const events = eventRepo.getHistory({ limit: parsed.maxEvents, includeConsumed: true });
      if (events.length > 0) {
        let eventContent = '';
        for (const event of events) {
          const payload = event.payload;
          switch (event.eventType) {
            case 'npc_action':
              if (payload.message) {
                eventContent += `• **${payload.npcName}** ${payload.action}: "${payload.message}"\n`;
              } else {
                eventContent += `• **${payload.npcName || 'Someone'}** ${payload.action}\n`;
              }
              break;
            case 'world_change':
              eventContent += `• 🌍 ${payload.description || payload.change}\n`;
              break;
            case 'quest_update':
              eventContent += `• 📜 Quest "${payload.questName}": ${payload.update}\n`;
              break;
            case 'combat_update':
              eventContent += `• ⚔️ ${payload.description}\n`;
              break;
            default:
              if (payload.description || payload.message) {
                eventContent += `• ${payload.description || payload.message}\n`;
              }
          }
        }
        
        if (eventContent.trim()) {
          sections.push({
            title: '📰 RECENT EVENTS',
            content: eventContent.trim(),
            priority: 20
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load event context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. NARRATIVE NOTES (Plot threads, foreshadowing)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!parsed.forPlayer && !isMinimal) {
    try {
      const notes = db.prepare(`
        SELECT * FROM narrative_notes 
        WHERE world_id = ? AND status = 'active' 
        ORDER BY created_at DESC LIMIT 5
      `).all(parsed.worldId) as any[];
      
      if (notes.length > 0) {
        let noteContent = '';
        for (const note of notes) {
          const typeEmoji: Record<string, string> = {
            'plot_thread': '🧵',
            'foreshadowing': '🔮',
            'canonical_moment': '📖',
            'npc_voice': '🗣️',
            'session_log': '📝'
          };
          const emoji = typeEmoji[note.type] || '•';
          
          noteContent += `${emoji} **${note.type.replace('_', ' ')}:** ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}\n`;
        }
        
        sections.push({
          title: '📓 NARRATIVE NOTES',
          content: noteContent.trim(),
          priority: 15
        });
      }
    } catch (e) {
      console.warn('Failed to load narrative notes', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. SECRETS (DM Only)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!parsed.forPlayer) {
    try {
      const secretContext = secretRepo.formatForLLM(parsed.worldId);
      if (secretContext && secretContext.length > 50) {
        sections.push({
          title: '🔒 DM SECRETS — DO NOT REVEAL',
          content: secretContext,
          priority: 90
        });
      }
    } catch (e) {
      console.warn('Failed to load secret context', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSEMBLE FINAL OUTPUT
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Sort by priority (highest first)
  sections.sort((a, b) => b.priority - a.priority);

  // Format output
  const divider = '─'.repeat(50);
  const finalContext = sections.map(s => {
    return `${divider}\n${s.title}\n${divider}\n${s.content}`;
  }).join('\n\n');

  // Also return structured data for programmatic use
  const structuredData = {
    worldId: parsed.worldId,
    characterId: parsed.characterId,
    encounterId: parsed.encounterId,
    partyId: party?.id,
    sectionCount: sections.length,
    hasCombat: sections.some(s => s.title.includes('COMBAT')),
    hasSecrets: sections.some(s => s.title.includes('SECRETS')),
    hasActiveAuras: sections.some(s => s.title.includes('AURAS')),
    hasNpcRelationships: sections.some(s => s.title.includes('NPC RELATIONSHIPS')),
    hasNearbyPois: sections.some(s => s.title.includes('NEARBY LOCATIONS')),
    verbosity: parsed.verbosity
  };

  return {
    content: [{
      type: 'text' as const,
      text: finalContext || '(No context available for the specified parameters)'
    }],
    _meta: structuredData
  };
}
