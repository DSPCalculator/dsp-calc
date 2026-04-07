import structuredClone from '@ungap/structured-clone';

function add_item_count(dict, item, count) {
    if (!count) {
        return;
    }
    dict[item] = (dict[item] || 0) + count;
}

function scale_item_dict(dict, multiplier) {
    if (multiplier === 1) {
        return dict;
    }
    const scaled = {};
    Object.entries(dict).forEach(([item, count]) => {
        scaled[item] = count * multiplier;
    });
    return scaled;
}

function cancel_shared_items(recipe) {
    const inputs = recipe["原料"] || {};
    const outputs = recipe["产物"] || {};

    Object.keys(inputs).forEach((item) => {
        if (!(item in outputs)) {
            return;
        }
        const cancel_count = Math.min(Number(inputs[item]) || 0, Number(outputs[item]) || 0);
        if (cancel_count <= 0) {
            return;
        }
        inputs[item] -= cancel_count;
        outputs[item] -= cancel_count;
        if (Math.abs(inputs[item]) < 1e-10) {
            delete inputs[item];
        }
        if (Math.abs(outputs[item]) < 1e-10) {
            delete outputs[item];
        }
    });
}

function simulate_fractionate_outputs(recipe, success_ratio, output_multiplier, threshold = 1e-5) {
    const input_entries = Object.entries(recipe["原料"]);
    if (input_entries.length === 0) {
        return {
            "原料": structuredClone(recipe["原料"]),
            "产物": structuredClone(recipe["产物"]),
            "时间": recipe["时间"] || 0
        };
    }

    const [, input_count] = input_entries[0];
    let remaining = input_count;
    let processed_total = 0;
    let guard = 0;
    const outputs = {};
    const destroy_ratio = Number(recipe["损毁率"] || 0);
    const remain_input_ratio = Number(recipe["原料保留率"] || 0);
    const double_output_multiplier = 1 + Number(recipe["产物翻倍率"] || 0);
    const main_outputs = recipe["主产物"] || [];
    const append_outputs = recipe["副产物"] || [];
    const remaining_ratio = (1 - destroy_ratio) * (1 - success_ratio + success_ratio * remain_input_ratio);
    const success_factor = (1 - destroy_ratio) * success_ratio;

    if (remaining_ratio >= 0 && remaining_ratio < 1) {
        const steps = remaining_ratio === 0
            ? 1
            : Math.ceil(Math.log(threshold / input_count) / Math.log(remaining_ratio));
        const clamped_steps = Math.max(0, steps);
        const remaining_power = Math.pow(remaining_ratio, clamped_steps);
        const geometric_sum = remaining_ratio === 1
            ? clamped_steps
            : (1 - remaining_power) / (1 - remaining_ratio);
        processed_total = input_count * geometric_sum;
        const total_success_count = input_count * success_factor * geometric_sum;

        main_outputs.forEach(output => {
            add_item_count(
                outputs,
                output["物品"],
                total_success_count * output["概率"] * output["数量"] * double_output_multiplier * output_multiplier
            );
        });
        append_outputs.forEach(output => {
            add_item_count(
                outputs,
                output["物品"],
                total_success_count * output["概率"] * output["数量"] * output_multiplier
            );
        });
    } else {
        while (remaining > threshold && guard < 100000) {
            processed_total += remaining;
            const destroyed = remaining * destroy_ratio;
            const survived = remaining - destroyed;
            const success_count = survived * success_ratio;
            const unchanged = survived - success_count;

            main_outputs.forEach(output => {
                add_item_count(
                    outputs,
                    output["物品"],
                    success_count * output["概率"] * output["数量"] * double_output_multiplier * output_multiplier
                );
            });
            append_outputs.forEach(output => {
                add_item_count(
                    outputs,
                    output["物品"],
                    success_count * output["概率"] * output["数量"] * output_multiplier
                );
            });

            remaining = unchanged + success_count * remain_input_ratio;
            guard++;
        }
    }

    return {
        "原料": structuredClone(recipe["原料"]),
        "产物": outputs,
        "时间": processed_total
    };
}

export function build_effective_game_data(base_game_data, settings) {
    const game_data = structuredClone(base_game_data);
    if (!game_data.TheyComeFromVoidEnable || !settings.blue_buff) {
        return game_data;
    }

    // 蓝 Buff 会把首位原料按首位产物数量返还，直接折进配方原料里。
    for (let i = 0; i < game_data.recipe_data.length; i++) {
        let recipe = game_data.recipe_data[i];
        if (Object.keys(recipe["原料"]).length < 2) {
            continue;
        }
        const output_name = Object.keys(recipe["产物"])[0];
        if (output_name.endsWith("矩阵")) {
            continue;
        }

        const input_name = Object.keys(recipe["原料"])[0];
        const input_count = Object.values(recipe["原料"])[0];
        const output_count = Object.values(recipe["产物"])[0];
        if (input_count > output_count) {
            recipe["原料"][input_name] -= output_count;
        } else {
            delete recipe["原料"][input_name];
        }
    }
    return game_data;
}

