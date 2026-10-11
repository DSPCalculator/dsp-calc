import solver from 'javascript-lp-solver';
import {ApplyBuildingMultiplier} from './building_multipliers.js';
import {orbitalCollectorProfile, poolFixedOrbitalCollectors, finalizeOrbitalCollectors, needsOrbitalCollectorCalculation} from './orbital_collectors.js';

const EPSILON = 1e-8;
let nextSourceId = 0;

/** Persist allocations in one physical unit, independently of display settings. */
export function toDisplayRate(perMinute, settings) {
    return Number(perMinute) / (settings.is_time_unit_minute ? 1 : 60);
}

export function fromDisplayRate(displayRate, settings) {
    return Number(displayRate) * (settings.is_time_unit_minute ? 1 : 60);
}

export function createProductionSource(state, item, {standalone = false} = {}) {
    const choice = state.scheme_data.item_recipe_choices[item] || 1;
    const recipeId = Object.hasOwn(state.item_data, item) ? state.item_data[item]?.[choice] : undefined;
    const config = state.scheme_data.scheme_for_recipe[recipeId] || {};
    return {
        id: globalThis.crypto?.randomUUID?.() || `source-${Date.now()}-${++nextSourceId}`,
        target_item: item,
        standalone: standalone === true,
        quantity_mode: 'rate',
        output_per_minute: 0,
        recipe_choice: choice,
        building: Number(config.建筑) || 0,
        proliferator_mode: Number(config.增产模式) || 0,
        proliferator_points: Number(config.增产点数) || 0,
    };
}

/**
 * Bound sources follow actual demand, never stale zero-valued LP result keys.
 * A coproduct-covered item can still be required by a downstream recipe even
 * when its own automatic production is zero.
 */
export function isItemRequired(state, needs, item, baselineProduction) {
    if (!Object.hasOwn(state.item_data, item)) return false;
    if (Number(needs[item]) > EPSILON) return true;
    const production = baselineProduction || state.calculateBaseline(needs)[0];
    return Object.entries(production).some(([product, amount]) =>
        Number(amount) > EPSILON && Number(state.item_graph[product]?.原料[item]) * Number(amount) > EPSILON);
}

function add(dict, item, amount) {
    dict[item] = (dict[item] || 0) + amount;
}

function scaled(dict, scale) {
    return Object.fromEntries(Object.entries(dict).filter(([, amount]) => Math.abs(amount * scale) > EPSILON)
        .map(([item, amount]) => [item, amount * scale]));
}

/**
 * The same recipe effects as GlobalState's graph, normalized by *net* target
 * output. Keeping the raw recipe balance until normalization is important for
 * self-recycling recipes: proliferated coproducts must not be counted twice.
 */
