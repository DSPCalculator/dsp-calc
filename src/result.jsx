import structuredClone from '@ungap/structured-clone';
import {useContext} from 'react';
import {GlobalStateContext, SchemeDataSetterContext, SettingsSetterContext} from './contexts';
import {ItemIcon} from './icon';
import {NplRows} from './natural_production_line';
import {HorizontalMultiButtonSelect, Recipe} from './recipe';
import {AutoSizedInput} from './ui_components/auto_sized_input.jsx';

export function RecipeSelect({item, choice, onChange}) {
    const global_state = useContext(GlobalStateContext);

    let game_data = global_state.game_data;
    let item_data = global_state.item_data;

    if (item_data[item].length == 2) {
        let recipe_index = item_data[item][1];
        let recipe = game_data.recipe_data[recipe_index];
        return <div className="my-1 px-2 py-1"><Recipe recipe={recipe}/></div>
    } else {
        let doms = [];
        for (let i = 1; i < item_data[item].length; i++) {
            let recipe_index = item_data[item][i];
            let recipe = game_data.recipe_data[recipe_index];
            let bg_class = (i == choice) ? "selected" : "";
            doms.push(<a key={i}
                         className={`recipe-item px-2 py-1 d-block text-decoration-none text-reset cursor-pointer ${bg_class}`}
                         onClick={() => onChange(i)}>
                <Recipe recipe={recipe}/>
            </a>);
        }

        return <div className="border-recipe-item">{doms}</div>;
    }
}

export function ProNumSelect({choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_num_text = {};
    for (var i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["增产点数"]] = game_data.proliferator_data[i]["名称"];
    }
    let pro_num_options = [];
    for (var i = 0; i < game_data.proliferator_effect.length; i++) {
        if (i == 0) {
            continue;
        } else if (global_state.proliferator_price[i] != -1)
            pro_num_options.push({value: i, item_icon: pro_num_text[i]});

    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange}
                                        optionType={"proNumSelect"}/>;
}

export const pro_mode_class = {
    [1]: "pro-mode-speedup",
    [2]: "pro-mode-extra-products"
}

