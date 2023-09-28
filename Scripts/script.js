/*
    戴森球计划量化计算器，详细计算思路见：https://www.bilibili.com/read/cv19387400
    线性规划使用javascript-lp-solver库：https://github.com/JWally/jsLPSolver
    作者：莳槡
    联系方式:
        QQ:653524123
        QQ群:816367922
        github:https://github.com/makuwa8992
        bilibili:https://space.bilibili.com/16051534
    功能实现(TODO):
        前端基础布局与前后端必要的交互 √
        更好的前端布局
        比递归累加原料更为准确的循环产线计算结果 √
        副产物处理 √
        支持同类似工厂类游戏与创世之书等mod的配方（导入其他mod的工厂建筑、增产剂、配方等数据）————待导入
        小数取整方向 √
        外部输入支持(原矿化(无喷涂)/自带喷涂) √
        添加固定建筑与配方的已有产线 √
        固定配方最优增产决策

*/
var game_data = GameData.vanilla;//初始化配方、建筑、增产剂效果等默认游戏数据,本来应该存在json里的,html读本地json不方便,有大佬愿意重构一下也好,
/*game_data是除非换游戏或者加mod不会动到的固定数据
    game_data数据内容说明:
        recipe_data：配方表
            记录配方数据的数组，数组中每一个元素即是一个配方的数据，以字典形式存储，其中各个键值对意义为：
                原料：完成一趟此配方需要的物品类型及相应数目
                产物：完成一趟此配方将产出的物品类型及相应数目
                设施：可以用于完成此配方的工厂类型
                时间：完成一趟此配方所需要的时间。其中，较为特殊的是：
                    采矿设备的时间规定为1s，即小矿机在矿物利用等级为1级时开采2簇矿物时的单位矿物产出时间
                    采集器的时间定规为1s，是矿物利用等级为1级时采集器在面板为0.125/s的巨星上采集的算入供电消耗前的单位矿物产出时间
                    抽水设备的时间规定为1.2s，是矿物利用等级为1级时单个抽水机的单位产出时间
                    抽油设备的时间规定为1s,是矿物利用等级为1级时单个萃取站在面板为1/s的油井上的单位产出时间
                    分馏塔的时间规定为100s，是让氢以1/s速度过带时的期望单位产出时间
                    蓄电器（满）的时间定为300s，是直接接入电网时充满电的时间（直接接入电网，设备倍率为1，使用能量枢纽，则设备倍率为50）
                增产：此配方的可增产情况，可以看做是2位2进制数所表示的一个值，第一位代表是否能加速，第二位代表是否能增产，比如0代表此配方既不能增产也不能加速，
                    2代表可以加速但不能增产，3代表既可以加速也可以增产等...其中，存在一个特例，当使用射线接受站接受光子时用上引力透镜，则引力透镜加速时可以让
                    产出翻倍，但不增加引力透镜消耗速度，**用4表示这种只能加速但不加倍原料消耗的配方
        
        proliferator_data：增产剂效果字典
            记录增产剂效能的数组，数组中第i个元素即为第i级增产剂的数据，以字典形式存储，其中各个键值对的意义为：
                增产剂名称：增产剂在游戏中的名字，其中，0级增产剂名为“不使用增产剂
                增产效果：使用此增产剂在额外产出模式时的产出倍率，如3级增产剂的增产效果为1.25
                加速效果：使用此增产剂在生产加速模式时的产出倍率，如3级增产剂的加速效果为2
                耗电倍率：使用此增产剂时工厂的耗电倍率，如3级增产剂的耗电倍率为2.5
                喷涂次数：增产剂在未被喷涂的情况下的面板喷涂次数，如3级增产剂的喷涂次数为60
        
        factory_data:建筑参数表
            记录各种工厂数值的字典，字典的键名为设施种类，如“制造台”、“冶炼设备”等，建值为属于这一设备种类的设备参数，以字典形式储存，字典中的键名为建筑名字，
            建值则是代表这一建筑参数的字典，字典中各个键值对的意义为：
                耗能：工厂的额定工作功率，单位为MW，如制造台MK.Ⅲ的耗能为1.08
                倍率：工厂的额定工作速度，即实际生产速度与配方面板速度的比值，如制造台MK.Ⅲ的倍率为1.5
                占地：目前定义为工厂建筑的占地面积，因为工厂的实际占地面积计算较为复杂。当前的想法是这个表的数据仅用作记录工厂建筑本身的占地面积，占地的单位
                    面积定义为游戏中一纬线间隔的平方（即游戏内的约1.256637m），之后通过其他数据结构来给涉及物品数目不同的相同建筑通过算法将进出货物时的分拣
                    器与传送带的占地也考虑上，届时会有不同的铺设模式对应不同的分拣器传送带占地。建筑占地本身也会因是否使用建筑偏移而有所改动。
*/
function changeGameData(){
    var game_mod = document.getElementById("gameData").value;
    game_data = GameData[game_mod];
    init();
    calculate();
}
var scheme_data = {
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
}//在非导入的情况会依据game_data生成默认值，这里的内容仅做示例，这个一样应该存在本地json里的，目前存在html的localStorage里
{/*初始化生产策略数据
    scheme_data是用户根据自己选取的配方策略而制定的数据
    scheme_data数据内容说明:
        item_recipe_choices:物品来源配方选取
            物品的来源配方列表存在由game_data生成的item_data列表中中的对应元素。
            item_data列表在下标为1~length-1的区域中存放着指向可以生产这个物品的配方在game_data.recipe_data中的id
            比如item_data["氢"] = [氢在list(item_data)中的id,采集器取氢的配方id，高效石墨烯的配方id，原油精炼的配方id...等]
            而item_recipe_choices["氢"] == 1就代表着需要使用额外的氢时我们选用轨道采集器来获取
        scheme_for_recipe：配方参数配置列表
            长度和game_data.recipe_data一致，列表中每一个元素都是一个字典，字典的内容为：
                '建筑':表示完成此配方使用的建筑在data["factory_data"]中的同一类工厂中的序号
                '喷涂点数':表示选取什么等级的增产剂（0为不使用，1、2、4分别对应增产剂MK.Ⅰ、Ⅱ、Ⅲ）
                '增产模式':表示选取何种增产模式（0为不增产，1为增产，2为加速）
*/}

