import structuredClone from '@ungap/structured-clone';
import type {GameData, ItemDataIndex, SchemeData} from '@engine/types/domain';

const DEFAULT_SCHEME_DATA: SchemeData = {
    "item_recipe_choices": {"氢": 1},
    "scheme_for_recipe": [{"建筑": 0, "增产点数": 0, "增产模式": 0}],
    // 这是示例,实际上 cost_weight 会在 init_scheme_data 中重置。
    "cost_weight": {
        "占地": 1,
        "电力": 0,
        "建筑成本": {
            "分拣器": 0,
            "制造台": 0,
        },
        "物品额外成本": {
            "单极磁石": {"成本": 10, "启用": 1, "与其它成本累计": 0, "溢出时处理成本": 0},
            "铁": {"成本": 1, "启用": 0, "与其它成本累计": 0, "溢出时处理成本": 0},
        },
    },
};

function get_item_data(game_data: GameData): ItemDataIndex {
    // 通过读取配方表得到配方中涉及的物品信息。
    const item_data: ItemDataIndex = {};
    let i = 0;
    for (let num = 0; num < game_data.recipe_data.length; num++) {
        for (const item in game_data.recipe_data[num].原料) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
        }
        for (const item in game_data.recipe_data[num].产物) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
            item_data[item].push(num);
        }
    }
    return item_data;
}

export function init_scheme_data(game_data: GameData): SchemeData {
    const scheme_data = structuredClone(DEFAULT_SCHEME_DATA);
    const item_data = get_item_data(game_data);
    scheme_data.item_recipe_choices = {};
    scheme_data.scheme_for_recipe = [];
    scheme_data.cost_weight["占地"] = 1;
    scheme_data.cost_weight["电力"] = 0;
    scheme_data.cost_weight["建筑成本"] = {"分拣器": 0};
    scheme_data.cost_weight["物品额外成本"] = {};
    for (let factory = 0; factory < game_data.factory_data.length; factory++) {
        for (let building_id = 0; building_id < game_data.factory_data[factory].length; building_id++) {
            scheme_data.cost_weight["建筑成本"][game_data.factory_data[factory][building_id]["名称"]] = 0;
        }
    }
    for (const item in item_data) {
        scheme_data.cost_weight["物品额外成本"][item] = {
            "成本": 0,
            "启用": 0,
            "与其它成本累计": 0,
            "溢出时处理成本": 0,
        };
    }
    for (const item_name in item_data) {
        scheme_data.item_recipe_choices[item_name] = 1;
    }
    for (let i = 0; i < game_data.recipe_data.length; i++) {
        scheme_data.scheme_for_recipe.push({"建筑": 0, "增产点数": 0, "增产模式": 0});
    }
    return scheme_data;
}
