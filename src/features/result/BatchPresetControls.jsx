import {useContext, useState} from 'react';
import {GlobalStateContext, SchemeDataSetterContext} from '../../app/providers/app-contexts.js';
import {HorizontalMultiButtonSelect} from '../../shared/ui/HorizontalMultiButtonSelect.jsx';
import {pro_mode_class} from './resultSelectorClasses.js';

// TODO refactor to some other modules
function updateSchemesForRecipes(old_scheme_data, should_update, updater) {
    return {
        ...old_scheme_data,
        scheme_for_recipe: old_scheme_data.scheme_for_recipe.map((recipe_setting, idx) => (
            should_update(idx) ? updater(recipe_setting, idx) : recipe_setting
        )),
    };
}

function FactorySelect({factory, list}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const [cur, set_cur] = useState(0);
    let game_data = global_state.game_data;

    const options = list.map((data, idx) => ({
        value: idx, item_icon: data["名称"], label: cur == idx ? data["名称"] : null
    }));

    function set_factory(building) {
        set_cur(building);
        set_scheme_data(old_scheme_data => updateSchemesForRecipes(
            old_scheme_data,
            (idx) => game_data.recipe_data[idx]["设施"] == factory,
            (recipe_setting) => ({
                ...recipe_setting,
                "建筑": building,
            })
        ));
    }

    return <HorizontalMultiButtonSelect choice={cur} options={options}
                                        onChange={set_factory} no_gap={true}/>;
}

export function BatchSetting() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const [pro_num, set_pro_num] = useState(0);
    const [pro_mode, set_pro_mode] = useState(0);
    let game_data = global_state.game_data;
    let proliferator_price = global_state.proliferator_price;

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
            factory_doms.push(<FactorySelect key={factory} factory={factory} list={list}/>);
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
        set_pro_num(pro_num);
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
        set_pro_mode(pro_mode);
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
