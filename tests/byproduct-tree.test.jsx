import '@testing-library/jest-dom/vitest';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, GlobalStateContext} from '../src/contexts.jsx';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {createProductionSource} from '../src/production_sources.js';
import {buildDependencyView} from '../src/dependency_view.js';
import {DependencyOverview} from '../src/dependency_overview.jsx';
import {createScenario} from './helpers/solver-cases.js';

const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const displaySettings = {is_time_unit_minute: true, fixed_num: 2, mineralize_list: {}};

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function grapheneState(settings = {}) {
    const {state, scheme} = createScenario(api, {recipes: {'石墨烯': 2}, settings});
    scheme.item_recipe_choices.氢 = state.item_data.氢.slice(1)
        .findIndex(id => !Object.keys(state.game_data.recipe_data[id].原料).length) + 1;
    return new GlobalState({game_data: state.game_data, item_data: structuredClone(state.item_data)}, scheme, state.settings);
}

function grapheneSource(state, output, id) {
    return {...createProductionSource(state, '石墨烯'), id, output_per_minute: output};
}

function show(viewModel, settings = displaySettings, onShowGlobal = vi.fn()) {
    const result = render(<GlobalStateContext.Provider value={{game_data: {mods: []}}}>
        <CompactModeContext.Provider value="compact">
            <DependencyOverview viewModel={viewModel} settings={settings} onShowGlobal={onShowGlobal}/>
        </CompactModeContext.Provider>
    </GlobalStateContext.Provider>);
    return {...result, onShowGlobal};
}

function deepFreeze(value) {
    Object.freeze(value);
    Object.values(value).forEach(entry => {
        if (entry && typeof entry === 'object' && !Object.isFrozen(entry)) deepFreeze(entry);
    });
    return value;
}

function hydrogenDemand() {
    return within(screen.getByRole('region', {name: '目标依赖表，可横向滚动'}))
        .getByLabelText('氢本支需求').closest('tr');
}

function synthetic({settings = {}, production = {'石墨烯': 120}, automatic, sources = [], legacy_sources = [], order} = {}) {
    const state = {settings: {...displaySettings, ...settings}, item_data: {'石墨烯': [], '氢': [], '可燃冰': []},
        item_graph: {'石墨烯': {原料: {}, 副产物: {'氢': 0.5}}, '氢': {原料: {}, 副产物: {}}, '可燃冰': {原料: {}, 副产物: {}}}};
    const calculation = [production, {}, automatic || sources.length || legacy_sources.length
        ? {automatic: automatic || {}, sources, legacy_sources, order: order || Object.keys(production)} : undefined];
    // This fixture tests hydrogen as a coproduct. Both products must have
    // demand so the demand-first projection retains the graphene owner.
    const needs = {'氢': 60, ...(production.石墨烯 > 0 ? {'石墨烯': production.石墨烯} : {})};
    return {state, calculation, view: buildDependencyView(state, needs, calculation)};
}

