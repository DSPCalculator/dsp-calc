import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useRef, useState} from 'react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {CompactModeContext, ContextProvider, GlobalStateContext, NeedsListContext, NeedsListSetterContext,
    SettingsSetterContext} from '../src/contexts.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {Result} from '../src/result.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

let current;
beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
    localStorage.clear();
    current = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const info = new GameInfo(default_game_data);
function factoryChoice(item, factoryName) {
    return info.item_data[item].findIndex((recipeId, index) => index > 0
        && default_game_data.factory_data[default_game_data.recipe_data[recipeId].设施]
            .some(factory => factory.名称 === factoryName));
}
const collectorChoice = item => factoryChoice(item, '轨道采集器');
function configure({bothCollected = false} = {}) {
    const scheme = init_scheme_data(default_game_data);
    scheme.item_recipe_choices['氢'] = collectorChoice('氢');
    scheme.item_recipe_choices['重氢'] = factoryChoice('重氢', bothCollected ? '轨道采集器' : '微型粒子对撞机');
    localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: scheme}));
}
const source = (output = 24) => ({id: 'deuterium-collector', target_item: '重氢', output_per_minute: output,
    recipe_choice: collectorChoice('重氢'), building: 0, proliferator_mode: 0, proliferator_points: 0, scope: 'plan'});

function Fixture({sources, initialNeeds}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const setSettings = useContext(SettingsSetterContext);
    const initialized = useRef(false);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingsOpen, setBuildingsOpen] = useState(false);
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            setNeeds(initialNeeds);
            setSettings({production_sources: sources});
        }
        current = {state, needs, setNeeds, setSettings};
    }, [state, needs, setNeeds, setSettings, sources, initialNeeds]);
    return <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
        show_building_popup={buildingsOpen} set_show_building_popup={setBuildingsOpen}/>;
}
function mount({sources = [source()], needs = {'氘核燃料棒': 30}, bothCollected = false, mode = 'full'} = {}) {
    configure({bothCollected});
    return {user: userEvent.setup(), ...render(<TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <Fixture initialNeeds={needs} sources={sources}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>)};
}
const manual = () => screen.getByRole('article', {name: '重氢现有产线 1'});
const allocation = () => within(manual()).getByRole('textbox', {name: '重氢现有产线 1分配产量'});
const shared = () => screen.getByRole('region', {name: '共享轨道采集'});
const statistics = () => screen.getByRole('complementary', {name: '生产统计'});
const viewButton = name => within(screen.getByRole('group', {name: '生产结果视图'})).getByRole('button', {name, exact: true});
const stored = key => JSON.parse(localStorage.getItem(key));
async function edit(user, input, value) {
    await user.clear(input);
    await user.type(input, String(value));
    await user.keyboard('{Enter}');
}
function expectShared({count, fraction, hydrogen, deuterium}) {
    expect(within(shared()).getByLabelText('共享轨道采集数量')).toHaveTextContent(new RegExp(`^${count}$`));
    expect(shared()).toHaveTextContent(`需求折算 ${fraction.toFixed(2)} 台`);
    expect(within(shared()).getByLabelText('共享采集氢产量').textContent).toBe(hydrogen.toFixed(2));
    expect(within(shared()).getByLabelText('共享采集重氢产量').textContent).toBe(deuterium.toFixed(2));
    const collectorRow = within(statistics()).getByText('轨道采集器', {exact: true}).closest('tr');
    expect(within(collectorRow).getAllByRole('cell')[1]).toHaveTextContent(count.toFixed(2));
}

