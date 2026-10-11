import '@testing-library/jest-dom/vitest';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, GlobalStateContext} from '../src/contexts.jsx';
import {DependencyOverview} from '../src/dependency_overview.jsx';
import {buildDependencyView} from '../src/dependency_view.js';

afterEach(cleanup);

const settings = {is_time_unit_minute: true, fixed_num: 2, mineralize_list: {}};
const iconState = {game_data: {mods: []}};

function Provider({children, mode = 'compact'}) {
    return <GlobalStateContext.Provider value={iconState}><CompactModeContext.Provider value={mode}>
        {children}
    </CompactModeContext.Provider></GlobalStateContext.Provider>;
}

function graphView(rate = 60) {
    const inputs = {'电路板': {'铁块': 2, '铜块': 1}, '处理器': {'铁块': 3}, '铁块': {'铁矿': 1}, '铜块': {}, '铁矿': {}};
    const state = {settings, item_data: Object.fromEntries(Object.keys(inputs).map(item => [item, []])),
        item_graph: Object.fromEntries(Object.entries(inputs).map(([item, 原料]) => [item, {原料, 副产物: {}}]))};
    return buildDependencyView(state, {'电路板': rate, '处理器': rate}, [{电路板: rate, 处理器: rate, 铁块: rate * 5, 铜块: rate, 铁矿: rate * 5}, {}]);
}

function node(item, id, overrides = {}) {
    return {id, item, kind: 'demand', scope: 'branch', branchRate: 60, globalRate: null,
        depth: 0, children: [], reason: null, boundaryReasons: [], shared: false, omittedInputs: [], ...overrides};
}

function model(roots, supplyRoots = [], overrides = {}) {
    const rows = [];
    function visit(entry) { rows.push(entry); entry.children.forEach(visit); }
    [...roots, ...supplyRoots].forEach(visit);
    return {roots, supplyRoots, rows, sources: {}, warnings: [], limits: {truncated: false},
        items: Object.fromEntries(rows.map(entry => [entry.item, {hasCanonicalRow: true, hasCanonicalGroup: false, sourceIds: []}])), ...overrides};
}

function deepFreeze(value) {
    Object.freeze(value);
    Object.values(value).forEach(entry => { if (entry && typeof entry === 'object' && !Object.isFrozen(entry)) deepFreeze(entry); });
    return value;
}

function show(viewModel, props = {}) {
    return render(<Provider mode={props.mode}><DependencyOverview viewModel={viewModel} settings={settings} {...props}/></Provider>);
}