export function get_factory_speed_multiplier(factory_name, target_item, settings) {
    if (factory_name === "采矿机") {
        return settings.mining_speed_multiple * settings.covered_veins_small;
    }
    if (factory_name === "大型采矿机") {
        return settings.mining_speed_multiple * settings.covered_veins_large * settings.mining_efficiency_large;
    }
    if (factory_name === "原油萃取站") {
        return settings.mining_speed_multiple * settings.mining_speed_oil;
    }
    if (factory_name === "激光钻井平台") {
        if (target_item === "原油") {
            return settings.mining_speed_multiple * settings.mining_speed_oil;
        }
        if (target_item === "水") {
            return settings.mining_speed_multiple * settings.mining_speed_water;
        }
        if (target_item === "深层熔岩") {
            return settings.mining_speed_multiple * settings.mining_speed_deep_seated_lava;
        }
        return 1;
    }
    if (factory_name === "抽水站" || factory_name === "聚束液体汲取设施") {
        return settings.mining_speed_multiple;
    }
    if (factory_name === "轨道采集器") {
        let multiplier = settings.mining_speed_multiple;
        if (target_item === "氢") {
            multiplier *= settings.mining_speed_hydrogen;
        } else if (target_item === "重氢") {
            multiplier *= settings.mining_speed_deuterium;
        } else if (target_item === "可燃冰") {
            multiplier *= settings.mining_speed_gas_hydrate;
        } else if (target_item === "氦") {
            multiplier *= settings.mining_speed_helium;
        } else if (target_item === "氨") {
            multiplier *= settings.mining_speed_ammonia;
        } else if (target_item === "甲烷") {
            multiplier *= settings.mining_speed_methane;
        }
        return multiplier;
    }
    if (factory_name === "大气采集站") {
        let multiplier = settings.mining_speed_multiple;
        if (target_item === "氮") {
            multiplier *= settings.mining_speed_nitrogen;
        } else if (target_item === "氧") {
            multiplier *= settings.mining_speed_oxygen;
        } else if (target_item === "二氧化硫") {
            multiplier *= settings.mining_speed_carbon_dioxide;
        } else if (target_item === "二氧化碳") {
            multiplier *= settings.mining_speed_sulfur_dioxide;
        }
        return multiplier;
    }
    if (factory_name === "行星基地") {
        return settings.enemy_drop_multiple;
    }
    if (factory_name === "分馏塔" || factory_name === "交互塔"
        || factory_name === "矿物复制塔" || factory_name === "点数聚集塔" || factory_name === "量子复制塔"
        || factory_name === "点金塔" || factory_name === "分解塔" || factory_name === "转化塔") {
        return settings.fractionating_speed;
    }
    if (factory_name === "伊卡洛斯") {
        return settings.icarus_manufacturing_speed;
    }
    return 1;
}

export function get_equivalent_recipe({
                                          game_data,
                                          scheme_data,
                                          settings,
                                          proliferator_price,
                                          recipe_id,
                                          target_item,
                                          scheme_override
                                      }) {
    const recipe = structuredClone(game_data.recipe_data[recipe_id]);
    const scheme_recipe = {
        ...scheme_data.scheme_for_recipe[recipe_id],
        ...(scheme_override || {})
    };
    const building_info = game_data.factory_data[recipe["设施"]][scheme_recipe["建筑"]];

    let speed_multiplier = 1;
    let output_multiplier = 1;
    const factory_speed_multiplier = building_info["倍率"] * get_factory_speed_multiplier(building_info["名称"], target_item, settings);

    const proliferate_mode = Number(scheme_recipe["增产模式"] || 0);
    const proliferate_num = Number(scheme_recipe["增产点数"] || 0);
    if (proliferate_mode && proliferate_num && proliferator_price[proliferate_num] !== -1) {
        const material_total = Object.values(recipe["原料"]).reduce((sum, count) => sum + count, 0);
        Object.entries(proliferator_price[proliferate_num]).forEach(([item, count]) => {
            add_item_count(recipe["原料"], item, material_total * count);
        });

        if (proliferate_mode === 1) {
            speed_multiplier *= game_data.proliferator_effect[proliferate_num]["加速效果"] + settings.acc_rate;
        } else if (proliferate_mode === 2) {
            output_multiplier *= game_data.proliferator_effect[proliferate_num]["增产效果"] + settings.inc_rate;
        } else if (proliferate_mode === 3) {
            output_multiplier *= game_data.proliferator_effect[proliferate_num]["加速效果"] + settings.acc_rate;
        } else if (proliferate_mode === 4) {
            output_multiplier *= proliferate_num / 10;
        }
    }

    if (recipe["模型"] === "fractionate_raw") {
        const effective_success_ratio = Number(recipe["成功率"] || 0);
        const simulated = simulate_fractionate_outputs(recipe, effective_success_ratio, output_multiplier);
        recipe["原料"] = simulated["原料"];
        recipe["产物"] = simulated["产物"];
        recipe["时间"] = simulated["时间"] / speed_multiplier / factory_speed_multiplier;
        recipe["模型"] = "normal";
    } else {
        recipe["产物"] = scale_item_dict(recipe["产物"], output_multiplier);
        recipe["时间"] /= speed_multiplier * factory_speed_multiplier;
    }
    recipe["建筑名称"] = building_info["名称"];
    recipe["建筑倍率"] = building_info["倍率"];
    cancel_shared_items(recipe);
    return recipe;
}

export function get_equivalent_recipe_output_rate(recipe, target_item) {
    return recipe["产物"][target_item] / recipe["时间"];
}
