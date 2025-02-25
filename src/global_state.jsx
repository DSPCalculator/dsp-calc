import 'javascript-lp-solver/src/solver';
import {get_game_data} from "./GameData.jsx";

function uniq(arr) {
    return Array.from(new Set(arr));
}

export class GameInfo {
    game_data;
    item_data;
    all_target_items;
    icon_grid;

    constructor(game_data) {
        this.game_data = game_data;
        this.init_item_data();
        this.all_target_items = uniq(this.game_data.recipe_data.flatMap(recipe => Object.keys(recipe["产物"])));
        this.init_icon_layout();
    }

    init_icon_layout() {
        let loc_item = {};
        for (let [item, loc] of Object.entries(this.game_data.item_grid)) {
            //移除沙土、伊卡洛斯、行星基地、巨构星际组装厂
            if (item === "沙土" || item === "伊卡洛斯" || item === "行星基地" || item === "巨构星际组装厂") {
                continue;
            }
            let x = loc % 100;
            let y = (loc - x) / 100;
            loc_item[[x, y]] = {item: item, x: x, y: y};
        }
        let xs = Object.values(loc_item).map(({item, x, y}) => x);
        let ys = Object.values(loc_item).map(({item, x, y}) => y);
        let minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
        let minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

        let icons = [];
        let all_unused_targets = new Set(self.all_target_items);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                let item = loc_item[[x, y]]?.item;
                if (item) {
                    // CSS grid starts from index 1
                    icons.push({col: x - minX + 1, row: y - minY + 1, item: item});
                    all_unused_targets.delete(item);
                }
            }
        }

        if (all_unused_targets.size > 0) {
            console.warn("如下产物未能在物品选择器中显示", all_unused_targets);
        }

        this.icon_grid = {nrow: maxY - minY + 1, ncol: maxX - minX + 1, icons: icons};
    }

    init_item_data() {
        // 通过读取配方表得到配方中涉及的物品信息
        // item_data中的键名为物品名，
        // 键值为此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
        let item_data = {};
        let recipe_data = this.game_data.recipe_data;
        let i = 0;
        for (let num = 0; num < recipe_data.length; num++) {
            for (let item in recipe_data[num].产物) {
                if (!(item in item_data)) {
                    item_data[item] = [i];
                    i++;
                }
                item_data[item].push(num);
            }
        }
        this.item_data = item_data;
    }
}

export class GlobalState {
    game_data;
    item_data;
    scheme_data;
    settings;

    proliferator_price;

    item_graph;
    multi_sources;

    item_list;
    key_item_list;

    constructor(game_info, scheme_data, settings) {
        console.log("mods", game_info.game_data.mods);
        this.game_data = game_info.game_data;
        this.item_data = game_info.item_data;
        this.scheme_data = scheme_data;
        this.settings = settings;

        //获取最后一个增产剂对应的点数值
        //懒得比较获取最大值了，直接用最后一个增产剂作为最大值
        let maxProliferatorPoint = game_info.game_data.proliferator_data[game_info.game_data.proliferator_data.length - 1].增产点数;
        for (let i = 0; i < scheme_data.scheme_for_recipe.length; i++) {
            //选择增产塔对应配方时，如果未选择增产策略，强制选择增产策略为增产分馏
            if (game_info.game_data.recipe_data[i].增产 == 8//8也就是bit4，增产分馏策略的位置
                && scheme_data.scheme_for_recipe[i].增产模式 == 0) {
                scheme_data.scheme_for_recipe[i].增产模式 = 4;//模式就是对应的bit，也就是4
            }
            //选择增产策略但是未选择增产剂时，强制选择最后一个增产剂；但是选择增产剂时，不会强制选择增产策略
            if (scheme_data.scheme_for_recipe[i].增产模式 > 0
                && scheme_data.scheme_for_recipe[i].增产点数 == 0) {
                scheme_data.scheme_for_recipe[i].增产点数 = maxProliferatorPoint;
            }
        }

        this.#init_pro_proliferator(settings.proliferate_itself);
        this.#init_item_graph();
        this.#init_item_list();
    }