export function productionSourceNode(state, source, {mineralized = false} = {}) {
    const {game_data: game, settings} = state;
    const item = source.target_item;
    const choice = Number(source.recipe_choice);
    const recipeId = Object.hasOwn(state.item_data, item) ? state.item_data[item]?.[choice] : undefined;
    if (!Number.isInteger(choice) || choice < 1 || recipeId === undefined) throw new Error('来源配方已失效，请重新选择配方');
    const recipe = game.recipe_data[recipeId];
    const building = Number(source.building);
    const factory = game.factory_data[recipe.设施]?.[building];
    if (!Number.isInteger(building) || !factory) throw new Error('来源建筑已失效，请重新选择建筑');
    let mode = Number(source.proliferator_mode ?? 0);
    let points = Number(source.proliferator_points ?? 0);
    if (recipe.增产 === 8 && mode === 0) mode = 4;
    if (mode > 0 && points === 0) points = game.proliferator_data.at(-1).增产点数;
    if (!Number.isInteger(mode) || mode < 0 || mode > 4 || (mode > 0 && !(recipe.增产 & (1 << (mode - 1))))) {
        throw new Error('此配方不支持所选增产模式');
    }
    if (!Number.isInteger(points) || !game.proliferator_effect[points] || state.proliferator_price[points] === -1) {
        throw new Error('来源增产剂已失效，请重新选择增产剂');
    }
    const normalized = {...source, recipe_choice: choice, building, proliferator_mode: mode, proliferator_points: points};
    if (mineralized) return {
        source: normalized, item, recipe_id: recipeId, factory, mineralized: true,
        inputs: {}, byproducts: {}, output_per_second: Infinity, gross_multiplier: 1,
        is_raw: true, energy_per_building: 0,
    };

    const inputs = {...recipe.原料};
    const outputs = {...recipe.产物};
    if (game.TheyComeFromVoidEnable && settings.blue_buff && Object.keys(inputs).length >= 2) {
        outputs[Object.keys(inputs)[0]] = Object.values(outputs)[0];
    }
    let productMultiplier = 1;
    let speedMultiplier = 1;
    if (mode > 0 && points > 0) {
        const inputCount = Object.values(inputs).reduce((sum, amount) => sum + amount, 0);
        for (const [proliferator, price] of Object.entries(state.proliferator_price[points])) {
            add(inputs, proliferator, inputCount * price);
        }
        const effect = game.proliferator_effect[points];
        if (mode === 1) speedMultiplier = effect.加速效果 * settings.acc_rate;
        if (mode === 2) productMultiplier = effect.增产效果 * settings.inc_rate;
        if (mode === 3) productMultiplier = effect.加速效果 * settings.acc_rate;
        if (mode === 4) speedMultiplier = points / 10;
    }
    const gross = Number(outputs[item]) * productMultiplier;
    const net = gross - (inputs[item] || 0);
    if (!(net > 0)) throw new Error('此配方没有正的目标物品净产出');
    const netInputs = {};
    const byproducts = {};
    for (const other of new Set([...Object.keys(inputs), ...Object.keys(outputs)])) {
        if (other === item) continue;
        const balance = ((outputs[other] || 0) * productMultiplier - (inputs[other] || 0)) / net;
        if (balance < -EPSILON) netInputs[other] = -balance;
        if (balance > EPSILON) byproducts[other] = balance;
    }
    const outputPerSecond = ApplyBuildingMultiplier(net * speedMultiplier / recipe.时间, factory.名称, item, settings) * factory.倍率;
    if (!Number.isFinite(outputPerSecond) || outputPerSecond <= 0) throw new Error('来源产能无效，请检查建筑和采集倍率');
    const node = {
        source: normalized, item, recipe_id: recipeId, factory, inputs: netInputs, byproducts,
        output_per_second: outputPerSecond, gross_multiplier: gross / net,
        is_raw: Object.keys(recipe.原料).length === 0 && Object.keys(recipe.产物).length === 1,
        mineralized: false,
    };
    const collector = orbitalCollectorProfile(state, normalized, recipeId, factory);
    if (collector) {
        node.orbital_collector = collector;
        for (const other of collector.items) {
            if (other !== item) node.byproducts[other] = collector.capacities[other] / collector.capacities[item];
        }
    }
    node.energy_per_building = energyPerBuilding(state, node);
    return node;
}

/** The last edited quantity owns the source; older records remain fixed-rate. */
export function resolveProductionSource(state, source) {
    const mode = source.quantity_mode ?? 'rate';
    if (mode !== 'rate' && mode !== 'buildings') throw new Error('来源数量模式无效，请重新输入产量或工厂数量');
    const value = mode === 'buildings' ? source.building_quantity : source.output_per_minute;
    const quantity = Number(value);
    if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(quantity) || quantity < 0) {
        throw new Error(`${mode === 'buildings' ? '工厂数量' : '分配产量'}必须为大于或等于 0 的有限数值`);
    }
    const node = productionSourceNode(state, source);
    const rate = mode === 'buildings' ? quantity * node.output_per_second * 60 : quantity;
    if (!Number.isFinite(rate)) throw new Error('分配产量过大，计算已超出可表示范围');
    node.source = {...node.source, quantity_mode: mode, output_per_minute: rate};
    if (mode === 'buildings') node.source.building_quantity = quantity;
    return node;
}

