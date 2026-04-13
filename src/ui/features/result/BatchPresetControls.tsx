import structuredClone from '@ungap/structured-clone';
import {useContext} from 'react';
import {GlobalStateContext, SchemeDataSetterContext} from '@ui/app/providers/app-contexts';
import {HorizontalMultiButtonSelect} from '@ui/components/controls/HorizontalMultiButtonSelect';
import type {NumericMap, SchemeData, Settings} from '@engine/types/domain';
import {pro_mode_class} from './resultSelectorClasses';

// TODO refactor to some other modules
function updateSchemesForRecipes(old_scheme_data, should_update, updater) {
    return {
        ...old_scheme_data,
        scheme_for_recipe: old_scheme_data.scheme_for_recipe.map((recipe_setting, idx) => (
            should_update(idx) ? updater(recipe_setting, idx) : recipe_setting
        )),
    };
}

function FactorySelect({captureComparisonBaseline, factory, list, needs_list}: {
    captureComparisonBaseline: (baseline: ComparisonBaseline) => void;
    factory: number;
    list: Array<{名称: string}>;
    needs_list: NumericMap;
}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const game_data = global_state.game_data;
    const scheme_data = global_state.scheme_data;

    let cur = 0;
    for (let i = 0; i < game_data.recipe_data.length; i++) {
        if (game_data.recipe_data[i]["设施"] == factory) {
            cur = scheme_data.scheme_for_recipe[i]["建筑"];
            break;
        }
    }

    const options = list.map((data, idx) => ({
        value: idx, item_icon: data["名称"], label: cur == idx ? data["名称"] : null
    }));

    function set_factory(building) {
        captureComparisonBaseline({
            needs_list: structuredClone(needs_list),
            scheme_data: structuredClone(global_state.raw_scheme_data),
            settings: structuredClone(global_state.settings),
        });
        const building_name = list[building]["名称"];
        set_scheme_data(old_scheme_data => updateSchemesForRecipes(
            old_scheme_data,
            (idx) => {
                const facility = game_data.recipe_data[idx]["设施"];
                const facility_list = game_data.factory_data[facility];
                return facility_list.some(building_info => building_info["名称"] === building_name);
            },
            (recipe_setting, idx) => {
                const facility = game_data.recipe_data[idx]["设施"];
                const facility_list = game_data.factory_data[facility];
                const matched_idx = facility_list.findIndex(building_info => building_info["名称"] === building_name);
                return matched_idx === -1 ? recipe_setting : {
                    ...recipe_setting,
                    "建筑": matched_idx,
                };
            }
        ));
    }

    return <HorizontalMultiButtonSelect choice={cur} options={options}
                                        onChange={set_factory} no_gap={true}/>;
}

export type ComparisonBaseline = {
    needs_list: NumericMap;
    scheme_data: SchemeData;
    settings: Settings;
};

export function BatchSetting({
    captureComparisonBaseline,
    needs_list,
}: {
    captureComparisonBaseline: (baseline: ComparisonBaseline) => void;
    needs_list: NumericMap;
}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const game_data = global_state.game_data;
    const scheme_data = global_state.scheme_data;
    const proliferator_price = global_state.proliferator_price;

    const first_recipe_setting = scheme_data.scheme_for_recipe[0];
    const pro_num = first_recipe_setting?.["增产点数"] ?? 0;
    const pro_mode = first_recipe_setting?.["增产模式"] ?? 0;

    const pro_num_item = {};
    for (const data of game_data.proliferator_data) {
        const pro_point = data["增产点数"];
        pro_num_item[pro_point] = pro_point === 0 ? "无" : data["名称"];
    }

    const factory_doms = [];
    // TODO rename to [factory_kind]
    Object.keys(game_data.factory_data).forEach(factory => {
        const factory_kind = Number(factory);
        const list = game_data.factory_data[factory_kind];
        const used_num = game_data.recipe_data.filter(data => data["设施"] == factory_kind).length;
        //只有可选工厂类型大于等于2，并且这种工厂类型至少被3个配方使用时，才允许批量预设
        if (list.length >= 2 && used_num >= 3) {
            factory_doms.push(<FactorySelect
                key={factory_kind}
                captureComparisonBaseline={captureComparisonBaseline}
                factory={factory_kind}
                list={list}
                needs_list={needs_list}
            />);
        }
    });

    const proliferate_options = [];
    game_data.proliferator_effect.forEach((_data, idx) => {
        if (proliferator_price[idx] != -1) {
            const item = pro_num_item[idx];
            if (item) {
                proliferate_options.push({
                    value: idx, label: idx == 0 ? "无" : null,
                    item_icon: idx != 0 ? item : null
                })
            } else {
                proliferate_options.push({value: idx, label: idx});
            }
        }
    });

    function change_pro_num(pro_num) {
        captureComparisonBaseline({
            needs_list: structuredClone(needs_list),
            scheme_data: structuredClone(global_state.raw_scheme_data),
            settings: structuredClone(global_state.settings),
        });
        set_scheme_data(old_scheme_data => updateSchemesForRecipes(
            old_scheme_data,
            () => true,
            (recipe_setting) => ({
                ...recipe_setting,
                "增产点数": pro_num,
            })
        ));
    }

    function change_pro_mode(pro_mode) {
        captureComparisonBaseline({
            needs_list: structuredClone(needs_list),
            scheme_data: structuredClone(global_state.raw_scheme_data),
            settings: structuredClone(global_state.settings),
        });
        set_scheme_data(old_scheme_data => updateSchemesForRecipes(
            old_scheme_data,
            (idx) => !(pro_mode != 0 && !(pro_mode & game_data.recipe_data[idx]["增产"])),
            (recipe_setting) => ({
                ...recipe_setting,
                "增产模式": Number(pro_mode),
            })
        ));
    }

    const promode_options = [
        {value: 0, label: "无"},
        {value: 1, label: "加速", className: pro_mode_class[1]},
        {value: 2, label: "增产", className: pro_mode_class[2]},
    ];

    return <div className="mt-3 d-inline-flex flex-wrap column-gap-3 row-gap-2 align-items-center">
        <small className="fw-bold">批量预设</small>
        <HorizontalMultiButtonSelect choice={pro_num} options={proliferate_options}
                                     onChange={change_pro_num} no_gap={true} className={"raw-text-selection"}/>
        <HorizontalMultiButtonSelect choice={pro_mode} options={promode_options}
                                     onChange={change_pro_mode} no_gap={true} className={"raw-text-selection"}/>
        {factory_doms}
    </div>;
}
