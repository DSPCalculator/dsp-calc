const EPSILON = 1e-8;
const positive = value => Number.isFinite(Number(value)) && Number(value) > EPSILON ? Number(value) : 0;
const positiveEntries = record => Object.entries(record || {}).map(([item, amount]) => [item, positive(amount)])
    .filter(([, amount]) => amount > 0);
const add = (map, item, amount) => map.set(item, (map.get(item) || 0) + amount);
const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;

/**
 * Present the physical processes in an existing calculation, without solving
 * again or changing the saved owner of a recipe. An automatic process is shown
 * under the output that drives its capacity after all other supply is credited.
 * Fixed sources retain their user-selected targets, including zero/error rows.
 *
 * `output` and `byproducts` are absolute, net rates in the current display unit.
 * `controlItem`, `sourceId`, and the original source metadata remain attached to
 * the same physical process even when `displayItem` changes. In particular,
 * inputs, buildings, gross_output, and recipe settings must not be rescaled by
 * the new display output. All automatic lines are retained, so distinct
 * processes with the same display primary never overwrite one another.
 */
export function buildProductionPresentation(state, needs, calculation) {
    const [production = {}, , details] = calculation || [];
    const lines = [];
    const required = new Map(positiveEntries(needs));
    const external = new Map(Object.entries(needs || {}).filter(([, amount]) =>
        Number.isFinite(Number(amount)) && Number(amount) < -EPSILON)
        .map(([item, amount]) => [item, -Number(amount)]));
    const supplied = new Map();
    const ordinals = new Map();
    const legacyTargets = new Set(!details ? (state.settings?.natural_production_line || [])
        .map(source => source?.目标物品).filter(Boolean) : []);
    // Older raw calculations do not expose fixed-source flows. Retain their
    // target rows for repair without reconstructing or inventing production.
    const warnings = legacyTargets.size ? ['legacy-source-details-unavailable'] : [];

    function project(source, controlItem, kind, index) {
        const sourceId = kind === 'automatic' ? `auto:${controlItem}` : source.id || `${kind}-${index}-${controlItem}`;
        const recipeChoice = source.recipe_choice ?? state.scheme_data?.item_recipe_choices?.[controlItem];
        const recipeId = source.recipe_id ?? state.item_data?.[controlItem]?.[recipeChoice];
        const recipe = state.game_data?.recipe_data?.[recipeId];
        const config = state.scheme_data?.scheme_for_recipe?.[recipeId];
        const building = source.building ?? config?.建筑;
        const factory = state.game_data?.factory_data?.[recipe?.设施]?.[building];
        const originalOutput = source.output;
        const outputs = source.error ? {} : Object.fromEntries(positiveEntries(source.byproducts)
            .filter(([item]) => item !== controlItem));
        if (!source.error && positive(originalOutput)) outputs[controlItem] = positive(originalOutput);
        const ordinal = kind === 'manual' ? (ordinals.get(controlItem) || 0) + 1 : null;
        if (kind === 'manual') ordinals.set(controlItem, ordinal);
        const line = {
            ...source,
            id: `${kind}:${encodeURIComponent(sourceId)}`,
            sourceId, originalSourceId: source.id ?? sourceId, kind, controlItem,
            item: controlItem, displayItem: controlItem, ordinal,
            originalOutput, originalGrossOutput: source.gross_output ?? originalOutput,
            output: positive(originalOutput), outputs,
            inputs: source.inputs || {}, byproducts: {}, source,
            recipeId, recipe_id: recipeId, recipe_choice: recipeChoice,
            building, proliferator_mode: source.proliferator_mode ?? config?.增产模式,
            proliferator_points: source.proliferator_points ?? config?.增产点数,
            factoryName: source.factory_name || factory?.名称,
            factory_name: source.factory_name || factory?.名称,
            ...(source.shared_collector_group ? {
                sharedCollector: details?.shared_collectors?.find(group => group.id === source.shared_collector_group),
            } : {}),
        };
        lines.push(line);
        if (source.error) return;
        for (const [item, amount] of positiveEntries(line.inputs)) add(required, item, amount);
        for (const [item, amount] of Object.entries(outputs)) add(supplied, item, amount);
    }

    if (details?.automatic) {
        for (const [item, source] of Object.entries(details.automatic)) project(source, item, 'automatic', lines.length);
    } else {
        // The legacy graph is the exact normalized graph used by this solve,
        // including mod/proliferation effects and net self-recycling. Rebuilding
        // raw recipes here could silently change either inputs or coproducts.
        for (const [item, amount] of Object.entries(production)) {
            const output = positive(amount);
            const graph = state.item_graph?.[item] || {};
            const recipeChoice = state.scheme_data?.item_recipe_choices?.[item];
            const recipeId = state.item_data?.[item]?.[recipeChoice];
            const recipe = state.game_data?.recipe_data?.[recipeId];
            const config = state.scheme_data?.scheme_for_recipe?.[recipeId];
            const factory = state.game_data?.factory_data?.[recipe?.设施]?.[config?.建筑];
            const perSecond = Number(graph.产出倍率) * Number(factory?.倍率);
            const buildings = perSecond > 0 ? output / (state.settings?.is_time_unit_minute ? 60 : 1) / perSecond : null;
            const scale = record => Object.fromEntries(Object.entries(record || {}).map(([other, coefficient]) =>
                [other, Number(coefficient) * output]));
            project({
                id: `automatic-${item}`, target_item: item, output,
                gross_output: output * (1 + positive(graph.自消耗)),
                output_per_second: Number.isFinite(perSecond) ? perSecond : 0,
                buildings, building_count: buildings > EPSILON ? Math.ceil(buildings - EPSILON) : 0,
                inputs: scale(graph.原料), byproducts: scale(graph.副产物),
                mineralized: Object.hasOwn(state.settings?.mineralize_list || {}, item),
                is_raw: !Object.keys(recipe?.原料 || graph.原料 || {}).length,
            }, item, 'automatic', lines.length);
        }
    }
    for (const [index, source] of (details?.sources || []).entries()) project(source, source.target_item, 'manual', index);
    for (const [index, source] of (details?.legacy_sources || []).entries()) project(source, source.target_item, 'legacy', index);

    for (const line of lines) {
        // Coupled orbital collectors have one shared fleet but separate
        // single-output recipe controls. Preserve that existing owner model.
        if (line.kind === 'automatic' && !line.error && !line.shared_collector_group) {
            let candidates = Object.entries(line.outputs).map(([item, output]) => ({
                item, output, required: required.get(item) || 0,
                residual: Math.max(0, (required.get(item) || 0) - (external.get(item) || 0)
                    - Math.max(0, (supplied.get(item) || 0) - output)),
                explicit: positive(needs?.[item]) > 0,
            }));
            // Even when other sources already cover all demand, prefer a
            // demanded product to an unrelated surplus-only coproduct.
            if (candidates.some(candidate => candidate.required > EPSILON)) {
                candidates = candidates.filter(candidate => candidate.required > EPSILON);
            }
            candidates.sort((left, right) => {
                const difference = right.residual / right.output - left.residual / left.output;
                if (Math.abs(difference) > EPSILON) return difference;
                // A genuinely served owner remains stable on an equal binding
                // fraction. This avoids flipping an ordinary graphene process
                // merely because its hydrogen is also fully consumed.
                const leftOwner = left.item === line.controlItem && left.residual > EPSILON;
                const rightOwner = right.item === line.controlItem && right.residual > EPSILON;
                return Number(right.explicit) - Number(left.explicit)
                    || Number(rightOwner) - Number(leftOwner) || lexical(left.item, right.item);
            });
            line.item = line.displayItem = candidates[0]?.item || line.controlItem;
        }
        line.output = line.outputs[line.displayItem] || 0;
        line.byproducts = Object.fromEntries(Object.entries(line.outputs)
            .filter(([item]) => item !== line.displayItem).sort(([left], [right]) => lexical(left, right)));
        const recipe = state.game_data?.recipe_data?.[line.recipeId];
        if (line.displayItem === line.controlItem) {
            line.displayGrossOutput = positive(line.originalGrossOutput);
        } else if (recipe && !positive(recipe.原料?.[line.displayItem])) {
            line.displayGrossOutput = line.output;
        } else {
            // Product proliferation applies equally to the recipe outputs, so
            // their raw ratio converts the original source's *gross* output.
            // Without those quantities, do not invent gross branch capacity.
            const ownerQuantity = positive(recipe?.产物?.[line.controlItem]);
            const displayQuantity = positive(recipe?.产物?.[line.displayItem]);
            const gross = positive(line.originalGrossOutput) * displayQuantity / ownerQuantity;
            line.displayGrossOutput = ownerQuantity && displayQuantity && Number.isFinite(gross)
                && gross + EPSILON >= line.output ? gross : null;
        }
    }

    const itemOrder = new Set([...(details?.order || Object.keys(production)), ...Object.keys(needs || {}),
        ...required.keys(), ...supplied.keys(), ...external.keys(), ...lines.map(line => line.displayItem), ...legacyTargets]);
    const byItem = Object.fromEntries([...itemOrder].map(item => [item, {lines: [], byproducts: []}]));
    for (const line of lines) {
        byItem[line.displayItem].lines.push(line);
        for (const [item, output] of Object.entries(line.byproducts)) {
            byItem[item].byproducts.push({
                id: `byproduct:${line.kind}:${encodeURIComponent(line.sourceId)}:${encodeURIComponent(item)}`,
                item, parentItem: line.displayItem, parentControlItem: line.controlItem,
                parentSourceId: line.sourceId, parentKind: line.kind, ordinal: line.ordinal, output,
                recipeId: line.recipeId, factoryName: line.factoryName,
                ...(line.sharedCollector ? {sharedCollector: line.sharedCollector} : {}),
            });
        }
    }
    const hiddenItems = new Set();
    const groups = Object.fromEntries([...itemOrder].map(item => {
        const itemSources = byItem[item];
        const demand = required.get(item) || 0;
        const automatic = itemSources.lines.filter(line => line.kind === 'automatic').reduce((sum, line) => sum + line.output, 0);
        const fixed = itemSources.lines.filter(line => line.kind !== 'automatic');
        const allocated = fixed.reduce((sum, line) => sum + line.output, 0);
        const externalSupply = external.get(item) || 0;
        const byproductSupply = itemSources.byproducts.reduce((sum, line) => sum + line.output, 0);
        const produced = automatic + allocated + byproductSupply + externalSupply;
        // A shared orbital fleet's single-output recipe controls cannot move
        // onto its other product. Keep that physical owner reachable, including
        // when the other product is the only one with positive demand.
        const sharedOwner = itemSources.lines.some(line => line.shared_collector_group && line.output > EPSILON);
        if (demand <= EPSILON && !fixed.length && !sharedOwner && !legacyTargets.has(item)) hiddenItems.add(item);
        return [item, {
            required: demand, produced, automatic, allocated, external: externalSupply,
            byproduct_supply: byproductSupply + externalSupply,
            surplus: Math.max(0, produced - demand), missing: Math.max(0, demand - produced),
        }];
    }));
    return {lines, byItem, groups, order: [...itemOrder].filter(item => !hiddenItems.has(item)), hiddenItems, warnings};
}