/** Keep saved canonical rates current when a setting changes physical capacity. */
export function synchronizeProductionSourceRates(state) {
    return (state.settings.production_sources || []).map(source => {
        if (source?.quantity_mode !== 'buildings' || source.migration_error) return source;
        try {
            const {output_per_minute} = resolveProductionSource(state, source).source;
            return output_per_minute === source.output_per_minute ? source : {...source, output_per_minute};
        } catch {
            // Preserve invalid records and their last valid rate for repair.
            return source;
        }
    });
}

function energyPerBuilding(state, node) {
    const {settings, game_data: game} = state;
    const name = node.factory.名称;
    // Orbital collectors supply their own power. The total is external grid draw.
    if (name === '轨道采集器') return 0;
    let energy = Number(node.factory.耗能) || 0;
    if (name === '大型采矿机') energy = 0.168 + (2.94 - 0.168) * settings.mining_efficiency_large ** 2;
    if (name.endsWith('分馏塔')) {
        const genesis = game.GenesisBookEnable;
        const threshold = genesis ? 60 : 30;
        if (settings.fractionating_speed > threshold) {
            energy *= (settings.fractionating_speed * 0.036 - (genesis ? 0.72 : 0.36)) / (genesis ? 1.44 : 0.72);
        }
    }
    const {proliferator_mode: mode, proliferator_points: points} = node.source;
    if (mode && points) energy *= game.proliferator_effect[points].耗电倍率;
    return energy;
}

export function isMiningBuilding(name) {
    return ['采矿机', '大型采矿机', '抽水机', '抽水站', '聚束液体汲取设施', '原油萃取站', '大气采集站'].includes(name);
}

/** Shared by ordinary rows and manual sources so a zero line never changes power. */
export function getProductionEnergy(state, factory, config, buildings) {
    return buildings * energyPerBuilding(state, {factory, source: {
        proliferator_mode: Number(config.proliferator_mode ?? config.增产模式) || 0,
        proliferator_points: Number(config.proliferator_points ?? config.增产点数) || 0,
    }});
}

/** Convert fixed-building legacy records once; retain invalid rows for repair. */
export function migrateLegacyProductionSources(state, legacyLines = state.settings.natural_production_line) {
    return (Array.isArray(legacyLines) ? legacyLines : []).filter(Boolean).map((line, index) => {
        const source = {
            id: `legacy-source-${index}-${line.目标物品 || 'unknown'}`,
            target_item: line.目标物品,
            standalone: line.standalone === true,
            output_per_minute: 0,
            recipe_choice: Number(line.配方id),
            building: Number(line.建筑),
            proliferator_mode: Number(line.增产模式) || 0,
            proliferator_points: Number(line.增产点数) || 0,
        };
        try {
            const count = Number(line.建筑数量);
            if (!Number.isFinite(count) || count < 0) throw new Error('原有产线的建筑数量无效');
            const node = productionSourceNode(state, source);
            return {...node.source, output_per_minute: count * node.output_per_second * 60};
        } catch (error) {
            return {...source, migration_error: error.message};
        }
    });
}

function automaticSource(state, item) {
    const recipeChoice = state.scheme_data.item_recipe_choices[item];
    const recipeId = state.item_data[item][recipeChoice];
    const config = state.scheme_data.scheme_for_recipe[recipeId];
    return {
        id: `automatic-${item}`, target_item: item, recipe_choice: recipeChoice,
        building: config.建筑, proliferator_mode: config.增产模式,
        proliferator_points: config.增产点数,
    };
}

function sourceResult(state, source, node, output, error = null) {
    const buildings = node ? node.source.quantity_mode === 'buildings' && !node.mineralized
        ? node.source.building_quantity : output / (state.settings.is_time_unit_minute ? 60 : 1) / node.output_per_second : 0;
    const result = {
        ...(node?.source || source),
        recipe_id: node?.recipe_id,
        factory_name: node?.factory.名称,
        output,
        output_per_second: node?.output_per_second || 0,
        gross_output: output * (node?.gross_multiplier || 1),
        buildings,
        building_count: buildings > EPSILON ? Math.ceil(buildings - EPSILON) : 0,
        energy_mw: buildings * (node?.energy_per_building || 0),
        inputs: scaled(node?.inputs || {}, output),
        byproducts: scaled(node?.byproducts || {}, output),
        is_raw: node?.is_raw || false,
        mineralized: node?.mineralized || false,
        error,
        ...(node?.orbital_collector ? {shared_collector_group: node.orbital_collector.id,
            collector_capacities: node.orbital_collector.capacities} : {}),
    };
    if ([result.output, result.gross_output, result.buildings, result.energy_mw,
        ...Object.values(result.inputs), ...Object.values(result.byproducts)].some(value => !Number.isFinite(value))) {
        throw new Error('分配产量过大，计算已超出可表示范围');
    }
    return result;
}

