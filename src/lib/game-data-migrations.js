const isStorageRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const VANILLA_HOLO_REVISION = 'vanilla-0.10.31.24710+holo-beacon-0.10.34';
export const VANILLA_DARK_FOG_REVISION = `${VANILLA_HOLO_REVISION}+dark-fog-lens-crafting-0.10.35`;
export const VANILLA_DARK_FOG_RECEIVING_REVISION = `${VANILLA_DARK_FOG_REVISION}+dark-fog-lens-receiving-steady-state`;
export const LEGACY_VANILLA_RECIPE_COUNT = 238;

const additions = [
    {index: 238, id: 161, name: '全息信标'},
    {index: 239, id: 162, name: '黑雾引力透镜'},
    // A third recipe for an existing item: never add or replace its choice/cost.
    {index: 240, id: 31208},
];
const currentRecipeCount = LEGACY_VANILLA_RECIPE_COUNT + additions.length;

/** Recognize only the known append-only shapes, including their item defaults. */
function hasKnownVanillaShape(saved) {
    if (!isStorageRecord(saved) || !isStorageRecord(saved.item_recipe_choices)
        || !Array.isArray(saved.scheme_for_recipe)
        || !isStorageRecord(saved.cost_weight)
        || !isStorageRecord(saved.cost_weight['物品额外成本'])) return false;
    const count = saved.scheme_for_recipe.length;
    if (count < LEGACY_VANILLA_RECIPE_COUNT || count > currentRecipeCount) return false;
    const photonChoice = Number(saved.item_recipe_choices['临界光子']);
    if (!Number.isInteger(photonChoice) || photonChoice < 1
        || photonChoice > (count === currentRecipeCount ? 3 : 2)) return false;
    return additions.filter(({name}) => name).every(({index, name}) => index < count
        ? saved.item_recipe_choices[name] === 1 && isStorageRecord(saved.cost_weight['物品额外成本'][name])
        : !Object.hasOwn(saved.item_recipe_choices, name) && !Object.hasOwn(saved.cost_weight['物品额外成本'], name));
}

/**
 * A deliberately narrow append-only migration, not a generic length repair.
 * The 238/239/240-recipe predecessors retain every recipe ordinal and per-item
 * choice, including either original receiver option. Tests pin all prefixes.
 */
export function migrateSchemeForGame(saved, game) {
    if (game.game_name !== 'Vanilla' || game.data_revision !== VANILLA_DARK_FOG_RECEIVING_REVISION
        || game.recipe_data.length !== currentRecipeCount
        || additions.some(({index, id}) => game.recipe_ids?.[index] !== id)
        || !hasKnownVanillaShape(saved)
        || saved.scheme_for_recipe.length === currentRecipeCount) return saved;

    const migrated = structuredClone(saved);
    for (const {index, name} of additions) {
        if (index < saved.scheme_for_recipe.length) continue;
        migrated.scheme_for_recipe.push({'建筑': 0, '增产点数': 0, '增产模式': 0});
        if (!name) continue;
        migrated.item_recipe_choices[name] = 1;
        migrated.cost_weight['物品额外成本'][name] = {
            '成本': 0, '启用': 0, '与其它成本累计': 0, '溢出时处理成本': 0,
        };
    }
    return migrated;
}

/** Archive replacements of known old shapes, including earlier 238 → 239 saves. */
export function isReplacedLegacyVanillaScheme(before, after) {
    return hasKnownVanillaShape(before) && hasKnownVanillaShape(after)
        && before.scheme_for_recipe.length < after.scheme_for_recipe.length;
}
