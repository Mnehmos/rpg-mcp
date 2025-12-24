import { z } from 'zod';
import { randomUUID } from 'crypto';
import { QuestRepository } from '../storage/repos/quest.repo.js';
import { CharacterRepository } from '../storage/repos/character.repo.js';
import { InventoryRepository } from '../storage/repos/inventory.repo.js';
import { ItemRepository } from '../storage/repos/item.repo.js';
import { QuestSchema } from '../schema/quest.js';
import { getDb } from '../storage/index.js';
import { SessionContext } from './types.js';
import { RichFormatter } from './utils/formatter.js';

function ensureDb() {
    const dbPath = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : process.env.RPG_DATA_DIR
            ? `${process.env.RPG_DATA_DIR}/rpg.db`
            : 'rpg.db';
    const db = getDb(dbPath);
    const questRepo = new QuestRepository(db);
    const characterRepo = new CharacterRepository(db);
    const inventoryRepo = new InventoryRepository(db);
    const itemRepo = new ItemRepository(db);
    return { questRepo, characterRepo, inventoryRepo, itemRepo };
}

export const QuestTools = {
    CREATE_QUEST: {
        name: 'create_quest',
        description: 'Define a new quest in the world.',
        inputSchema: QuestSchema.omit({ id: true, createdAt: true, updatedAt: true })
    },
    GET_QUEST: {
        name: 'get_quest',
        description: 'Get a single quest by ID with full details.',
        inputSchema: z.object({
            questId: z.string()
        })
    },
    LIST_QUESTS: {
        name: 'list_quests',
        description: 'List all quests, optionally filtered by world.',
        inputSchema: z.object({
            worldId: z.string().optional()
        })
    },
    ASSIGN_QUEST: {
        name: 'assign_quest',
        description: 'Assign a quest to a character.',
        inputSchema: z.object({
            characterId: z.string(),
            questId: z.string()
        })
    },
    UPDATE_OBJECTIVE: {
        name: 'update_objective',
        description: 'Update progress on a quest objective.',
        inputSchema: z.object({
            characterId: z.string(),
            questId: z.string(),
            objectiveId: z.string(),
            progress: z.number().int().min(1).default(1)
        })
    },
    COMPLETE_OBJECTIVE: {
        name: 'complete_objective',
        description: 'Mark an objective as fully completed.',
        inputSchema: z.object({
            questId: z.string(),
            objectiveId: z.string()
        })
    },
    COMPLETE_QUEST: {
        name: 'complete_quest',
        description: 'Mark a quest as completed and grant rewards.',
        inputSchema: z.object({
            characterId: z.string(),
            questId: z.string()
        })
    },
    GET_QUEST_LOG: {
        name: 'get_quest_log',
        description: 'Get the quest log for a character.',
        inputSchema: z.object({
            characterId: z.string()
        })
    }
} as const;

