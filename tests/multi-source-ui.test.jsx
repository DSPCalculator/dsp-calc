import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useRef, useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext, SettingsSetterContext} from '../src/contexts.jsx';
import {Result} from '../src/result.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

let runtimeSources;
let activeState;
const activeSources = () => activeState.settings.production_sources;

beforeEach(() => {
    localStorage.clear();
    runtimeSources = [];
    activeState = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function UnitSwitch() {
    const setSettings = useContext(SettingsSetterContext);
    return <button onClick={() => setSettings({is_time_unit_minute: false})}>显示每秒</button>;
}

function RuntimeFixtures() {
    const setSettings = useContext(SettingsSetterContext);
    const initialized = useRef(false);
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            if (runtimeSources.length) setSettings({production_sources: runtimeSources});
        }
    }, [setSettings]);
    const state = useContext(GlobalStateContext);
    useEffect(() => { activeState = state; }, [state]);
    return null;
}

function Overview({mode = 'full', initialNeeds = {'重氢': 300}}) {
    const [needs, setNeeds] = useState(initialNeeds);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingsOpen, setBuildingsOpen] = useState(false);
    return <TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <RuntimeFixtures/>
        <UnitSwitch/>
        <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
            show_building_popup={buildingsOpen} set_show_building_popup={setBuildingsOpen}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>;
}

function source(item = '重氢', output = 0, id = 'line-1', patch = {}) {
    return {id, target_item: item, scope: patch.standalone ? 'global' : 'plan', output_per_minute: output, recipe_choice: 1, building: 0,
        proliferator_mode: 0, proliferator_points: 0, ...patch};
}
// Bound fixtures are active-plan state, never legacy/global autosaves.
function seed(sources) { runtimeSources = sources; }
function productOrder() {
    return Array.from(screen.getByRole('region', {name: '生产结果表，可横向滚动'}).querySelectorAll('tbody > tr[data-product]'), row => row.dataset.product);
}
function manual(item = '重氢', ordinal = 1) { return screen.getByRole('article', {name: `${item}现有产线 ${ordinal}`}); }
function auto(item = '重氢') { return screen.getByRole('article', {name: `${item}需求产线`}); }
async function allocate(user, value, item = '重氢', ordinal = 1) {
    const input = within(manual(item, ordinal)).getByRole('textbox', {name: `${item}现有产线 ${ordinal}分配产量`});
    await user.clear(input);
    await user.type(input, String(value));
    await user.keyboard('{Enter}');
}

