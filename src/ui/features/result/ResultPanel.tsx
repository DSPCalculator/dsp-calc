import {useContext} from 'react';
import {GlobalState} from '@engine/calculation/globalState';
import structuredClone from '@ungap/structured-clone';
import {GameInfoContext, GlobalStateContext, SchemeDataSetterContext, SettingsSetterContext} from '@ui/app/providers/app-contexts';
import type {ComparisonBaseline} from './BatchPresetControls';
import {NplRows} from './NaturalProductionLinesTable';
import {ResultSidebar} from './ResultSidebar';
import {buildSideProducts} from './resultGraphHelpers';
import {addMineralizedItem, clearMineralizedItems, hasMineralizedItem, removeMineralizedItem} from '@engine/calculation/mineralizeState';
import {buildResultRowActions} from './resultRowActions';
import {buildResultRowsViewModel} from './resultRowsViewModel';
import {ResultTableRow} from './ResultTableRow';
import {ceilFromDisplayed, roundToFixed} from '@lib/number';
import type {
    GameData,
    ItemDataIndex,
    ItemGraph,
    NaturalProductionLineRow,
    NumericMap,
    ResultRowViewModel,
    SchemeData,
    Settings
} from '@engine/types/domain';
import {ITEM_ICON_CONTENT_SIZE} from '@ui/components/icons/ItemIcon';

type SidebarMetrics = {
    buildingCounts: NumericMap;
    energyCost: number;
    rawMaterials: NumericMap;
    externalSupplies: NumericMap;
    totalEnergyCost: number;
};

type ExternalSupplyEntry = {
    key: string;
    item: string;
    amount: number;
    source: 'mineralized';
};

function areSidebarMetricsEqual(left?: SidebarMetrics, right?: SidebarMetrics): boolean {
    if (!left || !right) {
        return left === right;
    }
    if (Math.abs(left.energyCost - right.energyCost) > 1e-6
        || Math.abs(left.totalEnergyCost - right.totalEnergyCost) > 1e-6) {
        return false;
    }

    const leftBuildings = Object.keys(left.buildingCounts);
    const rightBuildings = Object.keys(right.buildingCounts);
    if (leftBuildings.length !== rightBuildings.length) {
        return false;
    }
    for (const building of leftBuildings) {
        if ((left.buildingCounts[building] || 0) !== (right.buildingCounts[building] || 0)) {
            return false;
        }
    }

    const leftMaterials = Object.keys(left.rawMaterials);
    const rightMaterials = Object.keys(right.rawMaterials);
    if (leftMaterials.length !== rightMaterials.length) {
        return false;
    }
    for (const item of leftMaterials) {
        if (Math.abs((left.rawMaterials[item] || 0) - (right.rawMaterials[item] || 0)) > 1e-6) {
            return false;
        }
    }

    const leftSupplies = Object.keys(left.externalSupplies);
    const rightSupplies = Object.keys(right.externalSupplies);
    if (leftSupplies.length !== rightSupplies.length) {
        return false;
    }
    for (const item of leftSupplies) {
        if (Math.abs((left.externalSupplies[item] || 0) - (right.externalSupplies[item] || 0)) > 1e-6) {
            return false;
        }
    }

    return true;
}

