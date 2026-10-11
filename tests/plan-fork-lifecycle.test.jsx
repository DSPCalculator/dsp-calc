import '@testing-library/jest-dom/vitest';
import {useContext, useEffect} from 'react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {ContextProvider, GlobalStateContext, NeedsListContext, NeedsListSetterContext, PlanLoaderContext, SettingsSetterContext} from '../src/contexts.jsx';
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

const readStore = key => JSON.parse(localStorage.getItem(key));
const manual = (item = '重氢') => screen.getByRole('article', {name: `${item}现有产线 1`});
const sourceInput = (item = '重氢') => within(manual(item)).getByRole('textbox', {name: `${item}现有产线 1分配产量`});
const rowsFor = item => screen.getByRole('region', {name: '生产结果表，可横向滚动'}).querySelectorAll(`tbody > tr[data-product="${item}"]`);

function renderApp() {
    return {user: userEvent.setup(), ...render(<TooltipProvider delayDuration={0}><App/></TooltipProvider>)};
}
async function addItem(user, item, control = '添加需求物品') {
    await user.click(screen.getByRole('button', {name: control}));
    const dialog = screen.getByRole('dialog', {name: '选择物品'});
    await user.type(within(dialog).getByRole('searchbox'), item);
    await user.click(within(dialog).getAllByRole('button', {name: `选择${item}`, exact: true})[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', {name: '选择物品'})).not.toBeInTheDocument());
}
async function setAllocation(user, value, item = '重氢') {
    await user.clear(sourceInput(item));
    await user.type(sourceInput(item), String(value));
    await user.keyboard('{Enter}');
}
async function forkGravity(user) {
    await addItem(user, '引力矩阵');
    await user.click(screen.getByRole('button', {name: '使用重氢配方 2添加产线'}));
    await setAllocation(user, 150);
    expect(screen.getByLabelText('重氢总需求')).toHaveTextContent(/^300.00$/);
    expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^150.00$/);
    expect(sourceInput()).toHaveValue('150.00');
    expect(rowsFor('重氢')).toHaveLength(1);
    expect(readStore('auto_settings').production_sources).toEqual([]);
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
function expectNoDeuteriumFork(rate) {
    expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: '重氢生产来源'})).not.toBeInTheDocument();
    expect(rowsFor('重氢')).toHaveLength(1);
    expect(screen.getByRole('textbox', {name: '重氢产能，等比例调整需求'})).toHaveValue(rate);
    expect(screen.queryByText(/已暂停.*条未被当前需求使用的来源/)).not.toBeInTheDocument();
}