{//这里是前端按钮调用的布局相关的函数
    function addNeeds() {
        var needs_item = document.getElementById("needs_item").value;
        var needs_amount = document.getElementById("needs_amount").value;
        if (!(needs_item in item_data)) {
            alert("请输入或选择正确的物品名字！");
            return;
        }
        if (Object.keys(needs_list).length == 0) {
            document.getElementById("resetNeeds").innerHTML = "<button id=\"all\" onclick=\"resetNeeds('all')\">清空所有需求</button>" + "<br />";
        }//如果一开始没有物品，那就加一个以前清楚的按钮，有物品必有按钮，就不用加了
        if (!(needs_item in needs_list)) {
            needs_list[needs_item] = Number(needs_amount);
        }
        else {
            needs_list[needs_item] = Number(needs_list[needs_item]) + Number(needs_amount);
        }
        show_needs_list();
        calculate();
    }//增添需求

    function resetNeeds(item) {
        if (item in needs_list) {
            delete needs_list[item];
        }
        if (item == "all") {
            needs_list = {};
        }
        show_needs_list();
        calculate();
        if (Object.keys(needs_list).length == 0) {
            document.getElementById("resetNeeds").innerHTML = "";
        }
    }//更改需求

    function changeNeeds(item) {
        var num = document.getElementById("needs_of_" + item).value;
        if (item in needs_list) {
            needs_list[item] = Number(num);
        }
        show_needs_list();
        calculate();
    }
    function loadData() {
        var data_of_game = JSON.parse(localStorage.getItem('game_data'));
        if (data_of_game) {
            game_data = JSON.parse(localStorage.getItem('game_data'));
            item_data = get_item_data();
        }
        calculate();
    }//读取游戏数据

    function saveData() {
        localStorage.setItem('game_data', JSON.stringify(game_data));
    }//保存游戏数据

    function saveScheme() {
        localStorage.setItem('scheme_data', JSON.stringify(scheme_data));
    }//保存生产策略

    function loadScheme() {
        var scheme = JSON.parse(localStorage.getItem('scheme_data'));
        if (scheme) {
            scheme_data = JSON.parse(localStorage.getItem('scheme_data'));
        }
        calculate();
    }//读取生产策略

    function saveNeeds() {
        localStorage.setItem('needs_list', JSON.stringify(needs_list));
    }//保存生产策略

    function loadNeeds() {
        var scheme = JSON.parse(localStorage.getItem('needs_list'));
        if (scheme) {
            needs_list = JSON.parse(localStorage.getItem('needs_list'));
        }
        show_needs_list();
        calculate();
    }//读取生产策略

    function clearData() {
        localStorage.clear();
    }//清空所有缓存

    function ChangeRecipeOf(item) {
        scheme_data.item_recipe_choices[item] = document.getElementById("recipe_for_" + item).value;
        change_result_row_for_item(item);
        calculate();
    }//切换物品来源配方

    function ChangeSchemeOf(item) {
        var recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        scheme_data.scheme_for_recipe[recipe_id]["喷涂点数"] = document.getElementById("pro_num_for_" + item).value;
        scheme_data.scheme_for_recipe[recipe_id]["增产模式"] = document.getElementById("pro_mode_for_" + item).value;
        scheme_data.scheme_for_recipe[recipe_id]["建筑"] = document.getElementById("factory_for_" + item).value;
        change_result_row_for_item(item);
        calculate();
    }//切换配方制造时的选项

    function init_item_list() {
        var str = "";
        for (var i in item_data) {
            str += "<option value=\"" + i + "\">\n";
        }
        document.getElementById("item_list").innerHTML = str;
    }//初始化物品html上物品列表选项

    function if_proliferate_itself(proliferate_itself) {
        proliferator_price = init_pro_proliferator(proliferate_itself);
        if (proliferate_itself) {
            document.getElementById("是否自喷涂").innerHTML = "<button onclick=\"if_proliferate_itself(0)\">自喷涂?</button>Yes!";
        }
        else {
            document.getElementById("是否自喷涂").innerHTML = "<button onclick=\"if_proliferate_itself(1)\">自喷涂?</button>No!";
        }
        calculate();
    }//增产剂自喷涂勾选选项

    function changeFixedNum() {
        fixed_num = document.getElementById("显示精度").value;
        if (fixed_num <= 0) fixed_num = 0;
        show_result_dict();
    }//更改显示精度

    function BatchChangeFactoryOf(factory) {
        var building = document.getElementById("batch_setting_" + factory).value;
        for (var i = 0; i < game_data.recipe_data.length; i++) {
            if (game_data.recipe_data[i]["设施"] == factory) {
                scheme_data.scheme_for_recipe[i]["建筑"] = building;
            }
        }
        calculate();
    }//批量改变某一类型建筑的等级

    function BatchChangeProMode() {
        var pro_mode = document.getElementById("batch_setting_pro_mode").value;
        for (var i = 0; i < game_data.recipe_data.length; i++) {
            if (pro_mode != 0 && !(pro_mode & game_data.recipe_data[i]["增产"])) {
                continue;
            }
            scheme_data.scheme_for_recipe[i]["增产模式"] = Number(pro_mode);
        }
        calculate();
    }//批量更改增产剂使用模式

    function BatchChangeProNum() {
        var pro_num = document.getElementById("batch_setting_pro_num").value;
        for (var i = 0; i < game_data.recipe_data.length; i++) {
            scheme_data.scheme_for_recipe[i]["喷涂点数"] = pro_num;
        }
        calculate();
    }//批量更改配方使用的增产剂的等级

    function ChangeBuildingLayer(building) {
        stackable_buildings[building] = document.getElementById("stack_of_" + building).value;
        calculate();
    }

    function changeMiningRate(i) {
        scheme_data.mining_rate[i] = Number(document.getElementById("mining_rate_" + i).value);
        calculate();
    }

    function addNaturalProductionLine() {
        natural_production_line.push({ "目标物品": "氢", "建筑数量": 0, "配方id": 1, "喷涂点数": 0, "增产模式": 0, "建筑": 0 })
        show_natural_production_line();
    }

    function NPChangeRecipeOf(i) {
        natural_production_line[i]["配方id"] = document.getElementById("recipe_of_natural_production_" + i).value;
        natural_production_line[i]["建筑"] = 0;
        natural_production_line[i]["增产模式"] = 0;
        show_natural_production_line();
        calculate();
    }

    function NPChangeSchemeOf(i) {
        natural_production_line[i]["建筑"] = document.getElementById("factory_of_natural_production_" + i).value;
        natural_production_line[i]["增产模式"] = document.getElementById("pro_mode_of_natural_production_" + i).value;
        natural_production_line[i]["喷涂点数"] = document.getElementById("pro_num_of_natural_production_" + i).value;
        natural_production_line[i]["建筑数量"] = document.getElementById("building_num_of_natural_production_" + i).value;
        show_natural_production_line();
        calculate();
    }

    function NPDeleteLine(i) {
        for (var j = i; j < natural_production_line.length; j++) {
            natural_production_line[j] = natural_production_line[j + 1];
        }
        natural_production_line.pop();
        show_natural_production_line();
        calculate();
    }

    function NPChangeItem(i) {
        var item = document.getElementById("item_of_natural_production_" + i).value;
        if (!(item in item_data)) {
            alert("请输入或选择正确的物品名字！");
        }
        else {
            natural_production_line[i]["目标物品"] = item;
        }
        natural_production_line[i]["配方id"] = 1;
        natural_production_line[i]["建筑"] = 0;
        natural_production_line[i]["增产模式"] = 0;
        show_natural_production_line();
        calculate();
    }//改变固有产线物品

    function changeFractionatingSpeed() {
        scheme_data.fractionating_speed = Number(document.getElementById("分馏塔过氢带速").value);
        if (scheme_data.fractionating_speed > 1800) {
            game_data.factory_data["分馏设备"][0]["耗能"] = scheme_data.fractionating_speed * 0.0006 - 0.36;
        }
        else {
            game_data.factory_data["分馏设备"][0]["耗能"] = 0.72;
        }
        calculate();
    }//更改分馏塔过氢带速

    function IfEnergyContainMiner(){
        scheme_data.energy_contain_miner = (scheme_data.energy_contain_miner + 1) % 2;
        calculate();
    }
}//这里是前端按钮调用的布局相关的函数


