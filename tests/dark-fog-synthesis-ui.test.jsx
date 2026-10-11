import '@testing-library/jest-dom/vitest';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {DarkFogSynthesisGUID, default_game_data, get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const readStore = key => JSON.parse(localStorage.getItem(key));
const matrix = '黑雾矩阵';
const synthesisName = /黑雾合成.*Dark Fog Synthesis/;
const oldModNames = [/更多巨构/, /深空来敌/, /创世之书/, /万物分馏/];
const matrixRow = () => screen.getByRole('row', {name: `${matrix}全局产线`, exact: true});
const matrixChoice = choice => within(matrixRow()).getByRole('button', {name: `${matrix}配方 ${choice}`, exact: true});
const source = () => screen.getByRole('article', {name: `${matrix}现有产线 1`});

function renderApp() {
    return {user: userEvent.setup(), ...render(<TooltipProvider delayDuration={0}><App/></TooltipProvider>)};
}
async function addItem(user, item, query = item) {
    await user.click(screen.getByRole('button', {name: '添加需求物品', exact: true}));
    const dialog = screen.getByRole('dialog', {name: '选择物品'});
    await user.type(within(dialog).getByRole('searchbox', {name: '搜索物品，支持中文和拼音'}), query);
    await user.click(within(dialog).getByRole('button', {name: `选择${item}`, exact: true}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: '选择物品'})).not.toBeInTheDocument());
}
async function openMods(user) {
    await user.click(screen.getByRole('button', {name: /^(原版游戏|\d+ 个模组)$/}));
    return screen.getByRole('dialog', {name: '游戏与模组'});
}
async function toggleSynthesis(user) {
    const dialog = await openMods(user);
    await user.click(within(dialog).getByRole('checkbox', {name: synthesisName}));
    await user.click(within(dialog).getByRole('button', {name: '应用模组'}));
    expect(screen.queryByRole('dialog', {name: '游戏与模组'})).not.toBeInTheDocument();
}
async function saveNamed(user, name, kind = '需求列表') {
    await user.click(screen.getByTitle(`保存${kind}`));
    const noun = kind === '生产策略' ? '方案' : kind;
    const dialog = screen.getByRole('dialog', {name: `保存${noun}`});
    await user.type(within(dialog).getByRole('textbox', {name: `${noun}名称`}), name);
    await user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
}
async function loadNamed(user, name, kind = '需求列表') {
    await user.click(screen.getByTitle(`加载${kind}`));
    await user.click(screen.getByRole('menuitem', {name, exact: true}));
}
async function editOil(user, value) {
    await user.click(screen.getByRole('button', {name: '参数设置'}));
    const dialog = screen.getByRole('dialog', {name: '采矿参数与计算设置'});
    const input = within(dialog).getByRole('spinbutton', {name: '原油面板'});
    await user.clear(input);
    await user.type(input, String(value));
    await user.tab();
    await user.keyboard('{Escape}');
}
function seedExistingState() {
    localStorage.setItem('auto_settings', JSON.stringify({mineralize_list: {'铜块': true}, mining_speed_oil: 5,
        production_sources: [{id: 'existing-iron', target_item: '铁块', output_per_minute: 15, standalone: true,
            recipe_choice: 1, building: 0, proliferator_mode: 0, proliferator_points: 0}]}));
}