describe('active-plan fork lifecycle', () => {
    it('replaces gravity-matrix targets with strange matter without leaking its deuterium fork, including return and refresh', async () => {
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {
            '奇异物质目标': {'奇异物质': 60}, '引力矩阵目标': {'引力矩阵': 60},
        }}));
        let {user, unmount} = renderApp();
        await forkGravity(user);
        await loadNamed(user, '奇异物质目标');
        expect(screen.getByRole('spinbutton', {name: '奇异物质目标产量'})).toHaveValue(60);
        expect(screen.queryByRole('spinbutton', {name: '引力矩阵目标产量'})).not.toBeInTheDocument();
        expectNoDeuteriumFork('600.00');
        await loadNamed(user, '引力矩阵目标');
        expectNoDeuteriumFork('300.00');
        unmount();
        ({user} = renderApp());
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
        await addItem(user, '引力矩阵');
        expectNoDeuteriumFork('300.00');
    }, 15000);

    it('keeps fork identity and allocation through quantity edits, repeated same-item additions and unit changes', async () => {
        const {user} = renderApp();
        await forkGravity(user);
        const id = manual().dataset.sourceId;
        const target = screen.getByRole('spinbutton', {name: '引力矩阵目标产量'});
        await user.clear(target);
        await user.type(target, '120');
        expect(manual()).toHaveAttribute('data-source-id', id);
        expect(screen.getByLabelText('重氢总需求')).toHaveTextContent(/^600.00$/);
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^450.00$/);
        expect(sourceInput()).toHaveValue('150.00');
        await addItem(user, '引力矩阵');
        expect(screen.getByRole('spinbutton', {name: '引力矩阵目标产量'})).toHaveValue(180);
        expect(manual()).toHaveAttribute('data-source-id', id);
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^750.00$/);
        await user.click(screen.getByRole('tab', {name: '每秒'}));
        expect(manual()).toHaveAttribute('data-source-id', id);
        expect(sourceInput()).toHaveValue('2.50');
        expect(readStore('auto_settings').production_sources).toEqual([]);
    }, 15000);

    it.each(['add', 'remove', 'clear'])('clears current-plan forks when target identity changes via %s', async change => {
        const {user} = renderApp();
        if (change === 'remove') await addItem(user, '铁块');
        await forkGravity(user);
        if (change === 'add') await addItem(user, '铁块');
        else if (change === 'remove') await user.click(screen.getByRole('button', {name: '移除铁块需求'}));
        else {
            await user.click(screen.getByRole('button', {name: '清空需求'}));
            await user.click(within(screen.getByRole('dialog', {name: '清空当前需求？'})).getByRole('button', {name: '清空需求'}));
        }
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expect(readStore('auto_settings').production_sources).toEqual([]);
        if (change !== 'clear') expectNoDeuteriumFork('300.00');
        else expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
    }, 15000);

    it('treats an old raw target-only preset as a new plan even when its target item keys match', async () => {
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {'旧引力目标': {'引力矩阵': 60}}}));
        const {user} = renderApp();
        await forkGravity(user);
        await loadNamed(user, '旧引力目标');
        expectNoDeuteriumFork('300.00');
        expect(readStore('needs_list').Vanilla['旧引力目标']).toEqual({'引力矩阵': 60});
    }, 15000);

    it('keeps deliberately independent existing lines while clearing only plan-owned forks', async () => {
        let {user, unmount} = renderApp();
        await addItem(user, '铁块', '添加现有产线');
        await setAllocation(user, 90, '铁块');
        const independentId = manual('铁块').dataset.sourceId;
        await addItem(user, '引力矩阵');
        await user.click(screen.getByRole('button', {name: '使用重氢配方 2添加产线'}));
        await setAllocation(user, 150);
        expect(manual('铁块')).toHaveAttribute('data-source-id', independentId);
        expect(sourceInput('铁块')).toHaveValue('90.00');
        expect(sourceInput()).toHaveValue('150.00');
        await user.click(screen.getByRole('button', {name: '移除引力矩阵需求'}));
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expect(manual('铁块')).toHaveAttribute('data-source-id', independentId);
        expect(sourceInput('铁块')).toHaveValue('90.00');
        expect(readStore('auto_settings').production_sources).toHaveLength(1);
        expect(readStore('auto_settings').production_sources[0]).toMatchObject({id: independentId, standalone: true, scope: 'global'});
        unmount();
        ({user} = renderApp());
        expect(manual('铁块')).toHaveAttribute('data-source-id', independentId);
        expect(sourceInput('铁块')).toHaveValue('90.00');
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
    }, 15000);

    it('saves strategy-only settings without forks or targets and loads them without replacing the active plan', async () => {
        const {user} = renderApp();
        await forkGravity(user);
        const id = manual().dataset.sourceId;
        await saveNamed(user, '仅配方策略', '生产策略');
        const strategy = readStore('scheme_data').Vanilla['仅配方策略'];
        expect(strategy).not.toHaveProperty('needs_list');
        expect(strategy).not.toHaveProperty('plan_version');
        expect(strategy.production_sources).toEqual([]);
        const target = screen.getByRole('spinbutton', {name: '引力矩阵目标产量'});
        await user.clear(target);
        await user.type(target, '120');
        await loadNamed(user, '仅配方策略', '生产策略');
        expect(screen.getByRole('spinbutton', {name: '引力矩阵目标产量'})).toHaveValue(120);
        expect(manual()).toHaveAttribute('data-source-id', id);
        expect(sourceInput()).toHaveValue('150.00');
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^450.00$/);
        expect(readStore('auto_settings').production_sources).toEqual([]);
    }, 15000);

    it('does not persist or revive a zero-allocation surplus fork even when the calculation needs standalone:true', async () => {
        let {user, unmount} = renderApp();
        await addItem(user, '精炼油');
        await user.click(screen.getByRole('button', {name: '为氢副产物添加独立产线'}));
        await user.click(within(screen.getByRole('article', {name: '氢现有产线 1'})).getByRole('button', {name: '氢配方 2', exact: true}));
        expect(sourceInput('氢')).toHaveValue('0.00');
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(readStore('auto_settings').production_sources).toEqual([]);
        await addItem(user, '铁块');
        expect(screen.queryByRole('article', {name: '氢现有产线 1'})).not.toBeInTheDocument();
        unmount();
        ({user} = renderApp());
        await addItem(user, '精炼油');
        expect(screen.queryByRole('article', {name: '氢现有产线 1'})).not.toBeInTheDocument();
        expect(rowsFor('氢')).toHaveLength(0);
        expect(screen.getByLabelText('氢副产物产量')).toHaveTextContent(/^30.00$/);
    }, 15000);

    it('restores a named complete needs plan only after explicit load, including targets and recipe configurations', async () => {
        const kind = '需求列表';
        let {user, unmount} = renderApp();
        await forkGravity(user);
        const id = manual().dataset.sourceId;
        const ironRow = rowsFor('铁块')[0];
        await user.click(within(ironRow).getByRole('button', {name: '位面熔炉'}));
        const scheme = readStore('auto_scheme').Vanilla;
        await saveNamed(user, '引力完整计划', kind);
        const key = kind === '需求列表' ? 'needs_list' : 'scheme_data';
        const saved = readStore(key).Vanilla['引力完整计划'];
        expect(saved).toMatchObject({plan_version: 1, needs_list: {'引力矩阵': 60}});
        const savedSource = kind === '需求列表' ? saved.settings.production_sources[0] : saved.production_sources[0];
        expect(savedSource).toMatchObject({id, target_item: '重氢', output_per_minute: 150, recipe_choice: 2, scope: 'plan'});
        expect(kind === '需求列表' ? saved.scheme_data : {item_recipe_choices: saved.item_recipe_choices, scheme_for_recipe: saved.scheme_for_recipe, cost_weight: saved.cost_weight}).toEqual(scheme);
        await addItem(user, '铁块');
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        unmount();
        ({user} = renderApp());
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expect(screen.queryByRole('spinbutton', {name: '引力矩阵目标产量'})).not.toBeInTheDocument();
        await loadNamed(user, '引力完整计划', kind);
        expect(screen.getByRole('spinbutton', {name: '引力矩阵目标产量'})).toHaveValue(60);
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        expect(manual()).toHaveAttribute('data-source-id', id);
        expect(sourceInput()).toHaveValue('150.00');
        expect(within(manual()).getByRole('button', {name: '重氢配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('重氢总需求')).toHaveTextContent(/^300.00$/);
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^150.00$/);
        expect(readStore('auto_scheme').Vanilla).toEqual(scheme);
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(readStore(key).Vanilla['引力完整计划']).toEqual(saved);
    }, 15000);
});

