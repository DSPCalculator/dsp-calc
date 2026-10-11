import {pileSorterLevel, pileSorterLabel, PILE_SORTER_RESEARCH} from './lib/pile-sorter.js';
import {productionSourceNode} from './production_sources.js';

// Vanilla, unstacked cargo and one item per sorter trip. These values are not
// present in the repository's recipe data, so never reuse them for mod data.
// Youthcat-authored in-game descriptions reproduced in BWIKI's speed/transport
// sections: https://wiki.biligame.com/dsp/极速传送带#速度
// https://wiki.biligame.com/dsp/分拣器#运输
export const BELT_TIERS = Object.freeze([
    Object.freeze({tier: 1, name: '传送带', capacityPerSecond: 6}),
    Object.freeze({tier: 2, name: '高速传送带', capacityPerSecond: 12}),
    Object.freeze({tier: 3, name: '极速传送带', capacityPerSecond: 30}),
]);

export const SORTER_TIERS = Object.freeze([
    Object.freeze({tier: 1, name: '分拣器', capacityPerSecond: 1.5}),
    Object.freeze({tier: 2, name: '高速分拣器', capacityPerSecond: 3}),
    Object.freeze({tier: 3, name: '极速分拣器', capacityPerSecond: 6}),
]);

// Full Pile Sorter Upgrade VI, 4-layer output. 120 items/s is the effective
// interface capacity of ONE saturated Mk.III belt across 1–3 cells, not a
// claim about the sorter's internal maximum or every cargo's actual stack.
// https://wiki.biligame.com/dsp/集装分拣器
export const PILE_SORTER_TIERS = Object.freeze([
    Object.freeze({tier: 4, name: '集装分拣器', capacityPerSecond: 120}),
]);
export const PILE_STACK_HEIGHT = 4;

const MOD_REASON = '当前模组组合没有经过版本核验的物流容量数据，暂不推荐具体等级或数量';
const INVALID_RATE_REASON = '流量必须为有限的非负数，无法可靠估算';
const BYPRODUCT_REASON = '副产物未追溯到实际来源建筑，无法核算其单台出料分拣器';
const BASE_ASSUMPTIONS = Object.freeze([
    '传送带：合并出料流量，未叠堆；按净供给合并，不包含配方内部回流',
    '传送带为产物运抵地表后的带宽折算，不代表轨道采集器等设施具有传送带接口',
    '分拣器：单台满载建筑的目标产物出料，1格，基础科技、单件搬运；无入料、距离或布局保证',
    '不足一台的生产份额也按一台满载产能核算，未假定平均限速或均匀分流',
    '并联数量只是流量参考，不是实际布局最少数量；还需核对接口、堆叠研究站、分流和供料',
    '未读取分拣器货物叠加科技与集装分拣器配置，不将升级或集装能力计入推荐',
]);
const PILE_ASSUMPTIONS = Object.freeze([
    '已启用集装分拣器：原版、集装分拣器改良 6（满级），制造建筑出料按理想 4 层货物估算；不保证每个货物均为 4 层',
    '传送带：按各来源目标产物毛出料计算，保留同物品回流；不同产物各自计算，不以净供给抵消接口流量',
    '仅已确认使用分拣器的制造来源按 4 层；采矿、抽水、接收站、分馏塔、采集器、外部供给和未追溯副产物均按 1 层',
    '传送带基础速度为 6 / 12 / 30 货物每秒；理想 4 层时为 24 / 48 / 120 件每秒；混合来源按各自货物占位相加',
    '集装分拣器：单台满载建筑的目标产物毛出料；1–3 格、满速蓝带接口按 120 件每秒估算，非分拣器内部绝对速度上限',
    '不足一台的生产份额也按一台满载产能核算；研究站仅按单个建筑，共用出料接口需另行核对',
    '这些是理想供料下的流量参考，不保证入料、布局、分流或端口数量；轨道采集器仅折算运抵地表后的带宽',
]);
const PILE_INTERFACE_REASON = '满级集装分拣器按 1–3 格、单条满速蓝带接口 120 件/s 估算；实际出料仍受传送带与端口限制';