describe('product-grouped independent source cards', () => {
    it('keeps an intermediate at its dependency position with two vertically stacked source strips and separate total demand', async () => {
        const user = userEvent.setup();
        const initialNeeds = {'氘核燃料棒': 30};
        const baseline = render(<Overview initialNeeds={initialNeeds}/>);
        const order = productOrder();
        expect(order.indexOf('重氢')).toBeGreaterThan(0);
        baseline.unmount();
        seed([source()]);
        render(<Overview initialNeeds={initialNeeds}/>);
        expect(productOrder()).toEqual(order);
        const group = screen.getByRole('region', {name: '重氢生产来源'});
        expect(group).toHaveAttribute('id', 'production-sources-重氢');
        expect(group).toHaveAttribute('tabindex', '-1');
        expect(group).toHaveClass('scroll-mt-20');
        expect(group.closest('tr')).toHaveAttribute('data-product', '重氢');
        expect(group.closest('td')).toHaveAttribute('colspan', '8');
        const cards = within(group).getByRole('region', {name: '重氢产线，可横向滚动'});
        expect(cards).toHaveClass('flex', 'flex-col', 'overflow-x-auto');
        expect(cards).not.toHaveClass('flex-nowrap');
        expect(within(cards).getAllByRole('article')).toHaveLength(2);
        expect(within(group).getByLabelText('重氢总需求')).toHaveTextContent(/^300.00$/);
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent('300.00');
        expect(within(manual()).getByRole('textbox', {name: /分配产量/})).toHaveValue('0.00');
        await allocate(user, 150);
        expect(productOrder()).toEqual(order);
        expect(within(group).getByLabelText('重氢总需求')).toHaveTextContent(/^300.00$/);
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent('150.00');
        expect(within(manual()).getByRole('textbox', {name: /分配产量/})).toHaveValue('150.00');
        expect(within(group).getByLabelText('重氢合计生产')).toHaveTextContent('300.00 / min');
    });

    it('retains the automatic card at zero and warns on excess without changing the required amount', async () => {
        const user = userEvent.setup();
        seed([source()]);
        render(<Overview/>);
        await allocate(user, 300);
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(screen.queryByText(/超额分配/)).not.toBeInTheDocument();
        await allocate(user, 400);
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(screen.getByText(/超额分配/)).toHaveTextContent('100.00 / min');
        expect(screen.getByLabelText('重氢总需求')).toHaveTextContent(/^300.00$/);
        expect(screen.getByLabelText('重氢合计生产')).toHaveTextContent('400.00 / min');
    });

    it('adds multiple zero sources inside the same local scroller and preserves surviving identities on remove', async () => {
        const user = userEvent.setup();
        seed([source('重氢', 150)]);
        render(<Overview/>);
        const firstId = manual().dataset.sourceId;
        await user.click(screen.getByRole('button', {name: '添加重氢产线'}));
        await user.click(screen.getByRole('button', {name: '添加重氢产线'}));
        const cards = screen.getByRole('region', {name: '重氢产线，可横向滚动'});
        expect(within(cards).getAllByRole('article')).toHaveLength(4);
        expect(within(manual('重氢', 2)).getByRole('textbox', {name: /分配产量/})).toHaveValue('0.00');
        const thirdId = manual('重氢', 3).dataset.sourceId;
        expect(new Set(within(cards).getAllByRole('article').map(card => card.dataset.sourceId)).size).toBe(4);
        await user.click(within(manual('重氢', 2)).getByRole('button', {name: '删除重氢现有产线 2'}));
        expect(manual().dataset.sourceId).toBe(firstId);
        expect(manual('重氢', 2).dataset.sourceId).toBe(thirdId);
        await user.click(within(manual()).getByRole('button', {name: '删除重氢现有产线 1'}));
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent('300.00');
        await user.click(within(manual()).getByRole('button', {name: '删除重氢现有产线 1'}));
        expect(screen.queryByRole('region', {name: '重氢生产来源'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '重氢产能，等比例调整需求'})).toHaveValue('300.00');
    });

    it('keeps manual recipe, factory, and proliferation selections independent of auto and other manual sources', async () => {
        const user = userEvent.setup();
        seed([source('铁块', 60, 'iron-a'), source('铁块', 0, 'iron-b')]);
        render(<Overview initialNeeds={{'铁块': 300}}/>);
        await user.click(within(manual('铁块')).getByRole('button', {name: '位面熔炉'}));
        await user.click(within(manual('铁块')).getByRole('button', {name: '增产', exact: true}));
        expect(within(manual('铁块')).getByRole('button', {name: '位面熔炉'})).toHaveAttribute('aria-pressed', 'true');
        expect(within(auto('铁块')).getByRole('button', {name: '位面熔炉'})).toHaveAttribute('aria-pressed', 'false');
        expect(within(manual('铁块', 2)).getByRole('button', {name: '位面熔炉'})).toHaveAttribute('aria-pressed', 'false');
        expect(within(manual('铁块')).getByRole('button', {name: '增产', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(auto('铁块')).getByRole('button', {name: '无', exact: true})).toHaveAttribute('aria-pressed', 'true');
        await user.click(within(manual('铁块')).getByRole('button', {name: '铁块配方 2', exact: true}));
        expect(within(manual('铁块')).getByRole('button', {name: '铁块配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(auto('铁块')).getByRole('button', {name: '铁块配方 1', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(manual('铁块', 2)).getByRole('button', {name: '铁块配方 1', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(manual('铁块')).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('rejects negative allocations and preserves the last valid physical allocation when switching units', async () => {
        const user = userEvent.setup();
        seed([source('重氢', 150)]);
        render(<Overview/>);
        const input = within(manual()).getByRole('textbox', {name: /分配产量/});
        await user.clear(input);
        await user.type(input, '-2');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        await user.keyboard('{Enter}');
        expect(input).toHaveValue('150.00');
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent('150.00');
        await user.click(screen.getByRole('button', {name: '显示每秒'}));
        expect(within(manual()).getByRole('textbox', {name: /分配产量/})).toHaveValue('2.50');
        expect(activeSources()[0].output_per_minute).toBe(150);
    });

    it.each(['full', 'compact', 'mobile'])('keeps readable card controls and horizontal scrolling in %s mode', mode => {
        seed([source('铁块', 150)]);
        render(<Overview mode={mode} initialNeeds={{'铁块': 300}}/>);
        const group = screen.getByRole('region', {name: '铁块生产来源'});
        expect(group.querySelector('[role="img"]')).toHaveStyle({width: '40px', height: '40px'});
        expect(manual('铁块')).toHaveClass('shrink-0', 'text-base', 'py-4');
        expect(within(manual('铁块')).getByRole('textbox', {name: /分配产量/})).toHaveClass('text-base');
        expect(within(manual('铁块')).getByRole('button', {name: '位面熔炉'}).querySelector('[role="img"]')).toHaveStyle({width: '32px', height: '32px'});
        const recipe = manual('铁块').querySelector('.dsp-full-recipe');
        expect(recipe.querySelector('[role="img"]')).toHaveStyle({width: '28px', height: '28px'});
        expect(within(group).getByRole('region', {name: '铁块产线，可横向滚动'})).toHaveAttribute('tabindex', '0');
    });

    it('leaves all summary totals unchanged when adding a zero source to a large-miner chain', () => {
        const scheme = init_scheme_data(default_game_data);
        const oreRecipes = default_game_data.recipe_data.map((recipe, index) => ({recipe, index})).filter(({recipe}) => Object.hasOwn(recipe['产物'], '铁矿'));
        const ore = oreRecipes.find(({recipe}) => default_game_data.factory_data[recipe['设施']].some(factory => factory['名称'] === '大型采矿机'));
        scheme.item_recipe_choices['铁矿'] = oreRecipes.indexOf(ore) + 1;
        scheme.scheme_for_recipe[ore.index]['建筑'] = default_game_data.factory_data[ore.recipe['设施']].findIndex(factory => factory['名称'] === '大型采矿机');
        localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: scheme}));
        const baseline = render(<Overview initialNeeds={{'铁块': 300}}/>);
        const summary = screen.getByRole('complementary', {name: '生产统计'}).textContent;
        baseline.unmount();
        seed([source('铁块')]);
        render(<Overview initialNeeds={{'铁块': 300}}/>);
        expect(screen.getByRole('complementary', {name: '生产统计'}).textContent).toBe(summary);
    });

    it.each([
        ['mineralized external supply', {mineralize_list: {'铁块': true}}],
        ['hidden mining rows', {hide_mines: true}],
    ])('keeps zero-source summary equivalence with %s', (_label, settings) => {
        localStorage.setItem('auto_settings', JSON.stringify(settings));
        const baseline = render(<Overview initialNeeds={{'铁块': 300}}/>);
        const summary = screen.getByRole('complementary', {name: '生产统计'}).textContent;
        baseline.unmount();
        localStorage.setItem('auto_settings', JSON.stringify(settings));
        seed([source('铁块')]);
        render(<Overview initialNeeds={{'铁块': 300}}/>);
        expect(screen.getByRole('complementary', {name: '生产统计'}).textContent).toBe(summary);
    });

    it('counts each source once in sidebar and dialog totals, including raw-material demand', async () => {
        const user = userEvent.setup();
        seed([source('铁块', 150)]);
        render(<Overview initialNeeds={{'铁块': 300}}/>);
        const summary = screen.getByRole('complementary', {name: '生产统计'});
        const furnaceRow = within(summary).getByText('电弧熔炉', {exact: true}).closest('tr');
        // Each independently allocated 2.5-furnace source needs three buildings.
        expect(within(furnaceRow).getAllByRole('cell')[1]).toHaveTextContent('6.00');
        const oreRow = within(summary).getByText('铁矿', {exact: true}).closest('tr');
        expect(within(oreRow).getAllByRole('cell')[1]).toHaveTextContent('300.00/min');
        await user.click(screen.getByRole('button', {name: '建筑与需求', exact: true}));
        const dialog = screen.getByRole('dialog', {name: '建筑与需求'});
        const dialogOre = within(dialog).getByText('铁矿', {exact: true}).closest('tr');
        expect(within(dialogOre).getAllByRole('cell')[1]).toHaveTextContent('300.00/min');
        const dialogFurnace = within(dialog).getByText('电弧熔炉', {exact: true}).closest('tr');
        expect(within(dialogFurnace).getAllByRole('cell')[1]).toHaveTextContent('6.00');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(within(manual('铁块')).getByRole('textbox', {name: /分配产量/})).toHaveValue('150.00');
    });

    it('keeps an explicitly independent zero-only product editable when there is no target demand', () => {
        seed([source('铁块', 0, 'standalone-iron', {standalone: true})]);
        render(<Overview initialNeeds={{}}/>);
        expect(screen.getByLabelText('铁块总需求')).toHaveTextContent(/^0.00$/);
        expect(within(auto('铁块')).getByLabelText('铁块需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(within(manual('铁块')).getByRole('textbox', {name: /分配产量/})).toHaveValue('0.00');
        expect(screen.queryByText('开始规划你的生产线')).not.toBeInTheDocument();
    });

    it('shows unused runtime plan sources as paused without phantom rows and discards them on reload', () => {
        seed([source('重氢', 150), source('氢', 30, 'hydrogen')]);
        const first = render(<Overview initialNeeds={{'铁块': 60}}/>);
        expect(productOrder()).not.toContain('重氢');
        expect(productOrder()).not.toContain('氢');
        const status = screen.getByText('已暂停2条未被当前需求使用的来源').closest('details');
        expect(status).not.toHaveAttribute('open');
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expect(activeSources()).toHaveLength(2);
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
        first.unmount();
        runtimeSources = [];
        render(<Overview initialNeeds={{'铁块': 60}}/>);
        expect(productOrder()).not.toContain('重氢');
        expect(productOrder()).not.toContain('氢');
        expect(screen.queryByText('已暂停2条未被当前需求使用的来源')).not.toBeInTheDocument();
        expect(activeSources()).toEqual([]);
    });

    it('lets a paused runtime source become deliberately independent, survive reload, and pass its intent to an added source', async () => {
        const user = userEvent.setup();
        seed([source('铁块', 60)]);
        const first = render(<Overview initialNeeds={{}}/>);
        await user.click(screen.getByText('已暂停1条未被当前需求使用的来源'));
        expect(screen.getByText('铁块 · 60.00 / min')).toBeVisible();
        await user.click(screen.getByRole('button', {name: '作为独立产线启用'}));
        expect(screen.queryByText(/已暂停.*条未被当前需求使用的来源/)).not.toBeInTheDocument();
        expect(within(manual('铁块')).getByRole('textbox', {name: /分配产量/})).toHaveValue('60.00');
        await user.click(screen.getByRole('button', {name: '添加铁块产线'}));
        expect(activeSources().every(source => source.standalone && source.scope === 'global')).toBe(true);
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual(activeSources());
        first.unmount();
        runtimeSources = [];
        render(<Overview initialNeeds={{}}/>);
        expect(within(manual('铁块')).getByRole('textbox', {name: /分配产量/})).toHaveValue('60.00');
        expect(manual('铁块', 2)).toBeInTheDocument();
    });

    it('can remove a paused source and converts its displayed rate without changing its saved allocation', async () => {
        const user = userEvent.setup();
        seed([source('铁块', 150)]);
        render(<Overview initialNeeds={{}}/>);
        await user.click(screen.getByText('已暂停1条未被当前需求使用的来源'));
        await user.click(screen.getByRole('button', {name: '显示每秒'}));
        expect(screen.getByText('铁块 · 2.50 / s')).toBeVisible();
        expect(activeSources()[0].output_per_minute).toBe(150);
        await user.click(screen.getByRole('button', {name: '删除已暂停来源 1 铁块'}));
        expect(screen.queryByText(/已暂停.*条未被当前需求使用的来源/)).not.toBeInTheDocument();
        expect(activeSources()).toHaveLength(0);
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
    });

    it.each(['已删除的物品', '__proto__', 'constructor'])('surfaces unknown active-plan target %s and allows removing it', async item => {
        const user = userEvent.setup();
        seed([source(item, 150)]);
        render(<Overview initialNeeds={{}}/>);
        expect(screen.getByRole('alert')).toHaveTextContent(item);
        await user.click(screen.getByRole('button', {name: `删除无效产线${item}`} ));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText('开始规划你的生产线')).toBeInTheDocument();
    });

    it('shows invalid source errors and lets an invalid recipe be repaired or removed without crashing', async () => {
        const user = userEvent.setup();
        seed([source('铁块', 150, 'bad-recipe', {recipe_choice: 999})]);
        render(<Overview initialNeeds={{'铁块': 300}}/>);
        expect(within(manual('铁块')).getByRole('alert')).toHaveTextContent('来源配方已失效');
        await user.click(within(manual('铁块')).getByRole('button', {name: '铁块配方 1', exact: true}));
        expect(within(manual('铁块')).queryByRole('alert')).not.toBeInTheDocument();
        expect(within(auto('铁块')).getByLabelText('铁块需求产线产量')).toHaveTextContent('150.00');
    });
});