{//这里是script内部调用用到的主要逻辑需要的函数
    {
        function init() {
            needs_list = {};//物品需求列表
            natural_production_line = [];//固有产线的输入输出影响,格式为[0号产线{"目标物品","建筑数量","配方id","喷涂点数","增产模式","建筑"},...]
            mineralize_list = {};//原矿化列表，代表忽视哪些物品的原料
            stackable_buildings = { "矩阵研究站": 15 };
            item_data = get_item_data(); {/*
            通过读取配方表得到配方中涉及的物品信息，item_data中的键名为物品名，
            键值为此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
        */}
            init_item_list();
            init_scheme_data(); //初始化物品的来源配方决策
            proliferator_price = init_pro_proliferator(1); {/*
            代表0~10级增产点数的喷涂效果的成本列表
            如果为-1，则表示该等级的喷涂不可用
        */}
            multi_sources = {};//初始化多来源物品表
            lp_item_dict = {};//线性规划相关物品需求表
            external_supply_item = {};//外部供应物品
            side_item_dict = {};
            surplus_list = {};
            lp_surplus_list = {};
            lp_item_dict = {};
            item_graph = build_item_graph();//初始化产物关系图
            result_dict = {};
            fixed_num = 2;
            key_item_list = [];
            item_list = [];
            item_price = {};
            building_list = {};
            energy_cost = 0;
            build_item_list();
            item_price = get_item_price();
            init_recipe_list();
            init_pro_num_list();
            init_pro_mode_list();
            init_factory_list();
            batch_setting_init();
            building_stack_init();
            show_mining_setting();
        }//全局初始化

        function show_mining_setting() {
            var str = "";
            for (var i in scheme_data.mining_rate) {
                str += i + ":<input type=\"text\" size=\"6\" id=\"mining_rate_" + i + "\" value=\"" + scheme_data.mining_rate[i] + "\" onchange=\"changeMiningRate('" + i + "')\"/>";
            }
            document.getElementById("采矿参数").innerHTML = str;
        }//采矿相关UI接口

        function show_natural_production_line() {
            var str = "";
            for (var i in natural_production_line) {
                str += "<tr id=\"natural_production_" + i + "\">" +
                    "<th><input list=\"item_list\" id=\"item_of_natural_production_" + i + "\" value=\"" + natural_production_line[i]["目标物品"] + "\" onChange=\"NPChangeItem('" + i + "')\"></th>" + // 目标物品
                    "<th><input id=\"building_num_of_natural_production_" + i + "\" value=\"" + natural_production_line[i]["建筑数量"] + "\" onChange=\"NPChangeSchemeOf('" + i + "')\">" + "</th>" +  //建筑数量
                    "<th><select id=\"recipe_of_natural_production_" + i + "\" value=\"" + natural_production_line[i]["配方id"] + "\" onChange=\"NPChangeRecipeOf('" + i + "')\"></th>" + // 所选配方
                    "<th><select id=\"pro_num_of_natural_production_" + i + "\" value=\"" + natural_production_line[i]["喷涂点数"] + "\" onChange=\"NPChangeSchemeOf('" + i + "')\"></select></th>" + //所选增产剂
                    "<th><select id=\"pro_mode_of_natural_production_" + i + "\" value=\"" + natural_production_line[i]["增产模式"] + "\" onChange=\"NPChangeSchemeOf('" + i + "')\"></select></th>" + //所选增产模式
                    "<th><select id=\"factory_of_natural_production_" + i + "\" value=\"" + natural_production_line[i]["建筑"] + "\" onChange=\"NPChangeSchemeOf('" + i + "')\"></select></th>" + //所选工厂种类
                    "<th><button onclick=\"NPDeleteLine('" + i + "')\">删除</button></th></tr>";
            }
            document.getElementById("固有产线").innerHTML = str;
            for (var NPId in natural_production_line) {
                var item = document.getElementById("item_of_natural_production_" + NPId).value;
                var recipe_for_select = document.getElementById("recipe_of_natural_production_" + NPId);
                var pro_num_list = document.getElementById("pro_num_list");
                var pro_num_for_select = document.getElementById("pro_num_of_natural_production_" + NPId);
                var pro_mode_select = document.getElementById("pro_mode_of_natural_production_" + NPId);
                var factory_select = document.getElementById("factory_of_natural_production_" + NPId);
                var recipe_list = document.getElementById("recipe_list").options;
                recipe_for_select.innerHTML = "";
                pro_num_for_select.innerHTML = "";
                pro_mode_select.innerHTML = "";
                factory_select.innerHTML = "";
                for (var i = 1; i < item_data[item].length; i++) {
                    var option = document.createElement("option");
                    option.value = i;
                    option.label = recipe_list[item_data[item][i]].label;
                    if (natural_production_line[NPId]["配方id"] == i) {
                        option.selected = "selected";
                    }
                    recipe_for_select.options.add(option);
                }//配方选取列表
                var recipe_id = item_data[item][natural_production_line[NPId]["配方id"]];
                for (var i = 0; i < pro_num_list.options.length; i++) {
                    var option = document.createElement("option");
                    option.value = pro_num_list.options[i].value;
                    option.label = pro_num_list.options[i].value;
                    if (natural_production_line[NPId]["喷涂点数"] == option.value) {
                        option.selected = "selected";
                    }
                    pro_num_for_select.options.add(option);
                }//喷涂点数
                var pro_mode_list = document.getElementById("增产模式" + game_data.recipe_data[recipe_id]["增产"]);
                for (var i = 0; i < pro_mode_list.options.length; i++) {
                    var option = document.createElement("option");
                    option.value = pro_mode_list.options[i].value;
                    option.label = pro_mode_list.options[i].label;
                    if (natural_production_line[NPId]["增产模式"] == option.value) {
                        option.selected = "selected";
                    }
                    pro_mode_select.options.add(option);
                }//增产模式
                var factory_list = document.getElementById(game_data.recipe_data[recipe_id]["设施"] + "_list");
                for (var i = 0; i < factory_list.options.length; i++) {
                    var option = document.createElement("option");
                    option.value = factory_list.options[i].value;
                    option.label = factory_list.options[i].label;
                    if (natural_production_line[NPId]["建筑"] == option.value) {
                        option.selected = "selected";
                    }
                    factory_select.options.add(option);
                }//建筑选取
            }//修正参数设置UI
        }

        function batch_setting_init() {
            var str = "批量预设：";
            for (var factory in game_data.factory_data) {
                if (game_data.factory_data[factory].length >= 2) {
                    str += factory + ":<select id=\"batch_setting_" + factory + "\" onChange=\"BatchChangeFactoryOf('" + factory + "')\">";
                    for (var i = 0; i < game_data.factory_data[factory].length; i++) {
                        str += "<option value=\"" + i + "\" label=\"" + game_data.factory_data[factory][i]["名称"] + "\"";
                        if (i == 0) {
                            str += " selected"
                        }
                        str += "\/>";
                    }
                    str += "</select>";
                }
            }
            str += "喷涂点数:<select id=\"batch_setting_pro_num\" onChange=\"BatchChangeProNum()\">";
            for (var i = 0; i < game_data.proliferate_effect.length; i++) {
                if (proliferator_price[i] != -1)
                    str += "<option value=\"" + i + "\" label=\"" + i + "\"\/>";
            }
            str += "</select>增产模式:<select id=\"batch_setting_pro_mode\" onChange=\"BatchChangeProMode()\">";
            str += "<option value=\"0\" label = \"不使用增产剂\"\/>" + "<option value=\"1\" label = \"增产\"\/>" +
                "<option value=\"2\" label = \"加速\"\/>";
            document.getElementById("批量预设").innerHTML = str;
        }//初始化批量预设

        function building_stack_init() {
            var str = "建筑层数:";
            for (var building in stackable_buildings) {
                str += building + ":<input id=\"stack_of_" + building + "\" type=\"number\" value=\"" + stackable_buildings[building] + "\"onChange=\"ChangeBuildingLayer('" + building + "')\">";
            }
            document.getElementById("建筑层数").innerHTML = str;
        }

        function init_pro_num_list() {
            var str = "";
            for (var i = 0; i < game_data.proliferate_effect.length; i++) {
                if (proliferator_price[i] != -1)
                    str += "<option value=\"" + i + "\">";
            }
            document.getElementById("pro_num_list").innerHTML = str;
        }//初始化可用喷涂点数列表

        function init_pro_mode_list() {
            var str = "";
            str += "<datalist id=\"增产模式0\">\n";
            str += "<option value=\"0\" label=\"不使用增产剂\">\n";
            str += "</datalist>\n";
            str += "<datalist id=\"增产模式1\">\n";
            str += "<option value=\"0\" label=\"不使用增产剂\">\n";
            str += "<option value=\"1\" label=\"增产\">\n";
            str += "</datalist>\n";
            str += "<datalist id=\"增产模式2\">\n";
            str += "<option value=\"0\" label=\"不使用增产剂\">\n";
            str += "<option value=\"2\" label=\"加速\">\n";
            str += "</datalist>\n";
            str += "<datalist id=\"增产模式3\">\n";
            str += "<option value=\"0\" label=\"不使用增产剂\">\n";
            str += "<option value=\"1\" label=\"增产\">\n";
            str += "<option value=\"2\" label=\"加速\">\n";
            str += "</datalist>\n";
            str += "<datalist id=\"增产模式4\">\n";
            str += "<option value=\"0\" label=\"不使用增产剂\">\n";
            str += "<option value=\"4\" label=\"接收站透镜喷涂\">\n";
            str += "</datalist>\n";
            document.getElementById("pro_mode_list").innerHTML = str;
        }//初始化可选增产模式列表

        function init_factory_list() {
            var str = ""; 3
            for (var factory in game_data["factory_data"]) {
                str += "<datalist id=\"" + factory + "_list\">";
                for (var building in game_data["factory_data"][factory]) {
                    str += "<option value=\"" + building +
                        "\" label=\"" + game_data["factory_data"][factory][building]["名称"] + "\">";
                }
                str += "</datalist>\n";
            }
            document.getElementById("factory_list").innerHTML = str;
        }//初始化建筑列表

        function init_recipe_list() {
            var str = "";
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                str += "<option value=\"" + i + "\" label=\"" + recipe_to_html(game_data.recipe_data[i]) + "\">";
            }
            document.getElementById("recipe_list").innerHTML = str;
        }//初始化配方选取列表

        function get_item_data() {
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
        }//初始化载入物品信息

        function init_pro_proliferator(proliferate_itself) {
            var proliferator_price = [];
            proliferator_price.push({});
            for (var i = 1; i < game_data.proliferate_effect.length; i++) {
                proliferator_price.push(-1);
            }
            for (var i in game_data.proliferator_data) {
                if (game_data.proliferator_data[i]["单次喷涂最高增产点数"] != 0) {
                    proliferator_price[game_data.proliferator_data[i]["单次喷涂最高增产点数"]] = {};
                    if (proliferate_itself) {
                        proliferator_price[game_data.proliferator_data[i]["单次喷涂最高增产点数"]][i]
                            = 1 / (game_data.proliferator_data[i]["喷涂次数"] *
                                game_data.proliferate_effect[game_data.proliferator_data[i]["单次喷涂最高增产点数"]]["增产效果"] - 1);
                    }
                    else {
                        proliferator_price[game_data.proliferator_data[i]["单次喷涂最高增产点数"]][i]
                            = 1 / game_data.proliferator_data[i]["喷涂次数"];
                    }
                }
            }
            return proliferator_price;
        }//初始化单次各个等级的喷涂效果的成本（默认选用全自喷涂）

        function init_scheme_data() {
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
        }//初始化配方选取
    }//初始化相关
    {
        function show_needs_list() {
            var str = "需求列表：<br />";
            for (var i in needs_list) {
                str += i + ":<input type=\"text\" size=\"6\" value=\"" + needs_list[i] + "\" " + "id=\"needs_of_" + i + "\" onchange=\"changeNeeds('" + i + "')\">个/min"
                    + "<button id=\"" + i + "需求" + "\" onclick=\"resetNeeds('" + i + "')\">清空需求</button><br />";
            }
            document.getElementById("totalNeeds").innerHTML = str;
        }//展示需求列表

        function build_item_graph() {
            var item_graph = {};
            for (var item in item_data) {
                item_graph[item] = { "原料": {}, "可生产": {}, "产出倍率": 0, "副产物": {} };
            }
            for (var item in item_data) {
                if (item in mineralize_list) {
                    item_graph[item]["产出倍率"] = 100000000 ** ( fixed_num + 1 );
                    continue;
                }
                var recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
                item_graph[item]["产出倍率"] = 1 * game_data.recipe_data[recipe_id]["产物"][item];
                var produce_rate = 1;//净产出一个目标产物时公式的执行次数，用于考虑增产等对原料消耗的影响
                var material_num = 0;
                var total_material_num = 0;
                var proliferate_mode = scheme_data.scheme_for_recipe[recipe_id]["增产模式"];
                var proliferate_num = scheme_data.scheme_for_recipe[recipe_id]["喷涂点数"];
                for (var material in game_data.recipe_data[recipe_id]["原料"]) {
                    material_num = game_data.recipe_data[recipe_id]["原料"][material] / game_data.recipe_data[recipe_id]["产物"][item];
                    item_graph[item]["原料"][material] = material_num;
                    total_material_num += material_num;
                }
                if (proliferate_mode && proliferate_num) {//如果有用增产剂且有增产效果
                    if (proliferate_mode == 1) {
                        for (var proliferate in proliferator_price[proliferate_num]) {
                            if (proliferate in item_graph[item]["原料"]) {
                                item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                            }
                            else {
                                item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                            }
                        }
                        produce_rate *= game_data.proliferate_effect[proliferate_num]["增产效果"];
                        item_graph[item]["产出倍率"] *= produce_rate;
                    }
                    else if (proliferate_mode == 2) {
                        for (var proliferate in proliferator_price[proliferate_num]) {
                            if (proliferate in item_graph[item]["原料"]) {
                                item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                            }
                            else {
                                item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                            }
                        }
                        item_graph[item]["产出倍率"] *= game_data.proliferate_effect[proliferate_num]["加速效果"];
                    }
                    else if (proliferate_mode == 4) {
                        for (var proliferate in proliferator_price[proliferate_num]) {
                            if (proliferate in item_graph[item]["原料"]) {
                                item_graph[item]["原料"][proliferate] += total_material_num * proliferator_price[proliferate_num][proliferate];
                            }
                            else {
                                item_graph[item]["原料"][proliferate] = total_material_num * proliferator_price[proliferate_num][proliferate];
                            }
                        }
                        produce_rate *= game_data.proliferate_effect[proliferate_num]["加速效果"];
                        item_graph[item]["产出倍率"] *= produce_rate;
                    }//接收站透镜喷涂效果，按加速效果计算额外产出
                }//计算增产剂效果带来的变化
                for (var material in item_graph[item]["原料"]) {
                    item_graph[item]["原料"][material] /= produce_rate;
                }
                item_graph[item]["产出倍率"] /= game_data.recipe_data[recipe_id]["时间"];
                if (item in item_graph[item]["原料"]) {
                    var self_used = 1 / (1 - item_graph[item]["原料"][item]);
                    item_graph[item]["产出倍率"] /= self_used;
                    item_graph[item]["自消耗"] = self_used - 1;
                    delete item_graph[item]["原料"][item];
                    for (var material in item_graph[item]["原料"]) {
                        item_graph[item]["原料"][material] *= self_used;
                    }
                }
                for (var material in item_graph[item]["原料"]) {
                    item_graph[material]["可生产"][item] = 1 / item_graph[item]["原料"][material];
                }
                if (Object.keys(game_data.recipe_data[recipe_id]["产物"]).length > 1) {
                    var self_cost = 0;
                    if ("自消耗" in item_graph[item]) {
                        self_cost = item_graph[item]["自消耗"];
                    }
                    for (var product in game_data.recipe_data[recipe_id]["产物"]) {
                        if (product != item) {
                            if (product in item_graph[item]["原料"]) {
                                if (Math.min(game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost), item_graph[item]["原料"][product]) == item_graph[item]["原料"][product]) {
                                    item_graph[item]["副产物"][product] = game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost) - item_graph[item]["原料"][product];
                                    item_graph[item]["原料"][product] = 0;
                                    if (product in side_item_dict) {
                                        side_item_dict[product][item] = 0;
                                    }
                                    else {
                                        side_item_dict[product] = {};
                                        side_item_dict[product][item] = 0;
                                    }
                                    if (product in multi_sources) {
                                        multi_sources[product].push(item);
                                    }
                                    else {
                                        multi_sources[product] = [item];
                                    }
                                }
                                else {
                                    item_graph[item]["原料"][product] -= game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost);
                                }
                            }
                            else {
                                item_graph[item]["副产物"][product] = game_data.recipe_data[recipe_id]["产物"][product] / (game_data.recipe_data[recipe_id]["产物"][item] - self_cost);
                                if (product in side_item_dict) {
                                    side_item_dict[product][item] = 0;
                                }
                                else {
                                    side_item_dict[product] = {};
                                    side_item_dict[product][item] = 0;
                                }
                                if (product in multi_sources) {
                                    multi_sources[product].push(item);
                                }
                                else {
                                    multi_sources[product] = [item];
                                }
                            }
                        }
                    }
                }//此配方有自身无法消耗的副产物时
                var factory_type = game_data.recipe_data[recipe_id]['设施'];
                var building_info = game_data.factory_data[factory_type][scheme_data.scheme_for_recipe[recipe_id]["建筑"]];
                if (factory_type == "采矿设备" || factory_type == "抽水设备" || factory_type == "抽油设备" || factory_type == "巨星采集") {
                    item_graph[item]["产出倍率"] *= scheme_data.mining_rate["科技面板倍率"];
                    if (building_info["名称"] == "采矿机") {
                        item_graph[item]["产出倍率"] *= scheme_data.mining_rate["小矿机覆盖矿脉数"];
                    }
                    else if (building_info["名称"] == "大型采矿机") {
                        item_graph[item]["产出倍率"] *= (scheme_data.mining_rate["大矿机覆盖矿脉数"] * scheme_data.mining_rate["大矿机工作倍率"]);
                    }
                    else if (building_info["名称"] == "原油萃取站") {
                        item_graph[item]["产出倍率"] *= scheme_data.mining_rate["油井期望面板"];
                    }
                    else if (building_info["名称"] == "轨道采集器") {
                        if (item == "氢") {
                            item_graph[item]["产出倍率"] *= scheme_data.mining_rate["巨星氢面板"];
                        }
                        else if (item == "重氢") {
                            item_graph[item]["产出倍率"] *= scheme_data.mining_rate["巨星重氢面板"];
                        }
                        else if (item == "可燃冰") {
                            item_graph[item]["产出倍率"] *= scheme_data.mining_rate["巨星可燃冰面板"];
                        }
                    }
                }//采矿设备需算上科技加成
                else if (factory_type == "分馏设备") {
                    if (building_info["名称"] == "分馏塔") {
                        item_graph[item]["产出倍率"] *= scheme_data.fractionating_speed / 60;
                    }
                }
                else if (factory_type == "轻型工业机甲") {
                    if (building_info["名称"] == "伊卡洛斯") {
                        item_graph[item]["产出倍率"] *= scheme_data.mining_rate["伊卡洛斯手速"];
                    }
                }//毫无意义，只是我想这么干
            }
            return item_graph;
        }//根据配方设定完善产物关系图与多来源产物表

        function change_result_row_for_item(item) {
            var recipe_for_select = document.getElementById("recipe_for_" + item);
            var pro_num_list = document.getElementById("pro_num_list");
            var pro_num_for_select = document.getElementById("pro_num_for_" + item);
            var pro_mode_select = document.getElementById("pro_mode_for_" + item);
            var factory_select = document.getElementById("factory_for_" + item);
            var recipe_list = document.getElementById("recipe_list").options;
            recipe_for_select.innerHTML = "";
            pro_num_for_select.innerHTML = "";
            pro_mode_select.innerHTML = "";
            factory_select.innerHTML = "";
            for (var i = 1; i < item_data[item].length; i++) {
                var option = document.createElement("option");
                option.value = i;
                option.label = recipe_list[item_data[item][i]].label;
                if (scheme_data.item_recipe_choices[item] == i) {
                    option.selected = "selected";
                }
                recipe_for_select.options.add(option);
            }
            var recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
            for (var i = 0; i < pro_num_list.options.length; i++) {
                var option = document.createElement("option");
                option.value = pro_num_list.options[i].value;
                option.label = pro_num_list.options[i].value;
                if (scheme_data.scheme_for_recipe[recipe_id]["喷涂点数"] == option.value) {
                    option.selected = "selected";
                }
                pro_num_for_select.options.add(option);
            }
            var pro_mode_list = document.getElementById("增产模式" + game_data.recipe_data[recipe_id]["增产"]);
            for (var i = 0; i < pro_mode_list.options.length; i++) {
                var option = document.createElement("option");
                option.value = pro_mode_list.options[i].value;
                option.label = pro_mode_list.options[i].label;
                if (scheme_data.scheme_for_recipe[recipe_id]["增产模式"] == option.value) {
                    option.selected = "selected";
                }
                pro_mode_select.options.add(option);
            }
            var factory_list = document.getElementById(game_data.recipe_data[recipe_id]["设施"] + "_list");
            for (var i = 0; i < factory_list.options.length; i++) {
                var option = document.createElement("option");
                option.value = factory_list.options[i].value;
                option.label = factory_list.options[i].label;
                if (scheme_data.scheme_for_recipe[recipe_id]["建筑"] == option.value) {
                    option.selected = "selected";
                }
                factory_select.options.add(option);
            }
        }//根据物品当前生产策略调整输出栏

        function show_result_dict() {
            var str = "";
            energy_cost = 0;
            building_list = {};
            function get_factory_number(amount, item) {
                var recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
                var scheme_for_recipe = scheme_data.scheme_for_recipe[recipe_id];
                var factory_per_yield = 1 / item_graph[item]["产出倍率"] / game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["倍率"];
                var offset = 0;
                offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
                var build_number = amount / 60 * factory_per_yield + offset;
                if (Math.ceil(build_number - 0.5 * 0.1 ** fixed_num) != 0) {
                    if (game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"] in building_list) {
                        building_list[game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"]] = Number(building_list[game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"]]) + Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
                    }
                    else {
                        building_list[game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"]] = Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
                    }
                }game_data.factory_data[""]
                var factory = game_data.recipe_data[recipe_id]["设施"];
                if (factory != "巨星采集" && !(!scheme_data.energy_contain_miner && (factory == "采矿设备" || factory == "抽水设备" || factory == "抽油设备"))) {
                    var e_cost = build_number * game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["耗能"];
                    if (game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_for_recipe["建筑"]]["名称"] == "大型采矿机"){
                        e_cost = scheme_data.mining_rate["大矿机工作倍率"] * scheme_data.mining_rate["大矿机工作倍率"] * (2.94-0.168) + 0.168;
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
            function add_side_products_in_other_row(item) {
                var item_num = result_dict[item];
                for (var side_products in item_graph[item]["副产物"]) {
                    document.getElementById("num_of_" + side_products).insertAdjacentHTML("beforeend", "<br>+" + (item_num * item_graph[item]["副产物"][side_products]) + "(来自" + item + ")");
                    total_item_dict[side_products] += item_num * item_graph[item]["副产物"][side_products];
                }
            }
            for (var i in result_dict) {
                var recipe_id = item_data[i][scheme_data.item_recipe_choices[i]];
                var factory_number = get_factory_number(result_dict[i], i).toFixed(fixed_num);
                var img_path = document.getElementById("gameData" ).value + "/";
                str += "<tr id=\"row_of_" + i + "\"><th><a href=\"Javascript:mineralize('" + i + "')\">视为原矿</a></th>" + //操作
                    "<th>" + "<img src=\"./image/" + img_path + i + ".png\" title=\"" + i + "\" style=\"width: 40px; height: 40px;\">" + "</th>" +  //目标物品
                    "<th id=\"num_of_" + i + "\">" + get_gross_output(result_dict[i], i).toFixed(fixed_num) + "</th>" +  //分钟毛产出
                    "<th><p id=\"factory_counts_of_" + i + "\" value=\"" + factory_number + "\">" + game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"] +
                    " * " + factory_number + is_mineralized(i) + "</p></th>" +  //所需工厂*数目
                    "<th><select id=\"recipe_for_" + i + "\" onChange=\"ChangeRecipeOf('" + i + "')\"></select></th>" + // 所选配方
                    "<th><select id=\"pro_num_for_" + i + "\" onChange=\"ChangeSchemeOf('" + i + "')\"></select></th>" + //所选增产剂
                    "<th><select id=\"pro_mode_for_" + i + "\" onChange=\"ChangeSchemeOf('" + i + "')\"></select></th>" + //所选增产模式
                    "<th><select id=\"factory_for_" + i + "\" onChange=\"ChangeSchemeOf('" + i + "')\"></select></th></tr>";//所选工厂种类
            }
            document.getElementById("result").innerHTML = str;
            var total_item_dict = JSON.parse(JSON.stringify(result_dict));
            for (var i in result_dict) {
                change_result_row_for_item(i);
                add_side_products_in_other_row(i);
            }
            for (var i in total_item_dict) {
                if (total_item_dict[i] < 1e-6) {
                    document.getElementById("row_of_" + i).remove();
                }
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
                if (recipe["设施"] != "巨星采集" && !(!scheme_data.energy_contain_miner && (recipe["设施"] == "采矿设备" || recipe["设施"] == "抽水设备" || recipe["设施"] == "抽油设备"))){
                    var e_cost = natural_production_line[NPId]["建筑数量"] * building["耗能"];
                    if (natural_production_line[NPId]["喷涂点数"] != 0 && natural_production_line[NPId]["增产模式"] != 0) {
                        e_cost *= game_data.proliferate_effect[natural_production_line[NPId]["喷涂点数"]]["耗电倍率"];
                    }
                    energy_cost = Number(energy_cost) + e_cost;
                }
            }
            var building_str = "";
            for (var building in building_list) {
                building_str += building + ":" + building_list[building] + "</br>";
            }
            document.getElementById("建筑统计").innerHTML = building_str;
            document.getElementById("耗电统计").innerHTML = "预估电力需求下限：" + energy_cost + " MW" + if_energy_contain_miner();
            function if_energy_contain_miner(){
                if(scheme_data.energy_contain_miner){
                    return "<button onclick=\"IfEnergyContainMiner()\">忽视采集设备耗电</button>";
                }
                else{
                    return "<button onclick=\"IfEnergyContainMiner()\">考虑采集设备耗电</button>";
                }
            }
        }//展示结果

        function recipe_to_html(recipe) {
            var str = "";
            var num = 0;
            for (var material in recipe["原料"]) {
                if (num != 0) {
                    str += " + ";
                }
                str += recipe["原料"][material] + " * " + material;
                num += 1;
            }
            if (num != 0) {
                str += "→";
            }
            num = 0;
            for (var products in recipe["产物"]) {
                if (num != 0) {
                    str += " + ";
                }
                str += recipe["产物"][products] + " * " + products;
                num += 1;
            }
            str += "    耗时:" + recipe["时间"] + "s";
            return str;
        }//配方选项的展示格式，有空把它换成图形界面

        function build_item_list() {
            function delete_item_from_product_graph(name) {
                for (item in product_graph[name]["原料"]) {
                    delete product_graph[item]["可生产"][name];
                }
                for (item in product_graph[name]["可生产"]) {
                    delete product_graph[item]["原料"][name];
                }
                delete product_graph[name];
            }
            function find_item(name, isProduction, P_item_list) {
                if (!isProduction) {
                    if (product_graph[name] && Object.keys(product_graph[name]["原料"]).length == 0) {
                        var production = product_graph[name]["可生产"];
                        delete_item_from_product_graph(name);
                        item_list[P_item_list[0]] = name;
                        item_data[name][0] = P_item_list[0];
                        P_item_list[0] += 1;
                        for (item in production) {
                            P_item_list = find_item(item, 0, P_item_list);
                        }
                    }
                }
                else {
                    if (product_graph[name] && Object.keys(product_graph[name]["可生产"]).length == 0) {
                        var material = product_graph[name]["原料"];
                        delete_item_from_product_graph(name);
                        item_list[P_item_list[1]] = name;
                        item_data[name][0] = P_item_list[1];
                        P_item_list[1] -= 1;
                        for (item in material) {
                            P_item_list = find_item(item, 1, P_item_list);
                        }
                    }
                }//函数find_item用于迭代寻找产物关系图中的出度或入度为0的点，并将其从关系图中删去，存入物品列表中
                return P_item_list;
            }
            var product_graph = JSON.parse(JSON.stringify(item_graph));
            item_list = [];
            key_item_list = [];
            var P_item_list = [0, Object.keys(product_graph).length - 1];
            while (1) {
                for (var this_item in product_graph) {
                    if (this_item in product_graph) {
                        if (Object.keys(product_graph[this_item]["原料"]).length == 0) {
                            P_item_list = find_item(this_item, 0, P_item_list);
                        }
                        else if (Object.keys(product_graph[this_item]["可生产"]).length == 0) {
                            P_item_list = find_item(this_item, 1, P_item_list);
                        }
                    }
                }
                if (Object.keys(product_graph).length <= 0) break;
                var key_item = { "name": -1, "count": 1 };//记录关键物品的名字与出入度只和的最大值
                var count;
                for (var this_item in product_graph) {
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
            return item_list
        }//根据物品关系图生成物品列表，物品列表在将关键产物原矿化的情况下某物品的左侧的物品必不可能是其下游产物，右侧的物品必不可能是其上游产物，从做往右迭代一次就是将整个生产线从上游往下游迭代一次

        function get_item_cost(item) {
            var cost = 0.0;
            if (scheme_data.cost_weight["物品额外成本"][item]["启用"]) {
                cost = Number(cost) + scheme_data.cost_weight["物品额外成本"][item]["成本"];
                if (!scheme_data.cost_weight["物品额外成本"][item]["与其它成本累计"]) {
                    return cost;
                }
            }
            var recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
            var building_info = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]];
            var building_count_per_yield = 1 / item_graph[item]["产出倍率"] / building_info["倍率"];
            var layer_count = 1;
            if (building_info["名称"] in stackable_buildings) {
                layer_count = stackable_buildings[building_info["名称"]];
            }
            cost = Number(cost) + building_count_per_yield * scheme_data.cost_weight["占地"] * building_info["占地"] / layer_count;//计算占地造成的成本=单位产能建筑数*占地成本权重*建筑占地
            cost = Number(cost) + building_count_per_yield * scheme_data.cost_weight["电力"] * building_info["耗能"] * game_data.proliferate_effect[scheme_data.scheme_for_recipe[recipe_id]["喷涂点数"]]["耗电倍率"];
            //计算耗电造成的成本 = 单位产能建筑数 * 耗电成本权重 * 建筑耗电 * 喷涂影响
            cost = Number(cost) + building_count_per_yield * (0 * scheme_data.cost_weight["建筑成本"]["分拣器"] / layer_count + scheme_data.cost_weight["建筑成本"][building_info["名称"]]);
            //建筑产生的成本 = 单位产能建筑数*(每个结构中分拣器数量*分拣器成本 + 生产建筑成本)，分拣器成本那块，说是分拣器，但实际上可以是任何一个针对各种配方独立成本的系数
            return cost;
        }//计算一个物品的成本，用于各种各样的线性规划

        function get_item_price() {
            var p_key_item = 0;
            var item_price = {};
            function count_total_material(dict, material, num) {
                if (material in dict) {
                    dict[material] = Number(dict[material]) + num;
                }
                else {
                    dict[material] = num;
                }
                for (var sub_material in item_price[material]["原料"]) {
                    if (sub_material in dict) {
                        dict[sub_material] = Number(dict[sub_material]) + item_price[material]["原料"][sub_material] * num;
                    }
                    else {
                        dict[sub_material] = item_price[material]["原料"][sub_material] * num;
                    }
                }
                return dict;
            }
            for (var i = 0; i < item_list.length; i++) {
                if (p_key_item < key_item_list.length && item_list[i] == key_item_list[p_key_item]) {
                    item_price[item_list[i]] = { "原料": {}, "成本": 0 };
                    ++p_key_item;
                }
                else if ((item_list[i] in multi_sources) || (item_list[i] in external_supply_item)) {
                    item_price[item_list[i]] = { "原料": {}, "成本": 0 };
                }
                else {
                    item_price[item_list[i]] = { "原料": {}, "成本": get_item_cost(item_list[i]) };
                    for (var material in item_graph[item_list[i]]["原料"]) {
                        item_price[item_list[i]]["原料"] = count_total_material(item_price[item_list[i]]["原料"], material, item_graph[item_list[i]]["原料"][material]);
                    }
                    if (!scheme_data.cost_weight["物品额外成本"][item_list[i]]["与其它成本累计"]) {
                        for (var material in item_graph[item_list[i]]["原料"]) {
                            item_price[item_list[i]]["成本"] = Number(item_price[item_list[i]]["成本"]) + item_graph[item_list[i]]["原料"][material] * item_price[material]["成本"];
                        }
                    }
                }
            }
            return item_price;
        }//取得每一个物品的历史产出

        function show_mineralize_list() {
            if (Object.keys(mineralize_list).length > 0) {
                var str = "原矿化：";
                for (var item in mineralize_list) {
                    str += "<th><button onclick=\"unmineralize('" + item + "')\">" + item + "</button></th></tr>";
                }
                document.getElementById("原矿化列表").innerHTML = str;
            }
            else {
                document.getElementById("原矿化列表").innerHTML = "";
            }
        }//显示原矿化列表

        function show_surplus_list() {
            var str = "";
            for (var i in lp_surplus_list) {
                str +=
                    "<tr><th>" + i + "</th>" +  //目标物品
                    "<th>" + lp_surplus_list[i] + "</th></tr>"; //分钟冗余
            }
            document.getElementById("surplus_list").innerHTML = str;
        }//显示多余产出

        function mineralize(item) {
            mineralize_list[item] = JSON.parse(JSON.stringify(item_graph[item]));
            item_graph[item]["原料"] = {};
            show_mineralize_list();
            calculate();
        }//原矿化物品

        function unmineralize(item) {
            item_graph[item] = JSON.parse(JSON.stringify(mineralize_list[item]));
            delete mineralize_list[item];
            show_mineralize_list();
            calculate();
        }//取消原矿化

        function get_linear_programming_list() {
            var model = {
                optimize: 'cost',
                opType: 'min',
                constraints: {},
                variables: {}
            }//创建求解模型
            for (var item in lp_item_dict) {
                model.constraints["i" + item] = { min: lp_item_dict[item] };
                model.variables[item] = { cost: get_item_cost(item) };
                for (var other_item in lp_item_dict) {
                    model.variables[item]["i" + other_item] = 0.0;
                }
                model.variables[item]["i" + item] = 1.0;
                if ("副产物" in item_graph[item]) {
                    for (var sub_product in item_graph[item]["副产物"]) {
                        model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[item]["副产物"][sub_product];
                    }
                }
                for (var material in item_graph[item]["原料"]) {
                    if (!scheme_data.cost_weight["物品额外成本"][item]["与其它成本累计"]) {
                        model.variables[item].cost = Number(model.variables[item].cost) + item_graph[item]["原料"][material] * item_price[material]["成本"];//配方成本加上原料的成本
                    }
                    if (material in lp_item_dict) {
                        model.variables[item]["i" + material] = Number(model.variables[item]["i" + material]) - item_graph[item]["原料"][material];
                    }
                    if ("副产物" in item_graph[material] && !(material in lp_item_dict)) {//遍历原料时，如果原料时线规相关物品那么将其视作原矿，不考虑生产时的副产物
                        for (var sub_product in item_graph[material]["副产物"]) {
                            model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[material]["副产物"][sub_product] * item_graph[item]["原料"][material];
                        }
                    }
                    for (var sub_item in item_price[material]["原料"]) {
                        if (sub_item in lp_item_dict) {
                            model.variables[item]["i" + sub_item] = Number(model.variables[item]["i" + sub_item]) - item_price[material]["原料"][sub_item] * item_graph[item]["原料"][material];
                        }
                        if ("副产物" in item_graph[sub_item] && !(sub_item in lp_item_dict)) {//遍历原料时，如果原料是线规相关物品那么将其视作原矿，不考虑生产时的副产物
                            for (var sub_product in item_graph[sub_item]["副产物"]) {
                                model.variables[item]["i" + sub_product] = Number(model.variables[item]["i" + sub_product]) + item_graph[sub_item]["副产物"][sub_product] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_item];
                            }//否则生产这个配方时，其原料带来的必要副产物为：配方的此原料数*此原料成本中该物品的数量*单个该物品造成的副产物产出
                        }
                    }
                }
            }//完善求解器输入的模型
            // console.log(model);
            var results = solver.Solve(model);
            //求解线性规划，解得满足需求时每个item对应的item_graph的执行次数
            console.log(model);
            console.log(results);
            var lp_cost = 0;
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
            var lp_products = {};
            for (var item in model.constraints) {
                lp_products[item] = (-1) * model.constraints[item]["min"];
            }//记录多余物品，如果是缺失物品为负
            for (var recipe in results) {
                for (var item in model.variables[recipe]) {
                    if (item != "cost") {
                        lp_products[item] += model.variables[recipe][item] * results[recipe];
                    }
                }
            }//对线规结果执行相应配方增减相应物品
            for (var item in lp_products) {
                if (lp_products[item] > 1e-8) {//倘若最后物品仍有多余，则输出至多余物品表
                    lp_surplus_list[item.slice(1)] = lp_products[item];
                }
            }//多余物品计算
            for (var item in lp_item_dict) {
                result_dict[item] = 0;//将原矿化过的线规相关物品置为0，之后用线规结果的历史产出填补
            }
            for (var item in results) {
                result_dict[item] = Number(result_dict[item]) + results[item];
                for (var material in item_graph[item]["原料"]) {
                    if (!(material in lp_item_dict)) {
                        if (material in result_dict) {
                            result_dict[material] = Number(result_dict[material]) + results[item] * item_graph[item]["原料"][material];
                        }
                        else {
                            result_dict[material] = results[item] * item_graph[item]["原料"][material];
                        }
                        for (var sub_material in item_price[material]["原料"]) {
                            if (!(sub_material in lp_item_dict)) {
                                if (sub_material in result_dict) {
                                    result_dict[sub_material] = Number(result_dict[sub_material]) + results[item] * item_graph[item]["原料"][material] * item_price[material]["原料"][sub_material];
                                }
                                else {
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
        }//线性规划

    }//运行逻辑相关

    function calculate() { //主要计算逻辑
        multi_sources = {};
        result_dict = {};
        surplus_list = {};
        lp_surplus_list = {};
        external_supply_item = {};
        lp_item_dict = {};
        var in_out_list = {};
        for (var item in needs_list) {
            in_out_list[item] = needs_list[item];
        }//将需求目标添至计算的实际需求列表中
        for (var id in natural_production_line) {
            var recipe = game_data.recipe_data[item_data[natural_production_line[id]["目标物品"]][natural_production_line[id]["配方id"]]];
            var recipe_time = 60 * natural_production_line[id]["建筑数量"] * game_data.factory_data[recipe["设施"]][natural_production_line[id]["建筑"]]["倍率"] / recipe["时间"];
            if ((natural_production_line[id]["喷涂点数"] == 0) || (natural_production_line[id]["增产模式"] == 0)) {
                for (var item in recipe["原料"]) {
                    if (item in in_out_list) {
                        in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time;
                    }
                    else {
                        in_out_list[item] = recipe["原料"][item] * recipe_time;
                    }
                }
                for (var item in recipe["产物"]) {
                    if (item in in_out_list) {
                        in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time;
                    }
                    else {
                        in_out_list[item] = -1 * recipe["产物"][item] * recipe_time;
                    }
                }
            }
            else {
                var num = 0;//单次配方喷涂的物品量
                for (var item in recipe["原料"]) {
                    num += recipe["原料"][item];
                }
                num = Number(num) * recipe_time;
                if (natural_production_line[id]["增产模式"] == 1) {//增产
                    var pro_time = game_data.proliferate_effect[natural_production_line[id]["喷涂点数"]]["增产效果"];
                    for (var item in recipe["原料"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time;
                        }
                        else {
                            in_out_list[item] = recipe["原料"][item] * recipe_time;
                        }
                    }
                    for (var item in proliferator_price[natural_production_line[id]["喷涂点数"]]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + proliferator_price[natural_production_line[id]["喷涂点数"]][item] * num;
                        }
                        else {
                            in_out_list[item] = proliferator_price[natural_production_line[id]["喷涂点数"]][item] * num;
                        }
                    }
                    for (var item in recipe["产物"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time * pro_time;
                        }
                        else {
                            in_out_list[item] = -1 * recipe["产物"][item] * recipe_time * pro_time;
                        }
                    }
                }
                else if (natural_production_line[id]["增产模式"] == 2) {//加速
                    var pro_time = game_data.proliferate_effect[natural_production_line[id]["喷涂点数"]]["加速效果"];
                    for (var item in recipe["原料"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time * pro_time;
                        }
                        else {
                            in_out_list[item] = recipe["原料"][item] * recipe_time * pro_time;
                        }
                    }
                    for (var item in proliferator_price[natural_production_line[id]["喷涂点数"]]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + proliferator_price[natural_production_line[id]["喷涂点数"]][item] * num * pro_time;
                        }
                        else {
                            in_out_list[item] = proliferator_price[natural_production_line[id]["喷涂点数"]][item] * num * pro_time;
                        }
                    }
                    for (var item in recipe["产物"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time * pro_time;
                        }
                        else {
                            in_out_list[item] = -1 * recipe["产物"][item] * recipe_time * pro_time;
                        }
                    }
                }
                else if (natural_production_line[id]["增产模式"] == 4) {
                    var pro_time = game_data.proliferate_effect[natural_production_line[id]["喷涂点数"]]["加速效果"];
                    for (var item in recipe["原料"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + recipe["原料"][item] * recipe_time;
                        }
                        else {
                            in_out_list[item] = recipe["原料"][item] * recipe_time;
                        }
                    }
                    for (var item in proliferator_price[natural_production_line[id]["喷涂点数"]]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) + proliferator_price[natural_production_line[id]["喷涂点数"]][item] * num;
                        }
                        else {
                            in_out_list[item] = proliferator_price[natural_production_line[id]["喷涂点数"]][item] * num;
                        }
                    }
                    for (var item in recipe["产物"]) {
                        if (item in in_out_list) {
                            in_out_list[item] = Number(in_out_list[item]) - recipe["产物"][item] * recipe_time * pro_time;
                        }
                        else {
                            in_out_list[item] = -1 * recipe["产物"][item] * recipe_time * pro_time;
                        }
                    }
                }
            }
        }//将固有产线的输入输出添至计算的实际需求列表中
        for (var item in in_out_list) {
            if (in_out_list[item] < 0) {
                external_supply_item[item] = in_out_list[item];
            }
        }//将实际需求列表中小于0的部分看做外部输入
        item_graph = build_item_graph();
        build_item_list();
        item_price = get_item_price();
        for (var item in in_out_list) {
            if (in_out_list[item] > 0) {
                if (item in result_dict) {
                    result_dict[item] = Number(result_dict[item]) + in_out_list[item];
                }
                else {
                    result_dict[item] = in_out_list[item];
                }
                if (item_graph[item]["副产物"] && !(item in multi_sources) && !(item in key_item_list)) {//如果是线性规划相关物品的副产物因为这边是原矿化的所以不应考虑其副产物
                    for (var other_products in item_graph[item]["副产物"]) {
                        if (other_products in surplus_list) {
                            surplus_list[other_products] = Number(surplus_list[other_products]) + item_graph[item]["副产物"][other_products] * in_out_list[item];
                        }
                        else {
                            surplus_list[other_products] = item_graph[item]["副产物"][other_products] * in_out_list[item];
                        }
                    }
                }
                for (var material in item_price[item]["原料"]) {
                    if (material in result_dict) {
                        result_dict[material] = Number(result_dict[material]) + item_price[item]["原料"][material] * in_out_list[item];
                    }
                    else {
                        result_dict[material] = item_price[item]["原料"][material] * in_out_list[item];
                    }
                    if (item_graph[material]["副产物"] && !(material in multi_sources) && !(material in key_item_list)) {
                        for (var other_products in item_graph[material]["副产物"]) {
                            if (other_products in surplus_list) {
                                surplus_list[other_products] = Number(surplus_list[other_products]) + item_graph[material]["副产物"][other_products] * item_price[item]["原料"][material] * in_out_list[item];
                            }
                            else {
                                surplus_list[other_products] = item_graph[material]["副产物"][other_products] * item_price[item]["原料"][material] * in_out_list[item];
                            }
                        }
                    }
                }
            }
        }//遍历物品的item_price降可迭代物品的生产结果和副产物产出结果放入输出结果内
        for (var item in multi_sources) {
            if (item in result_dict) {
                if (item in surplus_list) {
                    lp_item_dict[item] = result_dict[item] - surplus_list[item];
                }
                else {
                    lp_item_dict[item] = result_dict[item];
                }
            }
            else {
                if (item in surplus_list) {
                    lp_item_dict[item] = -surplus_list[item];
                }
                else {
                    lp_item_dict[item] = 0;
                }
            }
        }//将多来源配方物品的总需求与总富余相减后放入线性规划相关物品表
        for (var item in external_supply_item) {
            if (!(item in multi_sources)) {
                if (item in result_dict) {
                    lp_item_dict[item] = result_dict[item] + in_out_list[item];
                }
                else {
                    lp_item_dict[item] = in_out_list[item];
                }
            }
            else {
                lp_item_dict[item] = Number(lp_item_dict[item]) + in_out_list[item];
            }
        }//将定量外部供应的物品放入线性规划相关物品表
        for (var item in key_item_list) {
            if (!(key_item_list[item] in multi_sources) && !(key_item_list[item] in external_supply_item)) {
                if ([key_item_list[item]] in result_dict) {
                    lp_item_dict[key_item_list[item]] = result_dict[key_item_list[item]];
                }
                else {
                    lp_item_dict[key_item_list[item]] = 0;
                }
            }
        }//将循环关键物品的总需求放入线性规划相关物品表
        var lp_cost = get_linear_programming_list();//线规最终目标函数成本，在考虑要不要显示
        show_result_dict();
        show_surplus_list();
    }//计算主要逻辑框架

}//这里是script内部调用用到的主要逻辑需要的函数