describe('Dark Fog Synthesis profile UI and persistence', () => {
    it('enforces exclusivity in both directions and discards Cancel and Escape without changing active state', async () => {
        seedExistingState();
        const {user} = renderApp();
        await addItem(user, '铁块');
        const before = ['auto_settings', 'auto_scheme', 'auto_mods'].map(key => localStorage.getItem(key));
        let dialog = await openMods(user);
        expect(within(dialog).getByRole('button', {name: '应用模组'})).toBeDisabled();
        for (const name of oldModNames) {
            await user.click(within(dialog).getByRole('checkbox', {name}));
            expect(within(dialog).getByRole('checkbox', {name: synthesisName})).toBeDisabled();
            if (name.source === '深空来敌') {
                expect(within(dialog).getByRole('checkbox', {name: /更多巨构/})).toBeChecked();
                await user.click(within(dialog).getByRole('checkbox', {name: /更多巨构/}));
                expect(within(dialog).getByRole('checkbox', {name})).not.toBeChecked();
            } else await user.click(within(dialog).getByRole('checkbox', {name}));
            expect(within(dialog).getByRole('checkbox', {name: synthesisName})).toBeEnabled();
        }
        await user.click(within(dialog).getByRole('checkbox', {name: synthesisName}));
        for (const name of oldModNames) expect(within(dialog).getByRole('checkbox', {name})).toBeDisabled();
        expect(dialog).toHaveTextContent('组合数据尚未核验');
        await user.click(within(dialog).getByRole('button', {name: '取消'}));
        expect(screen.getByRole('button', {name: '原版游戏'})).toHaveFocus();
        dialog = await openMods(user);
        expect(within(dialog).getByRole('checkbox', {name: synthesisName})).not.toBeChecked();
        await user.click(within(dialog).getByRole('checkbox', {name: synthesisName}));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('button', {name: '原版游戏'})).toHaveFocus();
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
        expect(screen.getByRole('article', {name: '铁块现有产线 1'})).toHaveAttribute('data-source-id', 'existing-iron');
        expect(['auto_settings', 'auto_scheme', 'auto_mods'].map(key => localStorage.getItem(key))).toEqual(before);
        dialog = await openMods(user);
        expect(within(dialog).getByRole('checkbox', {name: synthesisName})).not.toBeChecked();
        expect(within(dialog).getByRole('button', {name: '应用模组'})).toBeDisabled();
    });

    it('applies a clean profile, searches synthesis targets and keeps compact controls, drops and tree calculations', async () => {
        seedExistingState();
        const {user, container} = renderApp();
        await addItem(user, '铁块');
        const vanilla = readStore('auto_scheme').Vanilla;
        await toggleSynthesis(user);
        expect(readStore('auto_mods')).toEqual([DarkFogSynthesisGUID]);
        expect(readStore('auto_settings')).toMatchObject({production_sources: [], natural_production_line: [], mineralize_list: {}, mining_speed_oil: 3});
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        expect(readStore('auto_scheme').Vanilla).toEqual(vanilla);
        await addItem(user, matrix, 'heiwujuzhen');
        expect(screen.getByRole('spinbutton', {name: `${matrix}目标产量`})).toHaveValue(60);
        expect(screen.getByRole('textbox', {name: `${matrix}工厂数量，等比例调整需求`})).toHaveValue('4.00');
        expect(matrixChoice(2)).toHaveAttribute('aria-pressed', 'true');
        expect(within(matrixRow()).getByRole('button', {name: '矩阵研究站', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(matrixChoice(2)).toHaveAccessibleDescription('晶格硅 × 2 + 光子合并器 × 1 + 电浆激发器 × 1 + 钛化玻璃 × 1 → 黑雾矩阵 × 1 · 4s');
        expect(container.querySelector('.dsp-production-table')).toHaveClass('w-auto', 'text-base');
        expect(within(matrixRow()).getAllByRole('cell')).toHaveLength(9);
        expect(matrixRow().querySelector('.dsp-item-name')).toHaveClass('sr-only');
        expect(matrixRow().querySelector('.dsp-compact-recipe')).toHaveClass('w-max', 'max-w-32');
        await user.click(matrixChoice(1));
        expect(matrixChoice(1)).toHaveAttribute('aria-pressed', 'true');
        expect(matrixChoice(1)).toHaveAccessibleDescription('直接采集 → 黑雾矩阵 × 1 · 1s');
        expect(readStore('auto_scheme').DarkFogSynthesis.item_recipe_choices[matrix]).toBe(1);
        await user.click(matrixChoice(2));
        const summary = screen.getByRole('complementary', {name: '生产统计'}).textContent;
        const saved = localStorage.getItem('auto_scheme');
        await user.click(screen.getByRole('button', {name: '树状', exact: true}));
        expect(screen.getByRole('region', {name: '依赖树生产视图'})).toBeInTheDocument();
        expect(screen.getByLabelText('晶格硅本支需求')).toHaveTextContent(/^120.00$/);
        expect(screen.getByLabelText('钛化玻璃本支需求')).toHaveTextContent(/^60.00$/);
        expect(screen.getByRole('complementary', {name: '生产统计'}).textContent).toBe(summary);
        await user.click(screen.getByRole('button', {name: '平铺', exact: true}));
        expect(screen.getByRole('textbox', {name: `${matrix}工厂数量，等比例调整需求`})).toHaveValue('4.00');
        expect(localStorage.getItem('auto_scheme')).toBe(saved);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('saves and repeatedly restores a named strategy across remount without mixing a same-named Vanilla save', async () => {
        const name = '同名生产策略';
        const vanilla = init_scheme_data(default_game_data);
        vanilla.cost_weight['电力'] = 13;
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {[name]: vanilla}}));
        let {user, unmount} = renderApp();
        await toggleSynthesis(user);
        await addItem(user, matrix);
        await user.click(within(matrixRow()).getByRole('button', {name: '自演化研究站', exact: true}));
        const matrixRecipe = get_game_data([DarkFogSynthesisGUID]).recipe_ids.indexOf(48102);
        const saved = readStore('auto_scheme').DarkFogSynthesis;
        expect(saved.scheme_for_recipe[matrixRecipe].建筑).toBe(1);
        await saveNamed(user, name, '生产策略');
        expect(readStore('scheme_data').DarkFogSynthesis[name]).toEqual({...saved, production_sources: []});
        expect(readStore('scheme_data').Vanilla[name]).toEqual(vanilla);
        for (let repeat = 0; repeat < 2; repeat++) {
            await user.click(matrixChoice(1));
            await loadNamed(user, name, '生产策略');
            expect(matrixChoice(2)).toHaveAttribute('aria-pressed', 'true');
            expect(within(matrixRow()).getByRole('button', {name: '自演化研究站', exact: true})).toHaveAttribute('aria-pressed', 'true');
            expect(readStore('auto_scheme').DarkFogSynthesis).toEqual(saved);
        }
        unmount();
        ({user} = renderApp());
        expect(screen.getByRole('button', {name: '1 个模组'})).toBeInTheDocument();
        expect(readStore('auto_scheme').DarkFogSynthesis).toEqual(saved);
        await addItem(user, matrix);
        expect(matrixChoice(2)).toHaveAttribute('aria-pressed', 'true');
        expect(within(matrixRow()).getByRole('button', {name: '自演化研究站', exact: true})).toHaveAttribute('aria-pressed', 'true');
        await toggleSynthesis(user);
        expect(screen.getByRole('button', {name: '原版游戏'})).toBeInTheDocument();
        expect(readStore('auto_mods')).toEqual([]);
        await loadNamed(user, name, '生产策略');
        expect(readStore('auto_scheme').Vanilla).toEqual(vanilla);
        expect(readStore('auto_scheme').DarkFogSynthesis).toEqual(saved);
        expect(readStore('scheme_data').Vanilla[name]).toEqual(vanilla);
        expect(readStore('scheme_data').DarkFogSynthesis[name]).toEqual({...saved, production_sources: []});
    }, 20000);

    it('round-trips a complete named plan with settings and source identity, including grouped tree navigation and profile return', async () => {
        const name = '同名完整计划';
        const vanillaPlan = {'铁块': 30};
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {[name]: vanillaPlan}}));
        let {user, unmount} = renderApp();
        await toggleSynthesis(user);
        await addItem(user, matrix);
        await editOil(user, 5);
        await user.click(screen.getByRole('button', {name: `使用${matrix}配方 1添加产线`}));
        const allocation = within(source()).getByRole('textbox', {name: `${matrix}现有产线 1分配产量`});
        await user.clear(allocation);
        await user.type(allocation, '15');
        await user.keyboard('{Enter}');
        const id = source().dataset.sourceId;
        expect(screen.getByLabelText(`${matrix}需求产线产量`)).toHaveTextContent(/^45.00$/);
        expect(screen.getByLabelText(`${matrix}需求产线工厂数量`)).toHaveTextContent(/^3.00$/);
        await saveNamed(user, name);
        const saved = readStore('needs_list').DarkFogSynthesis[name];
        expect(saved).toMatchObject({plan_version: 1, game_name: 'DarkFogSynthesis', needs_list: {[matrix]: 60},
            settings: {mining_speed_oil: 5, production_sources: [{id, target_item: matrix, recipe_choice: 1, output_per_minute: 15, scope: 'plan'}]}});
        expect(readStore('needs_list').Vanilla[name]).toEqual(vanillaPlan);
        expect(readStore('auto_settings').production_sources).toEqual([]);
        await addItem(user, '铁块');
        await editOil(user, 7);
        expect(screen.queryByRole('article', {name: `${matrix}现有产线 1`})).not.toBeInTheDocument();
        await loadNamed(user, name);
        expect(readStore('auto_settings').mining_speed_oil).toBe(5);
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        expect(source()).toHaveAttribute('data-source-id', id);
        unmount();
        ({user} = renderApp());
        expect(screen.getByRole('button', {name: '1 个模组'})).toBeInTheDocument();
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
        await loadNamed(user, name);
        expect(screen.getByRole('spinbutton', {name: `${matrix}目标产量`})).toHaveValue(60);
        expect(source()).toHaveAttribute('data-source-id', id);
        expect(within(source()).getByRole('textbox', {name: `${matrix}现有产线 1分配产量`})).toHaveValue('15.00');
        expect(screen.getByLabelText(`${matrix}总需求`)).toHaveTextContent(/^60.00$/);
        expect(readStore('auto_settings').mining_speed_oil).toBe(5);
        const summary = screen.getByRole('complementary', {name: '生产统计'}).textContent;
        await user.click(screen.getByRole('button', {name: '树状', exact: true}));
        expect(screen.getByLabelText(`${matrix}本支需求`)).toHaveTextContent(/^60.00$/);
        const demandTable = screen.getByRole('region', {name: '目标依赖表，可横向滚动'});
        await user.click(within(demandTable).getByRole('button', {name: `查看${matrix}全局产线`}));
        expect(matrixRow()).toHaveFocus();
        expect(source()).toHaveAttribute('data-source-id', id);
        expect(screen.getAllByRole('row', {name: `${matrix}全局产线`, exact: true})).toHaveLength(1);
        expect(screen.getByRole('region', {name: `${matrix}生产来源`}).closest('td')).toHaveAttribute('colspan', '8');
        expect(screen.getByRole('complementary', {name: '生产统计'}).textContent).toBe(summary);
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(readStore('auto_scheme').DarkFogSynthesis).toEqual(saved.scheme_data);
        expect(readStore('needs_list').DarkFogSynthesis[name]).toEqual(saved);
        await toggleSynthesis(user);
        expect(screen.queryByRole('article', {name: `${matrix}现有产线 1`})).not.toBeInTheDocument();
        await loadNamed(user, name);
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(30);
        expect(screen.queryByRole('spinbutton', {name: `${matrix}目标产量`})).not.toBeInTheDocument();
        expect(readStore('needs_list').Vanilla[name]).toEqual(vanillaPlan);
        expect(readStore('needs_list').DarkFogSynthesis[name]).toEqual(saved);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }, 25000);
});
