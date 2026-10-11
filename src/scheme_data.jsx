import {useContext} from 'react';
import {GlobalStateContext, PlanLoaderContext} from './contexts.jsx';
import {SavedPresets} from './components/saved-presets.jsx';
import {createStrategySnapshot} from './lib/plan-state.js';

const DEFAULT_SCHEME_DATA = {
    "pile_sorter_level": -1,
    "item_recipe_choices": {"氢": 1},
    "scheme_for_recipe": [{"建筑": 0, "增产点数": 0, "增产模式": 0}],
    // 这是示例,实际上cost_weight之后会在init_scheme_data中重置
    "cost_weight": {
        "占地": 1,
        "电力": 0,
        "建筑成本": {
            "分拣器": 0,
            "制造台": 0,
        },
        "物品额外成本": {
            "单极磁石": {"成本": 10, "启用": 1, "与其它成本累计": 0},
            "铁": {"成本": 1, "启用": 0, "与其它成本累计": 0}
        }
    },
};

function get_item_data(game_data) {
    //通过读取配方表得到配方中涉及的物品信息，item_data中的键名为物品名，键值为
    //此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
    var item_data = {};
    var i = 0;
    for (var num = 0; num < game_data.recipe_data.length; num++) {
        for (var item in game_data.recipe_data[num].产物) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
            item_data[item].push(num);
        }
    }
    return item_data;
}

export function init_scheme_data(game_data) {
    let scheme_data = structuredClone(DEFAULT_SCHEME_DATA);
    let item_data = get_item_data(game_data);
    scheme_data.item_recipe_choices = {};
    scheme_data.scheme_for_recipe = [];
    scheme_data.cost_weight["占地"] = 1;
    scheme_data.cost_weight["电力"] = 0;
    scheme_data.cost_weight["建筑成本"] = {"分拣器": 0};
    scheme_data.cost_weight["物品额外成本"] = {};
    for (var factory in game_data.factory_data) {
        for (var building_id in game_data.factory_data[factory]) {
            scheme_data.cost_weight["建筑成本"][game_data.factory_data[factory][building_id]["名称"]] = 0;
        }
    }
    for (var item in item_data) {
        scheme_data.cost_weight["物品额外成本"][item] = {
            "成本": 0,
            "启用": 0,
            "与其它成本累计": 0,
            "溢出时处理成本": 0
        };
    }
    for (let item in item_data) {
        const preferred = item_data[item].findIndex((recipe, choice) => choice > 0
            && game_data.default_recipe_ids?.includes(game_data.recipe_ids[recipe]));
        scheme_data.item_recipe_choices[item] = preferred > 0 ? preferred : 1;
    }
    for (var i = 0; i < game_data.recipe_data.length; i++) {
        scheme_data.scheme_for_recipe.push({"建筑": 0, "增产点数": 0, "增产模式": 0});
    }
    return scheme_data;
}

export function SchemeStorage() {
    const global_state = useContext(GlobalStateContext);
    const load_plan = useContext(PlanLoaderContext);
    const game_name = global_state.game_data.game_name;

    return <SavedPresets key={game_name} storageKey="scheme_data" scope={game_name}
                         label="生产策略" noun="方案"
                         saveDescription="保存配方、建筑、增产、物流估算与成本策略，以及独立现有产线。若要保存当前目标及配方分叉，请使用需求列表保存完整方案。"
                         value={createStrategySnapshot(global_state.scheme_data, global_state.settings)}
                         onLoad={saved => load_plan(saved, 'strategy')}/>;
}
