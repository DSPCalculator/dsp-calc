import {useContext, useMemo, useState, useEffect, useRef} from 'react';
import {CompactModeContext, GlobalStateContext, SchemeDataSetterContext, SettingsSetterContext} from './contexts';
import {ItemIcon} from './icon';
import {ByproductSourceCard, PausedProductionSources, ProductionSourceCard, ProductionSourceGroup, SharedCollectorsSummary, ProductionByproducts} from './natural_production_line';
import {createProductionSource, fromDisplayRate, getProductionEnergy, isItemRequired, isMiningBuilding} from './production_sources.js';
import {describeRecipe, HorizontalMultiButtonSelect, Recipe} from './recipe';
import {AutoSizedInput} from './ui_components/auto_sized_input.jsx';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';
import {Card, CardContent, CardHeader, CardTitle} from './components/ui/card';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from './components/ui/dialog';
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';
import {cn} from './lib/utils';
import {estimateLogistics} from './logistics.js';
import {LogisticsOverview} from './logistics_overview.jsx';
import {buildProductionPresentation} from './lib/production-presentation.js';
import {buildDependencyView} from './dependency_view.js';
import {DependencyOverview} from './dependency_overview.jsx';
import {CanonicalProductionRow, ProductionColumns, ProductionItemName} from './production_result_row.jsx';
import {isPlanOwnedSource, targetIdentity} from './lib/plan-state.js';

function AutomaticSourceRoute({item, inactive, children}) {
    if (!inactive) return children;
    return <details className="dsp-inactive-automatic-route order-last rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <summary className="cursor-default" aria-label={`${item}备用需求配方`}>{item}备用需求配方（当前无需生产）</summary>
        <p className="py-2">当前需求由联产来源满足；这里保留此物品原有的配方设置。</p>
        {children}
    </details>;
}

function MovedAutomaticSourceCard({line, scheme, setScheme, onAddByproductSource}) {
    const item = line.displayItem;
    const controlItem = line.controlItem;
    const recipeId = line.recipe_id;
    const config = scheme.scheme_for_recipe[recipeId];
    const updateConfig = patch => setScheme(previous => {
        const next = structuredClone(previous);
        Object.assign(next.scheme_for_recipe[recipeId], patch);
        return next;
    });
    return <ProductionSourceCard key={line.id} item={item} controlItem={controlItem} physicalSourceId={line.sourceId}
        automatic output={line.output} buildings={line.buildings} factory_name={line.factory_name} sharedGroup={line.sharedCollector}
        recipe_id={recipeId} recipe_choice={scheme.item_recipe_choices[controlItem]} building={config.建筑}
        proliferator_mode={config.增产模式} proliferator_points={config.增产点数}
        onRecipeChange={value => setScheme(previous => ({...previous,
            item_recipe_choices: {...previous.item_recipe_choices, [controlItem]: value}}))}
        onFactoryChange={value => updateConfig({建筑: value})} onModeChange={value => updateConfig({增产模式: Number(value)})}
        onPointsChange={value => updateConfig({增产点数: Number(value)})} outputByproducts={line.byproducts} onAddByproductSource={onAddByproductSource}/>;
}

const ValueWithDifference = ({currentValue, previousValue}) => {
    const global_state = useContext(GlobalStateContext);
    const fixedNum = global_state.settings.fixed_num;
    // 如果没有上一次的值或者值相同，则只显示当前值
    if (previousValue === undefined || Math.abs(currentValue - previousValue) < 1e-6) {
        return <>
            {currentValue.toFixed(fixedNum)}
        </>;
    }

    // 计算差值
    const diff = currentValue - previousValue;
    const diffSign = diff > 0 ? '+' : '';


    return (
        <>
            {currentValue.toFixed(fixedNum)}
            <span className={cn("ml-1 align-sub text-xs", diff > 0 ? "text-rose-500" : "text-emerald-600")}>
                {diffSign}{diff.toFixed(fixedNum)}
            </span>
        </>
    );
};

export function RecipeSelect({item, choice, onChange, onFork, compact}) {
    const global_state = useContext(GlobalStateContext);
    const {game_data, item_data} = global_state;
    if (item_data[item].length === 2) {
        return <div className="px-1 py-1.5"><Recipe recipe={game_data.recipe_data[item_data[item][1]]} compact={compact}/></div>;
    }
    return <div className="dsp-recipe-options flex w-fit max-w-80 flex-col gap-0.5 rounded-md border bg-muted/30 p-0.5" role="group" aria-label={`${item}配方`}>
        {item_data[item].slice(1).map((recipe_index, index) => {
            const value = index + 1;
            const recipeButton = <Button key={recipe_index} type="button" variant="ghost" size="sm"
                aria-label={`${item}配方 ${value}`} aria-description={describeRecipe(game_data.recipe_data[recipe_index])} aria-pressed={choice == value}
                className={cn("h-auto min-h-8 justify-start rounded-md px-1 py-1.5", onFork && "w-full", choice == value && "bg-background shadow-sm ring-1 ring-border hover:bg-background")}
                onClick={() => onChange(value)}>
                <Recipe recipe={game_data.recipe_data[recipe_index]} compact={compact}/>
            </Button>;
            if (!onFork) return recipeButton;
            return <div key={recipe_index} className="dsp-recipe-option relative">
                {recipeButton}
                {choice != value && <Button type="button" variant="ghost" size="icon-xs"
                    className="dsp-recipe-fork absolute -right-1 -top-1 z-10 size-6 rounded-full p-0 hover:bg-transparent"
                    aria-label={`使用${item}配方 ${value}添加产线`}
                    aria-description={`${describeRecipe(game_data.recipe_data[recipe_index])}；新产线初始产量为 0，保留当前需求配方`}
                    title="使用此配方添加产线"
                    onClick={event => { event.stopPropagation(); onFork(value); }}>
                    <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border bg-background text-base leading-none shadow-sm">+</span>
                </Button>}
            </div>;
        })}
    </div>;
}

