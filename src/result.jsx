import { useContext } from 'react';
import { GlobalStateContext, SchemeDataSetterContext, UiSettingsSetterContext } from './contexts';
import { AutoSizedInput, ResultNum } from './auto_sized_input.jsx';
import { NplRows } from './natural_production_line';
import { HorizontalMultiButtonSelect, ItemIcon, Recipe } from './recipe';

export function RecipeSelect({ item, choice, onChange }) {
    const global_state = useContext(GlobalStateContext);

    let game_data = global_state.game_data;
    let item_data = global_state.item_data;

    if (item_data[item].length == 2) {
        let recipe_index = item_data[item][1];
        let recipe = game_data.recipe_data[recipe_index];
        return <div className="my-1 px-2 py-1"><Recipe recipe={recipe} /></div>
    } else {
        let doms = [];
        for (let i = 1; i < item_data[item].length; i++) {
            let recipe_index = item_data[item][i];
            let recipe = game_data.recipe_data[recipe_index];
            let bg_class = (i == choice) ? "selected" : "";
            doms.push(<a key={i}
                className={`recipe-item px-2 py-1 d-block text-decoration-none text-reset cursor-pointer ${bg_class}`}
                onClick={() => onChange(i)}>
                <Recipe recipe={recipe} />
            </a>);
        }

        return <div className="border-recipe-item">{doms}</div>;
    }
}

export function ProNumSelect({ choice, onChange }) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_num_text = {};
    for (var i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["单次喷涂最高增产点数"]] = game_data.proliferator_data[i]["增产剂名称"];
    }
    let pro_num_options = [];
    for (var i = 0; i < game_data.proliferate_effect.length; i++) {
        if (i == 0) {
            continue;
        }
        else if (global_state.proliferator_price[i] != -1)
            pro_num_options.push({ value: i, item_icon: pro_num_text[i] });

    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange} optionType={"proNumSelect"} />;
}

export const pro_mode_lists = {
    [0]: { [0]: "无" },
    [1]: { [0]: "无", [1]: "加速" },
    [2]: { [0]: "无", [2]: "增产" },
    [3]: { [0]: "无", [1]: "加速", [2]: "增产" },
    [4]: { [0]: "无", [4]: "接收站透镜喷涂" },
}

export const pro_mode_class = {
    [1]: "pro-mode-speedup",
    [2]: "pro-mode-extra-products"
}

export function ProModeSelect({ recipe_id, choice, onChange }) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let pro_mode_list = pro_mode_lists[game_data.recipe_data[recipe_id]["增产"]];
    let options = Object.entries(pro_mode_list).map(([value, label]) => (
        { value: value, label: label, className: pro_mode_class[value] }
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange} className={"raw-text-selection"} />;
}

export function FactorySelect({ recipe_id, choice, onChange, no_gap }) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let factory_kind = game_data.recipe_data[recipe_id]["设施"];
    let factory_list = game_data.factory_data[factory_kind];

    let options = factory_list.map((factory_data, idx) => (
        { value: idx, item_icon: factory_data["名称"] }
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange} no_gap={no_gap} />;
}

