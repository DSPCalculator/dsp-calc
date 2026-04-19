import type {BaseSettingRow, SettingRowGroup} from '@ui/types/ui';

export const RESOURCE_PANEL_GROUPS: SettingRowGroup[] = [
    {
        condition: () => true,
        rows: [
            {type: 'float', label: '原油井面板', key: 'mining_speed_oil', step: 0.10, min: 0.01, unit: '/s（单个井）'},
        ],
    },
    {
        condition: ({orbital_enabled}) => Boolean(orbital_enabled),
        rows: [
            {type: 'float', label: '水井面板', key: 'mining_speed_water', step: 0.10, min: 0.01, unit: '/s（单个井）'},
            {type: 'float', label: '深层熔岩井面板', key: 'mining_speed_deep_seated_lava', step: 0.10, min: 0.01, unit: '/s（单个井）'},
        ],
    },
    {
        condition: () => true,
        rows: [
            {type: 'float', label: '巨星氢面板', key: 'mining_speed_hydrogen', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
            {type: 'float', label: '巨星重氢面板', key: 'mining_speed_deuterium', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
        ],
    },
    {
        condition: ({orbital_enabled}) => !orbital_enabled,
        rows: [
            {type: 'float', label: '巨星可燃冰面板', key: 'mining_speed_gas_hydrate', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
        ],
    },
    {
        condition: ({genesis_enabled}) => Boolean(genesis_enabled),
        rows: [
            {type: 'float', label: '巨星氦面板', key: 'mining_speed_helium', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
            {type: 'float', label: '巨星氨面板', key: 'mining_speed_ammonia', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
            {type: 'float', label: '行星氮面板', key: 'mining_speed_nitrogen', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
            {type: 'float', label: '行星氧面板', key: 'mining_speed_oxygen', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
            {type: 'float', label: '行星二氧化碳面板', key: 'mining_speed_carbon_dioxide', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
            {type: 'float', label: '行星二氧化硫面板', key: 'mining_speed_sulfur_dioxide', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
        ],
    },
    {
        condition: ({orbital_enabled}) => Boolean(orbital_enabled),
        rows: [
            {type: 'float', label: '巨星甲烷面板', key: 'mining_speed_methane', step: 0.10, min: 0.01, unit: '/s（星球资源详情）'},
        ],
    },
];

export const MINING_BEHAVIOR_ROWS: BaseSettingRow[] = [
    {type: 'toggle', label: '原矿显示', key: 'hide_mines', enabledLabel: '隐藏原矿', disabledLabel: '显示原矿', enabledAction: '显示原矿', disabledAction: '隐藏原矿'},
    {type: 'int', label: '小矿机覆盖矿脉数', key: 'covered_veins_small', step: 1, min: 1},
    {type: 'int', label: '大矿机覆盖矿脉数', key: 'covered_veins_large', step: 1, min: 1},
    {type: 'percent', label: '大矿机开采速度', key: 'mining_efficiency_large', step: 100, min: 100, unit: '%'},
    {type: 'percent', label: '采矿速度', key: 'mining_speed_multiple', step: 10, min: 100, unit: '%（科技面板右上）'},
    {type: 'percent', label: '残骸产出倍率', key: 'enemy_drop_multiple', step: 4, min: 100, unit: '%（科技面板右上）'},
    {type: 'percent', label: '手动制造速度', key: 'icarus_manufacturing_speed', step: 50, min: 100, unit: '%'},
    {type: 'fractionating_speed', label: '分馏带速'},
];

export const DISPLAY_AND_PROLIFERATION_ROWS: BaseSettingRow[] = [
    {type: 'time_unit'},
    {type: 'int', label: '精度位数', key: 'fixed_num', step: 1, min: 0},
    {type: 'toggle', label: '配方显示', key: 'show_effective_recipe', enabledLabel: '等效配方', disabledLabel: '原始配方', enabledAction: '改为原始配方', disabledAction: '改为等效配方'},
    {type: 'toggle', label: '侧栏模式', key: 'show_sidebar_item_names', enabledLabel: '单列模式', disabledLabel: '双列模式', enabledAction: '改为双列模式', disabledAction: '改为单列模式'},
    {type: 'int', label: '研究站层数', key: 'stack_research_lab', step: 1, min: 1},
    {type: 'toggle', label: '增产剂自喷涂', key: 'proliferate_itself', enabledLabel: '启用', disabledLabel: '禁用', enabledAction: '改为禁用', disabledAction: '改为启用'},
    {type: 'percent', label: '增产剂加速效率补偿', key: 'acc_rate', step: 5, min: 1, unit: '%'},
    {type: 'percent', label: '增产剂增产效率补偿', key: 'inc_rate', step: 5, min: 1, unit: '%'},
];

export const THEY_COME_FROM_VOID_ROWS: BaseSettingRow[] = [
    {type: 'info', text: '【深空来敌元驱动】'},
    {type: 'info', text: '注意：更改任意元驱动状态后，必须重新选择MOD！'},
    {type: 'info', text: 'PS：鼠标悬停在元驱动名称上以查看具体效果'},
    {
        type: 'toggle',
        label: '蓝Buff',
        key: 'blue_buff',
        title: '制造厂在制造原材料至少2种的配方时，每产出1个产物，会返还1个第1位置的原材料',
        enabledLabel: '启用',
        disabledLabel: '禁用',
        enabledAction: '改为禁用',
        disabledAction: '改为启用',
    },
];