// Community 1-cell approximate reference, not a verified building→belt formula.
// https://steamcommunity.com/app/1366540/discussions/0/4210371088512004754/
const PILE_OUTPUT_REFERENCE = [13.3, 17.1, 18, 22.5, 21.8, 26.7, 120];
export function pileSorterConfig(level) {
    const research = PILE_SORTER_RESEARCH[level];
    if (!research) return null;
    const {stackHeight, carryingCapacity} = research;
    const capacity = PILE_OUTPUT_REFERENCE[level];
    const interfaceReason = level === 6 ? PILE_INTERFACE_REASON
        : `${pileSorterLabel(level)}：1 格、社区吞吐参考约 ${capacity} 件/s；搬运 ${carryingCapacity} 件、卸货最高 ${stackHeight} 层；测试接口条件未完整记载；实际取卸等待、带速和端口会限制吞吐`;
    return {...research, tiers: [{tier: 4, name: '集装分拣器', capacityPerSecond: capacity}], interfaceReason,
        assumptions: level === 6 ? PILE_ASSUMPTIONS : [
            `${pileSorterLabel(level)}：每次搬运 ${carryingCapacity} 件，制造出料按理想 ${stackHeight} 层；不保证每个货物满层`,
            '传送带按各来源目标产物毛出料和货物占位合并，保留内部回流',
            '仅已确认使用分拣器的制造来源采用所选叠堆高度；直连、采集、外部供给和未追溯副产物均按 1 层',
            interfaceReason,
            '分拣器容量为玩家实测参考，并非官方精确公式；不使用搬运量乘往返速度代替实际接口吞吐',
            '不足一台也按单台满载产能核算；数量仅供参考，不保证进料、实际布局、并联端口或堆叠研究站共用接口',
        ]};
}

// An explicit whitelist prevents a new/special factory from silently inheriting
// a sorter interface. Labs are per individual building, not their shared stack.
const SORTER_FACTORIES = new Set([
    '制造台 Mk.I', '制造台 Mk.II', '制造台 Mk.III', '重组式制造台',
    '电弧熔炉', '位面熔炉', '负熵熔炉', '原油精炼厂',
    '化工厂', '量子化工厂', '微型粒子对撞机', '矩阵研究站', '自演化研究站',
]);

function emptyEstimate(status, reason, throughputPerSecond = null) {
    return {status, recommended: null, alternatives: [], reason, throughputPerSecond};
}

/** Minimum tier for one flow; above the top tier, use parallel top-tier units. */
export function estimateThroughput(throughputPerSecond, tiers) {
    const rate = Number(throughputPerSecond);
    if (!Number.isFinite(rate) || rate < 0) return emptyEstimate('unavailable', INVALID_RATE_REASON);
    if (rate === 0) return emptyEstimate('none', '零流量，无需运输', 0);
    const alternatives = tiers.map(tier => {
        const ratio = rate / tier.capacityPerSecond;
        // Avoid an extra parallel lane for floating point noise at an exact
        // capacity boundary. A positive tiny flow still always needs one lane.
        const tolerance = Math.max(1e-9, Number.EPSILON * 4 * Math.abs(ratio));
        return {...tier, count: Math.max(1, Math.ceil(ratio - tolerance))};
    });
    if (!alternatives.length || alternatives.some(option => !Number.isSafeInteger(option.count))) {
        return emptyEstimate('unavailable', '流量过大，并联数量超出可可靠计算的范围', rate);
    }
    return {
        status: 'ready',
        recommended: alternatives.find(option => option.count === 1) || alternatives.at(-1),
        alternatives,
        reason: '',
        throughputPerSecond: rate,
    };
}

function hasUnsupportedMods(game) {
    // This verified append-only recipe profile leaves vanilla belts, sorters,
    // machine speeds and cargo behavior unchanged. Do not allow unknown mixes.
    if (game.game_name === 'DarkFogSynthesis' && game.DarkFogSynthesisEnable === true
        && game.mods?.length === 1 && game.mods[0] === 'DarkFogSynthesis'
        && !Object.entries(game).some(([key, value]) => key.endsWith('Enable') && key !== 'DarkFogSynthesisEnable' && value === true)) return false;
    return (game.mods || []).some(mod => mod !== 'Vanilla')
        || Object.entries(game).some(([key, value]) => key.endsWith('Enable') && value === true)
        || (game.game_name && game.game_name !== 'Vanilla');
}

