import { useEffect, useState } from 'react'

export function Result({ global_state, needs_list }) {
    // const [result_dict, set_result_dict] = useState(global_state.calculate());
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;
    let item_data = global_state.item_data;
    let item_graph = global_state.item_graph;
    let time_tick = global_state.ui_settings.time_tick;
    let mineralize_list = global_state.ui_settings.mineralize_list;
    let natural_production_line = global_state.natural_production_line;


    console.log("CALCULATING");
    let result_dict = global_state.calculate(needs_list);

    // TODO fixed_num
    let fixed_num = 2;
    let energy_cost = 0;
    let building_list = {};
    function get_factory_number(amount, item) {
        var recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        var scheme_for_recipe = scheme_data.scheme_for_recipe[recipe_id];
        var factory_per_yield = 1 / item_graph[item]["产出倍率"] / game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["倍率"];
        var offset = 0;
        offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        var build_number = amount / time_tick * factory_per_yield + offset;
        if (Math.ceil(build_number - 0.5 * 0.1 ** fixed_num) != 0) {
            if (game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"] in building_list) {
                building_list[game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"]] = Number(building_list[game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"]]) + Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            }
            else {
                building_list[game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"]] = Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            }
        } game_data.factory_data[""]
        var factory = game_data.recipe_data[recipe_id]["设施"];
        if (factory != "巨星采集" && !(!scheme_data.energy_contain_miner && (factory == "采矿设备" || factory == "抽水设备" || factory == "抽油设备"))) {
            var e_cost = build_number * game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["耗能"];
            if (game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"] == "大型采矿机") {
                e_cost = scheme_data.mining_rate["大矿机工作倍率"] * scheme_data.mining_rate["大矿机工作倍率"] * (2.94 - 0.168) + 0.168;
            }
            if (scheme_for_recipe["增产模式"] != 0 && scheme_for_recipe["喷涂点数"] != 0) {
                e_cost *= game_data.proliferate_effect[scheme_for_recipe["喷涂点数"]]["耗电倍率"];
            }
            energy_cost = Number(energy_cost) + e_cost;
        }
        return build_number;
    }
    function is_mineralized(item) {
        if (item in mineralize_list) {
            return "(原矿化)";
        }
        else {
            return "";
        }
    }
    function get_gross_output(amount, item) {
        var offset = 0;
        offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        if (item_graph[item]["自消耗"]) {
            return Number(amount * (1 + item_graph[item]["自消耗"])) + offset;
        }
        return Number(amount) + offset;
    }
    // function add_side_products_in_other_row(item) {
    //     var item_num = result_dict[item];
    //     for (var side_products in item_graph[item]["副产物"]) {
    //         document.getElementById("num_of_" + side_products).insertAdjacentHTML("beforeend", "<br>+" + (item_num * item_graph[item]["副产物"][side_products] + 0.49994 * 0.1 ** fixed_num).toFixed(fixed_num) + "(来自" + item + ")");
    //         total_item_dict[side_products] += item_num * item_graph[item]["副产物"][side_products];
    //     }
    // }

    // Dict<item, Dict<from, quantity>>
    let side_products = {};
    Object.entries(result_dict).forEach(([item, item_count]) => {
        Object.entries(item_graph[item]["副产物"]).forEach(([side_product, amount]) => {
            side_products[side_product] = side_products[side_product] || {};
            side_products[side_product][item] = item_count * amount;
        });
    })

    let result_table_rows = [];
    for (let i in result_dict) {
        side_products[i] = side_products[i] || {};
        let total = result_dict[i] + Object.values(side_products[i]).reduce((a, b) => a + b, 0);
        if (total < 1e-6) continue;

        let recipe_id = item_data[i][scheme_data.item_recipe_choices[i]];
        let factory_number = get_factory_number(result_dict[i], i).toFixed(fixed_num);

        let from_side_products = Object.entries(side_products[i]).map(([from, amount]) =>
            <p key={from}>+ {amount} (来自 {from} )</p>
        );

        result_table_rows.push(<tr key={i} id={`row_of_${i}`}>
            {/* 操作 */}
            <th><button className='btn btn-sm btn-outline-primary' onClick={() => mineralize(i)}>视为原矿</button></th>
            {/* 目标物品 */}
            <th><img src={`./image/${global_state.game_name}/${i}.png`} title={i} style={{ width: '40px', height: '40px' }} /></th>
            {/* 分钟毛产出 */}
            <th id={`num_of_${i}`}>
                <span>{get_gross_output(result_dict[i], i).toFixed(fixed_num)}</span>
                {from_side_products}
            </th>
            {/* 所需工厂*数目 */}
            <th><p id={`factory_counts_of_${i}`} value={factory_number}>{game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"] +
                " * " + factory_number + is_mineralized(i)}</p></th>
            {/* 所选配方 */}
            <th><select id={`recipe_for_${i}`} onChange={() => ChangeRecipeOf(i)}></select></th>
            {/* 所选增产剂 */}
            <th><select id={`pro_num_for_${i}`} onChange={() => ChangeSchemeOf(i)}></select></th>
            {/* 所选增产模式 */}
            <th><select id={`pro_mode_for_${i}`} onChange={() => ChangeSchemeOf(i)}></select></th>
            {/* 所选工厂种类 */}
            <th><select id={`factory_for_${i}`} onChange={() => ChangeSchemeOf(i)}></select></th>
        </tr>);
    }

    for (var i in result_dict) {
        // TODO enable these
        // change_result_row_for_item(i);
    }

    for (var NPId in natural_production_line) {
        var recipe = game_data.recipe_data[item_data[natural_production_line[NPId]["目标物品"]][natural_production_line[NPId]["配方id"]]];
        var building = game_data.factory_data[recipe["设施"]][natural_production_line[NPId]["建筑"]];
        if (building in building_list) {
            building_list[building["名称"]] = Number(building_list[building["名称"]]) + Math.ceil(natural_production_line[NPId]["建筑数量"]);
        }
        else {
            building_list[building["名称"]] = Math.ceil(natural_production_line[NPId]["建筑数量"]);
        }
        if (recipe["设施"] != "巨星采集" && !(!scheme_data.energy_contain_miner && (recipe["设施"] == "采矿设备" || recipe["设施"] == "抽水设备" || recipe["设施"] == "抽油设备"))) {
            var e_cost = natural_production_line[NPId]["建筑数量"] * building["耗能"];
            if (natural_production_line[NPId]["喷涂点数"] != 0 && natural_production_line[NPId]["增产模式"] != 0) {
                e_cost *= game_data.proliferate_effect[natural_production_line[NPId]["喷涂点数"]]["耗电倍率"];
            }
            energy_cost = Number(energy_cost) + e_cost;
        }
    }

    let building_doms = Object.entries(building_list).map(([building, count]) => (
        <div key={building}>{building}：{count}</div>));

    return <div className="card">
        <p>总计产能需求：</p>
        <table>
            <thead>
                <tr>
                    <th>操作</th>
                    <th>目标物品</th>
                    <th>需求产能</th>
                    <th>所需工厂数</th>
                    <th>配方选取</th>
                    <th>合成时原料喷涂点数</th>
                    <th>增产模式选择</th>
                    <th>工厂类型选择</th>
                </tr>
            </thead>
            <tbody>{result_table_rows}</tbody>
        </table>

        <p>建筑统计：</p>
        {building_doms}
        <p>预估电力需求下限：{energy_cost.toFixed(fixed_num)} MW</p>
        <button onClick={() => alert("TODO")}>{scheme_data.energy_contain_miner ? "忽视" : "考虑"}采集设备耗电</button>
    </div>;
}