function collectResultMetrics({
    fixed_num,
    game_data,
    scheme_data,
    settings,
    item_data,
    item_graph,
    time_tick,
    mineralize_list,
    natural_production_line,
    result_dict,
    lp_issue_items,
}: {
    fixed_num: number;
    game_data: GameData;
    scheme_data: SchemeData;
    settings: Settings;
    item_data: ItemDataIndex;
    item_graph: ItemGraph;
    time_tick: number;
    mineralize_list: Settings['mineralize_list'];
    natural_production_line: NaturalProductionLineRow[];
    result_dict: NumericMap;
    lp_issue_items: Set<string>;
}) {
    let energy_cost = 0;
    let miner_energy_cost = 0;
    const building_list: NumericMap = {};

    function get_factory_number(amount: number, item: string): number {
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const scheme_recipe = scheme_data.scheme_for_recipe[recipe_id];
        const factories_type = game_data.recipe_data[recipe_id]["设施"];
        const factory_info = game_data.factory_data[factories_type][scheme_recipe["建筑"]];
        const factory_name = factory_info["名称"];
        const raw_build_number = amount / time_tick / item_graph[item]["产出倍率"] / factory_info["倍率"];
        const build_number = roundToFixed(raw_build_number, fixed_num);
        const building_count = ceilFromDisplayed(raw_build_number, fixed_num);

        if (building_count !== 0) {
            building_list[factory_name] = Number(building_list[factory_name] || 0) + building_count;
        }

        if (factory_name !== "轨道采集器") {
            let e_cost = raw_build_number * factory_info["耗能"];
            if (factory_name === "大型采矿机") {
                e_cost = settings.mining_efficiency_large / 100.0 * settings.mining_efficiency_large / 100.0 * (2.94 - 0.168) + 0.168;
            } else if (factory_name.endsWith("分馏塔")) {
                if (game_data.GenesisBookEnable) {
                    if (settings.fractionating_speed > 60) {
                        e_cost *= (settings.fractionating_speed * 0.036 - 0.72) / 1.44;
                    }
                } else if (settings.fractionating_speed > 30) {
                    e_cost *= (settings.fractionating_speed * 0.036 - 0.36) / 0.72;
                }
            }
            if (scheme_recipe["增产模式"] != 0 && scheme_recipe["增产点数"] != 0) {
                e_cost *= game_data.proliferator_effect[scheme_recipe["增产点数"]]["耗电倍率"];
            }
            if (factory_name === "采矿机" || factory_name === "大型采矿机"
                || factory_name === "抽水机" || factory_name === "聚束液体汲取设施" || factory_name === "原油萃取站") {
                miner_energy_cost += e_cost;
            } else {
                energy_cost += e_cost;
            }
        }
        return build_number;
    }

    const side_products = buildSideProducts(result_dict, item_graph);
    const row_view_models: ResultRowViewModel[] = buildResultRowsViewModel({
        fixed_num,
        game_data,
        item_data,
        mineralize_list,
        result_dict,
        scheme_data,
        settings,
        side_products,
        getFactoryNumber: get_factory_number,
        lp_issue_items,
    });

    for (const row of natural_production_line) {
        const recipe = game_data.recipe_data[item_data[row["目标物品"]][row["配方id"]]];
        const factory_info = game_data.factory_data[recipe["设施"]][row["建筑"]];
        const factory_name = factory_info["名称"];
        building_list[factory_name] = Number(building_list[factory_name] || 0) + Math.ceil(row["建筑数量"]);

        if (factory_name !== "轨道采集器") {
            let e_cost = row["建筑数量"] * factory_info["耗能"];
            if (row["增产点数"] != 0 && row["增产模式"] != 0) {
                e_cost *= game_data.proliferator_effect[row["增产点数"]]["耗电倍率"];
            }
            if (factory_name === "采矿机" || factory_name === "大型采矿机"
                || factory_name === "抽水机" || factory_name === "聚束液体汲取设施" || factory_name === "原油萃取站") {
                miner_energy_cost += e_cost;
            } else {
                energy_cost += e_cost;
            }
        }
    }

    return {
        building_list,
        energy_cost,
        miner_energy_cost,
        row_view_models,
    };
}