describe('shared hydrogen and deuterium orbital collectors', () => {
    it('rebalances both gases when a manual collector allocation changes without counting the shared fleet twice', async () => {
        const {user} = mount();
        expectShared({count: 2, fraction: 1.09375, hydrogen: 525, deuterium: 26.25});
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^273.75$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^45.00$/);
        expect(within(manual()).getByText('共享采集', {exact: true})).toBeVisible();
        expect(manual()).toHaveTextContent('同组共 2 台');
        expect(within(manual()).getByText('采集需求折算', {exact: true})).toBeVisible();
        expect(within(manual()).getByRole('textbox', {name: '重氢现有产线 1工厂数量'})).toHaveAccessibleDescription(/共享同一组采集器，数量不相加/);

        await edit(user, allocation(), 150);
        expectShared({count: 7, fraction: 6.25, hydrogen: 3000, deuterium: 150});
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^150.00$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(screen.getByRole('region', {name: '氢生产来源'})).toHaveTextContent('多余产物 2722.50 / min');
        expect(current.state.settings.production_sources).toHaveLength(1);
        expect(current.state.settings.production_sources[0]).toMatchObject({id: 'deuterium-collector', output_per_minute: 150});
        expect(stored('auto_settings').production_sources).toEqual([]);
    });

    it('removes the manual allocation and rebuilds the same physical fleet from automatic collection', async () => {
        const {user} = mount({sources: [source(150)]});
        expectShared({count: 7, fraction: 6.25, hydrogen: 3000, deuterium: 150});
        await user.click(within(manual()).getByRole('button', {name: '删除重氢现有产线 1'}));
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expectShared({count: 2, fraction: 1.09375, hydrogen: 525, deuterium: 26.25});
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^273.75$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^525.00$/);
        const details = current.state.calculate(current.needs)[2];
        expect(details.shared_collectors).toHaveLength(1);
        expect(details.shared_collectors[0].source_ids).not.toContain('deuterium-collector');
        expect(current.state.settings.production_sources).toEqual([]);
    });

    it('shows matching hydrogen and deuterium demand as one shared fleet in flat and tree views', async () => {
        const {user} = mount({sources: [], needs: {'氢': 480, '重氢': 24}, bothCollected: true, mode: 'mobile'});
        expectShared({count: 1, fraction: 1, hydrogen: 480, deuterium: 24});
        const details = current.state.calculate(current.needs)[2];
        expect(details.shared_collectors).toHaveLength(1);
        const groupId = details.shared_collectors[0].id;
        expect(details.automatic['氢'].shared_collector_group).toBe(groupId);
        expect(details.automatic['重氢'].shared_collector_group).toBe(groupId);
        expect(details.automatic['氢'].buildings).toBeCloseTo(1, 10);
        expect(details.automatic['重氢'].buildings).toBe(0);
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(screen.getByLabelText('重氢合计生产')).toHaveTextContent('24.00 / min');
        for (const item of ['氢', '重氢']) {
            const row = screen.getByRole('row', {name: `${item}全局产线`});
            expect(row).toHaveTextContent('共享');
            expect(row).toHaveTextContent('同组共 1 台');
        }
        const deuteriumReference = screen.getByRole('article', {name: '重氢副产来源 1'});
        expect(deuteriumReference).toHaveTextContent('同组轨道采集');
        expect(within(deuteriumReference).queryByLabelText('重氢副产来源 1原配方')).not.toBeInTheDocument();
        const before = statistics().textContent;
        await user.click(viewButton('树状'));
        expectShared({count: 1, fraction: 1, hydrogen: 480, deuterium: 24});
        expect(statistics().textContent).toBe(before);
        await user.click(viewButton('平铺'));
        expectShared({count: 1, fraction: 1, hydrogen: 480, deuterium: 24});
        expect(statistics().textContent).toBe(before);
    });

    it('converts shared gas output to seconds without changing physical collectors or canonical allocation', () => {
        mount({sources: [source(150)]});
        act(() => {
            current.setSettings({is_time_unit_minute: false});
            current.setNeeds({'氘核燃料棒': 0.5});
        });
        expectShared({count: 7, fraction: 6.25, hydrogen: 50, deuterium: 2.5});
        expect(allocation()).toHaveValue('2.50');
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^2.50$/);
        expect(current.state.settings.production_sources[0].output_per_minute).toBe(150);
    });

    it('reconstructs shared collectors after a full App save, reload and repeated flat/tree switches', async () => {
        configure();
        let user = userEvent.setup();
        let app = render(<TooltipProvider><App/></TooltipProvider>);
        await edit(user, screen.getByRole('spinbutton', {name: '目标产量', exact: true}), 30);
        await user.click(screen.getByRole('button', {name: '添加需求物品'}));
        const picker = screen.getByRole('dialog', {name: '选择物品'});
        await user.type(within(picker).getByRole('searchbox'), '氘核燃料棒');
        await user.click(within(picker).getAllByRole('button', {name: '选择氘核燃料棒', exact: true})[0]);
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '选择物品'})).not.toBeInTheDocument());
        await user.click(screen.getByRole('button', {name: `使用重氢配方 ${collectorChoice('重氢')}添加产线`}));
        await edit(user, allocation(), 24);
        const id = manual().dataset.sourceId;
        expectShared({count: 2, fraction: 1.09375, hydrogen: 525, deuterium: 26.25});
        await user.click(screen.getByTitle('保存需求列表'));
        const dialog = screen.getByRole('dialog', {name: '保存需求列表'});
        await user.type(within(dialog).getByRole('textbox', {name: '需求列表名称'}), '共享采集燃料棒');
        await user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
        const saved = stored('needs_list').Vanilla['共享采集燃料棒'];
        expect(saved).toMatchObject({plan_version: 1, needs_list: {'氘核燃料棒': 30}});
        expect(saved.settings.production_sources).toHaveLength(1);
        expect(saved.settings.production_sources[0]).toMatchObject({id, output_per_minute: 24, scope: 'plan'});
        expect(JSON.stringify(saved)).not.toContain('shared_collectors');
        expect(JSON.stringify(saved)).not.toContain('shared_collector_group');
        app.unmount();
        user = userEvent.setup();
        app = render(<TooltipProvider><App/></TooltipProvider>);
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        await user.click(screen.getByTitle('加载需求列表'));
        await user.click(screen.getByRole('menuitem', {name: '共享采集燃料棒', exact: true}));
        expect(screen.getByRole('spinbutton', {name: '氘核燃料棒目标产量'})).toHaveValue(30);
        const before = statistics().textContent;
        for (const layout of ['树状', '平铺', '树状', '平铺']) {
            await user.click(viewButton(layout));
            expectShared({count: 2, fraction: 1.09375, hydrogen: 525, deuterium: 26.25});
            expect(statistics().textContent).toBe(before);
        }
        expect(manual()).toHaveAttribute('data-source-id', id);
        expect(allocation()).toHaveValue('24.00');
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^273.75$/);
        expect(stored('needs_list').Vanilla['共享采集燃料棒']).toEqual(saved);
        expect(stored('auto_settings').production_sources).toEqual([]);
        app.unmount();
    });
});
