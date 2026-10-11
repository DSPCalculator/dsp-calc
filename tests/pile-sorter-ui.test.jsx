import '@testing-library/jest-dom/vitest';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {default_game_data} from '../src/GameData.jsx';
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
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const toggle = () => screen.getByRole('combobox', {name: '批量设置分拣器'});
async function selectLevel(user, level) {
    await user.click(toggle());
    await user.click(screen.getByRole('option', {name: level === -1 ? '无集装' : level === 0 ? '集装分拣器（基础）' : `集装改良 ${level}${level === 6 ? '（满级）' : ' 级'}`, exact: true}));
}
const readStore = key => JSON.parse(localStorage.getItem(key));
const logistics = () => screen.getByRole('button', {name: /^铁块物流估算/});
const production = () => ['产能', '工厂数量'].map(field =>
    screen.getByRole('textbox', {name: `铁块${field}，等比例调整需求`}).value);
function renderApp() {
    return {user: userEvent.setup(), ...render(<TooltipProvider delayDuration={0}><App/></TooltipProvider>)};
}
async function loadNamed(user, name, kind = '需求列表') {
    await user.click(screen.getByTitle(`加载${kind}`));
    await user.click(screen.getByRole('menuitem', {name, exact: true}));
}
async function saveNamed(user, name, kind = '需求列表') {
    await user.click(screen.getByTitle(`保存${kind}`));
    const noun = kind === '生产策略' ? '方案' : kind;
    const dialog = screen.getByRole('dialog', {name: `保存${noun}`});
    await user.type(within(dialog).getByRole('textbox', {name: `${noun}名称`}), name);
    await user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
}

