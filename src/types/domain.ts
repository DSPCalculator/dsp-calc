export type ItemName = string;
export type NumericMap = Record<string, number>;
export type BooleanMap = Record<string, boolean>;

export interface FractionateOutput {
    物品: ItemName;
    数量: number;
    概率: number;
}

export interface FactoryInfo {
    名称: string;
    耗能: number;
    倍率: number;
    占地: number;
}

export interface RecipeData {
    名称: string;
    原料: NumericMap;
    产物: NumericMap;
    设施: number;
    时间: number;
    增产: number;
    模型?: 'normal' | 'fractionate_raw';
    成功率?: number;
    损毁率?: number;
    原料保留率?: number;
    产物翻倍率?: number;
    主产物?: FractionateOutput[];
    副产物?: FractionateOutput[];
    建筑名称?: string;
    建筑倍率?: number;
}

export interface ProliferatorEffect {
    增产效果: number;
    加速效果: number;
    耗电倍率: number;
}

export interface ProliferatorData extends ProliferatorEffect {
    名称: string;
    增产剂: string | number;
    喷涂次数: number;
    增产点数: number;
}

export interface GameDataInfo {
    name_en: string;
    name_cn: string;
    version: string;
}

export interface ModOption {
    value: string;
    label: string;
}

export interface GameData {
    MoreMegaStructureEnable: boolean;
    TheyComeFromVoidEnable: boolean;
    GenesisBookEnable: boolean;
    OrbitalRingEnable: boolean;
    FractionateEverythingEnable: boolean;
    mod_name_list: string[];
    mod_guid_list: string[];
    game_name: string;
    item_grid: NumericMap;
    item_grid_index_valid: BooleanMap;
    item_icon_name: Record<string, string>;
    recipe_data: RecipeData[];
    factory_data: FactoryInfo[][];
    proliferator_data: ProliferatorData[];
    proliferator_effect: ProliferatorEffect[];
}

export type ItemDataIndex = Record<string, number[]>;

export interface IconGridEntry {
    col: number;
    row: number;
    item: ItemName;
}

export interface IconGrid {
    nrow: number;
    ncol: number;
    icons: IconGridEntry[];
}

export interface NaturalProductionLineRow {
    目标物品: ItemName;
    目标产量?: number;
    配方id: number;
    建筑: number;
    增产点数: number;
    增产模式: number;
    建筑数量: number;
}

export type MineralizeList = Record<string, boolean> | string[];

export interface Settings {
    mining_speed_oil: number;
    mining_speed_water: number;
    mining_speed_deep_seated_lava: number;
    mining_speed_hydrogen: number;
    mining_speed_deuterium: number;
    mining_speed_gas_hydrate: number;
    mining_speed_helium: number;
    mining_speed_ammonia: number;
    mining_speed_nitrogen: number;
    mining_speed_oxygen: number;
    mining_speed_carbon_dioxide: number;
    mining_speed_sulfur_dioxide: number;
    mining_speed_methane: number;
    hide_mines: boolean;
    covered_veins_small: number;
    covered_veins_large: number;
    mining_efficiency_large: number;
    mining_speed_multiple: number;
    enemy_drop_multiple: number;
    icarus_manufacturing_speed: number;
    fractionating_speed: number;
    is_time_unit_minute: boolean;
    fixed_num: number;
    show_effective_recipe: boolean;
    stack_research_lab: number;
    proliferate_itself: boolean;
    acc_rate: number;
    inc_rate: number;
    blue_buff: boolean;
    mineralize_list: MineralizeList;
    natural_production_line: NaturalProductionLineRow[];
}

export interface RecipeScheme {
    建筑: number;
    增产点数: number;
    增产模式: number;
}

export interface ItemExtraCost {
    成本: number;
    额外成本?: number;
    启用: number;
    与其它成本累计: number;
    溢出时处理成本?: number;
}

export interface CostWeight {
    占地: number;
    电力: number;
    建筑成本: NumericMap;
    物品额外成本: Record<string, ItemExtraCost>;
}