function recipeCost(state, node) {
    const weights = state.scheme_data.cost_weight;
    const extra = weights.物品额外成本[node.item] || {};
    const extraCost = extra.启用 ? Number(extra.额外成本 ?? extra.成本 ?? 0) : 0;
    const factory = node.factory;
    const layers = factory.名称.endsWith('研究站') ? state.settings.stack_research_lab : 1;
    let cost = extraCost;
    if (!(extra.启用 && !extra.与其它成本累计)) {
        cost += (
            weights.占地 * factory.占地 / layers + weights.电力 * node.energy_per_building + (weights.建筑成本[factory.名称] || 0)
        ) / node.output_per_second;
    }
    // Retain the existing solver's disposal-weight semantics: charge primary
    // and coproduct generation without rewarding extra downstream production
    // solely for consuming penalized materials.
    cost += Number(extra.溢出时处理成本) || 0;
    for (const [item, amount] of Object.entries(node.byproducts)) cost += amount * (weights.物品额外成本[item]?.溢出时处理成本 || 0);
    return Number.isFinite(cost) ? cost : 0;
}

function solveBalances(state, needs, autoNodes, manualResults, collector = null, coupled = false) {
    const model = {optimize: 'cost', opType: 'min', constraints: {}, variables: {}};
    const balanceNeeds = {...needs};
    for (const source of manualResults) {
        add(balanceNeeds, source.target_item, -source.output);
        for (const [item, amount] of Object.entries(source.inputs)) add(balanceNeeds, item, amount);
        for (const [item, amount] of Object.entries(source.byproducts)) add(balanceNeeds, item, -amount);
    }
    for (const item of Object.keys(state.item_data)) model.constraints[`item:${item}`] = {min: balanceNeeds[item] || 0};
    for (const [item, node] of Object.entries(autoNodes)) {
        const variable = {cost: recipeCost(state, node), [`item:${item}`]: 1};
        for (const [other, amount] of Object.entries(node.inputs)) variable[`item:${other}`] = -amount;
        for (const [other, amount] of Object.entries(node.byproducts)) variable[`item:${other}`] = amount;
        model.variables[`auto:${item}`] = variable;
    }
    if (coupled) {
        for (const [item, node] of Object.entries(autoNodes)) {
            if (node.orbital_collector || Object.keys(node.byproducts).length || (needs[item] || 0) < 0) continue;
            const supplied = manualResults.some(line => (line.target_item === item && line.output > EPSILON)
                || (line.byproducts[item] || 0) > EPSILON)
                || Object.values(autoNodes).some(other => (other.byproducts[item] || 0) > EPSILON);
            // A single-output route with no outside/coproduct supply has no
            // forced-surplus reason. Do not invent extra H-consuming products
            // merely to justify collectors and evade the selected D route.
            if (!supplied) model.constraints[`item:${item}`] = {equal: balanceNeeds[item] || 0};
        }
    }
    const errors = [];
    const finite = [...Object.values(model.constraints).map(constraint => constraint.min ?? constraint.equal),
        ...Object.values(model.variables).flatMap(variable => Object.values(variable))].every(Number.isFinite);
    if (!finite) return {result: {}, errors: ['产量或配方系数过大，无法可靠计算物料平衡']};
    let solved;
    try {
        solved = collector ? solveOrbitalBalanceVariants(model, collector) : solver.Solve(model, 1e-10);
    } catch {
        return {result: {}, errors: ['物料平衡求解失败，请检查产量、配方和成本设置']};
    }
    if (!solved.feasible) errors.push('独立来源与当前需求配方无法满足物料平衡，请检查循环配方');
    if (solved.bounded === false) errors.push('当前成本设置使求解无界，请检查成本权重');
    const result = {};
    if (solved.feasible && solved.bounded !== false) {
        for (const item of Object.keys(autoNodes)) {
            const value = solved[`auto:${item}`] || 0;
            if (value > EPSILON) result[item] = value;
        }
    }
    return {result, errors};
}