describe('read-only linked coproduct references in the dependency tree', () => {
    it('shows graphene hydrogen supply and automatic remainder and navigates to the existing parent', async () => {
        const user = userEvent.setup();
        const state = grapheneState();
        state.settings.production_sources = [grapheneSource(state, 120, 'graphene-line')];
        const needs = {'石墨烯': 120, '氢': 100};
        const calculation = state.calculate(needs);
        const before = structuredClone({settings: state.settings, graph: state.item_graph, scheme: state.scheme_data, needs, calculation});
        const calculate = vi.spyOn(state, 'calculate').mockImplementation(() => { throw new Error('must not solve'); });
        const baseline = vi.spyOn(state, 'calculateBaseline').mockImplementation(() => { throw new Error('must not solve'); });
        const view = deepFreeze(buildDependencyView(state, needs, calculation));
        const {container, onShowGlobal} = show(view, state.settings);
        expect(view.items.氢).toMatchObject({requiredRate: 100, byproductRate: 60, automaticRate: 40,
            hasCanonicalRow: true, hasCanonicalGroup: true});
        const demand = within(hydrogenDemand());
        expect(demand.getByLabelText('氢本支需求')).toHaveTextContent(/^100.00$/);
        expect(demand.getByLabelText('氢来自石墨烯现有产线 1的全局副产物供给')).toHaveTextContent(/^60.00$/);
        expect(demand.getByText(/全局：/)).toHaveTextContent('需求产线 40.00 / min');
        expect(demand.getByText(/未分配给本支/)).toBeInTheDocument();
        expect(demand.getByText(/已计入全局供给，未指定分支分配/)).toBeInTheDocument();
        await user.click(demand.getByRole('button', {name: '查看石墨烯现有产线 1（氢副产物来源）'}));
        expect(onShowGlobal).toHaveBeenCalledExactlyOnceWith('石墨烯', 'graphene-line');
        expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
        expect(calculate).not.toHaveBeenCalled();
        expect(baseline).not.toHaveBeenCalled();
        expect({settings: state.settings, graph: state.item_graph, scheme: state.scheme_data, needs, calculation}).toEqual(before);
    });

    it('keeps distinct same-item parents and counts each physical source only once', async () => {
        const user = userEvent.setup();
        const state = grapheneState();
        state.settings.production_sources = [grapheneSource(state, 40, 'graphene-one'), grapheneSource(state, 80, 'graphene-two')];
        const needs = {'石墨烯': 120, '氢': 100};
        const calculation = state.calculate(needs);
        const totals = structuredClone(calculation[2].totals);
        const view = buildDependencyView(state, needs, calculation);
        const {onShowGlobal} = show(view, state.settings);
        const demand = within(hydrogenDemand());
        expect(demand.getByLabelText('氢来自石墨烯现有产线 1的全局副产物供给')).toHaveTextContent(/^20.00$/);
        expect(demand.getByLabelText('氢来自石墨烯现有产线 2的全局副产物供给')).toHaveTextContent(/^40.00$/);
        await user.click(demand.getByRole('button', {name: '查看石墨烯现有产线 1（氢副产物来源）'}));
        await user.click(demand.getByRole('button', {name: '查看石墨烯现有产线 2（氢副产物来源）'}));
        expect(onShowGlobal.mock.calls).toEqual([['石墨烯', 'graphene-one'], ['石墨烯', 'graphene-two']]);
        expect(view.items.氢.byproductRate).toBe(60);
        expect(view.items.氢.coproductSourceIds).toEqual(['manual:graphene-one', 'manual:graphene-two']);
        for (const id of view.items.氢.coproductSourceIds) expect(view.supplyRoots.filter(root => root.sourceId === id)).toHaveLength(1);
        expect(view.supplyRoots.filter(root => root.item === '氢')).toHaveLength(1);
        expect(view.sources[view.supplyRoots.find(root => root.item === '氢').sourceId].kind).toBe('automatic');
        expect(view.roots.find(root => root.item === '氢').children).toEqual([]);
        expect(calculation[2].totals).toEqual(totals);
    });

    it('links automatic parents by their UI source id, including fully coproduct-supplied receiving items', async () => {
        const user = userEvent.setup();
        const {view} = synthetic();
        const {onShowGlobal} = show(view);
        expect(view.items.氢).toMatchObject({automaticRate: 0, byproductRate: 60, hasCanonicalRow: true, hasCanonicalGroup: true});
        const demand = within(hydrogenDemand());
        expect(demand.getByLabelText('氢来自石墨烯需求产线的全局副产物供给')).toHaveTextContent(/^60.00$/);
        const link = demand.getByRole('button', {name: '查看石墨烯需求产线（氢副产物来源）'});
        link.focus();
        await user.keyboard('{Enter}');
        expect(onShowGlobal).toHaveBeenCalledExactlyOnceWith('石墨烯', 'auto:石墨烯');
        expect(demand.getByRole('button', {name: '查看氢全局产线'})).toBeInTheDocument();
        expect(view.supplyRoots.some(root => root.item === '氢')).toBe(false);
    });

    it('links a moved automatic process through its display owner and original physical editor ID', async () => {
        const user = userEvent.setup();
        const {state} = createScenario(api, {recipes: {'石墨烯': 1, '氢': 2}});
        const needs = {'太阳帆': 60, '氢': 10};
        const view = buildDependencyView(state, needs, state.calculate(needs));
        const {onShowGlobal} = show(view, state.settings);
        const demand = within(hydrogenDemand());
        expect(view.sources['automatic:automatic-氢']).toMatchObject({item: '石墨烯', controlItem: '氢', uiId: 'auto:氢'});
        expect(demand.getByLabelText('氢来自石墨烯需求产线的全局副产物供给')).toHaveTextContent(/^15.00$/);
        await user.click(demand.getByRole('button', {name: '查看石墨烯需求产线（氢副产物来源）'}));
        expect(onShowGlobal).toHaveBeenCalledExactlyOnceWith('石墨烯', 'auto:氢');
        expect(view.supplyRoots.some(root => root.item === '氢')).toBe(false);
    });

    it('keeps coproduct-only receiving groups visible with hide_mines but does not link a hidden parent', () => {
        const {view, state} = synthetic({settings: {hide_mines: true, mineralize_list: {'氢': true}}});
        show(view, state.settings);
        expect(view.items.氢).toMatchObject({hasCanonicalRow: true, hasCanonicalGroup: true});
        expect(view.items.石墨烯.hasCanonicalRow).toBe(false);
        const demand = within(hydrogenDemand());
        expect(demand.getByLabelText('氢来自石墨烯需求产线的全局副产物供给')).toHaveTextContent(/^60.00$/);
        expect(demand.queryByRole('button', {name: '查看石墨烯需求产线（氢副产物来源）'})).not.toBeInTheDocument();
        expect(demand.getByRole('button', {name: '查看氢全局产线'})).toBeInTheDocument();
    });

    it('preserves legacy supply references without pretending a manual parent editor exists', () => {
        const {view} = synthetic({production: {}, legacy_sources: [{id: 'old-line', target_item: '石墨烯', output: 120, byproducts: {'氢': 60}}]});
        show(view);
        expect(view.items.氢).toMatchObject({byproductRate: 60, hasCanonicalRow: true, hasCanonicalGroup: true});
        expect(view.items.石墨烯.hasCanonicalRow).toBe(false);
        const demand = within(hydrogenDemand());
        expect(demand.getByLabelText('氢来自石墨烯全局供给的全局副产物供给')).toHaveTextContent(/^60.00$/);
        expect(demand.queryByRole('button', {name: /查看石墨烯/})).not.toBeInTheDocument();
    });

    it('does not invent a visible parent row from an automatic record absent from production', () => {
        const {view} = synthetic({production: {}, order: ['石墨烯'],
            automatic: {'石墨烯': {id: 'unrepresented', output: 120, byproducts: {'氢': 60}}}});
        show(view);
        expect(view.items.石墨烯.hasCanonicalRow).toBe(false);
        expect(view.items.氢.hasCanonicalGroup).toBe(true);
        expect(within(hydrogenDemand()).queryByRole('button', {name: /查看石墨烯/})).not.toBeInTheDocument();
    });

    it('uses supplied per-second rates without rescaling or changing the physical totals', () => {
        const state = grapheneState({is_time_unit_minute: false});
        state.settings.production_sources = [grapheneSource(state, 120, 'graphene-line')];
        const needs = {'石墨烯': 2, '氢': 100 / 60};
        const calculation = state.calculate(needs);
        const view = buildDependencyView(state, needs, calculation);
        show(view, state.settings);
        expect(view.items.氢.byproductRate).toBe(1);
        expect(view.items.氢.automaticRate).toBeCloseTo(2 / 3, 8);
        const reference = within(hydrogenDemand()).getByLabelText('氢来自石墨烯现有产线 1的全局副产物供给');
        expect(reference).toHaveTextContent(/^1.00$/);
        expect(reference.closest('li')).toHaveTextContent('1.00 / s');
    });

    it('retains the same pooled reference at separate branches without creating source allocations', () => {
        const {state, calculation} = synthetic();
        Object.assign(state.item_data, {'重氢': [], '能量矩阵': []});
        Object.assign(state.item_graph, {'重氢': {原料: {'氢': 1}, 副产物: {}}, '能量矩阵': {原料: {'氢': 1}, 副产物: {}}});
        Object.assign(calculation[0], {'重氢': 20, '能量矩阵': 40});
        const view = buildDependencyView(state, {'重氢': 20, '能量矩阵': 40, '石墨烯': 120}, calculation);
        show(view);
        expect(screen.getAllByLabelText('氢本支需求').map(output => output.textContent)).toEqual(['20.00', '40.00']);
        expect(screen.getAllByLabelText('氢来自石墨烯需求产线的全局副产物供给').map(output => output.textContent)).toEqual(['60.00', '60.00']);
        expect(view.items.氢.byproductRate).toBe(60);
        expect(view.items.氢.coproductSourceIds).toHaveLength(1);
        expect(view.roots.filter(root => root.item === '石墨烯')).toHaveLength(1);
        expect(view.supplyRoots.filter(root => root.item === '石墨烯')).toHaveLength(0);
        expect(view.supplyRoots.some(root => root.item === '氢')).toBe(false);
        expect(view.roots.filter(root => root.item !== '石墨烯')
            .every(root => root.children[0].reason === 'global-supply' && root.children[0].children.length === 0)).toBe(true);
    });
});
