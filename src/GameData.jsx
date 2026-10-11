import darkFogSynthesis from '../data/mods/DarkFogSynthesis.json';
import {VANILLA_DARK_FOG_RECEIVING_REVISION} from './lib/game-data-migrations.js';

/*
    GameData数据内容说明:
        recipe_data：配方表
            记录配方数据的数组，数组中每一个元素即是一个配方的数据，以字典形式存储，其中各个键值对意义为：
                原料：完成一趟此配方需要的物品类型及相应数目
                产物：完成一趟此配方将产出的物品类型及相应数目
                设施：可以用于完成此配方的工厂类型
                时间：完成一趟此配方所需要的时间。其中，较为特殊的是：
                    采矿设备的时间规定为1s，即小矿机在矿物利用等级为0级时开采2簇矿物时的单位矿物产出时间
                    采集器的时间定规为1s，是矿物利用等级为0级时采集器在面板为0.125/s的巨星上采集的算入供电消耗前的单位矿物产出时间
                    抽水设备的时间规定为1.2s，是矿物利用等级为0级时单个抽水机的单位产出时间
                    抽油设备的时间规定为1s,是矿物利用等级为0级时单个萃取站在面板为1/s的油井上的单位产出时间
                    分馏塔的时间规定为100s，是让氢以1/s速度过带时的期望单位产出时间
                    蓄电器（满）的时间定为300s，是直接接入电网时充满电的时间（直接接入电网，设备倍率为1，使用能量枢纽，则设备倍率为50）
                增产：此配方的可增产情况，可以看做是2位2进制数所表示的一个值，第一位代表是否能加速，第二位代表是否能增产，比如0代表此配方既不能增产也不能加速，
                    2代表可以加速但不能增产，3代表既可以加速也可以增产等...其中，存在一个特例，当使用射线接受站接受光子时用上引力透镜，则引力透镜加速时可以让
                    产出翻倍，但不增加引力透镜消耗速度，**用4表示这种只能加速但不加倍原料消耗的配方
        
        proliferator_data：增产剂效果字典
            记录增产剂效能的数组，数组中第i个元素即为第i级增产剂的数据，以字典形式存储，其中各个键值对的意义为：
                名称：增产剂在游戏中的名字，其中，0级增产剂名为“不使用增产剂
                增产效果：使用此增产剂在额外产出模式时的产出倍率，如3级增产剂的增产效果为1.25
                加速效果：使用此增产剂在生产加速模式时的产出倍率，如3级增产剂的加速效果为2
                耗电倍率：使用此增产剂时工厂的耗电倍率，如3级增产剂的耗电倍率为2.5
                喷涂次数：增产剂在未被喷涂的情况下的面板喷涂次数，如3级增产剂的喷涂次数为60
        
        factory_data:建筑参数表
            记录各种工厂数值的字典，字典的键名为设施种类，如“制造台”、“冶炼设备”等，建值为属于这一设备种类的设备参数，以字典形式储存，字典中的键名为建筑名字，
            建值则是代表这一建筑参数的字典，字典中各个键值对的意义为：
                耗能：工厂的额定工作功率，单位为MW，如制造台 Mk.III的耗能为1.08
                倍率：工厂的额定工作速度，即实际生产速度与配方面板速度的比值，如制造台 Mk.III的倍率为1.5
                占地：目前定义为工厂建筑的占地面积，因为工厂的实际占地面积计算较为复杂。当前的想法是这个表的数据仅用作记录工厂建筑本身的占地面积，占地的单位
                    面积定义为游戏中一纬线间隔的平方（即游戏内的约1.256637m），之后通过其他数据结构来给涉及物品数目不同的相同建筑通过算法将进出货物时的分拣
                    器与传送带的占地也考虑上，届时会有不同的铺设模式对应不同的分拣器传送带占地。建筑占地本身也会因是否使用建筑偏移而有所改动。
*/
export const DarkFogSynthesisGUID = darkFogSynthesis.GUID;
export const dark_fog_synthesis_description = "黑雾合成 · Dark Fog Synthesis v0.1.0（实验性）：在当前原版数据上追加 6 条制造配方，默认使用合成，保留黑雾掉落选项。和平与非和平模式配方相同，不模拟科技解锁。计算器目前仅提供单独启用配置；与其它模组的组合数据尚未核验，不代表游戏内互不兼容。";
export const MoreMegaStructureGUID = "Gnimaerd.DSP.plugin.MoreMegaStructure";
export const TheyComeFromVoidGUID = "com.ckcz123.DSP_Battle";
export const GenesisBookGUID = "org.LoShin.GenesisBook";
export const FractionateEverythingGUID = "com.menglei.dsp.FractionateEverything";