/** Demand closure excludes unrelated automatic sinks from the coupled model. */
function requiredAutomaticNodes(needs, nodes, fixed) {
    const pending = Object.entries(needs).filter(([, amount]) => amount > EPSILON).map(([item]) => item);
    for (const source of fixed) pending.push(...Object.keys(source.inputs));
    const selected = {};
    while (pending.length) {
        const item = pending.pop();
        if (selected[item] || !nodes[item]) continue;
        selected[item] = nodes[item];
        pending.push(...Object.keys(nodes[item].inputs));
    }
    return selected;
}

/**
 * A new collector must meet a selected primary material's residual demand.
 * One physical H/D variable has only three possible active sets: no growth,
 * hydrogen exactly balanced, or deuterium exactly balanced. Fixed surplus is
 * retained in the no-growth branch; coproduct value cannot create a free fleet.
 */
function solveOrbitalBalanceVariants(model, collector) {
    const growth = `auto:${collector.owner}`;
    const variants = [null, ...collector.primaries];
    let best = null;
    for (const primary of variants) {
        const candidate = structuredClone(model);
        if (primary) {
            const key = `item:${primary}`;
            candidate.constraints[key] = {equal: candidate.constraints[key].min};
        } else {
            candidate.constraints.collectorGrowth = {max: 0};
            candidate.variables[growth].collectorGrowth = 1;
        }
        const solved = solver.Solve(candidate, 1e-10);
        if (!solved.feasible) continue;
        if (solved.bounded === false) return solved;
        if (!best || solved.result < best.result - EPSILON
            || (Math.abs(solved.result - best.result) < EPSILON && (solved[growth] || 0) < (best[growth] || 0))) best = solved;
    }
    return best || {feasible: false};
}

/**
 * An oil recipe selected for both oil and hydrogen describes the same physical
 * process twice. LP ties must not arbitrarily move that process to another UI
 * row as an allocation changes. Reattribute only rigorously equivalent flows,
 * retaining the original row; no material, building, or energy flow changes.
 */
function canonicalizeEquivalentRecipes(state, result, nodes, baseline, needs) {
    const groups = new Map();
    for (const [item, node] of Object.entries(nodes)) {
        if (node.mineralized) continue;
        const key = [node.recipe_id, node.source.building, node.source.proliferator_mode, node.source.proliferator_points].join(':');
        const entries = groups.get(key) || [];
        entries.push(item);
        groups.set(key, entries);
    }
    const flows = node => ({[node.item]: node.output_per_second,
        ...scaled(node.inputs, -node.output_per_second), ...scaled(node.byproducts, node.output_per_second)});
    for (const items of groups.values()) {
        if (items.length < 2) continue;
        const preferred = items.find(item => (baseline[item] || 0) > EPSILON)
            || items.find(item => (needs[item] || 0) > 0) || items[0];
        const destination = nodes[preferred];
        const targetFlows = flows(destination);
        for (const item of items) {
            if (item === preferred || !(result[item] > EPSILON)) continue;
            const node = nodes[item];
            const sourceFlows = flows(node);
            const equivalent = new Set([...Object.keys(targetFlows), ...Object.keys(sourceFlows)]);
            if ([...equivalent].some(material => Math.abs((targetFlows[material] || 0) - (sourceFlows[material] || 0)) > 1e-9)
                || Math.abs(destination.energy_per_building - node.energy_per_building) > 1e-9
                || Math.abs(recipeCost(state, destination) * destination.output_per_second - recipeCost(state, node) * node.output_per_second) > 1e-9) continue;
            add(result, preferred, result[item] / node.output_per_second * destination.output_per_second);
            delete result[item];
        }
    }
    return result;
}