export function Result({ needs_list, set_needs_list }) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const set_ui_settings = useContext(UiSettingsSetterContext);
    // const [result_dict, set_result_dict] = useState(global_state.calculate());
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;
    let ui_settings = global_state.ui_settings;
    let item_data = global_state.item_data;
    let item_graph = global_state.item_graph;
    let time_tick = ui_settings.is_time_unit_minute ? 60 : 1;

    // TODO refactor to a simple list
    let mineralize_list = ui_settings.mineralize_list;
    let natural_production_line = ui_settings.natural_production_line;
    console.log("result natural_production_line", natural_production_line);

    console.log("CALCULATING");
    let [result_dict, lp_surplus_list] = global_state.calculate(needs_list);
    console.log("lp_surplus_list", lp_surplus_list);

    let fixed_num = ui_settings.fixed_num;
    let energy_cost = 0, miner_energy_cost = 0;
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
        }
        var factory = game_data.recipe_data[recipe_id]["设施"];
        let is_factory_miner = factory == "采矿设备" || factory == "抽水设备" || factory == "抽油设备";
        if (factory != "巨星采集") {
            var e_cost = (build_number - offset) * game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["耗能"];
            if (game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"] == "大型采矿机") {
                e_cost = scheme_data.mining_rate["大矿机工作倍率"] * scheme_data.mining_rate["大矿机工作倍率"] * (2.94 - 0.168) + 0.168;
            }
            else if (game_data.recipe_data[recipe_id]["设施"] == "分馏设备") {
                if (scheme_data.fractionating_speed > 1800) {
                    console.log(scheme_data.fractionating_speed)
                    e_cost *= (scheme_data.fractionating_speed * 0.0006 - 0.36) / 0.72;
                }
            }
            if (scheme_for_recipe["增产模式"] != 0 && scheme_for_recipe["喷涂点数"] != 0) {
                e_cost *= game_data.proliferate_effect[scheme_for_recipe["喷涂点数"]]["耗电倍率"];
            }
            if (is_factory_miner) {
                miner_energy_cost += e_cost;
            } else {
                energy_cost += e_cost;
            }
        }
        return build_number;
    }
    function get_gross_output(amount, item) {
        var offset = 0;
        offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        if (item_graph[item]["自消耗"]) {
            return Number(amount * (1 + item_graph[item]["自消耗"])) + offset;
        }
        return Number(amount) + offset;
    }

    // Dict<item, Dict<from, quantity>>
    let side_products = {};
    Object.entries(result_dict).forEach(([item, item_count]) => {
        Object.entries(item_graph[item]["副产物"]).forEach(([side_product, amount]) => {
            side_products[side_product] = side_products[side_product] || {};
            side_products[side_product][item] = item_count * amount;
        });
    })

    function mineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        new_mineralize_list[item] = structuredClone(item_graph[item]);
        // editing item_graph!
        item_graph[item]["原料"] = {};

        console.log("mineralize_list", new_mineralize_list);
        set_ui_settings("mineralize_list", new_mineralize_list);
    }

    function unmineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        // editing item_graph!
        item_graph[item] = structuredClone(mineralize_list[item]);
        delete new_mineralize_list[item];
        set_ui_settings("mineralize_list", new_mineralize_list);
    }

    function clear_mineralize_list() {
        for (let item in mineralize_list) {
            // editing item_graph!
            item_graph[item] = structuredClone(mineralize_list[item]);
        }
        set_ui_settings("mineralize_list", {});
    }

    let mineralize_doms = Object.keys(mineralize_list).map(item => (
        <a key={item} className="m-1 cursor-pointer" onClick={() => unmineralize(item)}><ItemIcon item={item} /></a>
    ));

    let result_table_rows = [];
    for (let i in result_dict) {
        side_products[i] = side_products[i] || {};
        let total = result_dict[i] + Object.values(side_products[i]).reduce((a, b) => a + b, 0);
        if (total < 1e-6) continue;
        let recipe_id = item_data[i][scheme_data.item_recipe_choices[i]];
        if (ui_settings.hide_mines && ((i in mineralize_list) || Object.keys(game_data.recipe_data[recipe_id]["原料"]).length < 1)) {
            continue;
        }
        let factory_number = get_factory_number(result_dict[i], i).toFixed(fixed_num);
        let from_side_products = Object.entries(side_products[i]).map(([from, amount]) =>
            <div key={from} className="text-nowrap">+{amount.toFixed(fixed_num)} (<ItemIcon item={from} size={26} />)</div>
        );
        let factory_name = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"];
        let is_mineralized = i in mineralize_list;
        let row_class = is_mineralized ? "table-secondary" : "";

        function change_recipe(value) {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.item_recipe_choices[i] = value;
                return scheme_data;
            })
        }

        function change_pro_num(value) {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.scheme_for_recipe[recipe_id]["喷涂点数"] = value;
                return scheme_data;
            })
        }

        function change_pro_mode(value) {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.scheme_for_recipe[recipe_id]["增产模式"] = value;
                return scheme_data;
            })
        }

        function change_factory(value) {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.scheme_for_recipe[recipe_id]["建筑"] = value;
                return scheme_data;
            })
        }

        function set_needs_in_row(value0) {
            return function (e_or_value) {
                // Either an event [e] or a raw [value] is supported
                if (value0 != 0) {
                    let value = e_or_value.target ? e_or_value.target.value : e_or_value;
                    let new_needs_list = structuredClone(needs_list);
                    for (let i in needs_list) {
                        new_needs_list[i] *= value / value0;
                    }
                    set_needs_list(new_needs_list);
                }
            }
        }

        result_table_rows.push(<tr className={row_class} key={i}>
            {/* 操作 */}
            <td>
                {is_mineralized ?
                    <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn" onClick={() => unmineralize(i)}>恢复</button> :
                    <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn" onClick={() => mineralize(i)}>
                        <div>视为</div><div>原矿</div></button>
                }
            </td>
            {/* 目标物品 */}
            <td><div className="d-flex align-items-center text-nowrap">
                <ItemIcon item={i} tooltip={false} />
                <small className="ms-1">{i}</small>
            </div></td>
            {/* 分钟毛产出 */}
            <td className="text-center">
                <AutoSizedInput value={get_gross_output(result_dict[i], i).toFixed(fixed_num)} onChange={set_needs_in_row(result_dict[i])} />
                {from_side_products}
            </td>
            {/* 所需工厂*数目 */}
            <td className="text-nowrap">
                {is_mineralized ||
                    <>
                        <ItemIcon item={factory_name} size={30} />
                        <AutoSizedInput value={factory_number} onChange={set_needs_in_row(factory_number)} />
                    </>
                }
            </td>
            {/* 所选配方 */}
            <td><RecipeSelect item={i} onChange={change_recipe}
                choice={scheme_data.item_recipe_choices[i]} /></td>
            {/* 所选增产模式 */}
            <td><ProModeSelect recipe_id={recipe_id} onChange={change_pro_mode}
                choice={scheme_data.scheme_for_recipe[recipe_id]["增产模式"]} /></td>
            {/* 所选增产剂 */}
            <td><ProNumSelect onChange={change_pro_num}
                choice={scheme_data.scheme_for_recipe[recipe_id]["喷涂点数"]} /></td>
            {/* 所选工厂种类 */}
            <td><FactorySelect recipe_id={recipe_id} onChange={change_factory}
                choice={scheme_data.scheme_for_recipe[recipe_id]["建筑"]} /></td>
        </tr>);
    }

    for (var NPId in natural_production_line) {
        var recipe = game_data.recipe_data[item_data[natural_production_line[NPId]["目标物品"]][natural_production_line[NPId]["配方id"]]];
        var building = game_data.factory_data[recipe["设施"]][natural_production_line[NPId]["建筑"]];
        if (building["名称"] in building_list) {
            building_list[building["名称"]] = Number(building_list[building["名称"]]) + Math.ceil(natural_production_line[NPId]["建筑数量"]);
        }
        else {
            building_list[building["名称"]] = Math.ceil(natural_production_line[NPId]["建筑数量"]);
        }

        let factory = recipe["设施"];
        let is_factory_miner = factory == "采矿设备" || factory == "抽水设备" || factory == "抽油设备";
        if (factory != "巨星采集") {
            var e_cost = natural_production_line[NPId]["建筑数量"] * building["耗能"];
            if (natural_production_line[NPId]["喷涂点数"] != 0 && natural_production_line[NPId]["增产模式"] != 0) {
                e_cost *= game_data.proliferate_effect[natural_production_line[NPId]["喷涂点数"]]["耗电倍率"];
            }
            if (is_factory_miner) {
                miner_energy_cost += e_cost;
            } else {
                energy_cost += e_cost;
            }
        }
    }

    let building_rows = Object.entries(building_list).map(([building, count]) => (
        <tr key={building}>
            <td className="d-flex align-items-center text-nowrap">
                <span className="ms-auto me-1">{building}</span>
                <ItemIcon item={building} tooltip={false} />
            </td>
            <td className="ps-2 text-nowrap">x {count}</td>
        </tr>));

    let surplus_doms = Object.entries(lp_surplus_list).map(([item, quant]) =>
        (<div key={item} className="text-nowrap"><ItemIcon item={item} /> x{quant.toFixed(fixed_num)}</div>));


    return <div className="my-3 d-flex gap-5">
        {/* 结果表格 */}
        <table className="table table-sm align-middle w-auto result-table">
            <thead>
                <tr className="text-center text-nowrap">
                    <th width={60}>操作</th>
                    <th width={140}>物品</th>
                    <th width={130}>产能</th>
                    <th width={110}>工厂</th>
                    <th width={300}>配方选取</th>
                    <th width={180}>增产模式</th>
                    <th width={160}>增产剂</th>
                    <th width={170}>工厂类型</th>
                </tr>
            </thead>
            <tbody className="table-group-divider">
                <NplRows />
                {result_table_rows}
            </tbody>
        </table>
        {/* 结果右侧悬浮栏 */}
        <div className="sticky-top mt-3 align-self-start d-flex flex-column gap-2">

            {mineralize_doms.length > 0 &&
                <fieldset className="w-fit">
                    <legend><small>原矿化列表</small></legend>
                    <div className="d-flex flex-wrap align-items-center">
                        {mineralize_doms}
                        <button className="ms-2 btn btn-sm btn-outline-danger text-nowrap"
                            onClick={clear_mineralize_list}>清空</button>
                    </div>
                </fieldset>
            }

            {surplus_doms.length > 0 &&
                <fieldset className="w-fit">
                    <legend><small>多余产物</small></legend>
                    {surplus_doms}
                </fieldset>}

            {building_rows.length > 0 &&
                <>
                    <fieldset className="w-fit">
                        <legend><small>建筑统计</small></legend>
                        <table><tbody>{building_rows}</tbody></table>
                    </fieldset>
                    <span className="d-inline-flex gap-1 text-nowrap">
                        <span className="me-1">预估电力</span>
                        <span className="fast-tooltip" data-tooltip="不包含采集设备">
                            {energy_cost.toFixed(fixed_num)}
                        </span>/
                        <span className="fast-tooltip" data-tooltip="包含采集设备">
                            {(energy_cost + miner_energy_cost).toFixed(fixed_num)}
                        </span>
                        MW
                    </span>
                </>}
        </div>
    </div>;
}