const data_index_modules = import.meta.glob('../data/*.json', {
    import: 'default',
    eager: true,
});
const data_indices = Object.fromEntries(
    Object.entries(data_index_modules)
        .map(([module, data]) =>
            [module.replace(/^\.\.\/data\/(.+)\.json/, "$1"), data]
        ))

export const game_data_info_list = [
    // Vanilla stays first: its position is part of the version display contract.
    {
        "GUID": "Vanilla",
        "name": "原版游戏",
        "version": "0.10.31.24710",
    },
    {
        "GUID": MoreMegaStructureGUID,
        "name": "更多巨构",
        "version": "1.7.5",
    },
    {
        "GUID": TheyComeFromVoidGUID,
        "name": "深空来敌",
        "version": "3.4.3",
    },
    {
        "GUID": GenesisBookGUID,
        "name": "创世之书",
        "version": "3.0.14",
    },
    {
        "GUID": FractionateEverythingGUID,
        "name": "万物分馏",
        "version": "1.4.4",
    },
    {GUID: DarkFogSynthesisGUID, name: darkFogSynthesis.name, version: darkFogSynthesis.version},
]

export function get_mod_options() {
    const mod_options = [];
    game_data_info_list.forEach(function (mod) {
        if (mod.GUID === "Vanilla") {
            return;
        }
        mod_options.push({value: mod.GUID, label: mod.name + " v" + mod.version});
    });
    return mod_options;
}

/** One authoritative selection policy for the picker and restored settings. */
export function normalize_mod_list(mods) {
    const selected = Array.isArray(mods) ? mods : [];
    // A stale/hand-edited unsupported combination must not construct a hybrid dataset.
    if (selected.includes(DarkFogSynthesisGUID)) return [DarkFogSynthesisGUID];
    const known = get_mod_options().map(option => option.value).filter(value => selected.includes(value));
    if (known.includes(TheyComeFromVoidGUID) && !known.includes(MoreMegaStructureGUID)) known.unshift(MoreMegaStructureGUID);
    return known;
}

export const default_game_data = get_game_data(["Vanilla"])
export const vanilla_game_version = game_data_info_list[0].version;
export const vanilla_data_description = `原版基础数据 v${vanilla_game_version}；仅原版追加已核验的 v0.10.34 全息信标与 v0.10.35 黑雾引力透镜制造配方，并追加黑雾透镜稳态光子接收（默认倍率）：满连续接收（至少 20 分钟）、戴森供能与接收条件充足时，每站 24 个/分钟，喷涂 Mk.I / II / III 为 30 / 36 / 48，透镜均为 0.1 个/分钟。合成面板布局另按已记录的界面参考排列；未模拟启动、断续接收、戴森功率与损耗，尚未完整适配 v0.10.35。模组组合仍使用各自原有数据`;

var name_icon_list;

