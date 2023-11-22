import structuredClone from '@ungap/structured-clone';
import { createContext, useContext, useState, useEffect } from 'react';
import Select from 'react-select';

const DEFAULT_SCHEME_DATA = {
    "item_recipe_choices": { "氢": 1 },
    "scheme_for_recipe": [{ "建筑": 0, "喷涂点数": 0, "增产模式": 0 }],
    "cost_weight": {
        "占地": 1,
        "电力": 0,
        "建筑成本": {
            "分拣器": 0,
            "制造台": 0,
        },
        "物品额外成本": {
            "单极磁石": { "成本": 10, "启用": 1, "与其它成本累计": 0 },
            "铁": { "成本": 1, "启用": 0, "与其它成本累计": 0 }
        }
    },
    "mining_rate": {
        "科技面板倍率": 1.0,
        "小矿机覆盖矿脉数": 8,
        "大矿机覆盖矿脉数": 16,
        "大矿机工作倍率": 3,
        "油井期望面板": 3,
        "巨星氢面板": 1,
        "巨星重氢面板": 0.2,
        "巨星可燃冰面板": 0.5,
        "伊卡洛斯手速": 1
    },
    "fractionating_speed": 1,
    "energy_contain_miner": 0
};

export function MiningSettings({ scheme_data, set_scheme_data }) {
    let doms = Object.entries(scheme_data.mining_rate).map(([key, value]) =>
        <span key={key}>
            {key}: <input type="number" size="6" value={value} onChange={
                event => set_scheme_data(prev_scheme_data => ({
                    ...prev_scheme_data,
                    mining_rate: Object.assign(prev_scheme_data.mining_rate, {
                        [key]: parseFloat(event.target.value) || 0
                    })
                }))} />
        </span>
    );
    return <>{doms}</>;
}

export function FractionatingSetting({ scheme_data, set_scheme_data }) {
    return <><span>分馏塔过氢带速: <input type="number" size="6"
        value={scheme_data.fractionating_speed} onChange={
            event => set_scheme_data(prev_scheme_data => {
                let fractionating_speed = parseFloat(event.target.value) || 0;
                let new_scheme_data = structuredClone(prev_scheme_data);
                new_scheme_data.fractionating_speed = fractionating_speed;

                // TODO calculate fractionating_speed somewhere else
                // if (fractionating_speed > 1800) {
                //     game_data.factory_data["分馏设备"][0]["耗能"] = scheme_data.fractionating_speed * 0.0006 - 0.36;
                // }
                // else {
                //     game_data.factory_data["分馏设备"][0]["耗能"] = 0.72;
                // }
                return new_scheme_data;
            })} />
    </span></>;
}

function get_item_data(game_data) {
    var item_data = {};//通过读取配方表得到配方中涉及的物品信息，item_data中的键名为物品名，键值为此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
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
    scheme_data.cost_weight["建筑成本"] = { "分拣器": 0 };
    scheme_data.cost_weight["物品额外成本"] = {};
    scheme_data.mining_rate = {
        "科技面板倍率": 1.0,
        "小矿机覆盖矿脉数": 8,
        "大矿机覆盖矿脉数": 16,
        "大矿机工作倍率": 3,
        "油井期望面板": 3,
        "巨星氢面板": 1,
        "巨星重氢面板": 0.2,
        "巨星可燃冰面板": 0.5,
        "伊卡洛斯手速": 1
    };
    for (var factory in game_data.factory_data) {
        for (var building_id in game_data.factory_data[factory]) {
            scheme_data.cost_weight["建筑成本"][game_data.factory_data[factory][building_id]["名称"]] = 0;
        }
    }
    for (var item in item_data) {
        scheme_data.cost_weight["物品额外成本"][item] = { "成本": 0, "启用": 0, "与其它成本累计": 0 };
    }
    for (var item in item_data) {
        scheme_data.item_recipe_choices[item] = 1;
    }
    for (var i = 0; i < game_data.recipe_data.length; i++) {
        scheme_data.scheme_for_recipe.push({ "建筑": 0, "喷涂点数": 0, "增产模式": 0 });
    }
    return scheme_data;
}

export function SchemeStorage({ scheme_data, set_scheme_data, game_name }) {
    const [all_scheme, set_all_scheme] = useState({});
    // TODO implement 实时保存
    const NULL_SELECTION = { value: null, label: "（默认，实时保存）" };
    const [current_selection, set_current_selection] = useState(NULL_SELECTION);

    useEffect(() => {
        let all_scheme_data = JSON.parse(localStorage.getItem("scheme_data")) || {};
        let all_scheme_init = all_scheme_data[game_name] || {};
        console.log("Loading storage", game_name, Object.keys(all_scheme_init));
        set_all_scheme(all_scheme_init);
        set_current_selection(NULL_SELECTION);
    }, [game_name]);

    useEffect(() => {
        let all_scheme_saved = JSON.parse(localStorage.getItem("scheme_data")) || {};
        all_scheme_saved[game_name] = all_scheme;
        localStorage.setItem("scheme_data", JSON.stringify(all_scheme_saved));
    }, [all_scheme])

    function delete_() {
        if (!current_selection) return;
        let name = current_selection.value;
        if (name in all_scheme) {
            if (!confirm(`即将删除名为${name}的方案，是否继续`)) {
                return;// 用户取消保存
            }
            let all_scheme_copy = structuredClone(all_scheme);
            delete all_scheme_copy[name];
            set_all_scheme(all_scheme_copy);
            set_current_selection(NULL_SELECTION);
        }
    }//删除当前保存的策略

    function load() {
        if (!current_selection) return;
        let name = current_selection.value;
        if (all_scheme[name]) {
            set_scheme_data(all_scheme[name]);
        } else {
            alert(`未找到名为${name}的方案`);
        }
    }//读取生产策略

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
        set_current_selection({ value: name, label: name });
    }//保存生产策略

    let options = Object.keys(all_scheme).map(scheme_name =>
        ({ value: scheme_name, label: scheme_name }));

    return <><div>
        <button onClick={save}>保存生产策略为</button>
        <Select value={current_selection} onChange={set_current_selection} options={options} />
        <button onClick={load}>加载生产策略</button>
        <button onClick={delete_}>删除生产策略</button>
    </div ></>;
}
