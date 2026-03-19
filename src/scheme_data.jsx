import {useContext} from 'react';
import {GlobalStateContext, SchemeDataSetterContext} from './contexts.jsx';
import {Save2, Folder2Open, Trash} from 'react-bootstrap-icons';
import {useStorageManager} from './hooks/use_storage_manager.jsx';

const DEFAULT_SCHEME_DATA = {
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
        scheme_data.item_recipe_choices[item] = 1;
    }
    for (var i = 0; i < game_data.recipe_data.length; i++) {
        scheme_data.scheme_for_recipe.push({"建筑": 0, "增产点数": 0, "增产模式": 0});
    }
    return scheme_data;
}

export function SchemeStorage() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    let scheme_data = global_state.scheme_data;
    let game_name = global_state.game_data.game_name;

    const {all_items: all_scheme, save, load, delete_} = useStorageManager("scheme_data", game_name);

    const handle_save = () => save(scheme_data, "方案");
    const handle_load = (name) => load(name, set_scheme_data, "方案");
    const handle_delete = (name) => delete_(name, "方案");

    let dd_load_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => handle_load(scheme_name)}>{scheme_name}</a>
        </li>));

    let dd_delete_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => handle_delete(scheme_name)}>{scheme_name}</a>
        </li>));

    return <div className="d-flex gap-2 align-items-center">
        <div className="text-nowrap storage-label">生产策略</div>
        <div className="input-group input-group-sm">
            <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                    type="button" onClick={handle_save} title="保存生产策略">
                <Save2 className="compact-show"/>
                <span className="compact-hide-text">保存</span>
            </button>
            <button className="btn btn-outline-secondary dropdown-toggle d-inline-flex align-items-center gap-1"
                    type="button" data-bs-toggle="dropdown" aria-expanded="false" title="加载生产策略">
                <Folder2Open className="compact-show"/>
                <span className="compact-hide-text">加载</span>
            </button>
            <ul className="dropdown-menu">{dd_load_list}</ul>
            <button className="btn btn-outline-secondary dropdown-toggle d-inline-flex align-items-center gap-1"
                    type="button" data-bs-toggle="dropdown" aria-expanded="false" title="删除生产策略">
                <Trash className="compact-show"/>
                <span className="compact-hide-text">删除</span>
            </button>
            <ul className="dropdown-menu">{dd_delete_list}</ul>
        </div>
    </div>;
}