export interface SchemeData {
    item_recipe_choices: NumericMap;
    scheme_for_recipe: RecipeScheme[];
    cost_weight: CostWeight;
}

export interface ItemGraphNode {
    原料: NumericMap;
    可生产: NumericMap;
    产出倍率: number;
    副产物: NumericMap;
    自消耗?: number;
}

export type ItemGraph = Record<string, ItemGraphNode>;
export type MultiSources = Record<string, ItemName[]>;

export interface ItemPriceEntry {
    原料: NumericMap;
    成本: number;
    累计成本: number;
}

export type ItemPrice = Record<string, ItemPriceEntry>;
export type ProliferatorPrice = Array<NumericMap | -1>;

export interface ResultRowSideProduct {
    from: ItemName;
    amount_text: string;
}

export interface ResultRowViewModel {
    item_name: ItemName;
    recipe_id: number;
    factory_number: number;
    from_side_products: ResultRowSideProduct[];
    factory_name: string;
    is_mineralized: boolean;
    row_class: string;
    proliferator_mode: number;
    proliferator_points: number;
    building_choice: number;
    recipe_choice: number;
}

export interface CalculationSnapshot {
    game_data: GameData;
    effective_game_data: GameData;
    item_data: ItemDataIndex;
    raw_scheme_data: SchemeData;
    scheme_data: SchemeData;
    settings: Settings;
    proliferator_price: ProliferatorPrice;
    item_graph: ItemGraph;
    multi_sources: MultiSources;
    item_list: ItemName[];
    key_item_list: ItemName[];
    item_price: ItemPrice;
    getEquivalentRecipe(recipe_id: number, target_item: ItemName, scheme_override?: Partial<RecipeScheme>): RecipeData;
    getEquivalentRecipeForItem(item: ItemName): RecipeData;
    getEquivalentRecipeForRecipe(item: ItemName, recipe_id: number, scheme_override?: Partial<RecipeScheme>): RecipeData;
    getEquivalentRecipeForNaturalLine(row: NaturalProductionLineRow): RecipeData;
    getItemCost(item: ItemName): number;
}

export interface GameInfoState {
    game_data: GameData;
    item_data: ItemDataIndex;
    all_target_items: ItemName[];
    icon_grid: IconGrid;
}

export interface GlobalStateLike extends CalculationSnapshot {
    snapshot: CalculationSnapshot;
    calculate(needs_list: NumericMap): [NumericMap, NumericMap];
    get_equivalent_recipe_for_item(item: ItemName): RecipeData;
    get_equivalent_recipe_for_recipe(item: ItemName, recipe_id: number, scheme_override?: Partial<RecipeScheme>): RecipeData;
    get_equivalent_recipe_for_natural_line(row: NaturalProductionLineRow): RecipeData;
}

export interface SolverModel {
    optimize: 'cost';
    opType: 'min';
    constraints: Record<string, {min: number}>;
    variables: Record<string, Record<string, number>>;
}

export interface SolverResults {
    [key: string]: number | boolean | undefined;
    result?: number;
    feasible?: boolean;
    bounded?: boolean;
    isIntegral?: boolean;
}

export interface RawFractionateOutputInfo {
    OutputID: number;
    OutputCount: number;
    SuccessRatio: number;
}

export interface RawItemData {
    ID: number;
    Name: string;
    GridIndex: number;
    IconName: string;
    WorkEnergyPerTick?: number;
    Speed?: number;
    Space?: number;
}

export interface RawRecipeData {
    Name: string;
    Items: number[];
    ItemCounts: number[];
    Results: number[];
    ResultCounts: number[];
    Factories: number[];
    TimeSpend: number;
    Proliferator: number;
    OutputMain?: RawFractionateOutputInfo[];
    OutputAppend?: RawFractionateOutputInfo[];
    FractionateSuccessRatio?: number;
    SuccessRatio?: number;
    FractionateDestroyRatio?: number;
    DestroyRatio?: number;
    RemainInputRatio?: number;
    DoubleOutputRatio?: number;
}

export interface RawGameDataFile {
    items: RawItemData[];
    recipes: RawRecipeData[];
}