    /** 初始化单次各个等级的喷涂效果的成本（默认选用全自喷涂） */
    #init_pro_proliferator(proliferate_itself) {
        let game_data = this.game_data;
        let proliferator_price = [];
        proliferator_price.push({});
        for (let i = 1; i < game_data.proliferator_effect.length; i++) {
            proliferator_price.push(-1);
        }
        for (let i in game_data.proliferator_data) {
            if (game_data.proliferator_data[i]["增产点数"] != 0) {
                proliferator_price[game_data.proliferator_data[i]["增产点数"]] = {};
                if (proliferate_itself) {
                    proliferator_price[game_data.proliferator_data[i]["增产点数"]][game_data.proliferator_data[i]["增产剂"]]
                        = 1 / Math.floor(game_data.proliferator_data[i]["喷涂次数"] *
                        game_data.proliferator_effect[game_data.proliferator_data[i]["增产点数"]]["增产效果"] - 1 + 1e-6);
                } else {
                    proliferator_price[game_data.proliferator_data[i]["增产点数"]][game_data.proliferator_data[i]["增产剂"]]
                        = 1 / game_data.proliferator_data[i]["喷涂次数"];
                }
            }
        }
        this.proliferator_price = proliferator_price;
    }

    /** 根据配方设定完善产物关系图与多来源产物表 */
    #init_item_graph() {
        let game_data = this.game_data;
        let item_data = this.item_data;
        let scheme_data = this.scheme_data;
        let settings = this.settings;
        let proliferator_price = this.proliferator_price;

        let multi_sources = {};
        let item_graph = {};

        for (let item in item_data) {
            item_graph[item] = {"原料": {}, "可生产": {}, "产出倍率": 0, "副产物": {}};
        }
        for (var item in item_data) {
            if (item in settings.mineralize_list) {
                item_graph[item]["产出倍率"] = 100000000 ** (settings.fixed_num + 1);
                continue;
            }
            let recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
            item_graph[item]["产出倍率"] = 1 * game_data.recipe_data[recipe_id]["产物"][item];
            let produce_rate = 1;//净产出一个目标产物时公式的执行次数，用于考虑增产等对原料消耗的影响
            let material_num = 0;
            let total_material_num = 0;
            let proliferate_mode = scheme_data.scheme_for_recipe[recipe_id]["增产模式"];
            let proliferate_num = scheme_data.scheme_for_recipe[recipe_id]["增产点数"];
            for (let material in game_data.recipe_data[recipe_id]["原料"]) {
                material_num = game_data.recipe_data[recipe_id]["原料"][material] / game_data.recipe_data[recipe_id]["产物"][item];
                item_graph[item]["原料"][material] = material_num;
                total_material_num += material_num;
            }
            //如果有用增产剂且有增产效果，计算增产剂效果带来的变化
            if (proliferate_mode && proliferate_num) {
                if (proliferate_mode == 1) {
                    //加速
                    for (let proliferate in proliferator_price[proliferate_num]) {
                        if (proliferate in item_graph[item]["原料"]) {
                            item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                        } else {
                            item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                        }
                    }
                    item_graph[item]["产出倍率"] *= game_data.proliferator_effect[proliferate_num]["加速效果"] * this.settings.acc_rate;
                } else if (proliferate_mode == 2) {
                    //增产
                    for (let proliferate in proliferator_price[proliferate_num]) {
                        if (proliferate in item_graph[item]["原料"]) {
                            item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                        } else {
                            item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                        }
                    }
                    produce_rate *= game_data.proliferator_effect[proliferate_num]["增产效果"] * this.settings.inc_rate;
                    item_graph[item]["产出倍率"] *= produce_rate;
                } else if (proliferate_mode == 3) {
                    //接收站透镜喷涂效果，按加速效果计算额外产出
                    for (let proliferate in proliferator_price[proliferate_num]) {
                        if (proliferate in item_graph[item]["原料"]) {
                            item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                        } else {
                            item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                        }
                    }
                    produce_rate *= game_data.proliferator_effect[proliferate_num]["加速效果"] * this.settings.acc_rate;
                    item_graph[item]["产出倍率"] *= produce_rate;
                } else if (proliferate_mode == 4) {
                    //增产分馏塔，按点数计算产出
                    for (let proliferate in proliferator_price[proliferate_num]) {
                        if (proliferate in item_graph[item]["原料"]) {
                            item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                        } else {
                            item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                        }
                    }
                    item_graph[item]["产出倍率"] *= proliferate_num / 10;
                }
            }
            for (let material in item_graph[item]["原料"]) {
                item_graph[item]["原料"][material] /= produce_rate;
            }
            item_graph[item]["产出倍率"] /= game_data.recipe_data[recipe_id]["时间"];
            if (item in item_graph[item]["原料"]) {
                const self_used = 1 / (1 - item_graph[item]["原料"][item]);
                item_graph[item]["产出倍率"] /= self_used;
                item_graph[item]["自消耗"] = self_used - 1;
                delete item_graph[item]["原料"][item];
                for (let material in item_graph[item]["原料"]) {
                    item_graph[item]["原料"][material] *= self_used;
                }
            }
            for (let material in item_graph[item]["原料"]) {
                //console.log("item_graph[" + material + "]", item_graph[material])
                //console.log("material", material)
                //console.log("item_graph", item_graph)
                //console.log("item", item)
                item_graph[material]["可生产"][item] = 1 / item_graph[item]["原料"][material];
            }
            if (Object.keys(game_data.recipe_data[recipe_id]["产物"]).length > 1) {
                let self_cost = 0;
                if ("自消耗" in item_graph[item]) {
                    self_cost = item_graph[item]["自消耗"];
                }
                for (let product in game_data.recipe_data[recipe_id]["产物"]) {
                    if (product != item) {
                        if (product in item_graph[item]["原料"]) {
                            if (Math.min(game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost), item_graph[item]["原料"][product]) == item_graph[item]["原料"][product]) {
                                item_graph[item]["副产物"][product] = game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost) - item_graph[item]["原料"][product];
                                item_graph[item]["原料"][product] = 0;
                                if (product in multi_sources) {
                                    multi_sources[product].push(item);
                                } else {
                                    multi_sources[product] = [item];
                                }
                            } else {
                                item_graph[item]["原料"][product] -= game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost);
                            }
                        } else {
                            item_graph[item]["副产物"][product] = game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost);
                            if (product in multi_sources) {
                                multi_sources[product].push(item);
                            } else {
                                multi_sources[product] = [item];
                            }
                        }
                    }
                }
            }//此配方有自身无法消耗的副产物时
            //factory_type：可以选择的设施种类，int类型
            const factories_type = game_data.recipe_data[recipe_id]["设施"];
            const factory_info = game_data.factory_data[factories_type][scheme_data.scheme_for_recipe[recipe_id]["建筑"]];
            const factory_name = factory_info["名称"];
            if (factory_name === "采矿机") {
                item_graph[item]["产出倍率"] *= settings.mining_speed_multiple * settings.covered_veins_small;
            } else if (factory_name === "大型采矿机") {
                item_graph[item]["产出倍率"] *= settings.mining_speed_multiple * settings.covered_veins_large * settings.mining_efficiency_large;
            } else if (factory_name === "原油萃取站") {
                item_graph[item]["产出倍率"] *= settings.mining_speed_multiple * settings.mining_speed_oil;
            } else if (factory_name === "抽水站" || factory_name === "聚束液体汲取设施") {
                item_graph[item]["产出倍率"] *= settings.mining_speed_multiple;
            } else if (factory_name === "轨道采集器") {
                item_graph[item]["产出倍率"] *= settings.mining_speed_multiple;
                if (item === "氢") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_hydrogen;
                } else if (item === "重氢") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_deuterium;
                } else if (item === "可燃冰") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_gas_hydrate;
                } else if (item === "氦") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_helium;
                } else if (item === "氨") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_ammonia;
                }
            } else if (factory_name === "大气采集站") {
                item_graph[item]["产出倍率"] *= settings.mining_speed_multiple;
                if (item === "氮") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_nitrogen;
                } else if (item === "氧") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_oxygen;
                } else if (item === "二氧化硫") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_carbon_dioxide;
                } else if (item === "二氧化碳") {
                    item_graph[item]["产出倍率"] *= settings.mining_speed_sulfur_dioxide;
                }
            } else if (factory_name === "行星基地") {
                item_graph[item]["产出倍率"] *= settings.enemy_drop_multiple;
            } //采矿设备需算上科技加成
            else if (factory_name.endsWith("分馏塔")) {
                item_graph[item]["产出倍率"] *= settings.fractionating_speed;
            }//分馏塔流速加成计算
            else if (factory_name === "伊卡洛斯") {
                item_graph[item]["产出倍率"] *= settings.icarus_manufacturing_speed;
            }//毫无意义，只是我想这么干
        }

        this.item_graph = item_graph;
        this.multi_sources = multi_sources;
    }

    /** 计算一个物品的成本，用于各种各样的线性规划 */
    #get_item_cost(item) {
        let game_data = this.game_data;
        let scheme_data = this.scheme_data;
        let item_data = this.item_data;
        let item_graph = this.item_graph;
        let stack_research_lab = this.settings.stack_research_lab;

        let cost = 0.0;
        if (scheme_data.cost_weight["物品额外成本"][item]["启用"]) {
            cost = Number(cost) + scheme_data.cost_weight["物品额外成本"][item]["额外成本"];
            if (!scheme_data.cost_weight["物品额外成本"][item]["与其它成本累计"]) {
                return cost;
            }
        }
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const building_info = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]];
        const building_count_per_yield = 1 / item_graph[item]["产出倍率"] / building_info["倍率"];
        const layer_count = building_info["名称"].endsWith("研究站") ? stack_research_lab : 1;
        cost = Number(cost) + building_count_per_yield * scheme_data.cost_weight["占地"] * building_info["占地"] / layer_count;//计算占地造成的成本=单位产能建筑数*占地成本权重*建筑占地
        cost = Number(cost) + building_count_per_yield * scheme_data.cost_weight["电力"] * building_info["耗能"] * game_data.proliferator_effect[scheme_data.scheme_for_recipe[recipe_id]["增产点数"]]["耗电倍率"];
        //计算耗电造成的成本 = 单位产能建筑数 * 耗电成本权重 * 建筑耗电 * 喷涂影响
        cost = Number(cost) + building_count_per_yield * (0 * scheme_data.cost_weight["建筑成本"]["分拣器"] / layer_count + scheme_data.cost_weight["建筑成本"][building_info["名称"]]);
        //建筑产生的成本 = 单位产能建筑数*(每个结构中分拣器数量*分拣器成本 + 生产建筑成本)，分拣器成本那块，说是分拣器，但实际上可以是任何一个针对各种配方独立成本的系数
        return cost;
    }

    /** 根据物品关系图生成物品列表，物品列表在将关键产物原矿化的情况下某物品的左侧的物品必不可能是其下游产物，右侧的物品必不可能是其上游产物，从做往右迭代一次就是将整个生产线从上游往下游迭代一次 */
    #init_item_list() {
        const product_graph = JSON.parse(JSON.stringify(this.item_graph));
        // TODO item_data is edited?
        let item_data = this.item_data;
        const item_list = [];
        const key_item_list = [];
        let P_item_list = [0, Object.keys(product_graph).length - 1];

        function delete_item_from_product_graph(name) {
            for (let item in product_graph[name]["原料"]) {
                delete product_graph[item]["可生产"][name];
            }
            for (let item in product_graph[name]["可生产"]) {
                delete product_graph[item]["原料"][name];
            }
            delete product_graph[name];
        }

        function find_item(name, isProduction, P_item_list) {
            if (!isProduction) {
                if (product_graph[name] && Object.keys(product_graph[name]["原料"]).length == 0) {
                    const production = product_graph[name]["可生产"];
                    delete_item_from_product_graph(name);
                    item_list[P_item_list[0]] = name;
                    item_data[name][0] = P_item_list[0];
                    P_item_list[0] += 1;
                    for (let item in production) {
                        P_item_list = find_item(item, 0, P_item_list);
                    }
                }
            } else {
                if (product_graph[name] && Object.keys(product_graph[name]["可生产"]).length == 0) {
                    const material = product_graph[name]["原料"];
                    delete_item_from_product_graph(name);
                    item_list[P_item_list[1]] = name;
                    item_data[name][0] = P_item_list[1];
                    P_item_list[1] -= 1;
                    for (let item in material) {
                        P_item_list = find_item(item, 1, P_item_list);
                    }
                }
            }//函数find_item用于迭代寻找产物关系图中的出度或入度为0的点，并将其从关系图中删去，存入物品列表中
            return P_item_list;
        }

        while (1) {
            for (let this_item in product_graph) {
                if (this_item in product_graph) {
                    if (Object.keys(product_graph[this_item]["原料"]).length == 0) {
                        P_item_list = find_item(this_item, 0, P_item_list);
                    } else if (Object.keys(product_graph[this_item]["可生产"]).length == 0) {
                        P_item_list = find_item(this_item, 1, P_item_list);
                    }
                }
            }
            if (Object.keys(product_graph).length <= 0) break;
            const key_item = {"name": -1, "count": 1};//记录关键物品的名字与出入度只和的最大值
            let count;
            for (let this_item in product_graph) {
                count = Object.keys(product_graph[this_item]["原料"]).length + Object.keys(product_graph[this_item]["可生产"]).length
                if (count > key_item["count"]) {
                    key_item["name"] = this_item;
                    key_item["count"] = count;
                }
            }
            key_item_list.push(key_item["name"]);
            item_list[P_item_list[0]] = key_item["name"];
            item_data[key_item["name"]][0] = P_item_list[0];
            P_item_list[0]++;
            delete_item_from_product_graph(key_item["name"]);
        }//在物品图中找出循环关键物品，并将物品按生产层级由低到高排列
        this.item_list = item_list;
        this.key_item_list = key_item_list;
    }

    /** 取得每一个物品的历史产出 */
    #get_item_price() {
        let item_graph = this.item_graph;
        let item_list = this.item_list;
        let key_item_list = this.key_item_list;
        let multi_sources = this.multi_sources;
        let mineralize_list = this.settings.mineralize_list;
        let p_key_item = 0;
        let p_mineralize_item = 0;
        let item_price = {};

        function count_total_material(dict, material, num) {
            if (material in dict) {
                dict[material] = Number(dict[material]) + num;
            } else {
                dict[material] = num;
            }
            for (let sub_material in item_price[material]["原料"]) {
                if (sub_material in dict) {
                    dict[sub_material] = Number(dict[sub_material]) + item_price[material]["原料"][sub_material] * num;
                } else {
                    dict[sub_material] = item_price[material]["原料"][sub_material] * num;
                }
            }
            return dict;
        }

        for (let key_item in key_item_list) {
            item_price[key_item_list[key_item]] = {"原料": {}, "成本": 0, "累计成本": 0};
        }//关键物品成本为0
        for (let mineralize_item in mineralize_list) {
            item_price[mineralize_item] = {"原料": {}, "成本": 0, "累计成本": 0};
        }//矿物化物品成本为0
        for (let multi_source in multi_sources) {
            item_price[multi_source] = {"原料": {}, "成本": 0, "累计成本": 0};
        }//多来源物品成本为0
        for (let i = 0; i < item_list.length; i++) {
            if (p_key_item < key_item_list.length && item_list[i] == key_item_list[p_key_item]) {
                ++p_key_item;
                continue;
            }//跳过关键物品
            else if (p_mineralize_item < mineralize_list.length && item_list[i] == mineralize_list[p_mineralize_item]) {
                ++p_mineralize_item;
                continue;
            }//跳过原矿化物品
            else if (item_list[i] in multi_sources) {
                continue;
            }//跳过多来源物品
            else {
                item_price[item_list[i]] = {"原料": {}, "成本": this.#get_item_cost(item_list[i]), "累计成本": 0};//计算当前产线成本
                for (let material in item_graph[item_list[i]]["原料"]) {
                    item_price[item_list[i]]["原料"] = count_total_material(item_price[item_list[i]]["原料"], material, item_graph[item_list[i]]["原料"][material]);
                }//计算其历史产出
                for (let side_products in item_graph[item_list[i]]["副产物"]) {
                    item_price[item_list[i]]["原料"] = count_total_material(item_price[item_list[i]]["原料"], side_products, -item_graph[item_list[i]]["副产物"][side_products]);
                }//计算其副产物的历史产出
                item_price[item_list[i]]["累计成本"] = item_price[item_list[i]]["成本"];
                for (let item in item_price[item_list[i]]["原料"]) {
                    if (item_price[item_list[i]]["原料"][item] > 0) {
                        item_price[item_list[i]]["累计成本"] = Number(item_price[item_list[i]]["累计成本"]) + Number(item_price[item]["成本"]) * item_price[item_list[i]]["原料"][item];
                    }
                }
            }
        }
        return item_price;
    }

    /** 主要计算逻辑 */
    calculate(needs_list) {
        let game_data = this.game_data;
        let settings = this.settings;
        let natural_production_line = this.settings.natural_production_line;

        let item_data = this.item_data;
        let proliferator_price = this.proliferator_price;

        let multi_sources = this.multi_sources;
        let item_graph = this.item_graph;

        let key_item_list = this.key_item_list;

        let result_dict = {};
        let surplus_list = {};
        let lp_surplus_list = {};
        let external_supply_item = {};
        let lp_item_dict = {};
        let in_out_list = {};

        //重新读取一遍game_data.recipe_data
        let game_data2 = get_game_data(this.game_data.mod_guid_list);
        game_data["recipe_data"] = game_data2["recipe_data"];
        //根据是否启用蓝buff，修改recipe
        if (game_data.TheyComeFromVoidEnable && settings.blue_buff) {
            for (let i = 0; i < game_data.recipe_data.length; i++) {
                let recipe = game_data.recipe_data[i];
                //排除不生效的配方（分馏配方包含在其中，因为分馏原料只有一个）
                if (Object.keys(recipe["原料"]).length < 2) {
                    continue;
                }
                //排除所有糖
                let outputName = Object.keys(recipe["产物"])[0];
                if (outputName.endsWith("矩阵")) {
                    continue;
                }
                let inputName = Object.keys(recipe["原料"])[0];
                let outputCount = Object.values(recipe["产物"])[0];
                if (recipe["产物"][inputName] === undefined) {
                    recipe["产物"][inputName] = outputCount;
                } else {
                    recipe["产物"][inputName] += outputCount;
                }
            }
        }

        for (let item in needs_list) {
            in_out_list[item] = needs_list[item];
        }//将需求目标添至计算的实际需求列表中

        for (let id in natural_production_line) {
            const recipe = game_data.recipe_data[item_data[natural_production_line[id]["目标物品"]][natural_production_line[id]["配方id"]]];
            const recipe_time = 60 * natural_production_line[id]["建筑数量"] * game_data.factory_data[recipe["设施"]][natural_production_line[id]["建筑"]]["倍率"] / recipe["时间"];
            if ((natural_production_line[id]["增产点数"] == 0) || (natural_production_line[id]["增产模式"] == 0)) {
                for (let item in recipe["原料"]) {
                    if (item in in_out_list) {
                        in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time;
                    } else {
                        in_out_list[item] = recipe["原料"][item] * recipe_time;
                    }
                }
                for (let item in recipe["产物"]) {
                    if (item in in_out_list) {
                        in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time;
                    } else {
                        in_out_list[item] = -1 * recipe["产物"][item] * recipe_time;
                    }
                }
            } else {
                let num = 0;//单次配方喷涂的物品量
                for (let item in recipe["原料"]) {
                    num += recipe["原料"][item];
                }
                num = Number(num) * recipe_time;
                if (natural_production_line[id]["增产模式"] == 1) {//加速
                    let pro_time = game_data.proliferator_effect[natural_production_line[id]["增产点数"]]["加速效果"];
                    for (let item in recipe["原料"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time * pro_time;
                        } else {
                            in_out_list[item] = recipe["原料"][item] * recipe_time * pro_time;
                        }
                    }
                    for (let item in proliferator_price[natural_production_line[id]["增产点数"]]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + proliferator_price[natural_production_line[id]["增产点数"]][item] * num * pro_time;
                        } else {
                            in_out_list[item] = proliferator_price[natural_production_line[id]["增产点数"]][item] * num * pro_time;
                        }
                    }
                    for (let item in recipe["产物"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time * pro_time;
                        } else {
                            in_out_list[item] = -1 * recipe["产物"][item] * recipe_time * pro_time;
                        }
                    }
                } else if (natural_production_line[id]["增产模式"] == 2) {//增产
                    let pro_time = game_data.proliferator_effect[natural_production_line[id]["增产点数"]]["增产效果"];
                    for (let item in recipe["原料"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time;
                        } else {
                            in_out_list[item] = recipe["原料"][item] * recipe_time;
                        }
                    }
                    for (let item in proliferator_price[natural_production_line[id]["增产点数"]]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + proliferator_price[natural_production_line[id]["增产点数"]][item] * num;
                        } else {
                            in_out_list[item] = proliferator_price[natural_production_line[id]["增产点数"]][item] * num;
                        }
                    }
                    for (let item in recipe["产物"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time * pro_time;
                        } else {
                            in_out_list[item] = -1 * recipe["产物"][item] * recipe_time * pro_time;
                        }
                    }
                } else if (natural_production_line[id]["增产模式"] == 3) {
                    let pro_time = game_data.proliferator_effect[natural_production_line[id]["增产点数"]]["加速效果"];
                    for (let item in recipe["原料"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time;
                        } else {
                            in_out_list[item] = recipe["原料"][item] * recipe_time;
                        }
                    }
                    for (let item in proliferator_price[natural_production_line[id]["增产点数"]]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + proliferator_price[natural_production_line[id]["增产点数"]][item] * num;
                        } else {
                            in_out_list[item] = proliferator_price[natural_production_line[id]["增产点数"]][item] * num;
                        }
                    }
                    for (let item in recipe["产物"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time * pro_time;
                        } else {
                            in_out_list[item] = -1 * recipe["产物"][item] * recipe_time * pro_time;
                        }
                    }
                }
            }
        }//将现有产线的输入输出添至计算的实际需求列表中

        for (let item in in_out_list) {
            if (in_out_list[item] < 0) {
                external_supply_item[item] = in_out_list[item];
            }
        }//将实际需求列表中小于0的部分看做外部输入

        let item_price = this.#get_item_price();
        //console.log(item_price);
        /*item_price:
            "原料":一个物品的历史累计产出,若有没用到的副产物则为负,若为原矿化物品或关键物品或多来源物品则为空
            "成本":一个物品的当前产线成本以及被赋予的额外成本,若为原矿化物品或关键物品或多来源物品则为0
            "累计成本":一个物品独自建造时的历史总计产出的成本,若为原矿化物品或关键物品或多来源物品则为0
        */
        for (let item in in_out_list) {
            if (in_out_list[item] > 0) {
                if (item in result_dict) {
                    result_dict[item] = Number(result_dict[item]) + in_out_list[item];
                } else {
                    result_dict[item] = in_out_list[item];
                }
                for (let material in item_price[item]["原料"]) {
                    if (material in result_dict) {
                        result_dict[material] = Number(result_dict[material]) + item_price[item]["原料"][material] * in_out_list[item];
                    } else {
                        result_dict[material] = item_price[item]["原料"][material] * in_out_list[item];
                    }
                }
            }
        }//遍历物品的item_price降可迭代物品的生产结果和副产物产出结果放入输出结果内
        for (let item in multi_sources) {
            if (item in result_dict) {
                if (item in surplus_list) {
                    lp_item_dict[item] = result_dict[item] - surplus_list[item];
                } else {
                    lp_item_dict[item] = result_dict[item];
                }
            } else {
                if (item in surplus_list) {
                    lp_item_dict[item] = -surplus_list[item];
                } else {
                    lp_item_dict[item] = 0;
                }
            }
        }//将多来源配方物品的总需求与总富余相减后放入线性规划相关物品表
        for (let item in external_supply_item) {
            if (!(item in multi_sources)) {
                if (item in result_dict) {
                    if (result_dict[item] + in_out_list[item] > 0) {
                        for (let i in item_price[item]["原料"]) {
                            result_dict[i] = Number(result_dict[i]) + item_price[item]["原料"][i] * in_out_list[item];
                        }
                        result_dict[item] = Number(result_dict[item]) + in_out_list[item];
                    } else {
                        for (let i in item_price[item]["原料"]) {
                            result_dict[i] = Number(result_dict[i]) - item_price[item]["原料"][i] * result_dict[item];
                        }
                        lp_item_dict[item] = result_dict[item] + in_out_list[item];
                        result_dict[item] = 0;
                    }
                } else {
                    lp_item_dict[item] = in_out_list[item];
                }
            } else {
                lp_item_dict[item] = Number(lp_item_dict[item]) + in_out_list[item];
            }
        }//将定量外部供应的物品放入线性规划相关物品表
        for (let item in key_item_list) {
            if (!(key_item_list[item] in multi_sources) && !(key_item_list[item] in external_supply_item)) {
                if ([key_item_list[item]] in result_dict) {
                    lp_item_dict[key_item_list[item]] = result_dict[key_item_list[item]];
                } else {
                    lp_item_dict[key_item_list[item]] = 0;
                }
            }
        }//将循环关键物品的总需求放入线性规划相关物品表
        const lp_cost = this.#get_linear_programming_list(lp_item_dict, result_dict, lp_surplus_list, item_price);
        //线规最终目标函数成本，在考虑要不要显示

        return [result_dict, lp_surplus_list];
    }

    /** 线性规划 */
    #get_linear_programming_list(lp_item_dict, result_dict, lp_surplus_list, item_price) {
        let item_graph = this.item_graph;
        let scheme_data = this.scheme_data;
        /** 求解模型 */
        let model = {
            optimize: 'cost',
            opType: 'min',
            constraints: {},
            variables: {}
        }
        //console.log(item_graph["石墨烯"])
        for (let item in lp_item_dict) {
            model.constraints["i" + item] = {min: lp_item_dict[item]};
            model.variables[item] = {cost: this.#get_item_cost(item)};//计算线性规划物品当前的产线成本
            for (let other_item in lp_item_dict) {
                model.variables[item]["i" + other_item] = 0.0;
            }
            model.variables[item]["i" + item] = 1.0;
            model.variables[item].cost = Number(model.variables[item].cost) + scheme_data.cost_weight["物品额外成本"][item]["溢出时处理成本"];
            //console.log(item_graph[item]);
            if ("副产物" in item_graph[item]) {
                for (let sub_product in item_graph[item]["副产物"]) {
                    model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[item]["副产物"][sub_product];
                    model.variables[item].cost = Number(model.variables[item].cost) + item_graph[item]["副产物"][sub_product] * scheme_data.cost_weight["物品额外成本"][sub_product]["溢出时处理成本"];
                }
            }
            for (let material in item_graph[item]["原料"]) {
                model.variables[item].cost = Number(model.variables[item].cost) + item_graph[item]["原料"][material] * item_price[material]["累计成本"];//配方成本加上原料的成本
                if (material in lp_item_dict) {
                    model.variables[item]["i" + material] = Number(model.variables[item]["i" + material]) - item_graph[item]["原料"][material];
                }
                /*历史累计产出的副产物已在item_price中以负数的形式记录
                if ("副产物" in item_graph[material] && !(material in lp_item_dict)) {//遍历原料时，如果原料是线规相关物品那么将其视作原矿，不考虑生产时的副产物
                    for (let sub_product in item_graph[material]["副产物"]) {
                        console.log(material + model.variables[item]["i" + sub_product]);
                        model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[material]["副产物"][sub_product] * item_graph[item]["原料"][material];
                        console.log(material + model.variables[item]["i" + sub_product]);
                    }
                }
                */
                for (let sub_item in item_price[material]["原料"]) {
                    if (sub_item in lp_item_dict) {
                        // console.log(material + model.variables[item]["i" + sub_item]);
                        model.variables[item]["i" + sub_item] = Number(model.variables[item]["i" + sub_item]) - item_price[material]["原料"][sub_item] * item_graph[item]["原料"][material];
                        // console.log(material + model.variables[item]["i" + sub_item]);
                    }
                    if ("副产物" in item_graph[sub_item] && !(sub_item in lp_item_dict)) {//遍历原料时，如果原料是线规相关物品那么将其视作原矿，不考虑生产时的副产物
                        for (let sub_product in item_graph[sub_item]["副产物"]) {
                            model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[sub_item]["副产物"][sub_product] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_item];
                        }//否则生产这个配方时，其原料带来的必要副产物为：配方的此原料数*此原料成本中该物品的数量*单个该物品造成的副产物产出
                    }
                }
            }
        }//完善求解器输入的模型
        // console.log(model);
        const results = solver.Solve(model);
        //求解线性规划，解得满足需求时每个item对应的item_graph的执行次数
        console.log("model", model);
        console.log("results", results);
        let lp_cost = 0;
        if ("result" in results) {
            lp_cost = results["result"];
            delete results["result"];
        }//记录线规目标函数结果
        if ("feasible" in results) {
            if (!results.feasible) {
                alert("线性规划无解,请检查来源配方设定是否可能满足需求");
            }
            delete results.feasible;
        }//无解判断
        if ("bounded") {
            if (!results.bounded) {
                alert("线性规划目标函数无界,请检查配方执行成本是否合理");
            }
            delete results.bounded;
        }//无界判断
        const lp_products = {};
        for (let item in model.constraints) {
            lp_products[item] = (-1) * model.constraints[item]["min"];
        }//记录多余物品，如果是缺失物品为负
        for (let recipe in results) {
            for (let item in model.variables[recipe]) {
                if (item != "cost") {
                    lp_products[item] += model.variables[recipe][item] * results[recipe];
                }
            }
        }//对线规结果执行相应配方增减相应物品
        for (let item in lp_products) {
            if (lp_products[item] > 1e-8) {//倘若最后物品仍有多余，则输出至多余物品表
                lp_surplus_list[item.slice(1)] = lp_products[item];
            }
        }//多余物品计算
        for (let item in lp_item_dict) {
            result_dict[item] = 0;//将原矿化过的线规相关物品置为0，之后用线规结果的历史产出填补
        }
        for (let item in results) {
            result_dict[item] = Number(result_dict[item]) + results[item];
            for (let material in item_graph[item]["原料"]) {
                if (!(material in lp_item_dict)) {
                    if (material in result_dict) {
                        result_dict[material] = Number(result_dict[material]) + results[item] * item_graph[item]["原料"][material];
                    } else {
                        result_dict[material] = results[item] * item_graph[item]["原料"][material];
                    }
                    for (let sub_material in item_price[material]["原料"]) {
                        if (!(sub_material in lp_item_dict)) {
                            if (sub_material in result_dict) {
                                result_dict[sub_material] = Number(result_dict[sub_material]) + results[item] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_material];
                            } else {
                                result_dict[sub_material] = results[item] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_material];
                            }
                        }
                    }
                }
            }
        }//线规相关物品的总产出计算
        /*
            先根据result和model.variables中的各个消耗生成相乘后相加，减去constraints得到溢出物品，就是最终的多余产物 √
            然后将result_dict中线规物品矿的总吞吐量置为0，后遍历item_graph中各result中item的原料，不考虑制造过程中消耗的线规相关物品矿 √
            亦不考虑非线规相关物品提供的副产物(这会导致可能迭代下来获得的某一多来源物品的总计历史产出低于线规需求，不过这一部分非线规物品的副产物贡献会在之后展示result_dict时体现) √
            将得到的历史总产出加在result_dict中，此时得到了一个完全忽略所有副产出的result_dict实际上代表的是每个item按其item_graph执行的次数
            再在考虑显示result_dict的时候将净产出化为毛产出，并在括号内注明其余来源的产物即可
        */

        return lp_cost;//返回求解器求解结果
    }
}