{//初始化以及主要逻辑
    var needs_list = {};//物品需求列表
    var natural_production_line = [];//固有产线的输入输出影响,格式为[0号产线{"目标物品","建筑数量","配方id","喷涂点数","增产模式","建筑"},...]
    var mineralize_list = {};//原矿化列表，代表忽视哪些物品的原料
    var stackable_buildings = { "研究站": 15 };
    var item_data = get_item_data(); {/*
    通过读取配方表得到配方中涉及的物品信息，item_data中的键名为物品名，
    键值为此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
*/}
    init_scheme_data(); //初始化物品的来源配方决策
    var proliferator_price = init_pro_proliferator(1); {/*
    代表0~10级增产点数的喷涂效果的成本列表
    如果为-1，则表示该等级的喷涂不可用
*/}
    var multi_sources = {};//初始化多来源物品表
    var lp_item_dict = {};//线性规划相关物品需求表
    var external_supply_item = {};//外部供应物品
    var side_item_dict = {};
    var surplus_list = {};
    var lp_surplus_list = {};
    var lp_item_dict = {};
    var item_graph = build_item_graph();//初始化产物关系图
    var result_dict = {};
    var fixed_num = 2;
    var key_item_list = [];
    var item_list = [];
    var item_price = {};
    var building_list = {};
    var energy_cost = 0;
    build_item_list();
    item_price = get_item_price();
}//主要逻辑