describe('bulk pile-sorter preset', () => {
    it('is accessible, updates logistics immediately, preserves production, and supports hover/click/keyboard dismissal', async () => {
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {'铁块目标': {'铁块': 6000}}}));
        const {user} = renderApp();
        expect(toggle()).toHaveTextContent('无集装');
        expect(toggle()).toHaveAccessibleDescription(/选择集装分拣器改良等级.*不改变产量或建筑数量/);
        expect(within(screen.getByRole('region', {name: '批量预设'})).getByRole('combobox', {name: '批量设置分拣器'})).toBe(toggle());
        await loadNamed(user, '铁块目标');
        expect(logistics()).toHaveAccessibleName(/极速传送带 × 4/);
        const before = production();
        await selectLevel(user, 6);
        expect(toggle()).toHaveTextContent('集装改良 6（满级）');
        expect(production()).toEqual(before);
        expect(logistics()).toHaveClass('w-20');
        expect(logistics()).toHaveAccessibleName(/集装改良 6（满级），按来源叠堆.*极速传送带 × 1.*集装分拣器 × 1/);
        expect(within(logistics()).getByRole('img', {name: 'inserter-4'})).toBeInTheDocument();
        await user.hover(logistics());
        let panel = await screen.findByRole('dialog', {name: '铁块物流估算'});
        expect(within(panel).getByText(/分拣器按已选集装预设估算/)).toBeInTheDocument();
        expect(within(panel).getByRole('listitem', {name: '合并毛出料，按来源叠堆 传送带 5 条'})).toHaveTextContent('单条 1440 / min');
        expect(within(panel).getByRole('listitem', {name: '合并毛出料，按来源叠堆 极速传送带 1 条'})).toHaveTextContent('单条 7200 / min');
        expect(within(panel).getByText(/不保证每个货物均为 4 层/)).toBeInTheDocument();
        await user.unhover(logistics());
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await user.click(logistics());
        await user.unhover(logistics());
        panel = screen.getByRole('dialog', {name: '铁块物流估算'});
        await user.click(within(panel).getByText('需求产线'));
        const source = within(panel).getByRole('region', {name: '需求产线出料传送带'});
        expect(within(source).getByText('货物占位 1500.00 / min · 按 4 层')).toBeVisible();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(logistics()).toHaveFocus());
        await selectLevel(user, -1);
        expect(toggle()).toHaveTextContent('无集装');
        expect(logistics()).toHaveAccessibleName(/极速传送带 × 4/);
        expect(production()).toEqual(before);
    });

    it('persists through autosave, reload, named production strategies and complete plans', async () => {
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {'铁块目标': {'铁块': 6000}}}));
        let {user, unmount} = renderApp();
        await loadNamed(user, '铁块目标');
        await selectLevel(user, 6);
        await saveNamed(user, '集装策略', '生产策略');
        await saveNamed(user, '集装完整方案');
        expect(readStore('auto_scheme').Vanilla.pile_sorter_level).toBe(6);
        expect(readStore('scheme_data').Vanilla['集装策略'].pile_sorter_level).toBe(6);
        expect(readStore('needs_list').Vanilla['集装完整方案'].scheme_data.pile_sorter_level).toBe(6);
        await selectLevel(user, -1);
        expect(toggle()).toHaveTextContent('无集装');
        await loadNamed(user, '集装策略', '生产策略');
        expect(toggle()).toHaveTextContent('集装改良 6（满级）');
        await selectLevel(user, -1);
        await loadNamed(user, '集装完整方案');
        expect(toggle()).toHaveTextContent('集装改良 6（满级）');
        expect(logistics()).toHaveAccessibleName(/集装分拣器 × 1/);
        unmount();
        ({user} = renderApp());
        expect(toggle()).toHaveTextContent('集装改良 6（满级）');
        await loadNamed(user, '集装完整方案');
        expect(logistics()).toHaveAccessibleName(/集装分拣器 × 1/);
    });

    it('loads old strategies and complete plans with the toggle off instead of inheriting a newer enabled flag', async () => {
        const oldScheme = init_scheme_data(default_game_data);
        delete oldScheme.pile_sorter_level;
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'旧策略': oldScheme}}));
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {'旧完整方案': {
            plan_version: 1, game_name: 'Vanilla', needs_list: {'铁块': 6000}, scheme_data: oldScheme,
            settings: {production_sources: [], mineralize_list: {}},
        }}}));
        const {user} = renderApp();
        await selectLevel(user, 6);
        await loadNamed(user, '旧策略', '生产策略');
        expect(toggle()).toHaveTextContent('无集装');
        await selectLevel(user, 6);
        await loadNamed(user, '旧完整方案');
        expect(toggle()).toHaveTextContent('无集装');
        expect(logistics()).toHaveAccessibleName(/极速传送带 × 4/);
    });
    it('keeps the sorter beside factory controls and persists an intermediate upgrade through reload', async () => {
        let {user, unmount} = renderApp();
        const region = screen.getByRole('region', {name: '批量预设'});
        expect(toggle().closest('.flex-wrap')).toBe(within(region).getAllByRole('combobox')[0].closest('.flex-wrap'));
        await selectLevel(user, 2);
        expect(readStore('auto_scheme').Vanilla.pile_sorter_level).toBe(2);
        unmount();
        ({user} = renderApp());
        expect(toggle()).toHaveTextContent('集装改良 2 级');
        await selectLevel(user, 0);
        expect(toggle()).toHaveTextContent('集装分拣器（基础）');
        await selectLevel(user, -1);
        expect(toggle()).toHaveTextContent('无集装');
    });

    it('matches factory spacing and shows Mk.I or pile icons in the trigger and every option', async () => {
        const {user} = renderApp();
        const sorter = toggle();
        expect(sorter.querySelector('[role="img"]').getAttribute('aria-label')).toBe('inserter-1');
        const field = sorter.parentElement;
        expect(field.querySelector('.sr-only')).toBeNull();
        expect(field).toHaveClass('space-y-1.5');
        await user.click(sorter);
        const choices = screen.getAllByRole('option');
        expect(choices).toHaveLength(8);
        expect(choices.map(option => option.querySelector('[role="img"]').getAttribute('aria-label')))
            .toEqual(['inserter-1', ...Array(7).fill('inserter-4')]);
        await user.click(screen.getByRole('option', {name: '集装改良 2 级', exact: true}));
        expect(toggle().querySelector('[role="img"]').getAttribute('aria-label')).toBe('inserter-4');
        expect(readStore('auto_scheme').Vanilla.pile_sorter_level).toBe(2);
    });

});
