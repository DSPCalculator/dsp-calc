import structuredClone from '@ungap/structured-clone';
import {useContext, useEffect, useState} from 'react';
import {GameInfoContext, GlobalStateContext, SchemeDataSetterContext} from './contexts.jsx';

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

// var is_genesis_book_previous_enable;
// export function MiningSettings() {
//     const global_state = useContext(GlobalStateContext);
//     const set_scheme_data = useContext(SchemeDataSetterContext);
//     let scheme_data = global_state.scheme_data;
//     let settings = global_state.settings;
//
//     if (is_genesis_book_previous_enable === undefined) {
//         is_genesis_book_previous_enable = global_state.game_data.GenesisBookEnable;
//     }
//     let is_genesis_book_current_enable = global_state.game_data.GenesisBookEnable;
//     if (is_genesis_book_previous_enable !== is_genesis_book_current_enable) {
//         if (is_genesis_book_current_enable) {
//             settings.巨星氢面板 = 1;
//             settings.巨星重氢面板 = 0.2;
//             settings.巨星可燃冰面板 = 0.5;
//             settings.fractionating_speed = 3600;
//         } else {
//             settings.巨星氢面板 = 1;
//             settings.巨星重氢面板 = 0.5;
//             settings.巨星可燃冰面板 = 0.5;
//             settings.巨星氦面板 = 0.2;
//             settings.巨星氨面板 = 0.2;
//             settings.行星氮面板 = 0.2;
//             settings.行星氧面板 = 0.2;
//             settings.fractionating_speed.fractionating_speed = 1800;
//         }
//         is_genesis_book_previous_enable = is_genesis_book_current_enable;
//     }
//     let doms = Object.entries(scheme_data.mining_rate).map(([key, value]) =>
//         <tr key={key}>
//             <td className="text-nowrap">{key}</td>
//             <td className="ps-3">
//                 <input type="number" style={{maxWidth: '5em'}} value={value} onChange={
//                     event => set_scheme_data(prev_scheme_data => ({
//                         ...prev_scheme_data,
//                         mining_rate: Object.assign(prev_scheme_data.mining_rate, {
//                             [key]: parseFloat(event.target.value) || 0
//                         })
//                     }))}/>
//             </td>
//         </tr>
//     );
//     //如果未启用创世之书，隐藏巨星氦和巨星氨
//     if (!is_genesis_book_current_enable) {
//         doms = removeProperties(doms, value => value["key"] === "巨星氦面板" || value["key"] === "巨星氨面板");
//     }
//     return <table>
//         <tbody>{doms}</tbody>
//     </table>;
// }
// function removeProperties(obj, predicate) {
//     Object.keys(obj).forEach(key => {
//         if (predicate(obj[key])) {
//             delete obj[key];
//         }
//     });
//     return obj;
// }

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
    for (var item in item_data) {
        scheme_data.item_recipe_choices[item] = 1;
    }
    for (var i = 0; i < game_data.recipe_data.length; i++) {
        scheme_data.scheme_for_recipe.push({"建筑": 0, "增产点数": 0, "增产模式": 0});
    }
    return scheme_data;
}

export function SchemeStorage() {
    const global_state = useContext(GlobalStateContext);
    const game_info = useContext(GameInfoContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    let scheme_data = global_state.scheme_data;
    let game_name = global_state.game_data.game_name;

    const all_saved = JSON.parse(localStorage.getItem("scheme_data")) || {};
    const [all_scheme, set_all_scheme] = useState(all_saved[game_name] || {});
    // TODO implement 实时保存

    useEffect(() => {
        let all_scheme_data = JSON.parse(localStorage.getItem("scheme_data")) || {};
        let all_scheme_init = all_scheme_data[game_name] || {};
        console.log("Loading storage", game_name, Object.keys(all_scheme_init));
        set_all_scheme(all_scheme_init);
    }, [game_info]);

    useEffect(() => {
        let all_scheme_saved = JSON.parse(localStorage.getItem("scheme_data")) || {};
        all_scheme_saved[game_name] = all_scheme;
        localStorage.setItem("scheme_data", JSON.stringify(all_scheme_saved));
    }, [all_scheme])

    //删除当前保存的策略
    function delete_(name) {
        if (name in all_scheme) {
            if (!confirm(`即将删除名为${name}的方案，是否继续`)) {
                return;// 用户取消保存
            }
            let all_scheme_copy = structuredClone(all_scheme);
            delete all_scheme_copy[name];
            set_all_scheme(all_scheme_copy);
        }
    }

    //读取生产策略
    function load(name) {
        if (all_scheme[name]) {
            set_scheme_data(all_scheme[name]);
        } else {
            alert(`未找到名为${name}的方案`);
        }
    }

    //保存生产策略
    function save() {
        let name = prompt("输入方案名");
        if (!name) return;
        if (name in all_scheme) {
            if (!confirm(`已存在名为${name}的方案，继续保存将覆盖原方案`)) {
                return;// 用户取消保存
            }
        }
        let all_scheme_copy = structuredClone(all_scheme);
        all_scheme_copy[name] = structuredClone(scheme_data);
        set_all_scheme(all_scheme_copy);
    }

    let dd_load_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => load(scheme_name)}>{scheme_name}</a>
        </li>));

    let dd_delete_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => delete_(scheme_name)}>{scheme_name}</a>
        </li>));

    return <div className="d-flex gap-2 align-items-center">

        <div className="text-nowrap">生产策略</div>
        <div className="input-group input-group-sm">
            <button className="btn btn-outline-secondary" type="button" onClick={save}>保存</button>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false">加载
            </button>
            <ul className="dropdown-menu">{dd_load_list}</ul>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false">删除
            </button>
            <ul className="dropdown-menu">{dd_delete_list}</ul>
        </div>
    </div>;
}