function RatioAdjustInput({value, fixed_num, needs_list, set_needs_list, label}) {
    const disp_value = value.toFixed(fixed_num);
    const base_value = +disp_value;
    function set_needs_in_row(e_or_value) {
        if (base_value != 0) {
            const new_value = e_or_value.target ? e_or_value.target.value : e_or_value;
            const new_needs_list = {};
            for (const item in needs_list) {
                new_needs_list[item] = needs_list[item] * new_value / base_value;
            }
            set_needs_list(new_needs_list);
        }
    }
    return <Tooltip>
        <TooltipTrigger asChild>
            <span className="inline-flex">
                <AutoSizedInput delayed value={disp_value} onChange={set_needs_in_row} aria-label={label}/>
            </span>
        </TooltipTrigger>
        <TooltipContent>等比例调整所有需求</TooltipContent>
    </Tooltip>;
}

export function ProNumSelect({choice, onChange, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_num_text = {};
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["增产点数"]] = game_data.proliferator_data[i]["名称"];
    }
    let pro_num_options = [];
    for (let i = 0; i < game_data.proliferator_effect.length; i++) {
        if (i == 0) {
            continue;
        } else if (global_state.proliferator_price[i] != -1)
            pro_num_options.push({value: i, item_icon: pro_num_text[i]});

    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange}
                                        icon_size={icon_size} optionType={"proNumSelect"}/>;
}

export const pro_mode_class = {
    [1]: "pro-mode-speedup",
    [2]: "pro-mode-extra-products"
}