function rateEstimate(rate, tiers, supported) {
    const estimate = estimateThroughput(rate, tiers);
    if (estimate.status !== 'ready' || supported) return estimate;
    return emptyEstimate('unavailable', MOD_REASON, rate);
}

/** Mixed stacks occupy separate cargo slots; never grant raw sources free 4x. */
function pileBeltEstimate(itemsPerSecond, cargoPerSecond, supported) {
    const estimate = rateEstimate(cargoPerSecond, BELT_TIERS, supported);
    const averageStack = cargoPerSecond > 0 ? itemsPerSecond / cargoPerSecond : 1;
    const alternatives = estimate.alternatives.map(option => ({...option,
        cargoCapacityPerSecond: option.capacityPerSecond,
        capacityPerSecond: option.capacityPerSecond * averageStack,
    }));
    return {...estimate, throughputPerSecond: itemsPerSecond, cargoPerSecond,
        averageStack, alternatives,
        recommended: alternatives.find(option => option.tier === estimate.recommended?.tier) || null};
}

function automaticSource(state, item) {
    const recipeChoice = state.scheme_data.item_recipe_choices[item];
    const recipeId = state.item_data[item]?.[recipeChoice];
    const config = state.scheme_data.scheme_for_recipe[recipeId] || {};
    return {
        id: `automatic-${item}`, target_item: item, recipe_choice: recipeChoice,
        building: config.建筑, proliferator_mode: config.增产模式,
        proliferator_points: config.增产点数,
    };
}

function sorterExclusion(node) {
    const factory = node.factory.名称.replace(/\s/g, ' ');
    if (node.mineralized) return ['not-applicable', '外部供给没有本地生产建筑，不估算出料分拣器'];
    if (factory === '轨道采集器') return ['not-applicable', '轨道采集器通过物流运输，不使用建筑出料分拣器'];
    if (factory.endsWith('分馏塔')) return ['not-applicable', '分馏塔使用传送带接口；循环带和接口布局未评估'];
    if (factory === '射线接收站' || factory === '能量枢纽') return ['not-applicable', `${node.factory.名称}使用传送带接口，不套用普通分拣器模型`];
    if (node.is_raw) return ['not-applicable', '采集或直接获取来源不套用制造建筑出料分拣器模型'];
    if (!SORTER_FACTORIES.has(factory)) return ['unavailable', `${node.factory.名称}的运输接口未评估，不套用普通分拣器模型`];
    return null;
}

