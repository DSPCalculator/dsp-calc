// Keep scenario inputs independent of UI components so they can also be run
// against the pristine pre-refactor commit by capture-solver-baseline.mjs.
export const baselineSettings = {
    mining_speed_oil: 3,
    mining_speed_hydrogen: 1,
    mining_speed_deuterium: 0.05,
    mining_speed_gas_hydrate: 0.8,
    mining_speed_helium: 0.02,
    mining_speed_ammonia: 0.3,
    mining_speed_nitrogen: 1.2,
    mining_speed_oxygen: 0.6,
    mining_speed_carbon_dioxide: 0.4,
    mining_speed_sulfur_dioxide: 0.6,
    hide_mines: false,
    covered_veins_small: 8,
    covered_veins_large: 16,
    mining_efficiency_large: 3,
    mining_speed_multiple: 1,
    enemy_drop_multiple: 1,
    icarus_manufacturing_speed: 1,
    fractionating_speed: 30,
    is_time_unit_minute: true,
    fixed_num: 2,
    stack_research_lab: 15,
    proliferate_itself: true,
    acc_rate: 1,
    inc_rate: 1,
    blue_buff: false,
    mineralize_list: [],
    natural_production_line: [],
};

const mega = 'Gnimaerd.DSP.plugin.MoreMegaStructure';
const voidMod = 'com.ckcz123.DSP_Battle';
const genesis = 'org.LoShin.GenesisBook';
const fractionate = 'com.menglei.dsp.FractionateEverything';

export const solverCases = [
    {name: 'vanilla iron 60 per minute', needs: {'铁块': 60}},
    {name: 'vanilla circuit 120 per minute', needs: {'电路板': 120}},
    {name: 'vanilla universe matrix 60 per minute', needs: {'宇宙矩阵': 60}},
    {name: 'vanilla alternate graphene recipe', needs: {'石墨烯': 120}, recipes: {'石墨烯': 2}},
    {name: 'vanilla mixed circuit and processor demand', needs: {'电路板': 120, '处理器': 60}},
    {name: 'vanilla external iron supply', needs: {'电路板': 120, '铁块': -60}},
    {name: 'vanilla mineralized iron', needs: {'电路板': 120}, settings: {mineralize_list: {'铁块': true}}},
    {name: 'vanilla faster assembler', needs: {'电路板': 120}, factories: {'电路板': '制造台 Mk.III'}},
    {name: 'vanilla mining settings', needs: {'铁块': 120}, settings: {mining_speed_multiple: 2, covered_veins_small: 12}},
    {name: 'vanilla extra-product proliferation', needs: {'电路板': 120}, proliferation: {'电路板': {增产点数: 4, 增产模式: 2}}},
    {name: 'vanilla speed proliferation without self spray', needs: {'电路板': 120}, proliferation: {'电路板': {增产点数: 4, 增产模式: 1}}, settings: {proliferate_itself: false}},
    {name: 'vanilla normalized proliferation points', needs: {'电路板': 120}, proliferation: {'电路板': {增产点数: 0, 增产模式: 2}}},
    {name: 'vanilla existing iron production line', needs: {'电路板': 120}, settings: {natural_production_line: [{目标物品: '铁块', 配方id: 1, 建筑: 0, 建筑数量: 1, 增产点数: 0, 增产模式: 0}]}},
    {name: 'vanilla proliferated existing line', needs: {'电路板': 120}, settings: {natural_production_line: [{目标物品: '铁块', 配方id: 1, 建筑: 0, 建筑数量: 1, 增产点数: 4, 增产模式: 2}]}},
    {name: 'vanilla display seconds preserves raw solver inputs', needs: {'电路板': 120}, settings: {is_time_unit_minute: false, fixed_num: 4}},
    {name: 'genesis universe matrix', mods: [genesis], needs: {'宇宙矩阵': 60}},
    {name: 'genesis circuit', mods: [genesis], needs: {'电路板': 120}},
    {name: 'more mega structures universe matrix', mods: [mega], needs: {'宇宙矩阵': 60}},
    {name: 'fractionate everything universe matrix', mods: [fractionate], needs: {'宇宙矩阵': 60}},
    {name: 'mega void blue buff circuit', mods: [mega, voidMod], needs: {'电路板': 120}, settings: {blue_buff: true}},
    {name: 'mega and void universe matrix', mods: [mega, voidMod], needs: {'宇宙矩阵': 60}},
    {name: 'mega and genesis universe matrix', mods: [mega, genesis], needs: {'宇宙矩阵': 60}},
    {name: 'mega and fractionate universe matrix', mods: [mega, fractionate], needs: {'宇宙矩阵': 60}},
    {name: 'genesis and fractionate universe matrix', mods: [genesis, fractionate], needs: {'宇宙矩阵': 60}},
    {name: 'mega void genesis universe matrix', mods: [mega, voidMod, genesis], needs: {'宇宙矩阵': 60}},
    {name: 'mega void fractionate universe matrix', mods: [mega, voidMod, fractionate], needs: {'宇宙矩阵': 60}},
    {name: 'mega genesis fractionate universe matrix', mods: [mega, genesis, fractionate], needs: {'宇宙矩阵': 60}},
    {name: 'all mods universe matrix', mods: [mega, voidMod, genesis, fractionate], needs: {'宇宙矩阵': 60}},
];

export function createScenario(api, scenario) {
    const game = api.get_game_data(scenario.mods || []);
    const info = new api.GameInfo(game);
    const scheme = api.init_scheme_data(game);
    const settings = structuredClone({...baselineSettings, ...scenario.settings});
    for (const [item, choice] of Object.entries(scenario.recipes || {})) {
        if (!info.item_data[item]?.[choice]) throw new Error(`Unknown recipe choice ${choice} for ${item}`);
        scheme.item_recipe_choices[item] = choice;
    }
    for (const [item, recipeSettings] of Object.entries(scenario.proliferation || {})) {
        const recipeId = info.item_data[item][scheme.item_recipe_choices[item]];
        Object.assign(scheme.scheme_for_recipe[recipeId], recipeSettings);
    }
    for (const [item, building] of Object.entries(scenario.factories || {})) {
        const recipeId = info.item_data[item][scheme.item_recipe_choices[item]];
        const factories = game.factory_data[game.recipe_data[recipeId].设施];
        const choice = factories.findIndex(factory => factory.名称.replace(/\s/g, ' ') === building);
        if (choice < 0) throw new Error(`Unknown factory ${building} for ${item}`);
        scheme.scheme_for_recipe[recipeId].建筑 = choice;
    }
    const state = new api.GlobalState(info, scheme, settings);
    return {state, scheme, settings};
}

export function calculateScenario(api, scenario) {
    const {state} = createScenario(api, scenario);
    const [production, surplus] = state.calculate(structuredClone(scenario.needs));
    const buildings = {};
    const outputPerSecond = {};
    for (const item of Object.keys(production).sort()) {
        const recipeId = state.item_data[item][state.scheme_data.item_recipe_choices[item]];
        const recipe = state.game_data.recipe_data[recipeId];
        const factory = state.game_data.factory_data[recipe.设施][state.scheme_data.scheme_for_recipe[recipeId].建筑];
        outputPerSecond[item] = state.item_graph[item].产出倍率 * factory.倍率;
        // Inputs in these fixtures are explicitly per minute; display settings
        // do not change the numerical solver's input contract.
        buildings[item] = production[item] / 60 / outputPerSecond[item];
    }
    return {production, surplus, outputPerSecond, buildings};
}
