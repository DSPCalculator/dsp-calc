/**
 * 根据建筑类型应用相应的倍率
 * @param {number} output_num - 当前产量
 * @param {string} building_name - 建筑名称
 * @param {string} item - 目标物品
 * @param {object} settings - 设置对象
 * @returns {number} 应用倍率后的产量
 */
export function ApplyBuildingMultiplier(output_num, building_name, item, settings) {
    if (building_name === "采矿机") {
        output_num *= settings.mining_speed_multiple * settings.covered_veins_small;
    } else if (building_name === "大型采矿机") {
        output_num *= settings.mining_speed_multiple * settings.covered_veins_large * settings.mining_efficiency_large;
    } else if (building_name === "原油萃取站") {
        output_num *= settings.mining_speed_multiple * settings.mining_speed_oil;
    } else if (building_name === "抽水站" || building_name === "聚束液体汲取设施") {
        output_num *= settings.mining_speed_multiple;
    } else if (building_name === "轨道采集器") {
        output_num *= settings.mining_speed_multiple;
        if (item === "氢") {
            output_num *= settings.mining_speed_hydrogen;
        } else if (item === "重氢") {
            output_num *= settings.mining_speed_deuterium;
        } else if (item === "可燃冰") {
            output_num *= settings.mining_speed_gas_hydrate;
        } else if (item === "氦") {
            output_num *= settings.mining_speed_helium;
        } else if (item === "氨") {
            output_num *= settings.mining_speed_ammonia;
        }
    } else if (building_name === "大气采集站") {
        output_num *= settings.mining_speed_multiple;
        if (item === "氮") {
            output_num *= settings.mining_speed_nitrogen;
        } else if (item === "氧") {
            output_num *= settings.mining_speed_oxygen;
        } else if (item === "二氧化硫") {
            output_num *= settings.mining_speed_sulfur_dioxide;
        } else if (item === "二氧化碳") {
            output_num *= settings.mining_speed_carbon_dioxide;
        }
    } else if (building_name === "行星基地") {
        output_num *= settings.enemy_drop_multiple;
    } else if (building_name.endsWith("分馏塔")) {
        output_num *= settings.fractionating_speed;
    } else if (building_name === "伊卡洛斯") {
        output_num *= settings.icarus_manufacturing_speed;
    } //Jimmy：“毫无意义，只是我想这么干”
    return output_num;
}