function sourceEstimate(state, source, kind, outputPerSecond, supported, pileConfig) {
    const usePileSorter = Boolean(pileConfig);
    const result = {
        id: source.id,
        kind,
        factoryName: source.factory_name || '',
        outputPerSecond,
        perBuildingPerSecond: null,
        buildings: null,
        belt: usePileSorter
            ? {...pileBeltEstimate(outputPerSecond, outputPerSecond, supported), stackHeight: 1, grossKnown: false,
                reason: '来源尚未核实，暂按已知净供给、1 层货物折算'}
            : rateEstimate(outputPerSecond, BELT_TIERS, supported),
        sorter: emptyEstimate('unavailable', '来源产能未评估'),
        reason: '',
    };
    if (!Number.isFinite(outputPerSecond) || outputPerSecond < 0 || source.error) {
        result.reason = source.error || INVALID_RATE_REASON;
        result.sorter = emptyEstimate('unavailable', result.reason);
        return result;
    }
    if (outputPerSecond === 0) {
        result.buildings = 0;
        result.sorter = emptyEstimate('none', '零流量，无需运输', 0);
        return result;
    }
    try {
        const node = productionSourceNode(state, source, {
            mineralized: kind === 'automatic' && Object.hasOwn(state.settings.mineralize_list || {}, source.target_item),
        });
        result.factoryName = node.factory.名称;
        if (node.factory.名称 === '轨道采集器') result.belt.reason = '仅作运抵地表后的带宽折算，轨道采集器自身没有传送带接口';
        result.buildings = node.mineralized ? 0 : outputPerSecond / node.output_per_second;
        const perBuilding = node.output_per_second * node.gross_multiplier;
        result.perBuildingPerSecond = Number.isFinite(perBuilding) ? perBuilding : null;
        const exclusion = sorterExclusion(node);
        if (usePileSorter) {
            const stackHeight = supported && !exclusion ? pileConfig.stackHeight : 1;
            const grossOutput = outputPerSecond * node.gross_multiplier;
            result.belt = pileBeltEstimate(grossOutput, grossOutput / stackHeight, supported);
            result.belt.stackHeight = stackHeight;
            result.belt.grossKnown = true;
            const stackReason = supported && !exclusion
                ? `集装分拣器制造出料：理想 ${stackHeight} 层；流量为该目标产物毛出料，含同物品回流`
                : '此来源未采用集装制造出料假设，按 1 层货物折算；不自动获得 4 倍带宽';
            result.belt.reason = [result.belt.reason, stackReason,
                node.factory.名称 === '轨道采集器' ? '仅作运抵地表后的带宽折算，轨道采集器自身没有传送带接口' : '',
            ].filter(Boolean).join('；');
        }
        if (exclusion) {
            result.reason = exclusion[1];
            result.sorter = emptyEstimate(exclusion[0], exclusion[1], result.perBuildingPerSecond);
        } else {
            result.sorter = rateEstimate(perBuilding, usePileSorter ? pileConfig.tiers : SORTER_TIERS, supported);
            if (usePileSorter && supported && result.sorter.status === 'ready') result.sorter.reason = pileConfig.interfaceReason;
            result.reason = result.sorter.reason;
            if (node.factory.名称.endsWith('研究站') && Number(state.settings.stack_research_lab) > 1) {
                const stackReason = '仅按单个研究站满载出料估算；堆叠研究站的共用出料接口尚未评估';
                result.sorter.reason = [result.sorter.reason, stackReason].filter(Boolean).join('；');
                result.sorter.complete = false;
                result.reason = result.sorter.reason;
            }
        }
    } catch (error) {
        result.reason = error.message || '来源配方或建筑数据无效，无法估算出料分拣器';
        result.sorter = emptyEstimate('unavailable', result.reason);
    }
    return result;
}

/**
 * Read-only logistics reference. All input amounts are in the current display
 * unit; all returned rates/capacities are physical items/second. Manual sources
 * are the existing engine's source results (not saved per-minute allocations).
 * Baseline belt = aggregate NET supply; enabled pile mode = GROSS target output
 * converted to cargo slots for each source. Sorter = single FULL-LOAD
 * manufacturing building's GROSS target output, never the aggregate bus flow.
 */
