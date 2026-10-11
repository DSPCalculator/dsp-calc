import '@testing-library/jest-dom/vitest';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {Header} from '../src/header.jsx';
import {ThemeProvider} from '../src/ThemeContext.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';
import {default_game_data, get_game_data, MoreMegaStructureGUID, TheyComeFromVoidGUID} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';

beforeAll(() => {
    // jsdom has no scrolling/layout or pointer capture; Radix uses these browser APIs.
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function renderApp() {
    const user = userEvent.setup();
    const rendered = render(<ThemeProvider><TooltipProvider delayDuration={0}><Header/><App/></TooltipProvider></ThemeProvider>);
    return {user, ...rendered};
}

async function addTarget(user, item = '铁块', query = item, keyboard = false, button = '添加需求物品') {
    await user.click(screen.getByRole('button', {name: button}));
    const dialog = screen.getByRole('dialog', {name: '选择物品'});
    const search = within(dialog).getByRole('searchbox', {name: '搜索物品，支持中文和拼音'});
    await user.type(search, query);
    expect(within(dialog).getAllByRole('button', {name: `选择${item}`, exact: true})[0]).toBeInTheDocument();
    if (keyboard) await user.keyboard('{Enter}');
    else await user.click(within(dialog).getAllByRole('button', {name: `选择${item}`, exact: true})[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', {name: '选择物品'})).not.toBeInTheDocument());
}

async function clearTargets(user) {
    await user.click(screen.getByRole('button', {name: '清空需求', exact: true}));
    await user.click(within(screen.getByRole('dialog', {name: '清空当前需求？'})).getByRole('button', {name: '清空需求', exact: true}));
}

function readStore(key) {
    return JSON.parse(localStorage.getItem(key));
}

describe('calculator UI interactions', () => {
    it('shows bulk building selectors for numeric facilities and restores their selected building', async () => {
        const {user, unmount} = renderApp();
        const expected = Object.entries(default_game_data.factory_data).filter(([factory, list]) =>
            list.length >= 2 && default_game_data.recipe_data.filter(recipe => recipe['设施'] === Number(factory)).length >= 3);
        expect(expected.length).toBeGreaterThan(0);
        expect(screen.getAllByRole('combobox', {name: /批量设置.*建筑/})).toHaveLength(expected.length);
        const smelter = screen.getByRole('combobox', {name: '批量设置电弧熔炉建筑'});
        await user.click(smelter);
        await user.click(screen.getByRole('option', {name: /位面熔炉/}));
        expect(smelter).toHaveTextContent('位面熔炉');
        const saved = readStore('auto_scheme').Vanilla;
        default_game_data.recipe_data.forEach((recipe, index) => {
            const choice = default_game_data.factory_data[recipe['设施']].findIndex(building => building['名称'] === '位面熔炉');
            if (choice !== -1) expect(saved.scheme_for_recipe[index]['建筑']).toBe(choice);
        });
        await addTarget(user);
        expect(screen.getByRole('textbox', {name: '铁块工厂数量，等比例调整需求'})).toHaveValue('0.50');
        unmount();
        renderApp();
        expect(screen.getByRole('combobox', {name: '批量设置电弧熔炉建筑'})).toHaveTextContent('位面熔炉');
    });

    it('adds targets with Chinese and pinyin search, merges repeat additions, removes and confirms clear', async () => {
        const {user} = renderApp();
        expect(screen.getByRole('heading', {name: '生产总览'})).toBeInTheDocument();
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
        await addTarget(user);
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('60.00');
        await addTarget(user, '铁块', 'tiekuai', true);
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(120);
        await addTarget(user, '铜块', 'tongkuai', true);
        expect(screen.getByRole('spinbutton', {name: '铜块目标产量'})).toHaveValue(60);
        await user.click(screen.getByRole('button', {name: '移除铁块需求'}));
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '清空需求', exact: true}));
        await user.click(within(screen.getByRole('dialog', {name: '清空当前需求？'})).getByRole('button', {name: '取消'}));
        expect(screen.getByRole('spinbutton', {name: '铜块目标产量'})).toHaveValue(60);
        await clearTargets(user);
        expect(screen.queryByRole('spinbutton', {name: '铜块目标产量'})).not.toBeInTheDocument();
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
    });

    it('rejects empty, zero and negative target amounts without changing a valid calculation', async () => {
        const {user} = renderApp();
        const quantity = screen.getByRole('spinbutton', {name: '目标产量', exact: true});
        await user.clear(quantity);
        expect(screen.getByRole('button', {name: '添加需求物品'})).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent('大于 0');
        await user.type(quantity, '-1');
        expect(quantity).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('button', {name: '添加现有产线'})).toBeEnabled();
        await user.clear(quantity);
        await user.type(quantity, '0');
        expect(screen.getByRole('button', {name: '添加需求物品'})).toBeDisabled();
        await user.clear(quantity);
        await user.type(quantity, '60');
        await addTarget(user);
        const target = screen.getByRole('spinbutton', {name: '铁块目标产量'});
        await user.clear(target);
        await user.type(target, '-5');
        expect(target).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('60.00');
        await user.tab();
        expect(target).toHaveValue(60);
        expect(target).toHaveAttribute('aria-invalid', 'false');
    });

    it('scales all targets from a result input and recalculates factories when the time unit changes', async () => {
        const {user} = renderApp();
        await addTarget(user);
        await addTarget(user, '铜块');
        const output = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        await user.clear(output);
        await user.type(output, '120');
        await user.keyboard('{Enter}');
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(120);
        expect(screen.getByRole('spinbutton', {name: '铜块目标产量'})).toHaveValue(120);
        const factoryLabel = '铁块工厂数量，等比例调整需求';
        const perMinute = Number(screen.getByRole('textbox', {name: factoryLabel}).value);
        await user.click(screen.getByRole('tab', {name: '每秒'}));
        expect(screen.getByRole('tab', {name: '每秒'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('columnheader', {name: '产能 / s'})).toBeInTheDocument();
        expect(Number(screen.getByRole('textbox', {name: factoryLabel}).value)).toBeCloseTo(perMinute * 60, 1);
        expect(readStore('auto_settings').is_time_unit_minute).toBe(false);
        await user.click(screen.getByRole('tab', {name: '每分钟'}));
        expect(Number(screen.getByRole('textbox', {name: factoryLabel}).value)).toBeCloseTo(perMinute, 2);
    });

    it('keeps settings after Escape, returns focus, and reopens the dialog without a stuck overlay', async () => {
        const {user} = renderApp();
        const trigger = screen.getByRole('button', {name: '参数设置'});
        await user.click(trigger);
        const dialog = screen.getByRole('dialog', {name: '采矿参数与计算设置'});
        const oil = within(dialog).getByRole('spinbutton', {name: '原油面板'});
        await user.clear(oil);
        await user.type(oil, '5');
        await user.tab();
        expect(readStore('auto_settings').mining_speed_oil).toBe(5);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        await user.click(trigger);
        expect(within(screen.getByRole('dialog')).getByRole('spinbutton', {name: '原油面板'})).toHaveValue(5);
        await user.keyboard('{Escape}');
        await addTarget(user);
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
    });

    it('persists raw-material overrides after remount and supports repeated summary dialog dismissal', async () => {
        let {user, unmount} = renderApp();
        await addTarget(user);
        await user.click(screen.getByRole('button', {name: '将铁块视为原矿'}));
        expect(readStore('auto_settings').mineralize_list).toHaveProperty('铁块');
        unmount();
        ({user} = renderApp());
        await addTarget(user);
        expect(readStore('auto_settings').mineralize_list).toHaveProperty('铁块');
        expect(screen.queryByRole('textbox', {name: '铁矿产能，等比例调整需求'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '原矿与溢出', exact: true}));
        const dialog = screen.getByRole('dialog', {name: '原矿与多余产物'});
        await user.click(within(dialog).getByRole('button', {name: '恢复铁块生产'}));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('textbox', {name: '铁矿产能，等比例调整需求'})).toBeInTheDocument();
        for (let repeat = 0; repeat < 2; repeat++) {
            await user.click(screen.getByRole('button', {name: '建筑与需求', exact: true}));
            expect(screen.getByRole('dialog', {name: '建筑与需求'})).toHaveTextContent('原矿输入总需求');
            await user.keyboard('{Escape}');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }
    });

    it('adds a zero-allocation production source, edits its output and removes it', async () => {
        const {user} = renderApp();
        await addTarget(user, '铁块', '铁块', false, '添加现有产线');
        expect(screen.getByRole('region', {name: '铁块生产来源'})).toBeInTheDocument();
        const output = screen.getByRole('textbox', {name: '铁块现有产线 1分配产量'});
        expect(output).toHaveValue('0.00');
        expect(readStore('auto_settings').production_sources[0].output_per_minute).toBe(0);
        expect(readStore('auto_settings').production_sources[0].standalone).toBe(true);
        await user.clear(output);
        await user.type(output, '180');
        await user.keyboard('{Enter}');
        expect(readStore('auto_settings').production_sources[0].output_per_minute).toBe(180);
        expect(screen.getByLabelText('铁块现有产线 1工厂数量')).toHaveValue('3.00');
        await user.click(screen.getByRole('button', {name: '删除铁块现有产线 1'}));
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
    });

    it('saves and reloads scoped target presets, preserves canceled saves and confirms deletion', async () => {
        const {user} = renderApp();
        await addTarget(user);
        await user.click(screen.getByTitle('保存需求列表'));
        let dialog = screen.getByRole('dialog', {name: '保存需求列表'});
        expect(within(dialog).getByRole('button', {name: '保存', exact: true})).toBeDisabled();
        await user.type(within(dialog).getByRole('textbox', {name: '需求列表名称'}), '不应保存');
        await user.click(within(dialog).getByRole('button', {name: '取消'}));
        expect(localStorage.getItem('needs_list')).toBeNull();
        await user.click(screen.getByTitle('保存需求列表'));
        dialog = screen.getByRole('dialog', {name: '保存需求列表'});
        await user.type(within(dialog).getByRole('textbox', {name: '需求列表名称'}), '测试产线');
        await user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
        expect(readStore('needs_list').Vanilla['测试产线']).toMatchObject({plan_version: 1, game_name: 'Vanilla', needs_list: {'铁块': 60}, settings: {production_sources: []}});
        await clearTargets(user);
        await user.click(screen.getByTitle('加载需求列表'));
        await user.click(screen.getByRole('menuitem', {name: '测试产线'}));
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
        await user.click(screen.getByRole('button', {name: '删除已保存的需求列表'}));
        await user.click(screen.getByRole('menuitem', {name: '测试产线'}));
        await user.click(within(screen.getByRole('dialog', {name: '删除需求列表'})).getByRole('button', {name: '取消'}));
        expect(readStore('needs_list').Vanilla['测试产线']).toMatchObject({plan_version: 1, game_name: 'Vanilla', needs_list: {'铁块': 60}, settings: {production_sources: []}});
        await user.click(screen.getByRole('button', {name: '删除已保存的需求列表'}));
        await user.click(screen.getByRole('menuitem', {name: '测试产线'}));
        await user.click(within(screen.getByRole('dialog', {name: '删除需求列表'})).getByRole('button', {name: '确认删除'}));
        expect(readStore('needs_list').Vanilla).toEqual({});
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
        expect(screen.getByTitle('加载需求列表')).toBeDisabled();
    });

    it('preserves both game-scoped auto strategies across mod switches and cancels draft mod changes', async () => {
        const vanilla = init_scheme_data(default_game_data);
        const megaGame = get_game_data([MoreMegaStructureGUID]);
        const mega = init_scheme_data(megaGame);
        vanilla.cost_weight['电力'] = 13;
        mega.cost_weight['电力'] = 29;
        localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: vanilla, [megaGame.game_name]: mega}));
        const {user} = renderApp();
        await addTarget(user);
        await user.click(screen.getByRole('button', {name: '原版游戏'}));
        let dialog = screen.getByRole('dialog', {name: '游戏与模组'});
        await user.click(within(dialog).getByRole('checkbox', {name: /深空来敌/}));
        expect(within(dialog).getByRole('checkbox', {name: /更多巨构/})).toBeChecked();
        await user.click(within(dialog).getByRole('button', {name: '取消'}));
        expect(localStorage.getItem('auto_mods')).toBeNull();
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
        await user.click(screen.getByRole('button', {name: '原版游戏'}));
        dialog = screen.getByRole('dialog', {name: '游戏与模组'});
        expect(within(dialog).getByRole('checkbox', {name: /深空来敌/})).not.toBeChecked();
        await user.click(within(dialog).getByRole('checkbox', {name: /更多巨构/}));
        await user.click(within(dialog).getByRole('button', {name: '应用模组'}));
        expect(screen.getByRole('button', {name: '1 个模组'})).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        expect(readStore('auto_mods')).toEqual([MoreMegaStructureGUID]);
        expect(readStore('auto_scheme').Vanilla.cost_weight['电力']).toBe(13);
        expect(readStore('auto_scheme')[megaGame.game_name].cost_weight['电力']).toBe(29);
        await user.click(screen.getByRole('button', {name: '1 个模组'}));
        dialog = screen.getByRole('dialog', {name: '游戏与模组'});
        await user.click(within(dialog).getByRole('checkbox', {name: /更多巨构/}));
        await user.click(within(dialog).getByRole('button', {name: '应用模组'}));
        expect(screen.getByRole('button', {name: '原版游戏'})).toBeInTheDocument();
        expect(readStore('auto_scheme').Vanilla).toEqual(vanilla);
        expect(readStore('auto_scheme')[megaGame.game_name]).toEqual(mega);
        expect(readStore('auto_mods')).not.toContain(TheyComeFromVoidGUID);
    });

    it('changes per-row buildings, proliferation and recipe choices while saving the chosen strategy', async () => {
        const {user} = renderApp();
        await addTarget(user);
        const factoryLabel = '铁块工厂数量，等比例调整需求';
        const originalFactories = Number(screen.getByRole('textbox', {name: factoryLabel}).value);
        let row = screen.getByRole('textbox', {name: factoryLabel}).closest('tr');
        await user.click(within(row).getByRole('button', {name: '位面熔炉'}));
        expect(Number(screen.getByRole('textbox', {name: factoryLabel}).value)).toBeLessThan(originalFactories);
        expect(within(row).getByRole('button', {name: '位面熔炉'})).toHaveAttribute('aria-pressed', 'true');
        await user.click(within(row).getByRole('button', {name: '增产', exact: true}));
        row = screen.getByRole('textbox', {name: factoryLabel}).closest('tr');
        await user.click(within(row).getByRole('button', {name: /增产剂\s+Mk\.II$/}));
        expect(within(row).getByRole('button', {name: '增产', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(row).getByRole('button', {name: /增产剂\s+Mk\.II$/})).toHaveAttribute('aria-pressed', 'true');
        await addTarget(user, '石墨烯');
        const recipes = screen.getByRole('group', {name: '石墨烯配方'});
        await user.click(within(recipes).getByRole('button', {name: '石墨烯配方 2'}));
        expect(within(recipes).getByRole('button', {name: '石墨烯配方 2'})).toHaveAttribute('aria-pressed', 'true');
        expect(readStore('auto_scheme').Vanilla.item_recipe_choices['石墨烯']).toBe(2);
        await user.click(screen.getByTitle('保存生产策略'));
        const dialog = screen.getByRole('dialog', {name: '保存方案'});
        await user.type(within(dialog).getByRole('textbox', {name: '方案名称'}), '增产方案');
        await user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
        expect(readStore('scheme_data').Vanilla['增产方案'].item_recipe_choices['石墨烯']).toBe(2);
        await user.click(within(recipes).getByRole('button', {name: '石墨烯配方 1'}));
        await user.click(screen.getByTitle('加载生产策略'));
        await user.click(screen.getByRole('menuitem', {name: '增产方案'}));
        expect(readStore('auto_scheme').Vanilla.item_recipe_choices['石墨烯']).toBe(2);
    });

    it('shows empty search results, clears the query, and resets it after a canceled picker', async () => {
        const {user} = renderApp();
        await user.click(screen.getByRole('button', {name: '添加需求物品'}));
        let dialog = screen.getByRole('dialog', {name: '选择物品'});
        let search = within(dialog).getByRole('searchbox');
        await user.type(search, 'nonexistent-production-item-zzzz');
        expect(within(dialog).getByText('没有找到相关物品')).toBeInTheDocument();
        await user.keyboard('{Enter}');
        expect(dialog).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', {name: '清除搜索'}));
        expect(search).toHaveValue('');
        await user.type(search, 'tk');
        expect(within(dialog).getByRole('button', {name: '选择铁块', exact: true})).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.getByRole('button', {name: '添加需求物品'})).toHaveFocus();
        await user.click(screen.getByRole('button', {name: '添加需求物品'}));
        dialog = screen.getByRole('dialog', {name: '选择物品'});
        search = within(dialog).getByRole('searchbox');
        expect(search).toHaveValue('');
        await user.keyboard('{Escape}');
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
    });

    it('warns before replacing a named preset and only replaces after explicit save', async () => {
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {'保留产线': {'铜块': 25}}, MoreMegaStructure: {'其它游戏': {'铁块': 10}}}));
        const {user} = renderApp();
        await addTarget(user);
        await user.click(screen.getByTitle('保存需求列表'));
        let dialog = screen.getByRole('dialog', {name: '保存需求列表'});
        await user.type(within(dialog).getByRole('textbox', {name: '需求列表名称'}), '保留产线');
        expect(within(dialog).getByText(/保存将覆盖原内容/)).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(readStore('needs_list').Vanilla['保留产线']).toEqual({'铜块': 25});
        await user.click(screen.getByTitle('保存需求列表'));
        dialog = screen.getByRole('dialog', {name: '保存需求列表'});
        await user.type(within(dialog).getByRole('textbox', {name: '需求列表名称'}), '保留产线');
        await user.click(within(dialog).getByRole('button', {name: '覆盖保存'}));
        expect(readStore('needs_list').Vanilla['保留产线']).toMatchObject({plan_version: 1, game_name: 'Vanilla', needs_list: {'铁块': 60}});
        expect(readStore('needs_list').MoreMegaStructure['其它游戏']).toEqual({'铁块': 10});
    });

    it('rejects infinite, negative and empty delayed output values, and cancels edits with Escape', async () => {
        const {user} = renderApp();
        await addTarget(user);
        const label = '铁块产能，等比例调整需求';
        for (const invalid of ['Infinity', '-60', '']) {
            const output = screen.getByRole('textbox', {name: label});
            await user.clear(output);
            if (invalid) await user.type(output, invalid);
            expect(output).toHaveAttribute('aria-invalid', 'true');
            await user.keyboard('{Enter}');
            expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
            expect(screen.getByRole('textbox', {name: label})).toHaveValue('60.00');
        }
        const output = screen.getByRole('textbox', {name: label});
        await user.clear(output);
        await user.type(output, '120');
        await user.keyboard('{Escape}');
        await user.tab();
        expect(screen.getByRole('spinbutton', {name: '铁块目标产量'})).toHaveValue(60);
        expect(screen.getByRole('textbox', {name: label})).toHaveValue('60.00');
    });

    it.each(['auto_scheme', 'auto_settings'])('preserves corrupt %s data and warns while calculation remains usable', async storageKey => {
        const corrupt = '{original-user-save: invalid JSON';
        localStorage.setItem(storageKey, corrupt);
        const {user} = renderApp();
        expect(screen.getByRole('alert')).toHaveTextContent('原始保存数据未被修改');
        expect(localStorage.getItem(storageKey)).toBe(corrupt);
        await addTarget(user);
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('60.00');
        await user.click(screen.getByRole('tab', {name: '每秒'}));
        expect(screen.getByRole('columnheader', {name: '产能 / s'})).toBeInTheDocument();
        expect(localStorage.getItem(storageKey)).toBe(corrupt);
        expect(screen.getByRole('alert')).toHaveTextContent('原始保存数据未被修改');
    });

    it('toggles and persists the light and dark themes', async () => {
        const {user, unmount} = renderApp();
        await user.click(screen.getByRole('button', {name: '切换到深色主题'}));
        expect(document.documentElement).toHaveClass('dark');
        expect(localStorage.getItem('theme')).toBe('dark');
        unmount();
        const second = renderApp();
        expect(document.documentElement).toHaveClass('dark');
        await second.user.click(screen.getByRole('button', {name: '切换到浅色主题'}));
        expect(document.documentElement).not.toHaveClass('dark');
        expect(localStorage.getItem('theme')).toBe('light');
    });
});
