import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useRef, useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext, NeedsListContext, NeedsListSetterContext,
    PlanLoaderContext, SettingsSetterContext} from '../src/contexts.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {Result} from '../src/result.jsx';
import {createNeedsPlanSnapshot} from '../src/lib/plan-state.js';
import {TooltipProvider} from '../src/components/ui/tooltip';

let current;
beforeEach(() => {
    localStorage.clear();
    current = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Fixture({sources, initialNeeds}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const setSettings = useContext(SettingsSetterContext);
    const loadPlan = useContext(PlanLoaderContext);
    const initialized = useRef(false);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingsOpen, setBuildingsOpen] = useState(false);
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            setNeeds(initialNeeds);
            setSettings({production_sources: sources});
        }
        current = {state, needs, setNeeds, setSettings, loadPlan};
    }, [state, needs, setNeeds, setSettings, loadPlan, initialNeeds, sources]);
    return <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
        show_building_popup={buildingsOpen} set_show_building_popup={setBuildingsOpen}/>;
}

function mount({sources = [], needs = {'石墨烯': 120, '氢': 100}, automaticGraphene = 2, mode = 'full'} = {}) {
    const scheme = init_scheme_data(default_game_data);
    const info = new GameInfo(default_game_data);
    // The hydrogen remainder uses collection, avoiding unrelated oil coproducts.
    scheme.item_recipe_choices['氢'] = info.item_data['氢'].findIndex((recipeId, index) => index > 0
        && Object.keys(default_game_data.recipe_data[recipeId]['原料']).length === 0);
    scheme.item_recipe_choices['石墨烯'] = automaticGraphene;
    localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: scheme}));
    // Recipe switches to ordinary graphene should not start an oil side-chain.
    localStorage.setItem('auto_settings', JSON.stringify({mineralize_list: {'硫酸': true, '高能石墨': true}}));
    return render(<TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <Fixture sources={sources} initialNeeds={needs}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>);
}

const source = (id, output, patch = {}) => ({id, target_item: '石墨烯', output_per_minute: output, scope: 'plan',
    recipe_choice: 2, building: 0, proliferator_mode: 0, proliferator_points: 0, ...patch});
const linked = (ordinal = 1) => screen.getByRole('article', {name: `氢副产来源 ${ordinal}`});
const manual = (ordinal = 1) => screen.getByRole('article', {name: `石墨烯现有产线 ${ordinal}`});
const linkedOutput = (ordinal = 1) => within(linked(ordinal)).getByLabelText(`氢副产来源 ${ordinal}产量`);
const stored = () => current.state.settings.production_sources;
const summary = () => screen.getByRole('complementary', {name: '生产统计'});
const viewButton = name => within(screen.getByRole('group', {name: '生产结果视图'})).getByRole('button', {name});
async function editSource(user, value, ordinal = 1, field = '分配产量') {
    const input = within(manual(ordinal)).getByRole('textbox', {name: `石墨烯现有产线 ${ordinal}${field}`});
    await user.clear(input);
    await user.type(input, String(value));
    await user.keyboard('{Enter}');
}

