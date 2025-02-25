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
    {
        "name_en": "Vanilla",
        "name_cn": "原版游戏",
        "version": "0.10.32.25699",
    },
    {
        "name_en": "MoreMegaStructure",
        "name_cn": "更多巨构",
        "version": "1.8.3",
    },
    {
        "name_en": "TheyComeFromVoid",
        "name_cn": "深空来敌",
        "version": "3.4.10",
    },
    {
        "name_en": "GenesisBook",
        "name_cn": "创世之书",
        "version": "3.0.14",
    },
    {
        "name_en": "GenesisBook",
        "name_cn": "创世之书",
        "version": "3.1.0-alpha2.2",
    },
    {
        "name_en": "FractionateEverything",
        "name_cn": "万物分馏",
        "version": "1.4.5",
    },
    {
        "name_en": "FractionateEverything",
        "name_cn": "万物分馏",
        "version": "2.0.0",
    },
]

/**
 * 用户可以选择的mod显示列表
 */
export function get_mod_options() {
    const mod_options = [];
    game_data_info_list.forEach(function (mod) {
        if (mod.name_en === "Vanilla") {
            return;
        }
        mod_options.push({value: mod.name_en + mod.version, label: mod.name_cn + " v" + mod.version});
    });
    return mod_options;
}

const VanillaGUID = "Vanilla";
export const default_game_data = get_game_data([]);
export const vanilla_game_version = game_data_info_list[0].version;

var name_icon_list;

export function get_game_data(mod_guid_list) {
    //guid 指 name_en + version
    if (mod_guid_list.length === 0) {
        return get_game_data([VanillaGUID]);
    }
    let data = {};
    //根据mod列表，获取json文件名
    let json_file_name = "";
    data.MoreMegaStructureEnable = false;
    data.TheyComeFromVoidEnable = false;
    data.GenesisBookEnable = false;
    data.FractionateEverythingEnable = false;
    //mod_name_list存储mod英文名，用于在指定文件夹寻找图标
    let mod_name_list = []
    //这里要注意顺序，否则文件名会不对
    if (mod_guid_list.includes("MoreMegaStructure" + game_data_info_list[1].version)) {
        json_file_name += "_" + "MoreMegaStructure" + game_data_info_list[1].version;
        data.MoreMegaStructureEnable = true;
        mod_name_list.push("MoreMegaStructure");
    }
    if (mod_guid_list.includes("TheyComeFromVoid" + game_data_info_list[2].version)) {
        json_file_name += "_" + "TheyComeFromVoid" + game_data_info_list[2].version;
        data.TheyComeFromVoidEnable = true;
        mod_name_list.push("TheyComeFromVoid");
    }
    if (mod_guid_list.includes("GenesisBook" + game_data_info_list[3].version)) {
        json_file_name += "_" + "GenesisBook" + game_data_info_list[3].version;
        data.GenesisBookEnable = true;
        mod_name_list.push("GenesisBook");
    } else if (mod_guid_list.includes("GenesisBook" + game_data_info_list[4].version)) {
        json_file_name += "_" + "GenesisBook" + game_data_info_list[4].version;
        data.GenesisBookEnable = true;
        mod_name_list.push("GenesisBook");
    }
    if (mod_guid_list.includes("FractionateEverything" + game_data_info_list[5].version)) {
        json_file_name += "_" + "FractionateEverything" + game_data_info_list[5].version;
        data.FractionateEverythingEnable = true;
        mod_name_list.push("FractionateEverything");
    } else if (mod_guid_list.includes("FractionateEverything" + game_data_info_list[6].version)) {
        json_file_name += "_" + "FractionateEverything" + game_data_info_list[6].version;
        data.FractionateEverythingEnable = true;
        mod_name_list.push("FractionateEverything");
    }
    json_file_name = json_file_name === "" ? VanillaGUID : json_file_name.substring(1);
    let json_data = data_indices[json_file_name];
    //将json转换为需要的数据结构
    data.mod_name_list = mod_name_list;
    data.mod_guid_list = mod_guid_list;
    data.game_name = json_file_name;
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