describe('compact read-only dependency overview', () => {
    it('renders exact branch requirements separately from global production without editable inputs', async () => {
        const view = graphView();
        const {container} = show(view);
        expect(screen.getByRole('columnheader', {name: '本支需求 / min'})).toBeInTheDocument();
        expect(screen.getByLabelText('电路板本支需求')).toHaveTextContent('60.00');
        expect(screen.getByRole('button', {name: '收起电路板的上游原料'})).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getAllByLabelText('铁块本支需求').map(entry => entry.textContent)).toEqual(['120.00', '180.00']);
        expect(screen.getAllByRole('button', {name: '展开铁块的上游原料'})).toHaveLength(2);
        expect(view.items['铁块'].automaticRate).toBe(300);
        expect(screen.getAllByText('共享物料，仅列本支需求')).toHaveLength(2);
        expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
        expect(screen.queryByRole('tree')).not.toBeInTheDocument();
        expect(screen.getByText(/请勿相加作为全局生产量/)).toBeInTheDocument();
    });

    it('expands repeated shared branches independently and keeps stable path IDs across collapse', async () => {
        const user = userEvent.setup();
        const {container} = show(graphView());
        const ironButtons = screen.getAllByRole('button', {name: '展开铁块的上游原料'});
        const ids = ironButtons.map(button => button.closest('tr').dataset.nodeId);
        expect(new Set(ids).size).toBe(2);
        await user.click(ironButtons[0]);
        expect(screen.getAllByLabelText('铁矿本支需求')).toHaveLength(1);
        expect(screen.getByLabelText('铁矿本支需求')).toHaveTextContent('120.00');
        expect(ironButtons[1]).toHaveAttribute('aria-expanded', 'false');
        await user.click(ironButtons[1]);
        expect(screen.getAllByLabelText('铁矿本支需求').map(entry => entry.textContent)).toEqual(['120.00', '180.00']);
        await user.click(screen.getByRole('button', {name: '收起电路板的上游原料'}));
        expect(screen.getAllByLabelText('铁矿本支需求')).toHaveLength(1);
        expect(screen.getByLabelText('铁矿本支需求')).toHaveTextContent('180.00');
        await user.click(screen.getByRole('button', {name: '展开电路板的上游原料'}));
        expect([...container.querySelectorAll('[data-node-id]')].filter(row => ids.includes(row.dataset.nodeId)).map(row => row.dataset.nodeId)).toEqual(ids);
        expect(screen.getAllByLabelText('铁矿本支需求')).toHaveLength(2);
    });

    it('keeps reference boundaries explicit and does not offer fictional source routing', async () => {
        const reference = node('铁块', 'circuit/iron', {depth: 1, branchRate: 120, reason: 'global-supply',
            boundaryReasons: ['manual-supply', 'byproduct-supply', 'external-supply'], shared: true});
        const view = model([node('电路板', 'circuit', {children: [reference]})]);
        show(view);
        expect(screen.getByText(/现有产线供给、副产物供给、外部供给；引用全局供给，未分配给本支/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '展开铁块的上游原料'})).not.toBeInTheDocument();
        expect(screen.getByLabelText('铁块本支需求')).toHaveTextContent('120.00');
    });

    it('ends a cyclic recipe at an explicit reference with no recursive expansion control', async () => {
        const user = userEvent.setup();
        const state = {settings, item_data: {铁块: [], 磁铁: []}, item_graph: {
            铁块: {原料: {磁铁: 0.5}, 副产物: {}}, 磁铁: {原料: {铁块: 0.5}, 副产物: {}},
        }};
        show(buildDependencyView(state, {铁块: 60}, [{铁块: 80, 磁铁: 40}, {}]));
        await user.click(screen.getByRole('button', {name: '展开磁铁的上游原料'}));
        expect(screen.getByText('循环引用，查看全局供给')).toBeInTheDocument();
        const cyclicRow = screen.getByText('循环引用，查看全局供给').closest('tr');
        expect(within(cyclicRow).getByLabelText('铁块本支需求')).toHaveTextContent('15.00');
        expect(within(cyclicRow).queryByRole('button', {name: /上游原料/})).not.toBeInTheDocument();
    });

    it('labels orphan global sources, their inputs, and surplus as already counted global quantities', async () => {
        const user = userEvent.setup();
        const input = node('铁矿', 'supply/ore', {scope: 'global', branchRate: null, globalRate: 80, depth: 1, reason: 'raw'});
        const source = node('铁块', 'supply/iron', {kind: 'supply', scope: 'global', sourceId: 'manual:iron', branchRate: null, globalRate: 80, children: [input]});
        const view = model([], [source]);
        view.items['铁块'] = {hasCanonicalRow: true, hasCanonicalGroup: true, sourceIds: ['auto:iron', 'manual:iron'], surplusRate: 30};
        view.sources = {
            'auto:iron': {id: 'auto:iron', kind: 'automatic', item: '铁块', outputRate: 0},
            'manual:iron': {id: 'manual:iron', kind: 'manual', item: '铁块', outputRate: 80},
        };
        show(view);
        expect(screen.getByRole('heading', {name: '全局供给与投入'})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: '全局数量 / min'})).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: /本支需求/})).not.toBeInTheDocument();
        expect(screen.getByText(/已计入全局总量，不是新增目标需求/)).toBeInTheDocument();
        expect(screen.getByLabelText('铁块全局产出')).toHaveTextContent('80.00');
        expect(screen.getByText('全局溢出 30.00 / min（非本支需求）')).toBeInTheDocument();
        expect(screen.getByText(/全局：/)).toHaveTextContent('全局：需求产线 0.00 / min；现有产线 1 80.00 / min');
        await user.click(screen.getByRole('button', {name: '展开铁块的上游原料'}));
        expect(screen.getByLabelText('铁矿全局投入')).toHaveTextContent('80.00');
        expect(screen.queryByLabelText('铁矿本支需求')).not.toBeInTheDocument();
    });

    it('only shows canonical group labels where the real group exists and links ordinary rows too', async () => {
        const user = userEvent.setup();
        const onShowGlobal = vi.fn();
        const view = model([node('电路板', 'circuit'), node('铁矿', 'ore')]);
        view.items['电路板'].sourceIds = ['automatic:circuit'];
        view.sources['automatic:circuit'] = {id: 'automatic:circuit', kind: 'automatic', outputRate: 60};
        view.items['铁矿'].hasCanonicalRow = false;
        show(view, {onShowGlobal});
        expect(screen.queryByText(/需求产线/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '查看铁矿全局产线'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '查看电路板全局产线'}));
        expect(onShowGlobal).toHaveBeenCalledExactlyOnceWith('电路板');
    });

    it('supports native keyboard expansion and canonical navigation without mutating the view or settings', async () => {
        const user = userEvent.setup();
        const onShowGlobal = vi.fn();
        const view = deepFreeze(graphView());
        const snapshot = JSON.stringify(view);
        const frozenSettings = deepFreeze(structuredClone(settings));
        show(view, {settings: frozenSettings, onShowGlobal});
        const toggle = screen.getByRole('button', {name: '收起电路板的上游原料'});
        toggle.focus();
        await user.keyboard('{Enter}');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveFocus();
        await user.keyboard(' ');
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const link = screen.getByRole('button', {name: '查看电路板全局产线'});
        link.focus();
        await user.keyboard('{Enter}');
        expect(onShowGlobal).toHaveBeenCalledExactlyOnceWith('电路板');
        expect(JSON.stringify(view)).toBe(snapshot);
        expect(frozenSettings).toEqual(settings);
    });

    it.each(['full', 'compact', 'narrow', 'mobile'])('retains 16px text, comfortable rows, and approved icons in %s mode', mode => {
        const {container} = show(graphView(), {mode});
        const overview = screen.getByRole('region', {name: '依赖树只读视图'});
        expect(overview).toHaveClass('w-fit', 'min-w-0', 'max-w-full', 'text-base');
        const table = container.querySelector('.dsp-dependency-table');
        expect(table).toHaveClass('w-auto', 'text-base');
        expect(table).not.toHaveClass('w-full');
        expect(container.querySelector('.dsp-dependency-table-card')).toHaveClass('w-fit', 'min-w-0', 'max-w-full');
        const scroll = screen.getByRole('region', {name: '目标依赖表，可横向滚动'});
        expect(scroll).toHaveClass('max-h-[70dvh]', 'max-w-full', 'overflow-auto', 'overscroll-x-contain', 'focus-visible:outline-2');
        expect(scroll).toHaveAttribute('tabindex', '0');
        expect(table.querySelector('thead')).toHaveClass('sticky', 'top-0');
        for (const cell of table.querySelectorAll('tbody td')) expect(cell).toHaveClass('px-2', 'py-3');
        for (const icon of table.querySelectorAll('[role="img"]')) expect(icon).toHaveStyle({width: mode === 'mobile' ? '24px' : '40px', height: mode === 'mobile' ? '24px' : '40px'});
    });

    it('caps indentation at 24px while keeping thin guides and the true depth accessible', () => {
        const {container} = show(model([node('铁块', 'depth-one', {depth: 1}), node('铁矿', 'depth-eight', {depth: 8})]));
        const contents = container.querySelectorAll('.dsp-dependency-item-content');
        expect(contents[0]).toHaveStyle({paddingInlineStart: '4px'});
        expect(contents[1]).toHaveStyle({paddingInlineStart: '24px'});
        const guides = container.querySelectorAll('.dsp-dependency-guides');
        expect(guides[0]).toHaveAttribute('aria-hidden', 'true');
        expect(guides[0]).toHaveStyle({width: '4px'});
        expect(guides[1]).toHaveStyle({width: '24px'});
        expect(guides[1].getAttribute('style')).toContain('3px');
        expect(screen.getByText('第 9 层')).toHaveClass('sr-only');
    });

    it('bounds visible rows with keyboard-accessible pagination without dropping later roots', async () => {
        const user = userEvent.setup();
        const {container} = show(model(Array.from({length: 201}, (_, index) => node('铁块', `root-${index}`, {branchRate: index + 1}))));
        expect(container.querySelectorAll('tbody tr')).toHaveLength(200);
        expect(screen.getByRole('button', {name: '上一页'})).toBeDisabled();
        const next = screen.getByRole('button', {name: '下一页'});
        next.focus();
        await user.keyboard('{Enter}');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(screen.getByLabelText('铁块本支需求')).toHaveTextContent('201.00');
        expect(container.querySelector('[data-node-id]')).toHaveAttribute('data-node-id', 'root-200');
        expect(next).toBeDisabled();
        await user.click(screen.getByRole('button', {name: '上一页'}));
        expect(container.querySelectorAll('tbody tr')).toHaveLength(200);
    });

    it('marks projection truncation explicitly rather than silently treating it as a raw leaf', () => {
        const root = node('电路板', 'capped', {reason: 'node-limit', truncated: true, omittedInputs: [{item: '铁块', rate: 120}]});
        show(model([root], [], {limits: {truncated: true}}));
        expect(screen.getByText('上游条目已达到显示上限')).toBeInTheDocument();
        expect(screen.getByText('未展开原料：铁块；可查看全局产线')).toBeInTheDocument();
        expect(screen.getByRole('status', {name: '依赖显示限制'})).toHaveTextContent('省略处已标记');
        expect(screen.queryByRole('button', {name: /上游原料/})).not.toBeInTheDocument();
    });

    it('formats rates already supplied in the current unit without applying another conversion', () => {
        const {rerender} = show(graphView());
        expect(screen.getByLabelText('电路板本支需求')).toHaveTextContent('60.00');
        rerender(<Provider><DependencyOverview viewModel={graphView(1)} settings={{...settings, is_time_unit_minute: false, fixed_num: 3}}/></Provider>);
        expect(screen.getByRole('columnheader', {name: '本支需求 / s'})).toBeInTheDocument();
        expect(screen.getByLabelText('电路板本支需求')).toHaveTextContent('1.000');
    });
});