export function ProModeSelect({recipe_id, choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_modes = {[0]: "无"};
    //如果是增产塔，只能选择增产分馏
    if (game_data.recipe_data[recipe_id]["增产"] & (1 << 3)) {
        pro_modes = {};
    }
    ["加速", "增产", "接收站透镜喷涂", "增产分馏"].forEach((e, i) => {
        if (game_data.recipe_data[recipe_id]["增产"] & (1 << i)) pro_modes[i + 1] = e
    })
    let options = Object.entries(pro_modes).map(([value, label]) => (
        {value: value, label: label, className: pro_mode_class[value]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        className={"raw-text-selection"}/>;
}

export function FactorySelect({recipe_id, choice, onChange, no_gap}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let factory_kind = game_data.recipe_data[recipe_id]["设施"];
    let factory_list = game_data.factory_data[factory_kind];

    let options = factory_list.map((factory_data, idx) => (
        {value: idx, item_icon: factory_data["名称"]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange} no_gap={no_gap}/>;
}

export function Result({needs_list, set_needs_list}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const set_settings = useContext(SettingsSetterContext);
    // const [result_dict, set_result_dict] = useState(global_state.calculate());
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;
    let settings = global_state.settings;
    let item_data = global_state.item_data;
    let item_graph = global_state.item_graph;
    let time_tick = settings.is_time_unit_minute ? 60 : 1;

    // TODO refactor to a simple list
    let mineralize_list = settings.mineralize_list;
    let natural_production_line = settings.natural_production_line;
    console.log("result natural_production_line", natural_production_line);

    console.log("CALCULATING");
    let [result_dict, lp_surplus_list] = global_state.calculate(needs_list);
    console.log("lp_surplus_list", lp_surplus_list);

    let fixed_num = settings.fixed_num;
    let energy_cost = 0, miner_energy_cost = 0;
    let building_list = {};

    function get_factory_number(amount, item) {
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const scheme_recipe = scheme_data.scheme_for_recipe[recipe_id];
        const factories_type = game_data.recipe_data[recipe_id]["设施"];
        const factory_info = game_data.factory_data[factories_type][scheme_recipe["建筑"]];
        const factory_name = factory_info["名称"];
        const factory_per_yield = 1 / item_graph[item]["产出倍率"] / factory_info["倍率"];
        const offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        const build_number = amount / time_tick * factory_per_yield + offset;
        if (Math.ceil(build_number - 0.5 * 0.1 ** fixed_num) !== 0) {
            if (factory_name in building_list) {
                building_list[factory_name] = Number(building_list[factory_name]) + Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            } else {
                building_list[factory_name] = Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            }
        }
        if (factory_name !== "轨道采集器") {
            let e_cost = (build_number - offset) * factory_info["耗能"];
            if (factory_name === "大型采矿机") {
                e_cost = settings.mining_efficiency_large / 100.0 * settings.mining_efficiency_large / 100.0 * (2.94 - 0.168) + 0.168;
            } else if (factory_name.endsWith("分馏塔")) {
                if (game_data.mods.GenesisBookEnable) {
                    if (settings.fractionating_speed > 60) {
                        e_cost *= (settings.fractionating_speed * 0.036 - 0.72) / 1.44;
                    }
                } else {
                    if (settings.fractionating_speed > 30) {
                        e_cost *= (settings.fractionating_speed * 0.036 - 0.36) / 0.72;
                    }
                }
            }
            if (scheme_recipe["增产模式"] != 0 && scheme_recipe["增产点数"] != 0) {
                e_cost *= game_data.proliferator_effect[scheme_recipe["增产点数"]]["耗电倍率"];
            }
            if (factory_name === "采矿机" || factory_name === "大型采矿机"
                || factory_name === "抽水机" || factory_name === "聚束液体汲取设施" || factory_name === "原油萃取站") {
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
        set_settings({"mineralize_list": new_mineralize_list});
    }

    function unmineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        // editing item_graph!
        item_graph[item] = structuredClone(mineralize_list[item]);
        delete new_mineralize_list[item];
        set_settings({"mineralize_list": new_mineralize_list});
    }

    function clear_mineralize_list() {
        for (let item in mineralize_list) {
            // editing item_graph!
            item_graph[item] = structuredClone(mineralize_list[item]);
        }
        set_settings({"mineralize_list": {}});
    }

    let mineralize_doms = Object.keys(mineralize_list).map(item => (
        <a key={item} className="m-1 cursor-pointer" onClick={() => unmineralize(item)}><ItemIcon item={item}/></a>
    ));

    let result_table_rows = [];
    for (let i in result_dict) {
        side_products[i] = side_products[i] || {};
        let total = result_dict[i] + Object.values(side_products[i]).reduce((a, b) => a + b, 0);
        if (total < 1e-6) continue;
        let recipe_id = item_data[i][scheme_data.item_recipe_choices[i]];
        if (settings.hide_mines && ((i in mineralize_list) || Object.keys(game_data.recipe_data[recipe_id]["原料"]).length < 1)) {
            continue;
        }
        let factory_number = get_factory_number(result_dict[i], i);
        let from_side_products = Object.entries(side_products[i]).map(([from, amount]) =>
            <div key={from} className="text-nowrap">+{amount.toFixed(fixed_num)} (<ItemIcon item={from} size={26}/>)
            </div>
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
                scheme_data.scheme_for_recipe[recipe_id]["增产点数"] = value;
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

        function RatioAdjustInput({value}) {
            let disp_value = value.toFixed(fixed_num);
            let base_value = +disp_value;

            function set_needs_in_row() {
                return function (e_or_value) {
                    // Either an event [e] or a raw [value] is supported
                    if (base_value != 0) {
                        let new_value = e_or_value.target ? e_or_value.target.value : e_or_value;
                        let new_needs_list = {};
                        for (let i in needs_list) {
                            new_needs_list[i] = needs_list[i] * new_value / base_value;
                        }
                        set_needs_list(new_needs_list);
                    }
                }
            }

            return <span data-tooltip="等比例调整需求" className="fast-tooltip">
                <AutoSizedInput
                    delayed={true}
                    value={disp_value}
                    onChange={set_needs_in_row()}/>
            </span>;
        }

        result_table_rows.push(<tr className={row_class} key={i}>
            {/* 操作 */}
            <td>
                {is_mineralized ?
                    <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
                            onClick={() => unmineralize(i)}>恢复</button> :
                    <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
                            onClick={() => mineralize(i)}>
                        <div>视为</div>
                        <div>原矿</div>
                    </button>
                }
            </td>
            {/* 目标物品 */}
            <td>
                <div className="d-flex align-items-center text-nowrap">
                    <ItemIcon item={i} tooltip={false}/>
                    <small className="ms-1">{i}</small>
                </div>
            </td>
            {/* 分钟毛产出 */}
            <td className="text-center">
                <RatioAdjustInput value={get_gross_output(result_dict[i], i)}/>
                {from_side_products}
            </td>
            {/* 所需工厂*数目 */}
            <td className="text-nowrap">
                {is_mineralized ||
                    <>
                        <div className="d-inline-flex align-items-center gap-1">
                            <ItemIcon item={factory_name} size={30}/>
                            <RatioAdjustInput value={factory_number}/>
                        </div>
                    </>
                }
            </td>
            {/* 所选配方 */}
            <td><RecipeSelect item={i} onChange={change_recipe}
                              choice={scheme_data.item_recipe_choices[i]}/></td>
            {/* 所选增产模式 */}
            <td><ProModeSelect recipe_id={recipe_id} onChange={change_pro_mode}
                               choice={scheme_data.scheme_for_recipe[recipe_id]["增产模式"]}/></td>
            {/* 所选增产剂 */}
            <td><ProNumSelect onChange={change_pro_num}
                              choice={scheme_data.scheme_for_recipe[recipe_id]["增产点数"]}/></td>
            {/* 所选工厂种类 */}
            <td><FactorySelect recipe_id={recipe_id} onChange={change_factory}
                               choice={scheme_data.scheme_for_recipe[recipe_id]["建筑"]}/></td>
        </tr>);
    }

    for (let NPId in natural_production_line) {
        let recipe = game_data.recipe_data[item_data[natural_production_line[NPId]["目标物品"]][natural_production_line[NPId]["配方id"]]];
        let factory_info = game_data.factory_data[recipe["设施"]][natural_production_line[NPId]["建筑"]];
        const factory_name = factory_info["名称"];
        if (factory_name in building_list) {
            building_list[factory_name] = Number(building_list[factory_name]) + Math.ceil(natural_production_line[NPId]["建筑数量"]);
        } else {
            building_list[factory_name] = Math.ceil(natural_production_line[NPId]["建筑数量"]);
        }
        if (factory_name !== "轨道采集器") {
            let e_cost = natural_production_line[NPId]["建筑数量"] * factory_info["耗能"];
            if (natural_production_line[NPId]["增产点数"] != 0 && natural_production_line[NPId]["增产模式"] != 0) {
                e_cost *= game_data.proliferator_effect[natural_production_line[NPId]["增产点数"]]["耗电倍率"];
            }
            if (factory_name === "采矿机" || factory_name === "大型采矿机"
                || factory_name === "抽水机" || factory_name === "聚束液体汲取设施" || factory_name === "原油萃取站") {
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
                <ItemIcon item={building} tooltip={false}/>
            </td>
            <td className="ps-2 text-nowrap">x {count}</td>
        </tr>));

    function IncreaseCostWhenSurplus(item) {
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            scheme_data.cost_weight["物品额外成本"][item]["溢出时处理成本"] += 5000;
            return scheme_data;
        })
    }

    let surplus_doms = Object.entries(lp_surplus_list).map(([item, quant]) =>
        (<div key={item} className="text-nowrap"><ItemIcon item={item}/> x{quant.toFixed(fixed_num)}
            <button className="ms-2 btn btn-outline-primary ssmall text-nowrap mineralize-btn"
                    onClick={() => IncreaseCostWhenSurplus(item)}>
                <div>避免</div>
                <div>溢出</div>
            </button>
        </div>));

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
            <NplRows/>
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
                                onClick={clear_mineralize_list}>清空
                        </button>
                    </div>
                </fieldset>
            }

            {surplus_doms.length > 0 &&
                <fieldset className="w-fit">
                    <legend><small>多余产物</small></legend>
                    {surplus_doms}
                </fieldset>}

            {/* 原矿输入总需求 */}
            {(() => {
                // 判断物品是否为原矿：1. 在原矿化列表中，或 2. 配方没有输入需求且输出产物只有一种
                const isRawMaterial = (item) => {
                    if (item in mineralize_list) return true;
                    try {
                        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
                        const recipe = game_data.recipe_data[recipe_id];
                        // 检查配方是否没有输入需求且输出产物只有一种
                        const hasNoInputs = Object.keys(recipe["原料"]).length === 0;
                        const hasSingleOutput = Object.keys(recipe["产物"]).length === 1;
                        return hasNoInputs && hasSingleOutput;
                    } catch (e) {
                        return false;
                    }
                };
                
                const rawMaterials = Object.entries(result_dict).filter(([item]) => isRawMaterial(item));
                return rawMaterials.length > 0 && (
                    <fieldset className="w-fit">
                        <legend><small>原矿输入总需求</small></legend>
                        <table>
                            <tbody>
                                {rawMaterials.map(([item, amount]) => (
                                    <tr key={item}>
                                        <td className="d-flex align-items-center text-nowrap">
                                            <ItemIcon item={item} tooltip={false} size={24}/>
                                            <small className="ms-1">{item}</small>
                                        </td>
                                        <td className="ps-2 text-nowrap">
                                            <small>{amount.toFixed(fixed_num)}/{time_tick === 60 ? 'min' : 'sec'}</small>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </fieldset>
                );
            })()}


            {building_rows.length > 0 &&
                <>
                    <fieldset className="w-fit">
                        <legend><small>建筑统计</small></legend>
                        <table>
                            <tbody>{building_rows}</tbody>
                        </table>
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
