import {buildProductionPresentation} from './lib/production-presentation.js';

const EPSILON = 1e-8;
const DEFAULT_MAX_EXPANDED_NODES = 1000;
const DEFAULT_MAX_DEPTH = 64;

const positive = value => Number.isFinite(Number(value)) && Number(value) > EPSILON ? Number(value) : 0;
const canonicalItemId = item => `dependency-item:${encodeURIComponent(item)}`;
const finiteRateEntries = values => Object.entries(values || {}).map(([item, value]) => [item, positive(value)])
    .filter(([, value]) => value > 0);
const rateRecord = values => Object.fromEntries(finiteRateEntries(values));
const add = (map, item, rate) => map.set(item, (map.get(item) || 0) + rate);

/**
 * Read-only projection of one existing calculation; never calls the solver.
 *
 * roots: requested positive targets, with branchRate in the current display unit.
 * supplyRoots: otherwise-unrepresented physical sources, with globalRate instead
 *   of branchRate. Their immediate inputs are exact full-source consumption.
 * rows: depth-first roots followed by supplyRoots, useful for a compact table.
 * items/sources: canonical records to link to the ONE existing global editor.
 *
 * Branch rates are net recipe requirements. Known single-source occurrences
 * also expose gross capacity and fractional factory requirements, not physical
 * independent allocations or summable whole-factory totals. A pooled supply terminates
 * a branch and points to its canonical records, rather than guessing routing.
 *
 * maxExpandedNodes bounds non-root occurrences. Every requested target and
 * otherwise-unrepresented source still gets a root, so the total row bound is
 * O(targets + sources + maxExpandedNodes), including on highly shared DAGs.
 * A capped node exposes omittedInputs and a reason; truncation is never silent.
 */