export function ProModeSelect({recipe_id, choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_modes = {[0]: "无"};
    //如果是增产塔，只能选择增产分馏
    if (game_data.recipe_data[recipe_id]["增产"] & (1 << 3)) {
        pro_modes = {};
    }
    ["加速", "增产", "接收站透镜喷涂", "增产分馏"].forEach((e, i) => {
        if (game_data.recipe_data[recipe_id]["增产"] & (1 << i)) pro_modes[i + 1] = e
    })
    let options = Object.entries(pro_modes).map(([value, label]) => (
        {value: value, label: label, className: pro_mode_class[value]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        className={"raw-text-selection [&>button]:text-base"}/>;
}

export function FactorySelect({recipe_id, choice, onChange, no_gap, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let factory_kind = game_data.recipe_data[recipe_id]["设施"];
    let factory_list = game_data.factory_data[factory_kind];

    let options = factory_list.map((factory_data, idx) => (
        {value: idx, item_icon: factory_data["名称"]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        no_gap={no_gap} icon_size={icon_size}/>;
}
// 简易的对象相等性检查函数
const isEqual = (obj1, obj2) => {
    if (!obj1 || !obj2) return obj1 === obj2;

    // 比较能源成本
    if (Math.abs(obj1.energyCost - obj2.energyCost) > 1e-6 ||
        Math.abs(obj1.totalEnergyCost - obj2.totalEnergyCost) > 1e-6) {
        return false;
    }

    // 比较建筑数量
    const buildings1 = Object.keys(obj1.buildingCounts);
    const buildings2 = Object.keys(obj2.buildingCounts);

    if (buildings1.length !== buildings2.length) {
        return false;
    }

    for (const building of buildings1) {
        if (obj1.buildingCounts[building] !== obj2.buildingCounts[building]) {
            return false;
        }
    }

    // 比较原矿材料
    const materials1 = Object.keys(obj1.rawMaterials);
    const materials2 = Object.keys(obj2.rawMaterials);

    if (materials1.length !== materials2.length) {
        return false;
    }

    for (const material of materials1) {
        if (Math.abs(obj1.rawMaterials[material] - (obj2.rawMaterials[material] || 0)) > 1e-6) {
            return false;
        }
    }

    return true;
};

export function Result({needs_list, set_needs_list, show_ore_popup, set_show_ore_popup, show_building_popup, set_show_building_popup, focus_request}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const set_settings = useContext(SettingsSetterContext);
    const compact_mode = useContext(CompactModeContext);
    const result_ref = useRef(null);
    const pending_source_focus = useRef(null);
    const pending_global_focus = useRef(null);
    const handled_focus_request = useRef(null);
    const [view_mode, set_view_mode] = useState('flat');
    const is_compact = compact_mode !== "full";
    const is_mobile = compact_mode === "mobile";

    const mob_btn_icon = is_mobile ? 18 : 32; // 表格内按钮图标
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;
    let settings = global_state.settings;
    let item_data = global_state.item_data;
    const has_item = item => Object.hasOwn(item_data, item);
    let item_graph = global_state.item_graph;
    let time_tick = settings.is_time_unit_minute ? 60 : 1;

    // TODO refactor to a simple list
    let mineralize_list = settings.mineralize_list;

    const [result_dict, lp_surplus_list, source_details] = useMemo(() => {
        const res = global_state.calculate(needs_list);
        return res;
    }, [global_state, needs_list]);

    const presentation = useMemo(() => buildProductionPresentation(global_state, needs_list,
        [result_dict, lp_surplus_list, source_details]),
    [global_state, needs_list, result_dict, lp_surplus_list, source_details]);

    const dependency_view = useMemo(() => view_mode === 'tree'
        ? buildDependencyView(global_state, needs_list, [result_dict, lp_surplus_list, source_details], {presentation}) : null,
    [view_mode, global_state, needs_list, result_dict, lp_surplus_list, source_details, presentation]);

    const linked_byproducts = {groups: presentation.groups,
        byItem: Object.fromEntries(Object.entries(presentation.byItem).map(([item, value]) => [item, value.byproducts]))};

    function focus_global_line(item, sourceId) {
        const row = Array.from(result_ref.current?.querySelectorAll('tr[data-product]') || [])
            .find(element => element.dataset.product === item);
        const source = sourceId && Array.from(row?.querySelectorAll('[data-source-id]') || [])
            .find(element => element.dataset.sourceId === sourceId);
        const target = source || row;
        target?.focus({preventScroll: true});
        target?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    }

    function show_global_line(item, sourceId) {
        if (view_mode === 'flat') focus_global_line(item, sourceId);
        else {
            pending_global_focus.current = {item, sourceId};
            set_view_mode('flat');
        }
    }

    useEffect(() => {
        if (view_mode !== 'flat' || !pending_global_focus.current) return;
        const {item, sourceId} = pending_global_focus.current;
        focus_global_line(item, sourceId);
        pending_global_focus.current = null;
    }, [view_mode]);

    useEffect(() => {
        if (!pending_source_focus.current) return;
        const {id, instanceId} = pending_source_focus.current;
        const occurrence = instanceId && Array.from(result_ref.current?.querySelectorAll('[data-row-instance]') || [])
            .find(element => element.dataset.rowInstance === instanceId);
        const source = Array.from((occurrence || result_ref.current)?.querySelectorAll('[data-source-id]') || [])
            .find(element => element.dataset.sourceId === id)
            || Array.from(result_ref.current?.querySelectorAll('[data-source-id]') || []).find(element => element.dataset.sourceId === id);
        const allocation = source?.querySelector('input');
        if (allocation) {
            const details = allocation.closest('.dsp-branch-global-settings');
            if (details) details.open = true;
            allocation.focus({preventScroll: true});
            allocation.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
        }
        // A removed/collapsed occurrence must not trigger a delayed jump later.
        pending_source_focus.current = null;
    }, [source_details]);

    useEffect(() => {
        if (!focus_request?.item || handled_focus_request.current === focus_request) return;
        handled_focus_request.current = focus_request;
        if (view_mode === 'flat') focus_global_line(focus_request.item);
        else {
            pending_global_focus.current = {item: focus_request.item};
            set_view_mode('flat');
        }
    }, [focus_request, view_mode]);

    // 用于存储历史值的数组，最多保留两个版本
    const [historyValues, setHistoryValues] = useState([]);

    let fixed_num = settings.fixed_num;
    let energy_cost = 0, miner_energy_cost = 0;
    let building_list = {};

    function get_factory_number(amount, item) {
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const scheme_recipe = scheme_data.scheme_for_recipe[recipe_id];
        const factories_type = game_data.recipe_data[recipe_id]["设施"];
        const factory_info = game_data.factory_data[factories_type][scheme_recipe["建筑"]];
        const factory_name = factory_info["名称"];
        const factory_per_yield = 1 / item_graph[item]["产出倍率"] / factory_info["倍率"];
        const offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        const build_number = amount / time_tick * factory_per_yield + offset;
        if (Math.ceil(build_number - 0.5 * 0.1 ** fixed_num) !== 0) {
            if (factory_name in building_list) {
                building_list[factory_name] = Number(building_list[factory_name]) + Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            } else {
                building_list[factory_name] = Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            }
        }
        const e_cost = getProductionEnergy(global_state, factory_info, scheme_recipe, Math.max(0, build_number - offset));
        if (isMiningBuilding(factory_name)) miner_energy_cost += e_cost;
        else energy_cost += e_cost;
        return build_number;
    }

    function get_gross_output(amount, item) {
        var offset = 0;
        offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        if (item_graph[item]["自消耗"]) {
            return Number(amount * (1 + item_graph[item]["自消耗"])) + offset;
        }
        return Number(amount) + offset;
    }

    // Presentation ownership changes labels only; physical rates stay unchanged.
    const side_products = Object.fromEntries(Object.entries(linked_byproducts.byItem).map(([item, sources]) => {
        const parents = {};
        for (const source of sources) parents[source.parentItem] = (parents[source.parentItem] || 0) + source.output;
        return [item, parents];
    }));

    function mineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        new_mineralize_list[item] = structuredClone(item_graph[item]);
        // editing item_graph!
        item_graph[item]["原料"] = {};

        set_settings({"mineralize_list": new_mineralize_list});
    }

    function unmineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        // editing item_graph!
        item_graph[item] = structuredClone(mineralize_list[item]);
        delete new_mineralize_list[item];
        set_settings({"mineralize_list": new_mineralize_list});
    }

    function clear_mineralize_list() {
        for (let item in mineralize_list) {
            // editing item_graph!
            item_graph[item] = structuredClone(mineralize_list[item]);
        }
        set_settings({"mineralize_list": {}});
    }

    let mineralize_doms = Object.keys(mineralize_list).map(item => (
        <Button key={item} type="button" variant="outline" size="sm" className="h-auto gap-1 px-1.5 py-1" aria-label={`恢复${item}生产`} onClick={() => unmineralize(item)}>
            <ItemIcon item={item} size={is_mobile ? 24 : 40}/><span className="text-sm">{item}</span><span aria-hidden="true" className="text-muted-foreground">×</span>
        </Button>
    ));

    const production_sources = source_details?.sources || [];
    const source_groups = presentation.groups;
    const ordered_items = [...new Set([...(source_details?.order || Object.keys(result_dict)), ...Object.keys(source_groups), ...Object.keys(linked_byproducts.byItem)])];

    function add_source(item, recipe_choice = scheme_data.item_recipe_choices[item], focus_new_source = false) {
        const required = isItemRequired(global_state, needs_list, item);
        const standalone = production_sources.some(source => source.target_item === item && source.standalone)
            || !required;
        const source = createProductionSource(global_state, item, {standalone});
        // A recipe fork belongs to this plan even when its surplus-only row
        // needs engine independence to remain visible. Group additions inherit it.
        source.scope = focus_new_source || required || production_sources.some(existing => existing.target_item === item && isPlanOwnedSource(existing))
            ? 'plan' : 'global';
        // Fork the clicked recipe's own equipment settings, never the automatic
        // recipe's factory index or an unsupported proliferation mode.
        const recipe = game_data.recipe_data[item_data[item][recipe_choice]];
        const config = scheme_data.scheme_for_recipe[item_data[item][recipe_choice]] || {};
        const building = Number(config['建筑']);
        const mode = Number(config['增产模式']);
        const points = Number(config['增产点数']);
        source.recipe_choice = Number(recipe_choice);
        source.building = Number.isInteger(building) && game_data.factory_data[recipe['设施']]?.[building] ? building : 0;
        source.proliferator_mode = Number.isInteger(mode) && mode > 0 && mode <= 4 && (recipe['增产'] & (1 << (mode - 1)))
            ? mode : recipe['增产'] === 8 ? 4 : 0;
        source.proliferator_points = Number.isInteger(points) && game_data.proliferator_effect[points] && global_state.proliferator_price[points] !== -1 ? points : 0;
        if (focus_new_source) pending_source_focus.current = {id: source.id,
            instanceId: document.activeElement?.closest('[data-row-instance]')?.dataset.rowInstance};
        set_settings(previous => ({production_sources: [...(previous.production_sources || []), source]}));
    }

    function update_source(id, patch) {
        set_settings(previous => ({production_sources: (previous.production_sources || []).map(source => source.id === id ? {...source, ...patch, migration_error: undefined} : source)}));
    }

    function remove_source(id) {
        set_settings(previous => ({production_sources: (previous.production_sources || []).filter(source => source.id !== id)}));
    }

    // Mirror flat-row visibility before offering a jump to its physical owner.
    function is_global_line_visible(item) {
        if (!has_item(item) || !ordered_items.includes(item) || presentation.hiddenItems.has(item)) return false;
        const manual = production_sources.some(source => source.target_item === item);
        const linked = Boolean(linked_byproducts.byItem[item]?.length);
        const moved = presentation.byItem[item]?.lines.some(line => line.kind === 'automatic' && line.controlItem !== item && line.output > 1e-8 && !line.mineralized);
        const output = presentation.groups[item]?.produced || 0;
        if (output < 1e-6 && !manual && !linked) return false;
        const recipe = game_data.recipe_data[item_data[item][scheme_data.item_recipe_choices[item]]];
        return !(settings.hide_mines && !manual && !linked && !moved
            && (item in mineralize_list || Object.keys(recipe.原料).length < 1));
    }

    // Keep row construction outside the hook control-flow graph. This also
    // makes the single physical-counting pass explicit before summary effects.
    function buildResultRows() {
        let result_table_rows = [];
        for (const i of ordered_items) {
            if (!has_item(i)) continue;
            side_products[i] = side_products[i] || {};
            const item_sources = production_sources.filter(source => source.target_item === i);
            const byproduct_sources = linked_byproducts.byItem[i] || [];
            const direct_source = presentation.byItem[i]?.lines.find(line => line.kind === 'automatic' && line.controlItem === i);
            const moved_sources = (presentation.byItem[i]?.lines || []).filter(line => line.kind === 'automatic' && line.controlItem !== i && line.output > 1e-8);
            const automatic_amount = direct_source ? Math.max(0, result_dict[i] || 0) : 0;
            const automatic_shared_group = source_details?.shared_collectors?.find(group => group.id === source_details?.automatic?.[i]?.shared_collector_group);
            let total = automatic_amount + moved_sources.reduce((sum, line) => sum + line.output, 0) + Object.values(side_products[i]).reduce((a, b) => a + b, 0);
            if (total < 1e-6 && item_sources.length === 0 && byproduct_sources.length === 0) continue;
            let recipe_id = item_data[i][scheme_data.item_recipe_choices[i]];
            const is_mineralized = i in mineralize_list;
            // External supply has no local factories. Hiding a mining row is only a
            // display preference and must not remove its buildings or grid demand.
            // Count original physical sources once, even when their display owner moves.
            const physical_factory_number = is_mineralized ? 0 : source_details?.automatic?.[i]?.buildings ?? get_factory_number(Math.max(0, result_dict[i] || 0), i);
            let factory_number = direct_source ? physical_factory_number : 0;
            if (presentation.hiddenItems.has(i)) continue;
            if (item_sources.length === 0 && byproduct_sources.length === 0 && moved_sources.length === 0 && settings.hide_mines && (is_mineralized || Object.keys(game_data.recipe_data[recipe_id]["原料"]).length < 1)) {
                continue;
            }
            let from_side_products = Object.entries(side_products[i]).map(([from, amount]) =>
                <div key={from} className="mt-1 flex items-center justify-end gap-0.5 whitespace-nowrap text-sm text-muted-foreground">+{amount.toFixed(fixed_num)} (<ItemIcon item={from} size={is_mobile ? 18 : 26}/>)
                </div>
            );
            let factory_name = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"];
            let row_class = is_mineralized ? "bg-muted/60" : "";

            const change_recipe = (value) => {
                set_scheme_data(old_scheme_data => {
                    let scheme_data = structuredClone(old_scheme_data);
                    scheme_data.item_recipe_choices[i] = value;
                    return scheme_data;
                })
            };

            const change_pro_num = (value) => {
                set_scheme_data(old_scheme_data => {
                    let scheme_data = structuredClone(old_scheme_data);
                    scheme_data.scheme_for_recipe[recipe_id]["增产点数"] = value;
                    return scheme_data;
                })
            };

            const change_pro_mode = (value) => {
                set_scheme_data(old_scheme_data => {
                    let scheme_data = structuredClone(old_scheme_data);
                    scheme_data.scheme_for_recipe[recipe_id]["增产模式"] = value;
                    return scheme_data;
                })
            };

            const change_factory = (value) => {
                set_scheme_data(old_scheme_data => {
                    let scheme_data = structuredClone(old_scheme_data);
                    scheme_data.scheme_for_recipe[recipe_id]["建筑"] = value;
                    return scheme_data;
                })
            };

            const ratioProps = {fixed_num, needs_list, set_needs_list};
            const logistics = estimateLogistics(global_state, i, {automaticOutput: automatic_amount, manualSources: item_sources,
                // A presentation move does not invent a new sorter assessment.
                byproductSupply: Object.values(side_products[i]).reduce((sum, amount) => sum + amount, 0) + moved_sources.reduce((sum, line) => sum + line.output, 0)});
            const logisticsCell = <td className="dsp-logistics-cell w-24 px-2 py-3"><LogisticsOverview item={i} estimate={logistics}/></td>;
            if (item_sources.length > 0 || byproduct_sources.length > 0 || moved_sources.length > 0) {
                const group = source_groups[i] || linked_byproducts.groups[i];
                const automatic_scheme = scheme_data.scheme_for_recipe[recipe_id];
                const mineralizeControl = <Button type="button" variant="ghost" size="sm" className="h-8 px-1 text-base text-muted-foreground"
                    aria-label={is_mineralized ? `恢复${i}生产` : `将${i}视为原矿`}
                    onClick={() => is_mineralized ? unmineralize(i) : mineralize(i)}>{is_mineralized ? '恢复' : '原矿化'}</Button>;
                result_table_rows.push(<tr key={i} data-product={i} tabIndex={-1} aria-label={`${i}全局产线`} className={cn('dsp-source-group-row border-b last:border-0 focus-visible:outline-2 focus-visible:outline-ring', row_class)}>
                    <td colSpan={8} className="px-2 py-3">
                        <ProductionSourceGroup item={i} group={group} linkedByproductSupply={byproduct_sources.reduce((sum, source) => sum + source.output, 0)} onAdd={() => add_source(i)} mineralizeControl={mineralizeControl}
                            totalControl={<output aria-label={`${i}总需求`} className="text-base font-semibold tabular-nums">{group.required.toFixed(fixed_num)}</output>}>
                            <AutomaticSourceRoute item={i} inactive={moved_sources.length > 0 && automatic_amount <= 1e-8 && item_sources.length === 0}>
                            <ProductionSourceCard item={i} sharedGroup={automatic_shared_group} automatic output={automatic_amount} buildings={factory_number} factory_name={factory_name}
                                recipe_id={recipe_id} recipe_choice={scheme_data.item_recipe_choices[i]} building={automatic_scheme['建筑']}
                                proliferator_mode={automatic_scheme['增产模式']} proliferator_points={automatic_scheme['增产点数']}
                                onRecipeChange={change_recipe} onRecipeFork={item_sources.length === 0 ? value => add_source(i, value, true) : undefined} onFactoryChange={change_factory} onModeChange={change_pro_mode} onPointsChange={change_pro_num}
                                is_mineralized={is_mineralized} outputByproducts={direct_source?.byproducts} onAddByproductSource={item => add_source(item, scheme_data.item_recipe_choices[item], true)}/>
                            </AutomaticSourceRoute>
                            {moved_sources.map(line => <MovedAutomaticSourceCard key={line.id} line={line} scheme={scheme_data} setScheme={set_scheme_data} onAddByproductSource={item => add_source(item, scheme_data.item_recipe_choices[item], true)}/>)}
                            {item_sources.map((source, index) => <ProductionSourceCard key={source.id} item={i} sharedGroup={source_details?.shared_collectors?.find(group => group.id === source.shared_collector_group)} source={source} ordinal={index + 1}
                                output={source.output} buildings={source.buildings} factory_name={source.factory_name}
                                recipe_id={source.recipe_id} recipe_choice={source.recipe_choice} building={source.building}
                                proliferator_mode={source.proliferator_mode} proliferator_points={source.proliferator_points}
                                onOutputChange={value => update_source(source.id, {quantity_mode: 'rate', output_per_minute: fromDisplayRate(Number(value), settings)})}
                                onBuildingsChange={value => update_source(source.id, {quantity_mode: 'buildings', building_quantity: Number(value)})}
                                onRecipeChange={value => {
                                    const recipe = game_data.recipe_data[item_data[i][Number(value)]];
                                    const mode = source.proliferator_mode;
                                    const compatible_mode = mode > 0 && (recipe['增产'] & (1 << (mode - 1))) ? mode : recipe['增产'] === 8 ? 4 : 0;
                                    update_source(source.id, {recipe_choice: Number(value), building: 0, proliferator_mode: compatible_mode, migration_error: undefined});
                                }}
                                onFactoryChange={value => update_source(source.id, {building: Number(value)})}
                                onModeChange={value => update_source(source.id, {proliferator_mode: Number(value)})}
                                onPointsChange={value => update_source(source.id, {proliferator_points: Number(value)})}
                                onRemove={() => remove_source(source.id)} outputByproducts={presentation.lines.find(line => line.kind === 'manual' && line.sourceId === source.id)?.byproducts} onAddByproductSource={item => add_source(item, scheme_data.item_recipe_choices[item], true)}/>)}
                            {byproduct_sources.map((source, index) => <ByproductSourceCard key={source.id} item={i} source={source} ordinal={index + 1}
                                onShowParent={is_global_line_visible(source.parentItem) ? () => show_global_line(source.parentItem, source.parentSourceId) : undefined}/>)}
                        </ProductionSourceGroup>
                    </td>
                    {logisticsCell}
                </tr>);
                continue;
            }
            result_table_rows.push(<tr className={cn("border-b last:border-0 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring", row_class)} key={i} data-product={i} tabIndex={-1} aria-label={`${i}全局产线`}>
                <td className="px-2 py-3">
                    <Button type="button" variant="ghost" size="sm" className="h-7 whitespace-nowrap px-1 text-sm text-muted-foreground"
                        aria-label={is_mineralized ? `恢复${i}生产` : `将${i}视为原矿`}
                        onClick={() => is_mineralized ? unmineralize(i) : mineralize(i)}>
                        {is_mineralized ? '恢复' : '原矿化'}
                    </Button>
                </td>
                <td className="px-2 py-3">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <ItemIcon item={i} tooltip={is_compact} size={is_mobile ? 24 : 40}/>
                        <ProductionItemName item={i} compact={is_compact}/>
                    </div>
                    <ProductionByproducts products={direct_source?.byproducts} onAddSource={item => add_source(item, scheme_data.item_recipe_choices[item], true)}/>
                </td>
                <td className="px-2 py-3 text-right">
                    <RatioAdjustInput value={source_details?.automatic?.[i]?.gross_output ?? get_gross_output(automatic_amount, i)} {...ratioProps} label={`${i}产能，等比例调整需求`}/>
                    {from_side_products}
                </td>
                <td className="px-2 py-3 whitespace-nowrap">
                    {!is_mineralized ? <div className="inline-flex items-center gap-1">
                        <ItemIcon item={factory_name} size={is_mobile ? 20 : 30}/>
                        <RatioAdjustInput value={factory_number} {...ratioProps} label={`${i}工厂数量，等比例调整需求`}/>
                    </div> : <span className="text-muted-foreground">—</span>}
                    {automatic_shared_group && <p className="mt-1 text-xs text-muted-foreground">共享采集 · 同组共 {automatic_shared_group.building_count} 台</p>}
                </td>
                <td className="px-2 py-3"><RecipeSelect item={i} onChange={change_recipe} onFork={value => add_source(i, value, true)} choice={scheme_data.item_recipe_choices[i]} compact={compact_mode}/></td>
                <td className="px-2 py-3"><ProModeSelect recipe_id={recipe_id} onChange={change_pro_mode} choice={scheme_data.scheme_for_recipe[recipe_id]["增产模式"]}/></td>
                <td className="px-2 py-3"><ProNumSelect onChange={change_pro_num} choice={scheme_data.scheme_for_recipe[recipe_id]["增产点数"]} icon_size={mob_btn_icon}/></td>
                <td className="px-2 py-3"><FactorySelect recipe_id={recipe_id} onChange={change_factory} choice={scheme_data.scheme_for_recipe[recipe_id]["建筑"]} icon_size={mob_btn_icon}/></td>
                {logisticsCell}
            </tr>);
        }
        return result_table_rows;
    }
    const result_table_rows = buildResultRows();

    // The engine includes each independent source exactly once in global totals.
    if (source_details?.totals) {
        building_list = source_details.totals.buildingCounts;
        energy_cost = source_details.totals.energyCost;
        miner_energy_cost = source_details.totals.totalEnergyCost - energy_cost;
    }

    const building_rows = Object.entries(building_list).map(([building, count]) => (
        <tr key={building} className="border-b last:border-0">
            <td className="py-2"><span className="flex items-center gap-1.5 text-sm"><ItemIcon item={building} tooltip={false} size={is_mobile ? 26 : 40}/>{building}</span></td>
            <td className="py-2 pl-2 text-right text-base whitespace-nowrap tabular-nums">
                <ValueWithDifference currentValue={count} previousValue={historyValues?.[1]?.buildingCounts?.[building]}/>
            </td>
        </tr>));

    function IncreaseCostWhenSurplus(item) {
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            scheme_data.cost_weight["物品额外成本"][item]["溢出时处理成本"] += 5000;
            return scheme_data;
        })
    }

    const surplus_doms = Object.entries(lp_surplus_list).map(([item, quant]) =>
        <div key={item} className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-1.5 py-2">
            <ItemIcon item={item} size={is_mobile ? 28 : 40}/>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item}</p><p className="text-sm tabular-nums text-muted-foreground">{quant.toFixed(fixed_num)} / {time_tick === 60 ? 'min' : 's'}</p></div>
            <Button type="button" variant="outline" size="sm" className="h-8 px-1.5 text-sm" aria-label={`避免${item}溢出`} onClick={() => IncreaseCostWhenSurplus(item)}>避免溢出</Button>
        </div>);

    const isRawMaterial = (item) => {
        // 判断物品是否为原矿：1. 在原矿化列表中，或 2. 配方没有输入需求且输出产物只有一种
        if (item in mineralize_list) return true;
        try {
            const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
            const recipe = game_data.recipe_data[recipe_id];
            // 检查配方是否没有输入需求且输出产物只有一种
            const hasNoInputs = Object.keys(recipe["原料"]).length === 0;
            const hasSingleOutput = Object.keys(recipe["产物"]).length === 1;
            return hasNoInputs && hasSingleOutput;
        } catch {
            return false;
        }
    };

    // 计算数值变化的差值
    // 更新历史值
    useEffect(() => {
        // 构建新的值对象
        const currentValues = {
            energyCost: energy_cost,
            totalEnergyCost: energy_cost + miner_energy_cost,
            buildingCounts: { ...building_list },
            rawMaterials: {}
        };

        if (source_details?.totals) currentValues.rawMaterials = {...source_details.totals.rawMaterials};
        else Object.entries(result_dict).forEach(([item, amount]) => {
            if (isRawMaterial(item)) {
                currentValues.rawMaterials[item] = amount;
            }
        });

        // 如果historyValues为空或者第一个元素与当前值不同，则更新
        if (historyValues.length === 0 || !isEqual(historyValues[0], currentValues)) {
            // 将当前值添加到数组开头，最多保留两个版本
            const newHistory = [currentValues, ...historyValues].slice(0, 2);
            setHistoryValues(newHistory);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result_dict, energy_cost, miner_energy_cost, building_list]);

    const rawMaterials = source_details?.totals ? Object.entries(source_details.totals.rawMaterials) : Object.entries(result_dict).filter(([item]) => isRawMaterial(item));
    const totalBuildings = Object.values(building_list).reduce((sum, count) => sum + count, 0);
    const unit = time_tick === 60 ? 'min' : 's';
    const rawMaterialCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="px-3 pt-4 pb-2"><CardTitle className="text-base">原矿输入总需求</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3">
            {rawMaterials.length > 0 ? <table className="w-auto"><tbody>
                {rawMaterials.map(([item, amount]) => <tr key={item} className="border-b last:border-0">
                    <td className="py-2"><span className="flex items-center gap-1.5 text-sm"><ItemIcon item={item} tooltip={false} size={is_mobile ? 26 : 40}/>{item}</span></td>
                    <td className="py-2 pl-2 text-right text-base whitespace-nowrap tabular-nums">
                        <ValueWithDifference currentValue={amount} previousValue={historyValues?.[1]?.rawMaterials?.[item]}/><span className="ml-0.5 text-muted-foreground">/{unit}</span>
                    </td>
                </tr>)}
            </tbody></table> : <p className="py-2 text-sm text-muted-foreground">暂无原矿需求</p>}
        </CardContent>
    </Card>;
    const buildingCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-4 pb-2"><CardTitle className="text-base">建筑统计</CardTitle><Badge variant="secondary" className="px-1.5 py-0.5 text-sm tabular-nums">{totalBuildings}</Badge></CardHeader>
        <CardContent className="px-3 pb-3">
            {building_rows.length > 0 ? <table className="w-auto"><tbody>{building_rows}</tbody></table> : <p className="py-2 text-sm text-muted-foreground">暂无建筑需求</p>}
        </CardContent>
    </Card>;
    const energyCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="px-3 pt-4 pb-3"><CardTitle className="text-base">预估电力</CardTitle></CardHeader>
        <CardContent className="space-y-2 px-3 pb-4">
            <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">生产设施</span><span className="text-base tabular-nums"><ValueWithDifference currentValue={energy_cost} previousValue={historyValues?.[1]?.energyCost}/> MW</span></div>
            <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">含采集设备</span><span className="text-base font-medium tabular-nums"><ValueWithDifference currentValue={energy_cost + miner_energy_cost} previousValue={historyValues?.[1]?.totalEnergyCost}/> MW</span></div>
        </CardContent>
    </Card>;
    const mineralizedCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-4 pb-3"><CardTitle className="text-base">原矿化列表</CardTitle>
            {mineralize_doms.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-sm text-muted-foreground" onClick={clear_mineralize_list}>清空</Button>}
        </CardHeader>
        <CardContent className="px-3 pb-4">{mineralize_doms.length > 0 ? <div className="flex flex-wrap gap-1.5">{mineralize_doms}</div> : <p className="text-sm text-muted-foreground">将物品视为原矿，直接从生产链外部供给</p>}</CardContent>
    </Card>;
    const surplusCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="px-3 pt-4 pb-3"><CardTitle className="text-base">多余产物</CardTitle></CardHeader>
        <CardContent className="space-y-2 px-3 pb-4">{surplus_doms.length > 0 ? surplus_doms : <p className="text-sm text-muted-foreground">没有多余产物</p>}</CardContent>
    </Card>;

    return <section ref={result_ref} className="dsp-result w-fit max-w-full space-y-4" data-density="comfortable" aria-labelledby="production-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="mb-1 text-xs tracking-wider text-muted-foreground uppercase">Production overview</p>
                <div className="flex items-center gap-2"><h2 id="production-heading" className="text-xl font-semibold tracking-tight">生产总览</h2>
                    <Badge variant="secondary" className="px-1.5 py-0.5 text-sm font-normal">{result_table_rows.length} 项物品 · 每{time_tick === 60 ? '分钟' : '秒'}</Badge>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <div role="group" aria-label="生产结果视图" className="inline-flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
                    <Button type="button" variant={view_mode === 'flat' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-sm"
                        aria-pressed={view_mode === 'flat'} onClick={() => set_view_mode('flat')}>平铺</Button>
                    <Button type="button" variant={view_mode === 'tree' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-sm"
                        aria-pressed={view_mode === 'tree'} onClick={() => set_view_mode('tree')}>树状</Button>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-sm" onClick={() => set_show_ore_popup(true)}>原矿与溢出</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-sm" onClick={() => set_show_building_popup(true)}>建筑与需求</Button>
            </div>
        </div>
        <SharedCollectorsSummary groups={source_details?.shared_collectors}/>
        <PausedProductionSources sources={source_details?.paused_sources}
            onEnable={id => update_source(id, {standalone: true, scope: 'global'})} onRemove={remove_source}/>
        {(source_details?.errors?.length > 0 || production_sources.some(source => !has_item(source.target_item))) && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-base text-destructive">
            {(source_details.errors || []).map((error, index) => <p key={index}>{typeof error === 'string' ? error : error.message || String(error)}</p>)}
            {production_sources.filter(source => !has_item(source.target_item)).map(source => <Button key={source.id} type="button" variant="outline" size="sm"
                className="text-base" aria-label={`删除无效产线${source.target_item}`} onClick={() => remove_source(source.id)}>删除无效产线 {source.target_item}：{source.error}</Button>)}
        </div>}
        <div className="dsp-result-layout flex max-w-full items-start gap-4">
            <Card className="dsp-result-table-card w-fit min-w-0 max-w-full flex-[0_1_auto] gap-0 overflow-hidden rounded-lg py-0 shadow-none">
                {view_mode === 'tree' ? <DependencyOverview key={`${game_data.game_name}:${targetIdentity(needs_list)}`} viewModel={dependency_view} settings={settings} onShowGlobal={show_global_line}
                    canonicalRows={new Map(result_table_rows.map(row => [row.props['data-product'], row]))}/> : <>
                <p className="border-b bg-muted/20 px-2 py-2 text-sm text-muted-foreground lg:hidden">左右滑动表格，查看配方与生产设置</p>
                <div className="dsp-result-table-scroll max-h-[70dvh] max-w-full overflow-auto" tabIndex={0} role="region" aria-label="生产结果表，可横向滚动">
                    <table className="dsp-production-table w-auto border-collapse text-base [&_td]:align-middle">
                        <caption className="sr-only">生产链计算结果：产能、工厂、配方、增产设置和物流估算</caption>
                        <thead className="sticky top-0 z-10 border-b bg-muted shadow-[0_1px_0_var(--border)]">
                            <tr className="text-left text-base whitespace-nowrap text-muted-foreground">
                                <ProductionColumns unit={unit}/>
                            </tr>
                        </thead>
                        <tbody>{result_table_rows.map(row => <CanonicalProductionRow key={row.key} row={row}/>)}
                            {result_table_rows.length === 0 && <tr><td colSpan={9} className="px-4 py-20 text-center">
                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border bg-muted/40 text-lg text-muted-foreground" aria-hidden="true">＋</div>
                                <p className="text-sm font-medium">开始规划你的生产线</p><p className="mt-1.5 text-sm text-muted-foreground">添加目标物品与需求数量，查看完整的生产链与建筑需求</p>
                            </td></tr>}
                        </tbody>
                    </table>
                </div>
                </>}
            </Card>
            <aside className="dsp-result-summary hidden max-h-[70dvh] w-max max-w-80 shrink-0 content-start gap-3 overflow-y-auto lg:grid" aria-label="生产统计">
                {energyCard}{rawMaterialCard}{buildingCard}
                {mineralize_doms.length > 0 && mineralizedCard}
                {surplus_doms.length > 0 && surplusCard}
            </aside>
        </div>
        <Dialog open={show_ore_popup} onOpenChange={set_show_ore_popup}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>原矿与多余产物</DialogTitle><DialogDescription>管理外部供给，调整多余产物的处理成本</DialogDescription></DialogHeader>
                <div className="space-y-3">{mineralizedCard}{surplusCard}</div>
            </DialogContent>
        </Dialog>
        <Dialog open={show_building_popup} onOpenChange={set_show_building_popup}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>建筑与需求</DialogTitle><DialogDescription>原矿需求、建筑数量与预估电力。角标表示与上次计算的差值</DialogDescription></DialogHeader>
                <div className="space-y-3">{energyCard}{rawMaterialCard}{buildingCard}</div>
            </DialogContent>
        </Dialog>
    </section>;
}
