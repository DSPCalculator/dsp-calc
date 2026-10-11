import {isPileSorterLevel, migratePileSorter} from './pile-sorter.js';
import {isStorageRecord} from './storage.js';
import {normalizeSourceIds} from './source-storage.js';
import {migrateSchemeForGame} from './game-data-migrations.js';

export const PLAN_VERSION = 1;

/** Engine independence and ownership differ: a surplus fork is still plan-owned. */
export function isPlanOwnedSource(source) {
    if (source?.scope === 'plan') return true;
    if (source?.scope === 'global' || source?.standalone === true) return false;
    // Keep malformed records visible for recovery, without manufacturing output.
    return !source?.migration_error;
}

export function targetIdentity(needs) {
    return JSON.stringify(Object.keys(needs).sort());
}

export function clearPlanSources(settings) {
    const sources = settings.production_sources || [];
    const retained = sources.filter(source => !isPlanOwnedSource(source));
    return retained.length === sources.length ? settings : {...settings, production_sources: retained};
}

/** Old global records have no reliable owner. Archive them, never reactivate them. */
export function retireUnscopedPlanSources(settings) {
    const retired = (settings.production_sources || []).filter(isPlanOwnedSource);
    if (!retired.length) return settings;
    const backup = settings.production_sources_plan_backup;
    const previous = Array.isArray(backup) ? backup : backup === undefined ? [] : [{original_backup: backup}];
    return {...clearPlanSources(settings), production_sources_plan_backup: [...previous, ...retired]};
}

/** Automatic settings persistence deliberately omits the current plan's forks. */
export function settingsForAutosave(settings) {
    return clearPlanSources(settings);
}

function snapshotSettings(settings) {
    return Object.fromEntries(Object.entries(settings).filter(([key]) =>
        !key.endsWith('_backup') && key !== 'natural_production_line'));
}

export function createNeedsPlanSnapshot(needs_list, scheme_data, settings, game_name) {
    return {plan_version: PLAN_VERSION, game_name, needs_list, scheme_data, settings: snapshotSettings(settings)};
}

/** Strategy presets have no target owner and must not carry transient forks. */
export function createStrategySnapshot(scheme_data, settings) {
    return {...scheme_data, production_sources: clearPlanSources(settings).production_sources || []};
}

function validateNeeds(needs, game_info) {
    if (!isStorageRecord(needs) || Object.entries(needs).some(([item, count]) =>
        !Object.hasOwn(game_info.item_data, item) || !Number.isFinite(count) || count <= 0)) {
        throw new Error('方案中的需求列表格式不正确，当前计算未被修改。');
    }
    return needs;
}

function validateScheme(scheme, game_info) {
    const game = game_info.game_data;
    scheme = migrateSchemeForGame(scheme, game);
    if (!isStorageRecord(scheme) || !isStorageRecord(scheme.item_recipe_choices)
        || (Object.hasOwn(scheme, 'pile_sorter_level') && !isPileSorterLevel(scheme.pile_sorter_level))
        || (Object.hasOwn(scheme, 'use_pile_sorter') && typeof scheme.use_pile_sorter !== 'boolean')
        || !Array.isArray(scheme.scheme_for_recipe)
        || scheme.scheme_for_recipe.length !== game.recipe_data.length
        || !isStorageRecord(scheme.cost_weight)
        || !isStorageRecord(scheme.cost_weight['建筑成本'])
        || !isStorageRecord(scheme.cost_weight['物品额外成本'])
        || Object.entries(game_info.item_data).some(([item, choices]) => {
            const choice = Number(scheme.item_recipe_choices[item]);
            return !Number.isInteger(choice) || choice < 1 || choices[choice] === undefined
                || !isStorageRecord(scheme.cost_weight['物品额外成本'][item]);
        })
        || scheme.scheme_for_recipe.some((config, index) => !isStorageRecord(config)
            || !Number.isInteger(Number(config['建筑']))
            || !game.factory_data[game.recipe_data[index]['设施']]?.[config['建筑']]
            || !Number.isInteger(Number(config['增产模式'])) || Number(config['增产模式']) < 0 || Number(config['增产模式']) > 4
            || !Number.isInteger(Number(config['增产点数'])) || !game.proliferator_effect[config['增产点数']])) {
        throw new Error('方案中的生产策略不匹配当前游戏版本，当前计算未被修改。');
    }
    return migratePileSorter(scheme);
}

function validateSources(sources) {
    if (!Array.isArray(sources)) throw new Error('方案中的产线来源格式不正确，当前计算未被修改。');
    return normalizeSourceIds(sources);
}

const NUMERIC_SETTINGS = new Set(['covered_veins_small', 'covered_veins_large', 'mining_efficiency_large',
    'mining_speed_multiple', 'enemy_drop_multiple', 'icarus_manufacturing_speed', 'fractionating_speed',
    'stack_research_lab', 'acc_rate', 'inc_rate']);
const BOOLEAN_SETTINGS = new Set(['hide_mines', 'is_time_unit_minute', 'proliferate_itself', 'blue_buff']);
const INTEGER_SETTINGS = new Set(['covered_veins_small', 'covered_veins_large', 'stack_research_lab']);

function validateSettings(settings) {
    const invalid = !isStorageRecord(settings) || Object.entries(settings).some(([key, value]) => {
        if (key === 'mineralize_list') return !isStorageRecord(value);
        if (key === 'fixed_num') return !Number.isInteger(value) || value < 0 || value > 100;
        if (BOOLEAN_SETTINGS.has(key)) return typeof value !== 'boolean';
        if (NUMERIC_SETTINGS.has(key) || key.startsWith('mining_speed_')) {
            return !Number.isFinite(value) || value <= 0 || (INTEGER_SETTINGS.has(key) && !Number.isInteger(value));
        }
        return false;
    });
    if (invalid) throw new Error('方案中的计算设置格式不正确，当前计算未被修改。');
    return settings;
}

/** Validate outside the React updater so a failed load cannot partially modify state. */
export function decodeSavedPlan(saved, kind, game_info) {
    if (!isStorageRecord(saved)) throw new Error('保存的方案格式不正确，当前计算未被修改。');
    if (Object.hasOwn(saved, 'plan_version')) {
        if (kind !== 'needs' || saved.plan_version !== PLAN_VERSION) throw new Error('此方案版本暂不支持，当前计算未被修改。');
        if (saved.game_name !== game_info.game_data.game_name) throw new Error('此方案不属于当前游戏版本，当前计算未被修改。');
        const settings = validateSettings(saved.settings);
        return {
            complete: true,
            needs_list: validateNeeds(saved.needs_list, game_info),
            scheme_data: validateScheme(saved.scheme_data, game_info),
            settings: {...snapshotSettings(settings), natural_production_line: [],
                production_sources: validateSources(settings.production_sources)},
        };
    }
    if (kind === 'needs') return {complete: false, needs_list: validateNeeds(saved, game_info)};
    const {production_sources = [], ...scheme} = saved;
    return {complete: false, scheme_data: validateScheme(scheme, game_info),
        production_sources: validateSources(production_sources)};
}