export function Result({
    captureComparisonBaseline,
    comparison_baseline,
    needs_list,
    set_needs_list,
}: {
    captureComparisonBaseline: (baseline: ComparisonBaseline) => void;
    comparison_baseline: ComparisonBaseline | null;
    needs_list: NumericMap;
    set_needs_list: (next_needs_list: NumericMap) => void;
}) {
    const RESULT_ICON_SIZE = ITEM_ICON_CONTENT_SIZE;

    const game_info = useContext(GameInfoContext);
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const set_settings = useContext(SettingsSetterContext);
    const game_data = global_state.game_data;
    const scheme_data = global_state.scheme_data;
    const settings = global_state.settings;
    const item_data = global_state.item_data;
    const item_graph = global_state.item_graph;
    const time_tick = settings.is_time_unit_minute ? 60 : 1;
    const mineralize_list = settings.mineralize_list;
    const natural_production_line = settings.natural_production_line;
    const [calculated_result_dict, lp_surplus_list, lp_issue] = global_state.calculate(needs_list);
    const lp_issue_items = new Set(lp_issue?.items || []);
    const result_dict = lp_issue
        ? Object.fromEntries((lp_issue.items || []).map(item => [item, needs_list[item] || 0]))
        : calculated_result_dict;

    const fixed_num = settings.fixed_num;

    function rememberComparisonBaseline() {
        captureComparisonBaseline({
            needs_list: structuredClone(needs_list),
            scheme_data: structuredClone(global_state.raw_scheme_data),
            settings: structuredClone(settings),
        });
    }

    function update_recipe_choice(item, value) {
        rememberComparisonBaseline();
        set_scheme_data(old_scheme_data => ({
            ...old_scheme_data,
            item_recipe_choices: {
                ...old_scheme_data.item_recipe_choices,
                [item]: value,
            },
        }));
    }

    function update_recipe_settings(recipe_id, recipe_setting_patch) {
        rememberComparisonBaseline();
        set_scheme_data(old_scheme_data => ({
            ...old_scheme_data,
            scheme_for_recipe: old_scheme_data.scheme_for_recipe.map((recipe_setting, idx) => {
                if (idx !== recipe_id) {
                    return recipe_setting;
                }
                return {
                    ...recipe_setting,
                    ...recipe_setting_patch,
                };
            }),
        }));
    }

    function update_recipe_setting(recipe_id, field, value) {
        update_recipe_settings(recipe_id, {[field]: value});
    }

    function mineralize(item) {
        rememberComparisonBaseline();
        set_settings({"mineralize_list": addMineralizedItem(mineralize_list, item)});
    }

    function unmineralize(item) {
        rememberComparisonBaseline();
        set_settings({"mineralize_list": removeMineralizedItem(mineralize_list, item)});
    }

    function split_production_line(item: string, amount: number) {
        rememberComparisonBaseline();
        set_settings({"mineralize_list": removeMineralizedItem(mineralize_list, item)});
        set_needs_list({[item]: amount});
    }

    function clear_mineralize_list() {
        rememberComparisonBaseline();
        set_settings({"mineralize_list": clearMineralizedItems()});
    }

    function update_external_input_proliferator_points(points: number) {
        rememberComparisonBaseline();
        set_settings({external_input_proliferator_points: points});
    }

    function update_external_output_proliferator_points(points: number) {
        rememberComparisonBaseline();
        set_settings({external_output_proliferator_points: points});
    }

    const {
        building_list,
        energy_cost,
        miner_energy_cost,
        row_view_models,
    } = collectResultMetrics({
        fixed_num,
        game_data,
        item_graph,
        item_data,
        mineralize_list,
        result_dict,
        scheme_data,
        settings,
        time_tick,
        natural_production_line,
        lp_issue_items,
    });

    function buildRawMaterialList(
        current_result_dict: NumericMap,
        current_scheme_data: SchemeData,
        current_game_data: GameData,
        current_settings: Settings
    ): NumericMap {
        const raw_materials: NumericMap = {};
        Object.entries(current_result_dict).forEach(([item, amount]) => {
            if (Math.abs(amount) < 1e-6) {
                return;
            }
            if (hasMineralizedItem(current_settings.mineralize_list, item)) {
                raw_materials[item] = amount;
                return;
            }
            const recipe_choice = current_scheme_data.item_recipe_choices[item];
            const recipe_id = item_data[item]?.[recipe_choice];
            const recipe = recipe_id === undefined ? undefined : current_game_data.recipe_data[recipe_id];
            if (!recipe) {
                return;
            }
            if (Object.keys(recipe["原料"]).length === 0 && Object.keys(recipe["产物"]).length === 1) {
                raw_materials[item] = amount;
            }
        });
        return raw_materials;
    }

    function buildExternalSupplyEntries(
        raw_materials: NumericMap,
        current_settings: Settings
    ): ExternalSupplyEntry[] {
        const entries: ExternalSupplyEntry[] = [];
        Object.entries(raw_materials).forEach(([item, amount]) => {
            if (Math.abs(amount) < 1e-6) {
                return;
            }
            if (hasMineralizedItem(current_settings.mineralize_list, item)) {
                entries.push({
                    key: `mineralized:${item}`,
                    item,
                    amount,
                    source: 'mineralized',
                });
            }
        });

        return entries.filter(entry => Math.abs(entry.amount) >= 1e-6);
    }

    function buildExternalSupplyMetric(entries: ExternalSupplyEntry[]): NumericMap {
        return Object.fromEntries(entries.map(entry => [entry.key, entry.amount]));
    }

    const raw_material_list = buildRawMaterialList(result_dict, scheme_data, game_data, settings);
    const external_supply_entries = buildExternalSupplyEntries(raw_material_list, settings);
    const external_supply_metric = buildExternalSupplyMetric(external_supply_entries);
    let previous_sidebar_metrics: SidebarMetrics | undefined = undefined;

    if (comparison_baseline) {
        const previous_global_state = new GlobalState(game_info, comparison_baseline.scheme_data, comparison_baseline.settings);
        const [previous_result_dict] = previous_global_state.calculate(comparison_baseline.needs_list);
        const previous_metrics = collectResultMetrics({
            fixed_num,
            game_data: previous_global_state.game_data,
            item_graph: previous_global_state.item_graph,
            item_data: previous_global_state.item_data,
            mineralize_list: comparison_baseline.settings.mineralize_list,
            result_dict: previous_result_dict,
            scheme_data: previous_global_state.scheme_data,
            settings: comparison_baseline.settings,
            time_tick,
            natural_production_line: comparison_baseline.settings.natural_production_line,
            lp_issue_items: new Set<string>(),
        });
        const previous_raw_material_list = buildRawMaterialList(
            previous_result_dict,
            previous_global_state.scheme_data,
            previous_global_state.game_data,
            comparison_baseline.settings
        );
        previous_sidebar_metrics = {
            buildingCounts: {...previous_metrics.building_list},
            energyCost: previous_metrics.energy_cost,
            rawMaterials: previous_raw_material_list,
            externalSupplies: buildExternalSupplyMetric(buildExternalSupplyEntries(previous_raw_material_list, comparison_baseline.settings)),
            totalEnergyCost: previous_metrics.energy_cost + previous_metrics.miner_energy_cost,
        };
        if (areSidebarMetricsEqual(previous_sidebar_metrics, {
            buildingCounts: building_list,
            energyCost: energy_cost,
            rawMaterials: raw_material_list,
            externalSupplies: external_supply_metric,
            totalEnergyCost: energy_cost + miner_energy_cost,
        })) {
            previous_sidebar_metrics = undefined;
        }
    }

    const result_table_rows = row_view_models.map((row) => {
        const row_actions = buildResultRowActions(
            row.item_name,
            row.recipe_id,
            update_recipe_choice,
            update_recipe_setting
        );

        return <ResultTableRow
            key={row.item_name}
            RESULT_ICON_SIZE={RESULT_ICON_SIZE}
            fixed_num={fixed_num}
            item_graph={item_graph}
            needs_list={needs_list}
            row={row}
            set_needs_list={set_needs_list}
            settings={settings}
            onChangeFactory={row_actions.change_factory}
            onChangeProMode={row_actions.change_pro_mode}
            onChangeProNum={row_actions.change_pro_num}
            onChangeRecipe={row_actions.change_recipe}
            onMineralize={mineralize}
            onSplitProductionLine={split_production_line}
            onUnmineralize={unmineralize}
            result_amount={result_dict[row.item_name]}
        />;
    });

    function IncreaseCostWhenSurplus(item) {
        rememberComparisonBaseline();
        set_scheme_data(old_scheme_data => ({
            ...old_scheme_data,
            cost_weight: {
                ...old_scheme_data.cost_weight,
                "物品额外成本": {
                    ...old_scheme_data.cost_weight["物品额外成本"],
                    [item]: {
                        ...old_scheme_data.cost_weight["物品额外成本"][item],
                        "溢出时处理成本": old_scheme_data.cost_weight["物品额外成本"][item]["溢出时处理成本"] + 5000,
                    },
                },
            },
        }));
    }

    const lp_issue_alert = lp_issue &&
        <div className="alert alert-danger py-2 px-3 mb-2 result-lp-issue-alert" role="alert">
            <strong>{lp_issue.kind === 'infeasible' ? '线性规划无解' : '线性规划目标函数无界'}</strong>
            <span className="ms-2">{lp_issue.message}</span>
        </div>;

    return <div className="result-layout mt-2 mb-3">
        <div className="result-table-shell">
            {lp_issue_alert}
            <div className="result-table-scroll">
                <table className="table table-sm align-middle w-auto result-table">
                    <thead>
                    <tr className="text-center text-nowrap">
                        <th style={{width: 60}}>操作</th>
                        <th style={{width: 140}}>需求</th>
                        <th style={{width: 110}}>工厂</th>
                        <th style={{width: 300}}>{settings.show_effective_recipe ? "等效配方" : "原始配方"}</th>
                        <th style={{width: 180}}>增产模式</th>
                        <th style={{width: 160}}>增产剂</th>
                        <th style={{width: 170}}>工厂类型</th>
                    </tr>
                    </thead>
                    <tbody className="table-group-divider">
                    <NplRows/>
                    {result_table_rows}
                    </tbody>
                </table>
            </div>
        </div>
        <div className="result-sidebar-shell">
            <ResultSidebar
                RESULT_ICON_SIZE={RESULT_ICON_SIZE}
                building_list={building_list}
                clear_mineralize_list={clear_mineralize_list}
                energy_cost={energy_cost}
                fixed_num={fixed_num}
                IncreaseCostWhenSurplus={IncreaseCostWhenSurplus}
                is_time_unit_minute={settings.is_time_unit_minute}
                mineralize_list={mineralize_list}
                miner_energy_cost={miner_energy_cost}
                onChangeExternalInputProliferatorPoints={update_external_input_proliferator_points}
                onChangeExternalOutputProliferatorPoints={update_external_output_proliferator_points}
                previous_sidebar_metrics={previous_sidebar_metrics}
                external_supply_entries={external_supply_entries}
                raw_material_list={raw_material_list}
                settings={settings}
                show_item_names={settings.show_sidebar_item_names}
                surplus_list={lp_surplus_list}
                unmineralize={unmineralize}
            />
        </div>
    </div>;
}
