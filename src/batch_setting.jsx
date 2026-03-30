import {useContext, useState} from 'react';
import {CompactModeContext, GlobalStateContext, SchemeDataSetterContext} from './contexts';
import {HorizontalMultiButtonSelect} from './recipe.jsx';
import {pro_mode_class} from './result.jsx';

// TODO refactor to some other modules
function FactorySelect({factory, list, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;

    // 从 scheme_data 推导当前选中建筑（取该设施类型下第一个配方的建筑索引）
    let cur = 0;
    for (let i = 0; i < game_data.recipe_data.length; i++) {
        if (game_data.recipe_data[i]["设施"] == factory) {
            cur = scheme_data.scheme_for_recipe[i]["建筑"];
            break;
        }
    }

    const options = list.map((data, idx) => ({
        value: idx, item_icon: data["名称"],
        label: cur == idx ? <span className="mx-1 compact-hide-text">{data["名称"]}</span> : null
    }));

    function set_factory(building) {
        // 取本设施类型选中建筑的名称，用于跨设施类型匹配
        const building_name = list[building]["名称"];
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                const facility = game_data.recipe_data[i]["设施"];
                const facility_list = game_data.factory_data[facility];
                // 找同名建筑在该设施类型中的索引
                const matched_idx = facility_list.findIndex(b => b["名称"] === building_name);
                if (matched_idx !== -1) {
                    scheme_data.scheme_for_recipe[i]["建筑"] = matched_idx;
                }
            }
            return scheme_data;
        });
    }

    return <HorizontalMultiButtonSelect choice={cur} options={options}
                                        onChange={set_factory} no_gap={true} icon_size={icon_size}/>;
}

export function BatchSetting() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const compact_mode = useContext(CompactModeContext);
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;
    let proliferator_price = global_state.proliferator_price;

    // 从 scheme_data 推导当前增产点数和增产模式（取第一个配方的值）
    let pro_num = 0;
    let pro_mode = 0;
    if (scheme_data.scheme_for_recipe.length > 0) {
        pro_num = scheme_data.scheme_for_recipe[0]["增产点数"];
        pro_mode = scheme_data.scheme_for_recipe[0]["增产模式"];
    }

    const is_mobile = compact_mode === "mobile";
    const mob_icon = is_mobile ? 22 : undefined;

    let pro_num_item = {};
    for (let data of game_data.proliferator_data) {
        let pro_point = data["增产点数"];
        pro_num_item[pro_point] = pro_point === 0 ? "无" : data["名称"];
    }

    let factory_doms = [];
    // TODO rename to [factory_kind]
    Object.keys(game_data.factory_data).forEach(factory => {
        let list = game_data.factory_data[factory];
        let used_num = game_data.recipe_data.filter(data => data["设施"] == factory).length;
        //只有可选工厂类型大于等于2，并且这种工厂类型至少被3个配方使用时，才允许批量预设
        if (list.length >= 2 && used_num >= 3) {
            factory_doms.push(<FactorySelect key={factory} factory={factory} list={list} icon_size={mob_icon}/>);
        }
    });

    let proliferate_options = [];
    game_data.proliferator_effect.forEach((_data, idx) => {
        if (proliferator_price[idx] != -1) {
            let item = pro_num_item[idx];
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
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                scheme_data.scheme_for_recipe[i]["增产点数"] = pro_num;
            }
            return scheme_data;
        });
    }

    function change_pro_mode(pro_mode) {
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                if (pro_mode != 0 && !(pro_mode & game_data.recipe_data[i]["增产"])) {
                    continue;
                }
                scheme_data.scheme_for_recipe[i]["增产模式"] = Number(pro_mode);
            }
            return scheme_data;
        });
    }

    const promode_options = [
        {value: 0, label: "无"},
        {value: 1, label: "加速", className: pro_mode_class[1]},
        {value: 2, label: "增产", className: pro_mode_class[2]},
    ];

    return <div className="mt-3 d-inline-flex flex-wrap column-gap-3 row-gap-2 align-items-center batch-setting-container">
        <small className="fw-bold">批量预设</small>
        <HorizontalMultiButtonSelect choice={pro_num} options={proliferate_options}
                                     onChange={change_pro_num} no_gap={true} className={"raw-text-selection"}
                                     icon_size={mob_icon}/>
        <HorizontalMultiButtonSelect choice={pro_mode} options={promode_options}
                                     onChange={change_pro_mode} no_gap={true} className={"raw-text-selection"}/>
        {factory_doms}
    </div>;
}
