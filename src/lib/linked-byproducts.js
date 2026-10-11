const EPSILON = 1e-8;
const positive = value => Number.isFinite(Number(value)) && Number(value) > EPSILON ? Number(value) : 0;
const entries = record => Object.entries(record || {}).map(([item, amount]) => [item, positive(amount)])
    .filter(([, amount]) => amount > 0);
const add = (totals, item, amount) => totals.set(item, (totals.get(item) || 0) + amount);

/**
 * Read-only links to physical coproduct sources in one existing calculation.
 * Rates are already in display units. Links do not add production, machinery,
 * allocations or consumer routing, and are never part of the saved plan.
 */
export function buildLinkedByproducts(state, needs, calculation) {
    const [production = {}, , details] = calculation || [];
    const byItem = new Map();
    const required = new Map(entries(needs));
    const incoming = new Map(Object.entries(needs || {}).filter(([, amount]) =>
        Number.isFinite(Number(amount)) && Number(amount) < 0).map(([item, amount]) => [item, -Number(amount)]));
    const allocated = new Map();

    function project(line, parentItem, parentKind, parentSourceId, ordinal = null) {
        if (line.error) return;
        for (const [item, amount] of entries(line.inputs)) add(required, item, amount);
        if (parentKind !== 'automatic') add(allocated, parentItem, positive(line.output));
        for (const [item, output] of entries(line.byproducts)) {
            // Self-recycling belongs to the parent recipe, not a linked source.
            if (item === parentItem) continue;
            const rows = byItem.get(item) || [];
            rows.push({
                id: `byproduct:${parentKind}:${encodeURIComponent(parentSourceId)}:${encodeURIComponent(item)}`,
                item, parentItem, parentSourceId, parentKind, ordinal, output,
                recipeId: line.recipe_id,
                factoryName: line.factory_name,
                ...(line.shared_collector_group ? {sharedCollector: details?.shared_collectors?.find(group => group.id === line.shared_collector_group)} : {}),
            });
            byItem.set(item, rows);
            add(incoming, item, output);
        }
    }

    if (details?.automatic) {
        for (const [item, line] of Object.entries(details.automatic)) {
            project(line, item, 'automatic', `auto:${item}`);
        }
    } else {
        // Preserve the exact graph used by the legacy calculation, including
        // proliferation and mod effects. Never resolve recipes or rerun a solve.
        for (const [item, amount] of entries(production)) {
            const graph = state.item_graph?.[item] || {};
            const scale = record => Object.fromEntries(Object.entries(record || {}).map(([other, coefficient]) => [other, Number(coefficient) * amount]));
            const recipeId = state.item_data?.[item]?.[state.scheme_data?.item_recipe_choices?.[item]];
            const recipe = state.game_data?.recipe_data?.[recipeId];
            const config = state.scheme_data?.scheme_for_recipe?.[recipeId];
            const factory = state.game_data?.factory_data?.[recipe?.设施]?.[config?.建筑];
            project({inputs: scale(graph.原料), byproducts: scale(graph.副产物),
                recipe_id: recipeId, factory_name: factory?.名称}, item, 'automatic', `auto:${item}`);
        }
    }

    const ordinals = new Map();
    for (const [index, source] of (details?.sources || []).entries()) {
        const item = source.target_item;
        const ordinal = (ordinals.get(item) || 0) + 1;
        ordinals.set(item, ordinal);
        project(source, item, 'manual', source.id || `manual-${index}-${item}`, ordinal);
    }
    for (const [index, source] of (details?.legacy_sources || []).entries()) {
        project(source, source.target_item, 'legacy', source.id || `legacy-${index}-${source.target_item}`);
    }

    // Existing groups are authoritative, and include external negative needs.
    // Only the physical flows above produce links; group supply alone cannot.
    const groups = details?.groups || Object.fromEntries([...new Set([
        ...Object.keys(production), ...required.keys(), ...incoming.keys(), ...allocated.keys(),
    ])].map(item => {
        const automatic = positive(production[item]);
        const demand = required.get(item) || 0;
        const fixed = allocated.get(item) || 0;
        const supply = incoming.get(item) || 0;
        const produced = automatic + fixed + supply;
        return [item, {required: demand, automatic, allocated: fixed, byproduct_supply: supply,
            surplus: Math.max(0, produced - demand), missing: Math.max(0, demand - produced)}];
    }));
    return {byItem: Object.fromEntries(byItem), groups};
}