describe('read-only linked byproduct production cards', () => {
    it('automatically groups a 60/min graphene coproduct with the 40/min hydrogen remainder without creating a source', () => {
        mount();
        const group = screen.getByRole('region', {name: '氢生产来源'});
        expect(within(group).getByLabelText('氢总需求')).toHaveTextContent(/^100.00$/);
        expect(within(group).getByLabelText('氢需求产线产量')).toHaveTextContent(/^40.00$/);
        expect(linkedOutput()).toHaveTextContent(/^60.00$/);
        expect(within(group).getByLabelText('氢合计生产')).toHaveTextContent('100.00 / min');
        expect(within(group).getAllByRole('article')).toHaveLength(2);
        expect(linked()).toHaveAttribute('data-parent-source-id', 'auto:石墨烯');
        expect(within(linked()).getByRole('heading')).toHaveTextContent('氢副产物 · 来自石墨烯产线');
        expect(stored()).toEqual([]);
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
        expect(linked().querySelectorAll('input, select, textarea')).toHaveLength(0);
        expect(within(linked()).getAllByRole('button')).toHaveLength(1);
        expect(within(linked()).getByRole('button', {name: '查看石墨烯需求产线（氢副产来源 1）'})).toBeEnabled();
        expect(within(linked()).queryByLabelText(/工厂数量/)).not.toBeInTheDocument();
        const chemicalPlants = within(summary()).getByText('化工厂', {exact: true}).closest('tr');
        expect(within(chemicalPlants).getAllByRole('cell')[1]).toHaveTextContent(/^2.00$/);
    });

    it.each([
        {demand: 300, automatic: 240, produced: 300, surplus: 0},
        {demand: 60, automatic: 0, produced: 60, surplus: 0},
        {demand: 30, automatic: 0, produced: 60, surplus: 30},
    ])('shows the full $demand hydrogen demand before crediting coproduct supply', ({demand, automatic, produced, surplus}) => {
        mount({needs: {'石墨烯': 120, '氢': demand}});
        const group = screen.getByRole('region', {name: '氢生产来源'});
        expect(within(group).getByLabelText('氢总需求').textContent).toBe(demand.toFixed(2));
        expect(within(group).getByLabelText('氢需求产线产量').textContent).toBe(automatic.toFixed(2));
        expect(linkedOutput()).toHaveTextContent(/^60.00$/);
        expect(within(group).getByLabelText('氢合计生产')).toHaveTextContent(`${produced.toFixed(2)} / min`);
        if (surplus) expect(within(group).getByText(/超额分配/)).toHaveTextContent('多余产物 30.00 / min，需求产线已降至 0');
        else expect(within(group).queryByText(/超额分配/)).not.toBeInTheDocument();
    });

    it('attaches surplus-only coproducts to their producer without a zero-demand main group', () => {
        mount({needs: {'石墨烯': 120}});
        expect(screen.queryByRole('region', {name: '氢生产来源'})).not.toBeInTheDocument();
        const producer = screen.getByRole('row', {name: '石墨烯全局产线', exact: true});
        expect(within(producer).getByLabelText('氢副产物产量')).toHaveTextContent(/^60.00$/);
        expect(current.state.calculate(current.needs)[1].氢).toBe(60);
        expect(stored()).toEqual([]);
    });

    it('labels negative-target external credit separately from the real linked coproduct supply', () => {
        mount({needs: {'石墨烯': 120, '重氢': 30, '氢': -20}});
        const group = screen.getByRole('region', {name: '氢生产来源'});
        expect(within(group).getByLabelText('氢总需求')).toHaveTextContent(/^60.00$/);
        expect(within(group).getByLabelText('氢需求产线产量')).toHaveTextContent(/^0.00$/);
        expect(linkedOutput()).toHaveTextContent(/^60.00$/);
        expect(within(group).getByText('含副产物供给 60.00 / min')).toBeInTheDocument();
        expect(within(group).getByText('含外部供给 20.00 / min')).toBeInTheDocument();
        expect(within(group).getByLabelText('氢合计生产')).toHaveTextContent('80.00 / min');
        expect(within(group).getByText(/超额分配/)).toHaveTextContent('多余产物 20.00 / min');
        expect(screen.getAllByRole('article', {name: /^氢副产来源/})).toHaveLength(1);
    });

    it('focuses an automatic parent in the same flat view without changing settings or totals', async () => {
        const user = userEvent.setup();
        mount();
        const before = summary().textContent;
        const settings = JSON.stringify(current.state.settings);
        await user.click(within(linked()).getByRole('button', {name: '查看石墨烯需求产线（氢副产来源 1）'}));
        expect(screen.getByRole('row', {name: '石墨烯全局产线'})).toHaveFocus();
        expect(viewButton('平铺')).toHaveAttribute('aria-pressed', 'true');
        expect(summary().textContent).toBe(before);
        expect(JSON.stringify(current.state.settings)).toBe(settings);
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({block: 'nearest', inline: 'nearest'});
    });

    it('keeps two manual parent identities and their 30/min and 90/min coproducts distinct', async () => {
        const user = userEvent.setup();
        mount({sources: [source('graphene-a', 60), source('graphene-b', 180)], needs: {'石墨烯': 240, '氢': 150}});
        expect(screen.getByLabelText('氢总需求')).toHaveTextContent(/^150.00$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^30.00$/);
        expect(linkedOutput(1)).toHaveTextContent(/^30.00$/);
        expect(linkedOutput(2)).toHaveTextContent(/^90.00$/);
        expect(linked(1)).toHaveAttribute('data-parent-source-id', 'graphene-a');
        expect(linked(2)).toHaveAttribute('data-parent-source-id', 'graphene-b');
        expect(screen.getAllByRole('article', {name: /^氢副产来源/})).toHaveLength(2);
        expect(stored().map(entry => entry.id)).toEqual(['graphene-a', 'graphene-b']);
        const chemicalPlants = within(summary()).getByText('化工厂', {exact: true}).closest('tr');
        expect(within(chemicalPlants).getAllByRole('cell')[1]).toHaveTextContent(/^4.00$/);
        await user.click(within(linked(2)).getByRole('button', {name: '查看石墨烯现有产线 2（氢副产来源 2）'}));
        expect(manual(2)).toHaveFocus();
    });

    it('updates parent edits and removes deleted-parent references while keeping the surviving identity', async () => {
        const user = userEvent.setup();
        mount({sources: [source('graphene-a', 60), source('graphene-b', 180)], automaticGraphene: 1,
            needs: {'石墨烯': 240, '氢': 200}});
        await editSource(user, 100);
        expect(linkedOutput(1)).toHaveTextContent(/^50.00$/);
        expect(linkedOutput(2)).toHaveTextContent(/^90.00$/);
        expect(screen.getByLabelText('氢总需求')).toHaveTextContent(/^200.00$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^60.00$/);
        await user.click(within(manual()).getByRole('button', {name: '删除石墨烯现有产线 1'}));
        expect(screen.getAllByRole('article', {name: /^氢副产来源/})).toHaveLength(1);
        expect(linked()).toHaveAttribute('data-parent-source-id', 'graphene-b');
        expect(linkedOutput()).toHaveTextContent(/^90.00$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^110.00$/);
        expect(within(linked()).getByRole('button', {name: '查看石墨烯现有产线 1（氢副产来源 1）'})).toBeEnabled();
        await user.click(within(manual()).getByRole('button', {name: '删除石墨烯现有产线 1'}));
        expect(screen.queryByRole('article', {name: /^氢副产来源/})).not.toBeInTheDocument();
        expect(screen.queryByRole('region', {name: '氢生产来源'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '氢产能，等比例调整需求'})).toHaveValue('200.00');
        expect(stored()).toEqual([]);
    });

    it('removes a coproduct when its parent recipe changes and restores just one reference when switched back', async () => {
        const user = userEvent.setup();
        mount({sources: [source('graphene-a', 120)], automaticGraphene: 1});
        expect(linkedOutput()).toHaveTextContent(/^60.00$/);
        await user.click(within(manual()).getByRole('button', {name: '石墨烯配方 1', exact: true}));
        expect(screen.queryByRole('article', {name: /^氢副产来源/})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '氢产能，等比例调整需求'})).toHaveValue('100.00');
        await user.click(within(manual()).getByRole('button', {name: '石墨烯配方 2', exact: true}));
        expect(screen.getAllByRole('article', {name: /^氢副产来源/})).toHaveLength(1);
        expect(linked()).toHaveAttribute('data-parent-source-id', 'graphene-a');
        expect(linkedOutput()).toHaveTextContent(/^60.00$/);
        expect(stored()).toHaveLength(1);
    });

    it('recomputes fixed-count parent coproducts after proliferation without adding machinery to the linked card', async () => {
        const user = userEvent.setup();
        mount({sources: [source('graphene-a', 120, {quantity_mode: 'buildings', building_quantity: 2})], automaticGraphene: 1});
        expect(linkedOutput()).toHaveTextContent(/^60.00$/);
        await user.click(within(manual()).getByRole('button', {name: '增产', exact: true}));
        expect(within(manual()).getByRole('textbox', {name: /工厂数量/})).toHaveValue('2.00');
        expect(linkedOutput()).toHaveTextContent(/^75.00$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^25.00$/);
        await user.click(within(manual()).getByRole('button', {name: /增产剂\s+Mk\.II$/}));
        expect(linkedOutput()).toHaveTextContent(/^72.00$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^28.00$/);
        expect(linked().querySelectorAll('input, select, textarea')).toHaveLength(0);
        expect(stored()).toHaveLength(1);
        expect(stored()[0]).toMatchObject({id: 'graphene-a', building_quantity: 2, proliferator_mode: 2, proliferator_points: 2});
    });

    it('reconstructs links from repeated saved-plan reloads without persisting duplicate source records', () => {
        mount({sources: [source('graphene-a', 60), source('graphene-b', 60)]});
        const saved = structuredClone(createNeedsPlanSnapshot(current.needs, current.state.scheme_data,
            current.state.settings, current.state.game_data.game_name));
        expect(saved.settings.production_sources.map(entry => entry.id)).toEqual(['graphene-a', 'graphene-b']);
        expect(JSON.stringify(saved)).not.toContain('byproduct:');
        for (let iteration = 0; iteration < 2; iteration++) {
            act(() => current.setNeeds({'铁块': 60}));
            expect(screen.queryByRole('article', {name: /^氢副产来源/})).not.toBeInTheDocument();
            act(() => current.loadPlan(saved, 'needs'));
            expect(screen.getAllByRole('article', {name: /^氢副产来源/})).toHaveLength(2);
            expect(linkedOutput(1)).toHaveTextContent(/^30.00$/);
            expect(linkedOutput(2)).toHaveTextContent(/^30.00$/);
            expect(stored()).toEqual(saved.settings.production_sources);
            expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
        }
    });

    it('converts displayed linked rates to seconds while retaining canonical parent output and true demand', () => {
        mount({sources: [source('graphene-a', 120)]});
        act(() => {
            current.setSettings({is_time_unit_minute: false});
            current.setNeeds({'石墨烯': 2, '氢': 100 / 60});
        });
        expect(linkedOutput()).toHaveTextContent(/^1.00$/);
        expect(within(linked()).getByText('/ s')).toBeInTheDocument();
        expect(screen.getByLabelText('氢总需求')).toHaveTextContent(/^1.67$/);
        expect(screen.getByLabelText('氢需求产线产量')).toHaveTextContent(/^0.67$/);
        expect(screen.getByLabelText('氢合计生产')).toHaveTextContent('1.67 / s');
        expect(stored()[0]).toMatchObject({id: 'graphene-a', output_per_minute: 120});
    });

    it('opens the global linked group from an unallocated branch and navigates to its original manual parent', async () => {
        const user = userEvent.setup();
        mount({sources: [source('graphene-a', 120)], mode: 'mobile'});
        const before = summary().textContent;
        await user.click(viewButton('树状'));
        const demandTable = screen.getByRole('region', {name: '目标依赖表，可横向滚动'});
        expect(within(demandTable).getByLabelText('氢本支产能')).toHaveTextContent('—');
        expect(within(demandTable).getByLabelText('氢本支工厂数量')).toHaveTextContent('—');
        expect(within(demandTable).getByRole('article', {name: '氢副产来源 1'})).not.toBeVisible();
        await user.click(within(demandTable).getByLabelText('氢全局来源设置'));
        const treeLink = within(demandTable).getByRole('article', {name: '氢副产来源 1'});
        expect(within(treeLink).getByLabelText('氢副产来源 1产量')).toHaveTextContent(/^60.00$/);
        await user.click(within(treeLink).getByRole('button', {name: '查看石墨烯现有产线 1（氢副产来源 1）'}));
        expect(manual()).toHaveFocus();
        expect(summary().textContent).toBe(before);
        expect(stored()).toHaveLength(1);
    });
});