function balanceIsFeasible(result, needs, nodes, fixed) {
    const balance = {};
    for (const [item, amount] of Object.entries(needs)) add(balance, item, -amount);
    for (const [item, amount] of Object.entries(result)) {
        if (!Number.isFinite(amount) || amount < -EPSILON) return false;
        const node = nodes[item];
        if (!node) { if (amount > EPSILON) return false; else continue; }
        add(balance, item, amount);
        for (const [material, rate] of Object.entries(node.inputs)) add(balance, material, -rate * amount);
        for (const [material, rate] of Object.entries(node.byproducts)) add(balance, material, rate * amount);
    }
    for (const line of fixed) {
        if (!Object.hasOwn(nodes, line.target_item)) { if (line.output > EPSILON) return false; else continue; }
        add(balance, line.target_item, line.output);
        for (const [material, amount] of Object.entries(line.inputs)) add(balance, material, -amount);
        for (const [material, amount] of Object.entries(line.byproducts)) add(balance, material, amount);
    }
    return Object.values(balance).every(amount => Number.isFinite(amount) && amount >= -1e-6);
}

/** Preserve the established automatic route policy whenever it balances exactly. */
function solveCompatibleBalances(needs, nodes, sources, fixed, solveCompatible) {
    if (!solveCompatible) return null;
    const adjusted = {...needs};
    for (const source of sources) {
        if (!Object.hasOwn(nodes, source.target_item)) continue;
        add(adjusted, source.target_item, -source.output);
        for (const [item, amount] of Object.entries(source.inputs)) add(adjusted, item, amount);
        for (const [item, amount] of Object.entries(source.byproducts)) add(adjusted, item, -amount);
    }
    if (!Object.values(adjusted).every(Number.isFinite)) return null;
    try {
        const candidate = solveCompatible(adjusted);
        if (candidate.feasible && balanceIsFeasible(candidate.production, needs, nodes, fixed)) return candidate.production;
    } catch {
        // Some legacy reduced models cannot represent a supplied cycle. The
        // full balance model below handles it without hiding invalid flows.
    }
    return null;
}