export async function handleCreateQuest(args: unknown, _ctx: SessionContext) {
    const { questRepo } = ensureDb();
    const parsed = QuestTools.CREATE_QUEST.inputSchema.parse(args);

    const now = new Date().toISOString();

    // Ensure all objectives have IDs
    const objectives = parsed.objectives.map(obj => ({
        ...obj,
        id: obj.id || randomUUID(),
        current: obj.current ?? 0,
        completed: obj.completed ?? false
    }));

    const quest = {
        ...parsed,
        objectives,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
    };

    questRepo.create(quest);

    let output = RichFormatter.quest(quest as any);
    output += RichFormatter.success('Quest created!');
    output += RichFormatter.embedJson(quest, 'QUEST');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetQuest(args: unknown, _ctx: SessionContext) {
    const { questRepo } = ensureDb();
    const parsed = QuestTools.GET_QUEST.inputSchema.parse(args);

    const quest = questRepo.findById(parsed.questId);
    if (!quest) {
        throw new Error(`Quest ${parsed.questId} not found`);
    }

    let output = RichFormatter.quest(quest as any);
    output += RichFormatter.embedJson(quest, 'QUEST');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleListQuests(args: unknown, _ctx: SessionContext) {
    const { questRepo } = ensureDb();
    const parsed = QuestTools.LIST_QUESTS.inputSchema.parse(args);

    const quests = questRepo.findAll(parsed.worldId);

    let output = RichFormatter.header('Quests', '📜');
    if (quests.length === 0) {
        output += RichFormatter.alert('No quests found.', 'info');
    } else {
        const rows = quests.map((q: any) => [q.name, q.status || 'active', String(q.objectives?.length || 0)]);
        output += RichFormatter.table(['Name', 'Status', 'Objectives'], rows);
        output += `\n*${quests.length} quest(s) total*\n`;
    }
    output += RichFormatter.embedJson({ quests, count: quests.length }, 'QUESTS');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleAssignQuest(args: unknown, _ctx: SessionContext) {
    const { questRepo, characterRepo } = ensureDb();
    const parsed = QuestTools.ASSIGN_QUEST.inputSchema.parse(args);

    const character = characterRepo.findById(parsed.characterId);
    if (!character) throw new Error(`Character ${parsed.characterId} not found`);

    const quest = questRepo.findById(parsed.questId);
    if (!quest) throw new Error(`Quest ${parsed.questId} not found`);

    let log = questRepo.getLog(parsed.characterId);
    if (!log) {
        log = {
            characterId: parsed.characterId,
            activeQuests: [],
            completedQuests: [],
            failedQuests: []
        };
    }

    if (log.activeQuests.includes(parsed.questId)) {
        throw new Error(`Quest ${parsed.questId} is already active for character ${parsed.characterId}`);
    }
    if (log.completedQuests.includes(parsed.questId)) {
        throw new Error(`Quest ${parsed.questId} is already completed by character ${parsed.characterId}`);
    }

    // Check prerequisites
    for (const prereqId of quest.prerequisites) {
        if (!log.completedQuests.includes(prereqId)) {
            const prereqQuest = questRepo.findById(prereqId);
            const prereqName = prereqQuest?.name || prereqId;
            throw new Error(`Prerequisite quest "${prereqName}" not completed`);
        }
    }

    log.activeQuests.push(parsed.questId);
    questRepo.updateLog(log);

    let output = RichFormatter.header('Quest Assigned', '📜');
    output += RichFormatter.keyValue({
        'Quest': quest.name,
        'Character': character.name,
    });
    output += RichFormatter.success(`${character.name} has accepted the quest!`);
    output += RichFormatter.embedJson({ quest }, 'QUEST');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleUpdateObjective(args: unknown, _ctx: SessionContext) {
    const { questRepo, characterRepo } = ensureDb();
    const parsed = QuestTools.UPDATE_OBJECTIVE.inputSchema.parse(args);

    // Verify character exists and has this quest
    const character = characterRepo.findById(parsed.characterId);
    if (!character) throw new Error(`Character ${parsed.characterId} not found`);

    const log = questRepo.getLog(parsed.characterId);
    if (!log || !log.activeQuests.includes(parsed.questId)) {
        throw new Error(`Quest ${parsed.questId} is not active for character ${parsed.characterId}`);
    }

    const quest = questRepo.findById(parsed.questId);
    if (!quest) throw new Error(`Quest ${parsed.questId} not found`);

    const objectiveIndex = quest.objectives.findIndex(o => o.id === parsed.objectiveId);
    if (objectiveIndex === -1) throw new Error(`Objective ${parsed.objectiveId} not found in quest`);

    // Update progress
    const updatedQuest = questRepo.updateObjectiveProgress(
        parsed.questId,
        parsed.objectiveId,
        parsed.progress
    );

    if (!updatedQuest) {
        throw new Error('Failed to update objective progress');
    }

    const objective = updatedQuest.objectives[objectiveIndex];

    // Check if all objectives are now complete
    const allComplete = questRepo.areAllObjectivesComplete(parsed.questId);

    let output = RichFormatter.header('Objective Progress', '✅');
    output += RichFormatter.keyValue({
        'Quest': updatedQuest.name,
        'Objective': objective.description,
        'Progress': `${objective.current}/${objective.required}`,
        'Completed': objective.completed ? 'Yes' : 'No',
    });
    if (allComplete) {
        output += RichFormatter.success('🎉 All objectives complete! Ready to turn in.');
    }
    output += RichFormatter.embedJson({ objective, questComplete: allComplete, quest: updatedQuest }, 'OBJECTIVE');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleCompleteObjective(args: unknown, _ctx: SessionContext) {
    const { questRepo } = ensureDb();
    const parsed = QuestTools.COMPLETE_OBJECTIVE.inputSchema.parse(args);

    const quest = questRepo.findById(parsed.questId);
    if (!quest) throw new Error(`Quest ${parsed.questId} not found`);

    const objectiveIndex = quest.objectives.findIndex(o => o.id === parsed.objectiveId);
    if (objectiveIndex === -1) throw new Error(`Objective ${parsed.objectiveId} not found`);

    const updatedQuest = questRepo.completeObjective(parsed.questId, parsed.objectiveId);
    if (!updatedQuest) {
        throw new Error('Failed to complete objective');
    }

    const objective = updatedQuest.objectives[objectiveIndex];
    const allComplete = questRepo.areAllObjectivesComplete(parsed.questId);

    let output = RichFormatter.header('Objective Completed', '☑️');
    output += RichFormatter.keyValue({
        'Quest': updatedQuest.name,
        'Objective': objective.description,
    });
    output += RichFormatter.success('Objective marked as complete!');
    if (allComplete) {
        output += RichFormatter.alert('🎉 All objectives complete! Ready to turn in.', 'success');
    }
    output += RichFormatter.embedJson({ objective, questComplete: allComplete, quest: updatedQuest }, 'OBJECTIVE');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleCompleteQuest(args: unknown, _ctx: SessionContext) {
    const { questRepo, characterRepo, inventoryRepo, itemRepo } = ensureDb();
    const parsed = QuestTools.COMPLETE_QUEST.inputSchema.parse(args);

    const character = characterRepo.findById(parsed.characterId);
    if (!character) throw new Error(`Character ${parsed.characterId} not found`);

    const quest = questRepo.findById(parsed.questId);
    if (!quest) throw new Error(`Quest ${parsed.questId} not found`);

    let log = questRepo.getLog(parsed.characterId);
    if (!log || !log.activeQuests.includes(parsed.questId)) {
        throw new Error(`Quest "${quest.name}" is not active for character ${character.name}`);
    }

    // Verify all objectives are completed
    const allCompleted = quest.objectives.every(o => o.completed);
    if (!allCompleted) {
        const incomplete = quest.objectives.filter(o => !o.completed);
        throw new Error(`Not all objectives completed. Remaining: ${incomplete.map(o => o.description).join(', ')}`);
    }

    // Grant rewards
    const rewardsGranted: { xp?: number; gold?: number; items: string[] } = {
        items: []
    };

    // Grant XP (update character - need to check if character schema supports xp)
    if (quest.rewards.experience > 0) {
        rewardsGranted.xp = quest.rewards.experience;
        // Note: Character XP tracking would need to be added to character schema
        // For now, we just report it
    }

    // Grant gold
    if (quest.rewards.gold > 0) {
        rewardsGranted.gold = quest.rewards.gold;
        // Note: Gold tracking would need to be added to character or inventory system
        // For now, we just report it
    }

    // Grant items
    for (const itemId of quest.rewards.items) {
        try {
            inventoryRepo.addItem(parsed.characterId, itemId, 1);
            const item = itemRepo.findById(itemId);
            rewardsGranted.items.push(item?.name || itemId);
        } catch (err) {
            // Item may not exist, still complete the quest
            rewardsGranted.items.push(`${itemId} (item not found)`);
        }
    }

    // Update quest log
    log.activeQuests = log.activeQuests.filter(id => id !== parsed.questId);
    log.completedQuests.push(parsed.questId);
    questRepo.updateLog(log);

    // Update quest status
    questRepo.update(parsed.questId, { status: 'completed' });

    let output = RichFormatter.header('Quest Completed!', '🎉');
    output += RichFormatter.keyValue({
        'Quest': quest.name,
        'Character': character.name,
    });
    output += RichFormatter.section('Rewards');
    output += RichFormatter.keyValue({
        'XP': rewardsGranted.xp || 0,
        'Gold': rewardsGranted.gold || 0,
    });
    if (rewardsGranted.items.length > 0) {
        output += RichFormatter.subSection('Items');
        output += RichFormatter.list(rewardsGranted.items);
    }
    output += RichFormatter.success('Congratulations!');
    output += RichFormatter.embedJson({ quest, rewards: rewardsGranted }, 'COMPLETE');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetQuestLog(args: unknown, _ctx: SessionContext) {
    const { questRepo, characterRepo } = ensureDb();
    const parsed = QuestTools.GET_QUEST_LOG.inputSchema.parse(args);

    // Verify character exists
    const character = characterRepo.findById(parsed.characterId);
    if (!character) {
        throw new Error(`Character ${parsed.characterId} not found`);
    }

    // Get full quest log with complete quest data
    const fullLog = questRepo.getFullQuestLog(parsed.characterId);

    // Transform to frontend-friendly format
    const quests = fullLog.quests.map(quest => ({
        id: quest.id,
        title: quest.name,
        name: quest.name,
        description: quest.description,
        status: quest.logStatus,
        questGiver: quest.giver,
        objectives: quest.objectives.map(obj => ({
            id: obj.id,
            description: obj.description,
            type: obj.type,
            target: obj.target,
            current: obj.current,
            required: obj.required,
            completed: obj.completed,
            progress: `${obj.current}/${obj.required}`
        })),
        rewards: {
            experience: quest.rewards.experience,
            gold: quest.rewards.gold,
            items: quest.rewards.items
        },
        prerequisites: quest.prerequisites
    }));

    let output = RichFormatter.header(`${character.name}'s Quest Log`, '📖');
    output += RichFormatter.keyValue({ 'Summary': `${fullLog.summary.active} active, ${fullLog.summary.completed} completed, ${fullLog.summary.failed} failed` });

    if (quests.length === 0) {
        output += RichFormatter.alert('No quests in log.', 'info');
    } else {
        for (const quest of quests) {
            const statusIcon = quest.status === 'completed' ? '✅' : quest.status === 'failed' ? '❌' : '📜';
            output += `\n${statusIcon} **${quest.name}** (${quest.status})\n`;
            if (quest.objectives && quest.objectives.length > 0) {
                for (const obj of quest.objectives) {
                    const check = obj.completed ? '☑️' : '☐';
                    output += `  ${check} ${obj.description} (${obj.current}/${obj.required})\n`;
                }
            }
        }
    }
    output += RichFormatter.embedJson({ characterId: parsed.characterId, characterName: character.name, quests, summary: fullLog.summary }, 'QUESTLOG');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}