export function get_game_data(modList) {
    if (modList.includes(DarkFogSynthesisGUID) && modList.some(mod => mod !== DarkFogSynthesisGUID && mod !== 'Vanilla')) {
        throw new Error('黑雾合成目前仅支持单独启用；与其它模组的组合数据尚未核验。');
    }
    let data = {};
    data.DarkFogSynthesisEnable = modList.includes(DarkFogSynthesisGUID);
    //根据mod列表，获取json文件名
    const mod_names = [];
    let json_file_name = "";
    data.MoreMegaStructureEnable = false;
    if (modList.includes(MoreMegaStructureGUID)) {
        json_file_name += "_MoreMegaStructure";
        data.MoreMegaStructureEnable = true;
        mod_names.push("MoreMegaStructure");
    }
    data.TheyComeFromVoidEnable = false;
    if (modList.includes(TheyComeFromVoidGUID)) {
        json_file_name += "_TheyComeFromVoid";
        data.TheyComeFromVoidEnable = true;
        mod_names.push("TheyComeFromVoid")
    }
    data.GenesisBookEnable = false;
    if (modList.includes(GenesisBookGUID)) {
        json_file_name += "_GenesisBook";
        data.GenesisBookEnable = true;
        mod_names.push("GenesisBook")
    }
    data.FractionateEverythingEnable = false;
    if (modList.includes(FractionateEverythingGUID)) {
        json_file_name += "_FractionateEverything";
        data.FractionateEverythingEnable = true;
        mod_names.push("FractionateEverything")
    }
    json_file_name = json_file_name === "" ? "Vanilla" : json_file_name.substring(1);
    let json_data = data_indices[json_file_name];
    if (data.DarkFogSynthesisEnable) {
        // Append only. Preserve every vanilla ordinal, item slot and icon.
        json_data = {...json_data, recipes: [...json_data.recipes, ...darkFogSynthesis.recipes]};
        json_file_name = 'DarkFogSynthesis';
        mod_names.push('DarkFogSynthesis');
    }
    //将json转换为需要的数据结构
    data.mods = mod_names;
    data.game_name = json_file_name;
    data.data_revision = data.DarkFogSynthesisEnable
        ? `${VANILLA_DARK_FOG_RECEIVING_REVISION}+dark-fog-synthesis-${darkFogSynthesis.version}-${darkFogSynthesis.sourceCommit}`
        : json_file_name === 'Vanilla' ? VANILLA_DARK_FOG_RECEIVING_REVISION : json_file_name;
    data.recipe_ids = json_data.recipes.map(recipe => recipe.ID);
    data.default_recipe_ids = data.DarkFogSynthesisEnable
        ? darkFogSynthesis.recipes.map(recipe => recipe.ID) : [];
    data.item_grid = {};
    data.item_icon_name = {};
    data.recipe_data = [];
    data.factory_data = [];
    data.proliferator_data = [];
    data.proliferator_effect = [];
    //data.item_grid
    json_data.items.forEach(function (item) {
        data.item_grid[item.Name] = item["GridIndex"];
        data.item_icon_name[item.Name] = item["IconName"];
    })

    //data.recipe_data & data.factory_data
    function get_item_by_id(itemID) {
        let ret = null;
        json_data.items.forEach(function (item) {
            if (ret !== null) {
                return;
            }
            if (item["ID"] === itemID) {
                ret = item;
            }
        })
        return ret;
    }

    let FactoriesArr = [];//存储所有可能的工厂类型
    json_data.recipes.forEach(function (recipe) {
        let 原料 = {};
        for (let i = 0; i < recipe["Items"].length; i++) {
            let itemID = recipe.Items[i];
            let item = get_item_by_id(itemID);
            原料[item.Name] = recipe.ItemCounts[i];
        }
        let 产物 = {};
        for (let i = 0; i < recipe["Results"].length; i++) {
            let itemID = recipe.Results[i];
            let item = get_item_by_id(itemID);
            产物[item.Name] = recipe.ResultCounts[i];
        }
        let 设施 = -1;
        for (let i = 0; i < FactoriesArr.length; i++) {
            if (FactoriesArr[i].toString() === recipe.Factories.toString()) {
                设施 = i;
                break;
            }
        }
        if (设施 === -1) {
            设施 = FactoriesArr.length;
            FactoriesArr.push(recipe.Factories);
        }
        let 时间 = recipe.TimeSpend / 60.0;
        let 增产 = recipe.Proliferator;
        data.recipe_data.push({
            "原料": 原料,
            "产物": 产物,
            "设施": 设施,
            "时间": 时间,
            "增产": 增产,
        });
    })
    //data.factory_data
    for (let i = 0; i < FactoriesArr.length; i++) {
        let factories = [];
        for (let j = 0; j < FactoriesArr[i].length; j++) {
            let factory = {};
            let item = get_item_by_id(FactoriesArr[i][j]);
            //console.log("i=" + i + ",j=" + j + ",FactoriesArr[i][j]=" + FactoriesArr[i][j]);
            factory["名称"] = item["Name"];
            factory["耗能"] = item["WorkEnergyPerTick"] * 0.00006;
            factory["倍率"] = item["Speed"];
            //factory["输出倍率"] = item["MultipleOutput"];
            factory["占地"] = item["Space"];
            factories.push(factory);
        }
        data.factory_data.push(factories);
    }
    //proliferator_effect
    data.proliferator_effect = [
        {
            "增产效果": 1.0,
            "加速效果": 1.0,
            "耗电倍率": 1.0
        },
        {
            "增产效果": 1.125,
            "加速效果": 1.25,
            "耗电倍率": 1.3
        },
        {
            "增产效果": 1.2,
            "加速效果": 1.5,
            "耗电倍率": 1.7
        },
        {
            "增产效果": 1.225,
            "加速效果": 1.75,
            "耗电倍率": 2.1
        },
        {
            "增产效果": 1.25,
            "加速效果": 2.0,
            "耗电倍率": 2.5
        },
        {
            "增产效果": 1.275,
            "加速效果": 2.25,
            "耗电倍率": 2.9
        },
        {
            "增产效果": 1.3,
            "加速效果": 2.5,
            "耗电倍率": 3.3
        },
        {
            "增产效果": 1.325,
            "加速效果": 2.75,
            "耗电倍率": 3.7
        },
        {
            "增产效果": 1.35,
            "加速效果": 3.0,
            "耗电倍率": 4.1
        },
        {
            "增产效果": 1.375,
            "加速效果": 3.25,
            "耗电倍率": 4.5
        },
        {
            "增产效果": 1.4,
            "加速效果": 3.5,
            "耗电倍率": 4.9
        }
    ]
    let proliferator_effect = data.proliferator_effect;
    //data.proliferator_data
    data.proliferator_data.push({
        "名称": "不使用增产剂",
        "增产剂": 0,
        "喷涂次数": 1,
        "增产点数": 0,
        "增产效果": proliferator_effect[0].增产效果,
        "加速效果": proliferator_effect[0].加速效果,
        "耗电倍率": proliferator_effect[0].耗电倍率,
    })
    if (name_icon_list === undefined) {
        name_icon_list = {};
    }
    json_data.items.forEach(function (item) {
        if (item.ID === 1141) {
            data.proliferator_data.push({
                "名称": "增产剂 Mk.I",
                "增产剂": "增产剂 Mk.I",
                "喷涂次数": 12,
                "增产点数": 1,
                "增产效果": proliferator_effect[1].增产效果,
                "加速效果": proliferator_effect[1].加速效果,
                "耗电倍率": proliferator_effect[1].耗电倍率,
            })
        }
        if (item.ID === 1142) {
            data.proliferator_data.push({
                "名称": "增产剂 Mk.II",
                "增产剂": "增产剂 Mk.II",
                "喷涂次数": 24,
                "增产点数": 2,
                "增产效果": proliferator_effect[2].增产效果,
                "加速效果": proliferator_effect[2].加速效果,
                "耗电倍率": proliferator_effect[2].耗电倍率
            })
        }
        if (item.ID === 1143) {
            data.proliferator_data.push({
                "名称": data.GenesisBookEnable ? "增产剂" : "增产剂 Mk.III",
                "增产剂": data.GenesisBookEnable ? "增产剂" : "增产剂 Mk.III",
                "喷涂次数": 60,
                "增产点数": 4,
                "增产效果": proliferator_effect[4].增产效果,
                "加速效果": proliferator_effect[4].加速效果,
                "耗电倍率": proliferator_effect[4].耗电倍率
            })
        }
        //存储名称与icon的关系
        //console.log("name:" + item["Name"] + " icon:" + item["IconName"])
        name_icon_list[item["Name"]] = item["IconName"];
    })
    if (data.FractionateEverythingEnable) {
        data.proliferator_data.push({
            "名称": "点数聚集分馏塔",
            "增产剂": data.GenesisBookEnable ? "增产剂" : "增产剂 Mk.III",
            "喷涂次数": 24,// 60/(10/4)
            "增产点数": 10,
            "增产效果": proliferator_effect[10].增产效果,
            "加速效果": proliferator_effect[10].加速效果,
            "耗电倍率": proliferator_effect[10].耗电倍率
        })
    }

    //下载data
    //saveJSONToFile(data, json_file_name + "_convert.json");

    return data;
}

export function get_icon_by_item(item) {
    return name_icon_list[item];
}

// function saveJSONToFile(jsonData, filename) {
//     // 将JSON数据转换为字符串
//     const jsonString = JSON.stringify(jsonData, null, 2);
//
//     // 创建一个虚拟的<a>标签
//     const blob = new Blob([jsonString], {type: 'text/json'});
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//
//     // 设置下载的文件名
//     a.download = filename;
//     a.href = url;
//     a.click();
//
//     // 清理URL对象
//     URL.revokeObjectURL(url);
// }