/** Independent fixed sources and the original automatically balanced sources. */
export function calculateProductionSources(state, needs, legacy, solveCompatible, {automaticOnly = false} = {}) {
    const sources = (automaticOnly ? [] : Array.isArray(state.settings.production_sources) ? state.settings.production_sources : []).filter(Boolean);
    const errors = [];
    const savedSourceResults = sources.map((source, index) => {
        const safe = {...source, id: source.id || `source-${index}`, standalone: source.standalone === true};
        try {
            if (safe.migration_error) throw new Error(safe.migration_error);
            const node = resolveProductionSource(state, safe);
            return sourceResult(state, safe, node, toDisplayRate(node.source.output_per_minute, state.settings));
        } catch (error) {
            return sourceResult(state, safe, null, 0, error.message);
        }
    });
    const sourceResults = [];
    const pausedSources = [];
    for (const [index, source] of savedSourceResults.entries()) {
        if (source.error || source.standalone || isItemRequired(state, needs, source.target_item, legacy[0])) {
            sourceResults.push(source);
        } else {
            // Keep every saved setting and the canonical allocation. Pausing is
            // derived from the current targets and never erases a saved source.
            const stored = sources[index];
            pausedSources.push({...stored, output_per_minute: source.output_per_minute, id: source.id, standalone: false});
        }
    }
    // Mixed older/newer settings remain safe while callers migrate their saves.
    const legacyResults = migrateLegacyProductionSources(state).map(source => {
        try {
            const node = productionSourceNode(state, source);
            return sourceResult(state, source, node, toDisplayRate(source.output_per_minute, state.settings));
        } catch (error) {
            return sourceResult(state, source, null, 0, error.message);
        }
    });
    const allFixed = [...sourceResults, ...legacyResults];
    const fixedTotals = {};
    for (const source of allFixed) {
        if (Object.hasOwn(state.item_data, source.target_item)) add(fixedTotals, `output:${source.target_item}`, source.output);
        for (const [item, amount] of Object.entries(source.inputs)) add(fixedTotals, `input:${item}`, amount);
        for (const [item, amount] of Object.entries(source.byproducts)) add(fixedTotals, `byproduct:${item}`, amount);
        add(fixedTotals, 'energy', source.energy_mw);
        add(fixedTotals, 'buildings', source.buildings);
    }
    if (!Object.values(fixedTotals).every(Number.isFinite)) {
        const error = '多条来源的合计产量过大，无法可靠计算；请减小分配产量';
        errors.push(error);
        for (const source of allFixed) Object.assign(source, sourceResult(state, source, null, 0, error));
    }
    const hasAllocation = sourceResults.some(source => source.output > EPSILON);
    const fixedPool = poolFixedOrbitalCollectors(state, allFixed);
    const hasOrbitalAllocation = (fixedPool?.fixed_buildings || 0) > EPSILON;
    let orbitalActive = hasOrbitalAllocation || needsOrbitalCollectorCalculation(state, legacy[0]);
    const autoNodes = {};
    for (const item of Object.keys(state.item_data)) {
        try {
            const node = productionSourceNode(state, automaticSource(state, item), {mineralized: item in state.settings.mineralize_list});
            autoNodes[item] = node;
        } catch (error) {
            // An unused unusable recipe need not make an otherwise valid plan
            // fail; the LP will report infeasibility if that route is necessary.
            if ((needs[item] || 0) > 0) errors.push(`${item}：${error.message}`);
        }
    }
    if (!orbitalActive && allFixed.some(line => line.output > EPSILON)) {
        // Standalone sources can introduce collector demand several inputs
        // upstream, even when the original target list is empty.
        orbitalActive = Object.values(requiredAutomaticNodes(needs, autoNodes, allFixed))
            .some(node => node.orbital_collector);
    }
    if (!hasAllocation && !orbitalActive) {
        // A zero or paused source preserves legacy normalization exactly.
        for (const [item, node] of Object.entries(autoNodes)) {
            const graph = state.item_graph[item];
            node.inputs = graph.原料;
            node.byproducts = graph.副产物;
            node.output_per_second = graph.产出倍率 * node.factory.倍率;
            node.gross_multiplier = 1 + (graph.自消耗 || 0);
        }
    }
    let result = legacy[0];
    if (hasAllocation || orbitalActive) {
        // Explicit disposal penalties need the full objective: the legacy
        // historical-cost reduction can bypass them by making surplus products.
        const hasDisposalPenalty = Object.values(state.scheme_data.cost_weight.物品额外成本)
            .some(cost => (Number(cost.溢出时处理成本) || 0) !== 0);
        const compatible = hasDisposalPenalty || orbitalActive ? null : solveCompatibleBalances(needs, autoNodes, sourceResults, allFixed, solveCompatible);
        if (compatible) {
            result = compatible;
        } else {
            const solveNodes = orbitalActive ? requiredAutomaticNodes(needs, autoNodes, allFixed) : autoNodes;
            const collectorItems = orbitalActive ? Object.keys(solveNodes).filter(item => solveNodes[item].orbital_collector) : [];
            // A single variable carries both outputs. Other selected collector
            // rows are views of that process, never extra physical production.
            const collectorOwner = ['氢', '重氢'].find(item => collectorItems.includes(item));
            const collector = collectorOwner ? {owner: collectorOwner, primaries: collectorItems} : null;
            if (collector) for (const item of collectorItems) if (item !== collectorOwner) delete solveNodes[item];
            const solved = solveBalances(state, needs, solveNodes, allFixed, collector, orbitalActive);
            result = orbitalActive ? solved.result : canonicalizeEquivalentRecipes(state, solved.result, autoNodes, legacy[0], needs);
            errors.push(...solved.errors);
        }
    }
    // Keep a fully allocated item in its original dependency position.
    result = {...result};
    for (const source of sourceResults) {
        if (hasAllocation && Object.hasOwn(state.item_data, source.target_item) && !Object.hasOwn(result, source.target_item)) result[source.target_item] = 0;
    }
    const automatic = {};
    for (const [item, amount] of Object.entries(result)) {
        if (Object.hasOwn(autoNodes, item)) {
            try {
                automatic[item] = sourceResult(state, autoNodes[item].source, autoNodes[item], amount);
            } catch (error) {
                errors.push(`${item}：${error.message}`);
                result[item] = 0;
            }
        }
    }
    for (const source of sourceResults) {
        const item = source.target_item;
        if (Object.hasOwn(autoNodes, item) && !Object.hasOwn(automatic, item)) automatic[item] = sourceResult(state, autoNodes[item].source, autoNodes[item], 0);
    }
    if (orbitalActive) {
        for (const [item, node] of Object.entries(autoNodes)) {
            if (node.orbital_collector && !automatic[item]) automatic[item] = sourceResult(state, node.source, node, 0);
        }
    }
    const sharedCollectors = finalizeOrbitalCollectors(state, automatic, allFixed, fixedPool);
    const required = {};
    for (const [item, amount] of Object.entries(needs)) required[item] = Math.max(0, Number(amount) || 0);
    const incoming = {};
    for (const [item, amount] of Object.entries(needs)) if (amount < 0) incoming[item] = -amount;
    for (const line of [...Object.values(automatic), ...allFixed]) {
        for (const [item, amount] of Object.entries(line.inputs)) add(required, item, amount);
        for (const [item, amount] of Object.entries(line.byproducts)) add(incoming, item, amount);
    }
    const allocated = {};
    for (const line of allFixed) if (Object.hasOwn(state.item_data, line.target_item)) add(allocated, line.target_item, line.output);
    const groups = {};
    const recomputed = hasAllocation || orbitalActive;
    const surplus = recomputed ? {} : {...legacy[1]};
    for (const item of new Set([...Object.keys(result), ...Object.keys(required), ...Object.keys(incoming), ...Object.keys(allocated)])) {
        const produced = (result[item] || 0) + (allocated[item] || 0) + (incoming[item] || 0);
        const excess = Math.max(0, produced - (required[item] || 0));
        if (recomputed && excess > EPSILON) surplus[item] = excess;
        groups[item] = {
            required: required[item] || 0,
            allocated: allocated[item] || 0,
            automatic: result[item] || 0,
            byproduct_supply: incoming[item] || 0,
            surplus: excess > EPSILON ? excess : 0,
            missing: Math.max(0, (required[item] || 0) - produced),
        };
    }
    const missingItems = Object.entries(groups).filter(([, group]) => group.missing > 1e-6).map(([item]) => item);
    if (missingItems.length) errors.push(`当前来源未能满足物料需求：${missingItems.join('、')}`);
    const totals = {buildingCounts: {}, fractionalBuildingCounts: {}, rawMaterials: {}, energyCost: 0, totalEnergyCost: 0};
    for (const line of [...Object.values(automatic), ...allFixed]) {
        const count = line.physical_building_count ?? line.building_count;
        const buildings = line.physical_buildings ?? line.buildings;
        if (count > 0 && !line.mineralized) {
            add(totals.buildingCounts, line.factory_name, count);
            add(totals.fractionalBuildingCounts, line.factory_name, buildings);
        }
        if (line.is_raw && line.output > EPSILON) add(totals.rawMaterials, line.target_item, line.output);
        if (line.shared_collector_group) {
            for (const [item, amount] of Object.entries(line.byproducts)) add(totals.rawMaterials, item, amount);
        }
        totals.totalEnergyCost += line.energy_mw;
        if (!isMiningBuilding(line.factory_name || '')) totals.energyCost += line.energy_mw;
    }
    let overflow = false;
    for (const record of [...Object.values(groups), totals.buildingCounts, totals.fractionalBuildingCounts, totals.rawMaterials, totals]) {
        for (const [key, value] of Object.entries(record)) {
            if (typeof value === 'number' && !Number.isFinite(value)) {
                record[key] = 0;
                overflow = true;
            }
        }
    }
    if (overflow) errors.push('产量合计超出可表示范围，统计结果无效；请减小产量');
    const order = [...new Set([...Object.keys(legacy[0]), ...Object.keys(result), ...sourceResults.map(source => source.target_item)])]
        .filter(item => Object.hasOwn(state.item_data, item));
    const details = {shared_collectors: sharedCollectors, sources: sourceResults, paused_sources: pausedSources, legacy_sources: legacyResults, automatic, groups, totals, order, item_order: order, errors, valid: errors.length === 0 && sourceResults.every(source => !source.error)};
    return [result, surplus, details];
}