export function estimateLogistics(state, item, {automaticOutput = 0, manualSources = [], byproductSupply = 0} = {}) {
    const supported = !hasUnsupportedMods(state.game_data);
    const level = pileSorterLevel(state.scheme_data);
    const pileConfig = level >= 0 ? pileSorterConfig(level) : null;
    const usePileSorter = Boolean(pileConfig);
    const timeUnit = state.settings.is_time_unit_minute ? 60 : 1;
    const warnings = supported ? [] : [MOD_REASON];
    const sources = [sourceEstimate(state, automaticSource(state, item), 'automatic', Number(automaticOutput) / timeUnit, supported, pileConfig)];
    for (const source of manualSources) {
        if (source.target_item !== item) continue;
        sources.push(sourceEstimate(state, source, 'manual', Number(source.output) / timeUnit, supported, pileConfig));
    }
    const byproductRate = Number(byproductSupply) / timeUnit;
    if (byproductRate !== 0) {
        sources.push({
            id: `byproduct-${item}`, kind: 'byproduct', factoryName: '',
            outputPerSecond: byproductRate, perBuildingPerSecond: null, buildings: null,
            belt: usePileSorter
                ? {...pileBeltEstimate(byproductRate, byproductRate, supported), stackHeight: 1, grossKnown: false,
                    reason: '副产物来源未追溯，暂按已知供给、1 层货物折算，不假定集装出料'}
                : rateEstimate(byproductRate, BELT_TIERS, supported),
            sorter: emptyEstimate('unavailable', BYPRODUCT_REASON), reason: BYPRODUCT_REASON,
        });
    }
    const invalid = sources.some(source => !Number.isFinite(source.outputPerSecond) || source.outputPerSecond < 0);
    const sum = sources.reduce((total, source) => total + source.outputPerSecond, 0);
    const totalPerSecond = !invalid && Number.isFinite(sum) ? sum : null;
    let belt = totalPerSecond === null
        ? emptyEstimate('unavailable', INVALID_RATE_REASON)
        : rateEstimate(totalPerSecond, BELT_TIERS, supported);
    if (usePileSorter && totalPerSecond !== null) {
        const gross = sources.reduce((total, source) => total + source.belt.throughputPerSecond, 0);
        const cargo = sources.reduce((total, source) => total + (source.belt.cargoPerSecond ?? source.outputPerSecond), 0);
        belt = pileBeltEstimate(gross, cargo, supported);
        if (belt.status === 'ready') {
            const mixed = sources.some(source => source.outputPerSecond > 0 && source.belt.stackHeight > 1)
                && sources.some(source => source.outputPerSecond > 0 && source.belt.stackHeight === 1);
            belt.reason = mixed
                ? `混合来源按「${pileConfig.stackHeight} 层制造出料 ÷ ${pileConfig.stackHeight} + 1 层其它来源」累加货物占位；单条容量是当前来源比例下的等效件数`
                : '按各来源货物占位合并；请在来源明细中核对毛出料和叠堆条件';
            if (sources.some(source => source.outputPerSecond > 0 && source.belt.grossKnown === false)) {
                belt.reason += '；未追溯或无效来源仅按已知净供给、1 层折算，毛出料尚未核实';
            }
        }
    }
    const active = sources.filter(source => source.outputPerSecond !== 0);
    const evaluated = active.filter(source => source.sorter.status === 'ready');
    const unknown = active.filter(source => source.sorter.status === 'unavailable');
    let sorter;
    if (invalid || totalPerSecond === null) {
        sorter = emptyEstimate('unavailable', INVALID_RATE_REASON);
    } else if (!active.length) {
        sorter = emptyEstimate('none', '零流量，无需运输', 0);
    } else if (evaluated.length) {
        const busiest = evaluated.reduce((best, source) => source.perBuildingPerSecond > best.perBuildingPerSecond ? source : best);
        sorter = {...busiest.sorter, sourceId: busiest.id,
            reason: unknown.length ? '仅比较已评估来源；部分来源的单台出料尚未核算' : '取已评估来源中单台满载出料流量最高者，不将全部建筑出料相加'};
    } else if (unknown.length) {
        sorter = emptyEstimate('unavailable', unknown.map(source => source.sorter.reason).filter((reason, index, list) => list.indexOf(reason) === index).join('；'));
    } else {
        sorter = emptyEstimate('not-applicable', '这些来源不适用普通制造建筑的出料分拣器模型');
    }
    sorter.complete = !invalid && unknown.length === 0 && evaluated.every(source => source.sorter.complete !== false);
    for (const source of sources) {
        if (source.reason) warnings.push(source.reason);
        if (source.outputPerSecond > 0 && source.belt.reason) warnings.push(source.belt.reason);
    }
    if (invalid || totalPerSecond === null) warnings.push(INVALID_RATE_REASON);
    return {
        supported, totalPerSecond, belt, sorter, sources,
        ...(usePileSorter ? {usePileSorter: true, pileSorterLevel: level, pileSorterLabel: pileSorterLabel(level), beltTitle: '合并毛出料，按来源叠堆'} : {}),
        assumptions: [...(usePileSorter ? pileConfig.assumptions : BASE_ASSUMPTIONS)],
        warnings: [...new Set(warnings)],
    };
}