function ContextProbe({observe}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const loadPlan = useContext(PlanLoaderContext);
    const setSettings = useContext(SettingsSetterContext);
    useEffect(() => { observe({state, needs, setNeeds, loadPlan, setSettings}); }, [state, needs, setNeeds, loadPlan, setSettings, observe]);
    return null;
}

describe('complete-plan state transitions', () => {
    it('loads targets, sources, calculation settings and recipe settings in one observable commit', () => {
        const seen = [];
        let current;
        render(<ContextProvider><ContextProbe observe={value => { current = value; seen.push(value); }}/></ContextProvider>);
        act(() => current.setNeeds({'铁块': 60}));
        const scheme = init_scheme_data(default_game_data);
        scheme.cost_weight['电力'] = 13;
        const source = {id: 'saved-fork', target_item: '重氢', output_per_minute: 150, recipe_choice: 2,
            building: 0, proliferator_mode: 0, proliferator_points: 0, standalone: false, scope: 'plan'};
        const saved = {plan_version: 1, game_name: 'Vanilla', needs_list: {'引力矩阵': 60}, scheme_data: scheme,
            settings: {...current.state.settings, production_sources: [source], mining_speed_oil: 5}};
        seen.length = 0;
        act(() => current.loadPlan(saved, 'needs'));
        expect(seen.length).toBeGreaterThan(0);
        for (const transition of seen) {
            expect(transition.needs).toEqual({'引力矩阵': 60});
            expect(transition.state.settings.production_sources).toEqual([source]);
            expect(transition.state.settings.mining_speed_oil).toBe(5);
            expect(transition.state.scheme_data).toEqual(scheme);
        }
        expect(readStore('auto_settings').production_sources).toEqual([]);
    });

    it.each([
        ['a different game', plan => { plan.game_name = 'GenesisBook'; }],
        ['a missing game', plan => { delete plan.game_name; }],
        ['an unsupported version', plan => { plan.plan_version = 999; }],
        ['unknown targets', plan => { plan.needs_list = {'不存在的物品': 60}; }],
        ['zero target rates', plan => { plan.needs_list = {'引力矩阵': 0}; }],
        ['nonfinite target rates', plan => { plan.needs_list = {'引力矩阵': Infinity}; }],
        ['string target rates', plan => { plan.needs_list = {'引力矩阵': '60'}; }],
        ['missing recipe configurations', plan => { plan.scheme_data.scheme_for_recipe = []; }],
        ['an invalid recipe choice', plan => { plan.scheme_data.item_recipe_choices['铁块'] = 999; }],
        ['an invalid factory configuration', plan => { plan.scheme_data.scheme_for_recipe[0]['建筑'] = 999; }],
        ['missing item costs', plan => { plan.scheme_data.cost_weight['物品额外成本'] = {}; }],
        ['a malformed source list', plan => { plan.settings.production_sources = {broken: true}; }],
        ['invalid display precision', plan => { plan.settings.fixed_num = 101; }],
        ['fractional display precision', plan => { plan.settings.fixed_num = 1.5; }],
        ['a malformed mineralization list', plan => { plan.settings.mineralize_list = []; }],
        ['a nonfinite mining speed', plan => { plan.settings.mining_speed_oil = Infinity; }],
        ['a zero speed multiplier', plan => { plan.settings.mining_speed_multiple = 0; }],
        ['a fractional laboratory stack', plan => { plan.settings.stack_research_lab = 1.5; }],
        ['a nonboolean time unit', plan => { plan.settings.is_time_unit_minute = 'false'; }],
    ])('rejects complete plans with %s without partially changing the active plan', (_label, corrupt) => {
        let current;
        render(<ContextProvider><ContextProbe observe={value => { current = value; }}/></ContextProvider>);
        act(() => current.setNeeds({'铁块': 60}));
        const source = {id: 'keep-active-fork', target_item: '铁块', output_per_minute: 30, recipe_choice: 1,
            building: 0, proliferator_mode: 0, proliferator_points: 0, standalone: false, scope: 'plan'};
        act(() => current.setSettings({production_sources: [source]}));
        const before = current;
        const savedSettings = readStore('auto_settings');
        const savedScheme = readStore('auto_scheme');
        const invalid = {plan_version: 1, game_name: 'Vanilla', needs_list: {'引力矩阵': 60}, scheme_data: init_scheme_data(default_game_data),
            settings: {...current.state.settings, production_sources: [], mining_speed_oil: 99}};
        corrupt(invalid);
        expect(() => act(() => current.loadPlan(invalid, 'needs'))).toThrow();
        expect(current.needs).toEqual(before.needs);
        expect(current.state.settings).toEqual(before.state.settings);
        expect(current.state.settings.production_sources).toEqual([source]);
        expect(current.state.scheme_data).toEqual(before.state.scheme_data);
        expect(readStore('auto_settings')).toEqual(savedSettings);
        expect(readStore('auto_scheme')).toEqual(savedScheme);
    });
});