export function buildDependencyView(state, needs, calculation, options = {}) {
    const [production = {}, surplus = {}, details] = calculation || [];
    const presentation = options.presentation ?? buildProductionPresentation(state, needs, calculation);
    const settings = state.settings || {};
    const graph = state.item_graph || {};
    const maxExpandedNodes = Number.isSafeInteger(options.maxExpandedNodes) && options.maxExpandedNodes >= 0
        ? options.maxExpandedNodes : DEFAULT_MAX_EXPANDED_NODES;
    const maxDepth = Number.isSafeInteger(options.maxDepth) && options.maxDepth >= 0 ? options.maxDepth : DEFAULT_MAX_DEPTH;
    const sources = [];
    const warnings = [];

    function sourceRecord(line, kind, index) {
        const original = line.source || line;
        const controlItem = line.controlItem || original.target_item;
        const item = line.displayItem || controlItem;
        // The canonical dependency identity still belongs to the physical
        // source. UI routing uses its stable editor ID and its display owner.
        const sourceId = original.id || (kind !== 'automatic' && line.originalSourceId) || `${kind}-${index}-${controlItem}`;
        const grossOutput = line.displayGrossOutput !== undefined ? line.displayGrossOutput
            : item === controlItem ? original.gross_output ?? line.output : null;
        const invalidFlow = [original.output, original.gross_output ?? original.output, line.output, grossOutput,
            ...Object.values(line.inputs || {}), ...Object.values(original.byproducts || {})]
            .some(value => value !== undefined && !Number.isFinite(Number(value)));
        const recipeId = line.recipe_id ?? state.item_data?.[controlItem]?.[state.scheme_data?.item_recipe_choices?.[controlItem]];
        const recipe = state.game_data?.recipe_data?.[recipeId];
        const scheme = state.scheme_data?.scheme_for_recipe?.[recipeId];
        const factory = state.game_data?.factory_data?.[recipe?.设施]?.[line.building ?? scheme?.建筑];
        const perFactory = Number(graph[controlItem]?.产出倍率) * Number(factory?.倍率)
            * (settings.is_time_unit_minute ? 60 : 1);
        // Keep physical fractions unrounded. Legacy UI offsets belong only in formatting.
        const buildings = line.buildings ?? (kind === 'automatic' && perFactory > 0
            ? positive(line.originalOutput ?? original.output) / perFactory : null);
        return {
            factoryName: line.factory_name || factory?.名称 || null,
            sharedCollector: Boolean(line.shared_collector_group),
            buildings: Number.isFinite(buildings) && buildings >= 0 ? buildings : null,
            displayOffset: (!details?.automatic && kind === 'automatic') || original.buildings == null
                ? 0.49994 * 0.1 ** Number(settings.fixed_num ?? 2) : 0,
            id: `${kind}:${sourceId}`, sourceId, kind, item, controlItem, recipeId,
            uiId: kind === 'automatic' ? line.sourceId || `auto:${controlItem}` : kind === 'manual' ? line.sourceId || sourceId : null,
            canonicalId: `dependency-source:${encodeURIComponent(kind)}:${encodeURIComponent(sourceId)}`,
            outputRate: positive(line.output), grossRate: grossOutput === null ? null : positive(grossOutput),
            inputs: rateRecord(line.inputs), byproducts: rateRecord(line.byproducts),
            error: line.error || (invalidFlow ? 'non-finite-source-flow' : null), mineralized: line.mineralized === true,
            isRaw: line.is_raw ?? !Object.keys(recipe?.原料 || line.inputs || {}).length,
        };
    }

    for (const [index, line] of presentation.lines.entries()) sources.push(sourceRecord(line, line.kind, index));

    if (!details && settings.natural_production_line?.length) {
        // ContextProvider migrates these before normal UI use. If a caller hands
        // us an older raw calculation, do not invent its missing source flows.
        warnings.push('legacy-source-details-unavailable');
        for (const [index, line] of settings.natural_production_line.entries()) {
            sources.push({...sourceRecord({target_item: line.目标物品, error: 'legacy-source-details-unavailable'}, 'legacy', index),
                outputRate: null, grossRate: null});
        }
    }

    const required = new Map(finiteRateEntries(needs));
    const external = new Map(Object.entries(needs || {}).filter(([, amount]) => Number.isFinite(Number(amount)) && Number(amount) < -EPSILON)
        .map(([item, amount]) => [item, -Number(amount)]));
    const coproducts = new Map();
    const primarySources = new Map();
    const coproductSources = new Map();
    for (const source of sources) {
        const primary = primarySources.get(source.item) || [];
        source.ordinal = source.kind === 'manual' ? primary.filter(line => line.kind === 'manual').length + 1 : null;
        primary.push(source);
        primarySources.set(source.item, primary);
        for (const [item, amount] of Object.entries(source.inputs)) add(required, item, amount);
        for (const [item, amount] of Object.entries(source.byproducts)) {
            add(coproducts, item, amount);
            const producers = coproductSources.get(item) || [];
            producers.push(source.id);
            coproductSources.set(item, producers);
        }
    }
    const itemOrder = new Set([...Object.keys(needs || {}), ...presentation.order, ...Object.keys(production),
        ...Object.keys(presentation.groups), ...required.keys(), ...external.keys(), ...primarySources.keys(), ...coproducts.keys()]);
    const flatOrder = new Set(presentation.order);
    const items = Object.fromEntries([...itemOrder].filter(item => typeof item === 'string').map(item => {
        const lines = primarySources.get(item) || [];
        const automaticLines = lines.filter(line => line.kind === 'automatic');
        const activeAutomatic = automaticLines.filter(line => line.outputRate > EPSILON);
        const automatic = activeAutomatic.length === 1 ? activeAutomatic[0] : automaticLines.length === 1 ? automaticLines[0] : null;
        const manualRate = lines.filter(line => line.kind !== 'automatic').reduce((total, line) => total + (line.outputRate || 0), 0);
        const automaticRate = automaticLines.reduce((total, line) => total + line.outputRate, 0);
        const externalRate = external.get(item) || 0;
        const byproductRate = coproducts.get(item) || 0;
        const group = presentation.groups[item];
        const requiredRate = group ? positive(group.required) : required.get(item) || 0;
        const producedRate = automaticRate + manualRate + externalRate + byproductRate;
        const surplusRate = group ? positive(group.surplus) : Object.hasOwn(surplus, item)
            ? positive(surplus[item]) : Math.max(0, producedRate - requiredRate);
        const missingRate = group ? positive(group.missing) : Math.max(0, requiredRate - producedRate);
        const hasMovedProcessing = lines.some(line => line.controlItem !== item && line.outputRate > EPSILON
            && !line.mineralized && !line.isRaw);
        // The selected recipe for the display item may be unrelated to the
        // moved physical process. Its mining flags cannot hide that process or
        // turn its real factories into external/mineralized supply.
        const mineralized = !hasMovedProcessing
            && (Object.hasOwn(settings.mineralize_list || {}, item) || automatic?.mineralized === true);
        const hasManualSources = lines.some(line => line.kind === 'manual');
        const recipeId = state.item_data?.[item]?.[state.scheme_data?.item_recipe_choices?.[item]];
        const recipeInputs = state.game_data?.recipe_data?.[recipeId]?.原料 ?? graph[item]?.原料 ?? {};
        const hasByproductSources = byproductRate > EPSILON;
        const hasCanonicalRow = flatOrder.has(item) && !presentation.hiddenItems.has(item) && Object.hasOwn(state.item_data || graph, item)
            && (automaticRate >= 1e-6 || hasManualSources || hasByproductSources)
            && !(settings.hide_mines && !hasManualSources && !hasByproductSources && !hasMovedProcessing
                && (mineralized || !Object.keys(recipeInputs).length));
        const boundaryReasons = [];
        if (lines.some(line => line.error)) boundaryReasons.push('invalid-source');
        if (activeAutomatic.length > 1) boundaryReasons.push('multiple-sources');
        if (manualRate > EPSILON) boundaryReasons.push('manual-supply');
        if (byproductRate > EPSILON) boundaryReasons.push('byproduct-supply');
        if (externalRate > EPSILON) boundaryReasons.push('external-supply');
        if (surplusRate > EPSILON) boundaryReasons.push('overproduction');
        if (missingRate > 1e-6) boundaryReasons.push('missing-supply');
        return [item, {item, canonicalId: canonicalItemId(item), automaticRate, manualRate, byproductRate, externalRate,
            requiredRate, surplusRate, missingRate, boundaryReasons,
            mineralized, hasCanonicalRow, hasCanonicalGroup: hasCanonicalRow
                && (hasManualSources || hasByproductSources || automaticLines.length > 1 || lines.some(line => line.controlItem !== item)),
            sourceIds: lines.map(line => line.id), coproductSourceIds: coproductSources.get(item) || [],
            automaticSourceId: automatic?.id || null, occurrenceIds: []}];
    }));
    const sourcesById = Object.fromEntries(sources.map(source => [source.id, source]));
    const rows = [];
    const coveredSources = new Set();
    let expandedNodes = 0;
    let truncated = false;

    function makeOccurrence({item, rate, id, parentId = null, depth = 0, scope = 'branch', source = null}) {
        const canonical = items[item];
        const occurrence = {id, item, kind: source ? 'supply' : 'demand', scope,
            branchRate: scope === 'branch' ? rate : null, globalRate: scope === 'global' ? rate : null,
            parentId, depth, canonicalId: canonical?.canonicalId || canonicalItemId(item),
            sourceId: source?.id || null, children: [], reason: null, boundaryReasons: [],
            shared: false, repeated: Boolean(canonical?.occurrenceIds.length),
            canonicalOccurrenceId: canonical?.occurrenceIds[0] || id, truncated: false, omittedInputs: []};
        canonical?.occurrenceIds.push(id);
        rows.push(occurrence);
        return occurrence;
    }

    function expandInputs(occurrence, inputRates, ancestors) {
        const inputs = finiteRateEntries(inputRates);
        for (let index = 0; index < inputs.length; index++) {
            if (occurrence.depth >= maxDepth || expandedNodes >= maxExpandedNodes) {
                occurrence.truncated = true;
                occurrence.reason = occurrence.depth >= maxDepth ? 'depth-limit' : 'node-limit';
                occurrence.omittedInputs = inputs.slice(index).map(([item, rate]) => ({item, rate, canonicalId: canonicalItemId(item)}));
                truncated = true;
                return;
            }
            const [item, rate] = inputs[index];
            expandedNodes++;
            const child = makeOccurrence({item, rate, id: `${occurrence.id}/input:${encodeURIComponent(item)}`,
                parentId: occurrence.id, depth: occurrence.depth + 1, scope: occurrence.scope});
            occurrence.children.push(child);
            expandDemand(child, rate, ancestors);
        }
    }

    function expandDemand(occurrence, rate, ancestors) {
        const {item} = occurrence;
        const canonical = items[item];
        if (ancestors.has(item)) {
            occurrence.reason = 'cycle';
            occurrence.referenceId = ancestors.get(item);
            return;
        }
        if (!canonical || !Object.hasOwn(state.item_data || graph, item)) {
            occurrence.reason = 'unknown-item';
            return;
        }
        if (canonical.mineralized && !canonical.boundaryReasons.some(reason =>
            ['manual-supply', 'byproduct-supply', 'invalid-source', 'multiple-sources'].includes(reason))) {
            occurrence.reason = 'mineralized';
            if (canonical.automaticSourceId) coveredSources.add(canonical.automaticSourceId);
            return;
        }
        if (canonical.boundaryReasons.length) {
            occurrence.reason = 'global-supply';
            occurrence.boundaryReasons = [...canonical.boundaryReasons];
            return;
        }
        const automatic = sourcesById[canonical.automaticSourceId];
        if (!automatic || !(automatic.outputRate > EPSILON)) {
            occurrence.reason = 'missing-supply';
            return;
        }
        coveredSources.add(automatic.id);
        const inputs = Object.fromEntries(Object.entries(automatic.inputs).map(([input, amount]) => [input, rate * (amount / automatic.outputRate)]));
        if (Object.values(inputs).some(amount => !Number.isFinite(amount))) {
            occurrence.reason = 'invalid-flow';
            warnings.push(`non-finite-branch:${occurrence.id}`);
            return;
        }
        if (!Object.keys(inputs).length) {
            occurrence.reason = 'raw';
            return;
        }
        const nextAncestors = new Map(ancestors);
        nextAncestors.set(item, occurrence.id);
        expandInputs(occurrence, inputs, nextAncestors);
    }

    const roots = finiteRateEntries(needs).map(([item, rate]) => {
        const root = makeOccurrence({item, rate, id: `target:${encodeURIComponent(item)}`});
        expandDemand(root, rate, new Map());
        return root;
    });
    const pendingSources = sources.filter(source => !coveredSources.has(source.id)
        && (source.outputRate > EPSILON || source.error || (source.kind !== 'automatic' && !items[source.item]?.occurrenceIds.length)));
    const supplyRoots = [];
    for (const source of pendingSources) {
        if (coveredSources.has(source.id)) continue;
        const root = makeOccurrence({item: source.item, rate: source.outputRate, id: `supply:${encodeURIComponent(source.id)}`, scope: 'global', source});
        coveredSources.add(source.id);
        root.reason = source.error ? 'invalid-source' : source.mineralized ? 'mineralized' : null;
        if (!root.reason) expandInputs(root, source.inputs, new Map([[source.item, root.id]]));
        supplyRoots.push(root);
    }
    for (const occurrence of rows) {
        occurrence.shared = (items[occurrence.item]?.occurrenceIds.length || 0) > 1;
        if (occurrence.scope !== 'branch') continue;
        const canonical = items[occurrence.item];
        const source = sourcesById[canonical?.automaticSourceId];
        const unallocated = ['global-supply', 'cycle', 'missing-supply', 'unknown-item', 'invalid-source', 'invalid-flow'].includes(occurrence.reason);
        const factor = source?.outputRate > EPSILON ? occurrence.branchRate / source.outputRate : null;
        occurrence.production = occurrence.reason === 'mineralized'
            ? {capacity: occurrence.branchRate, buildings: 0, displayOffset: 0, status: 'external'}
            : !unallocated && factor !== null
                ? {capacity: source.grossRate === null ? null : source.grossRate * factor,
                    buildings: source.buildings === null ? null : source.buildings * factor,
                    displayOffset: source.displayOffset, factoryName: source.factoryName, sharedCollector: source.sharedCollector, status: 'recipe'}
                : {capacity: null, buildings: null, displayOffset: 0, status: 'unallocated'};
    }
    return {roots, supplyRoots, rows, items, sources: sourcesById, warnings,
        limits: {maxExpandedNodes, maxDepth, expandedNodes, truncated}};
}
