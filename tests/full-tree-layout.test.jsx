import '@testing-library/jest-dom/vitest';
import {useContext} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, GlobalStateContext} from '../src/contexts.jsx';
import {DependencyOverview} from '../src/dependency_overview.jsx';
import {ProductionColumns, ProductionRowInstanceContext} from '../src/production_result_row.jsx';

afterEach(cleanup);

const settings = {is_time_unit_minute: true, fixed_num: 2};
function Provider({children}) {
    return <GlobalStateContext.Provider value={{game_data: {mods: []}}}>
        <CompactModeContext.Provider value="compact">{children}</CompactModeContext.Provider>
    </GlobalStateContext.Provider>;
}
function node(item, id, overrides = {}) {
    const branchRate = overrides.branchRate ?? 60;
    const production = {capacity: branchRate, buildings: branchRate / 60, displayOffset: 0, status: 'recipe'};
    return {item, id, depth: 0, kind: 'demand', scope: 'branch', branchRate, production,
        children: [], boundaryReasons: [], omittedInputs: [], ...overrides};
}
function model(roots, supplyRoots = [], overrides = {}) {
    const rows = [];
    const stack = [...roots, ...supplyRoots];
    while (stack.length) { const row = stack.shift(); rows.push(row); stack.push(...row.children); }
    return {roots, supplyRoots, rows, sources: {}, warnings: [], limits: {truncated: false},
        items: Object.fromEntries(rows.map(row => [row.item, {hasCanonicalRow: true, sourceIds: []}])), ...overrides};
}
function canonical(item, onAction = () => {}, capacity = '777.00') {
    return <tr data-item={item} aria-label={`${item}全局产线`}>
        <td><button onClick={() => onAction('add')}>添加{item}产线</button><button onClick={() => onAction('raw')}>{item}原矿化</button></td>
        <td>{item}</td>
        <td><input aria-label={`${item}产能，等比例调整需求`} value={capacity} onChange={event => onAction('capacity', event.target.value)}/></td>
        <td><output aria-label={`${item}工厂数量`}>42.50</output></td>
        <td><select aria-label={`${item}配方`} defaultValue="a" onChange={event => onAction('recipe', event.target.value)}><option value="a">完整配方 A</option><option value="b">完整配方 B</option></select><button onClick={() => onAction('fork')}>分叉{item}配方</button></td>
        <td><select aria-label={`${item}增产模式`} onChange={event => onAction('mode', event.target.value)}><option value="a">不使用</option><option value="b">增产</option></select></td>
        <td><select aria-label={`${item}增产剂`} onChange={event => onAction('proliferator', event.target.value)}><option value="a">无</option><option value="b">Mk.III</option></select></td>
        <td><select aria-label={`${item}工厂类型`} onChange={event => onAction('factory', event.target.value)}><option value="a">电弧熔炉</option><option value="b">位面熔炉</option></select></td>
        <td><span>物流：传送带 3 / 集装分拣器 2</span></td>
    </tr>;
}
function ScopedSourceEditor() {
    const instance = useContext(ProductionRowInstanceContext);
    const id = `${instance}-source-iron`;
    return <section id={id} data-source-id="iron-a"><label htmlFor={`${id}-output`}>来源产量</label><input id={`${id}-output`} defaultValue="350"/></section>;
}
function show(viewModel, canonicalRows, extra = {}) {
    return render(<Provider><DependencyOverview viewModel={viewModel} canonicalRows={canonicalRows} settings={settings} {...extra}/></Provider>);
}
const treeRow = name => screen.getByRole('row', {name});

describe('complete inline production rows in the dependency tree', () => {
    it('keeps canonical settings while replacing global quantities with read-only branch values', () => {
        const headerView = render(<table><thead><tr><ProductionColumns unit="min" branch/></tr></thead></table>);
        const expectedHeaders = screen.getAllByRole('columnheader').map(header => header.textContent);
        expect(expectedHeaders).toHaveLength(9);
        headerView.unmount();
        const view = model([node('铁块', 'iron', {branchRate: 12})]);
        const {container} = show(view, new Map([['铁块', canonical('铁块')]]));
        expect(screen.getByRole('region', {name: '依赖树生产视图'})).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['依赖 / 本支需求', ...expectedHeaders]);
        expect(screen.getByRole('columnheader', {name: /本支产能/})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /本支工厂数量/})).toBeInTheDocument();
        const row = treeRow('铁块依赖第1层');
        expect(row.querySelectorAll(':scope > td')).toHaveLength(10);
        const branch = row.firstElementChild;
        expect(branch).toHaveClass('w-px');
        expect(within(branch).getByLabelText('铁块本支需求')).toHaveTextContent('12.00');
        expect(branch.querySelector('input,select')).toBeNull();
        expect(within(row).getByLabelText('铁块本支产能')).toHaveTextContent('12.00');
        expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
        expect(within(row).getByLabelText('铁块本支工厂数量')).toHaveTextContent('0.20');
        expect(within(row).getByRole('combobox', {name: '铁块配方'})).toHaveValue('a');
        expect(within(row).getByText('物流：传送带 3 / 集装分拣器 2')).toBeVisible();
        expect(container.querySelector('details')).not.toHaveAttribute('open');
        expect(screen.getByText(/配方、增产与工厂类型修改会同步全局计划/)).toBeVisible();
    });

    it('shows distinct branch quantities and preserves shared settings callbacks without exposing global quantity edits', async () => {
        const user = userEvent.setup();
        const action = vi.fn();
        const view = model([node('铁块', 'first', {branchRate: 10, shared: true}), node('铁块', 'second', {branchRate: 20, shared: true})]);
        const original = JSON.stringify(view);
        const {rerender, container} = show(view, new Map([['铁块', canonical('铁块', action)]]));
        const rows = screen.getAllByRole('row', {name: '铁块依赖第1层'});
        expect(rows.map(row => within(row).getByLabelText('铁块本支需求').textContent)).toEqual(['10.00', '20.00']);
        expect(rows.map(row => within(row).getByLabelText('铁块本支产能').textContent)).toEqual(['10.00', '20.00']);
        expect(rows.map(row => within(row).getByLabelText('铁块本支工厂数量').textContent)).toEqual(['0.17', '0.33']);
        for (const row of rows) {
            expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
            expect(row.querySelector('summary')).toHaveTextContent('共享');
        }
        await user.click(within(rows[1]).getByRole('button', {name: '添加铁块产线'}));
        await user.click(within(rows[1]).getByRole('button', {name: '铁块原矿化'}));
        await user.click(within(rows[1]).getByRole('button', {name: '分叉铁块配方'}));
        await user.selectOptions(within(rows[1]).getByRole('combobox', {name: '铁块配方'}), 'b');
        await user.selectOptions(within(rows[1]).getByRole('combobox', {name: '铁块增产模式'}), 'b');
        await user.selectOptions(within(rows[1]).getByRole('combobox', {name: '铁块增产剂'}), 'b');
        await user.selectOptions(within(rows[1]).getByRole('combobox', {name: '铁块工厂类型'}), 'b');
        expect(action.mock.calls).toEqual([['add'], ['raw'], ['fork'], ['recipe', 'b'], ['mode', 'b'], ['proliferator', 'b'], ['factory', 'b']]);
        const ids = Array.from(container.querySelectorAll('[data-node-id]'), row => row.id);
        expect(new Set(ids).size).toBe(2);
        rerender(<Provider><DependencyOverview viewModel={view} canonicalRows={new Map([['铁块', canonical('铁块', action, '999.00')]])} settings={settings}/></Provider>);
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.getAllByLabelText('铁块本支产能').map(output => output.textContent)).toEqual(['10.00', '20.00']);
        expect(Array.from(container.querySelectorAll('[data-node-id]'), row => row.id)).toEqual(ids);
        expect(JSON.stringify(view)).toBe(original);
    });

    it('separates unallocated branch quantities from expandable global source edits and logistics', async () => {
        const user = userEvent.setup();
        const remove = vi.fn();
        const rows = new Map([['铁块', <tr key="iron" data-item="铁块">
            <td colSpan={8}><section aria-label="铁块生产来源"><output aria-label="铁块全局总需求">500</output><button onClick={remove}>删除铁块现有产线 1</button><input aria-label="铁块现有产线 1分配产量" defaultValue="350"/><span>完整来源配方、增产剂和工厂</span></section></td>
            <td>全局物流估算</td>
        </tr>]]);
        show(model([node('铁块', 'iron', {branchRate: 20, production: {capacity: null, buildings: null, status: 'unallocated'}})]), rows);
        const row = treeRow('铁块依赖第1层');
        const cells = Array.from(row.children);
        expect(cells.map(cell => cell.colSpan)).toEqual([1, 1, 1, 1, 1, 5]);
        expect(cells.reduce((total, cell) => total + cell.colSpan, 0)).toBe(10);
        expect(within(row).getByLabelText('铁块本支产能')).toHaveTextContent('—');
        expect(within(row).getByLabelText('铁块本支工厂数量')).toHaveTextContent('—');
        expect(within(row).getByRole('textbox')).not.toBeVisible();
        const toggle = within(row).getByLabelText('铁块全局来源设置');
        expect(toggle.closest('details')).not.toHaveAttribute('open');
        await user.click(toggle);
        expect(within(row).getByLabelText('铁块全局总需求')).toHaveTextContent('500');
        expect(within(row).getByRole('textbox')).toHaveValue('350');
        expect(within(row).getByText('全局物流估算')).toBeVisible();
        await user.click(within(row).getByRole('button', {name: '删除铁块现有产线 1'}));
        expect(remove).toHaveBeenCalledOnce();
    });

    it('gives repeated source groups independent DOM IDs while preserving shared source identity', async () => {
        const user = userEvent.setup();
        const grouped = <tr id="global-iron" data-item="铁块"><td colSpan={8}><ScopedSourceEditor/></td><td>物流</td></tr>;
        const view = model([node('铁块', 'first', {shared: true}), node('铁块', 'second', {shared: true})]);
        const {container, rerender} = show(view, new Map([['铁块', grouped]]));
        const ids = Array.from(container.querySelectorAll('[id]'), element => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(container.querySelector('#global-iron')).toBeNull();
        const rows = screen.getAllByRole('row', {name: '铁块依赖第1层'});
        const instances = rows.map(row => row.dataset.rowInstance);
        expect(new Set(instances).size).toBe(2);
        for (const row of rows) {
            await user.click(within(row).getByLabelText('铁块全局来源设置'));
            const editor = within(row).getByRole('textbox', {name: '来源产量'});
            expect(editor.id).toContain(row.dataset.rowInstance);
            expect(editor.parentElement).toHaveAttribute('data-source-id', 'iron-a');
        }
        rerender(<Provider><DependencyOverview viewModel={view} canonicalRows={new Map([['铁块', grouped]])} settings={settings}/></Provider>);
        expect(Array.from(container.querySelectorAll('[id]'), element => element.id)).toEqual(ids);
    });

    it('keeps cycle-boundary controls accessible and caps 4px indentation at 24px', () => {
        const {container} = show(model([
            node('铁块', 'first', {depth: 1}),
            node('铁块', 'cycle', {depth: 80, reason: 'cycle', shared: true, branchRate: 1.25,
                production: {capacity: null, buildings: null, status: 'unallocated'}}),
        ]), new Map([['铁块', canonical('铁块')]]));
        const rows = container.querySelectorAll('[data-node-id]');
        expect(rows[0].querySelector('.dsp-dependency-item-content')).toHaveStyle({paddingInlineStart: '4px'});
        expect(rows[1].querySelector('.dsp-dependency-item-content')).toHaveStyle({paddingInlineStart: '24px'});
        expect(rows[1].querySelector('.dsp-dependency-guides')).toHaveStyle({width: '24px'});
        expect(rows[1]).toHaveAccessibleName('铁块依赖第81层');
        expect(rows[1]).toHaveAttribute('data-depth', '80');
        expect(within(rows[1]).getByLabelText('铁块本支需求')).toHaveTextContent('1.25');
        expect(within(rows[1]).getByLabelText('铁块本支产能')).toHaveTextContent('—');
        expect(within(rows[1]).getByLabelText('铁块本支工厂数量')).toHaveTextContent('—');
        expect(within(rows[1]).getByRole('button', {name: '添加铁块产线'})).toBeVisible();
        expect(within(rows[1]).queryByRole('button', {name: /上游原料/})).not.toBeInTheDocument();
        expect(rows[1].querySelector('details')).toHaveTextContent('循环引用，查看全局供给');
    });

    it('paginates complete row controls at 50 occurrences with stable unique row IDs', async () => {
        const user = userEvent.setup();
        const roots = Array.from({length: 51}, (_, index) => node('铁块', `root-${index}`, {branchRate: index + 1}));
        const {container} = show(model(roots), new Map([['铁块', canonical('铁块')]]));
        expect(container.querySelectorAll('tbody > tr')).toHaveLength(50);
        expect(screen.getAllByLabelText('铁块本支产能')).toHaveLength(50);
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        const firstId = container.querySelector('tbody > tr').id;
        expect(new Set(Array.from(container.querySelectorAll('[id]'), element => element.id)).size).toBe(container.querySelectorAll('[id]').length);
        const next = screen.getByRole('button', {name: '下一页'});
        next.focus();
        await user.keyboard('{Enter}');
        expect(container.querySelectorAll('tbody > tr')).toHaveLength(1);
        expect(screen.getByLabelText('铁块本支需求')).toHaveTextContent('51.00');
        expect(screen.getByLabelText('铁块本支产能')).toHaveTextContent('51.00');
        expect(screen.getByLabelText('铁块本支工厂数量')).toHaveTextContent('0.85');
        expect(next).toBeDisabled();
        await user.click(screen.getByRole('button', {name: '上一页'}));
        expect(container.querySelector('tbody > tr').id).toBe(firstId);
        expect(screen.getAllByLabelText('铁块本支产能')).toHaveLength(50);
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    });

    it('preserves missing-canonical references without inventing global values or misaligning columns', () => {
        show(model([node('铁矿', 'ore', {branchRate: 12.5, reason: 'raw'})]), new Map());
        const row = treeRow('铁矿依赖第1层');
        expect(screen.getAllByRole('columnheader')).toHaveLength(10);
        expect(Array.from(row.children, cell => cell.colSpan)).toEqual([1, 9]);
        expect(within(row).getByLabelText('铁矿本支需求')).toHaveTextContent('12.50');
        expect(within(row).getByText('此物品没有可显示的全局产线，仅保留依赖引用')).toBeVisible();
        expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
        expect(within(row).queryByLabelText('铁矿工厂数量')).not.toBeInTheDocument();
    });

    it('keeps canonical rows omitted by projection bounds in a separate global section without duplicating collapsed branches', async () => {
        const user = userEvent.setup();
        const action = vi.fn();
        const child = node('铁块', 'circuit/iron', {depth: 1, children: [node('铁矿', 'circuit/iron/ore', {depth: 2})]});
        const view = model([node('电路板', 'circuit', {children: [child], reason: 'node-limit'})], [], {limits: {truncated: true}});
        const before = JSON.stringify(view);
        const {container} = show(view, new Map(['电路板', '铁块', '铁矿', '铜块'].map(item => [item, canonical(item, action)])));
        const remaining = screen.getByRole('region', {name: '其余全局产线表，可横向滚动'});
        expect(within(remaining).getAllByRole('columnheader')).toHaveLength(10);
        expect(remaining.querySelector('tbody > tr').children).toHaveLength(10);
        const ids = Array.from(container.querySelectorAll('[id]'), element => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(within(remaining).getAllByRole('textbox')).toHaveLength(1);
        expect(within(remaining).getByRole('textbox', {name: '铜块产能，等比例调整需求'})).toHaveValue('777.00');
        expect(within(remaining).queryByLabelText('铜块本支需求')).not.toBeInTheDocument();
        expect(within(remaining).queryByLabelText('铜块全局投入')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('铁矿本支产能')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '展开铁块的上游原料'}));
        expect(screen.getByLabelText('铁矿本支产能')).toHaveTextContent('60.00');
        await user.click(within(remaining).getByRole('button', {name: '添加铜块产线'}));
        expect(action).toHaveBeenCalledExactlyOnceWith('add');
        expect(JSON.stringify(view)).toBe(before);
        expect(screen.getByRole('status', {name: '依赖显示限制'})).toBeInTheDocument();
    });

    it('labels source/global input quantities independently of the full global editors', async () => {
        const user = userEvent.setup();
        const ore = node('铁矿', 'supply/ore', {scope: 'global', globalRate: 80, depth: 1});
        const supply = node('铁块', 'supply/iron', {kind: 'supply', scope: 'global', globalRate: 80, children: [ore]});
        show(model([], [supply]), new Map([['铁块', canonical('铁块')], ['铁矿', canonical('铁矿')]]));
        expect(screen.getByLabelText('铁块全局产出')).toHaveTextContent('80.00');
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('777.00');
        await user.click(screen.getByRole('button', {name: '展开铁块的上游原料'}));
        expect(screen.getByLabelText('铁矿全局投入')).toHaveTextContent('80.00');
        expect(screen.queryByLabelText('铁矿本支需求')).not.toBeInTheDocument();
        expect(treeRow('铁矿依赖第2层')).toHaveAttribute('data-scope', 'global');
        expect(screen.getByText(/不是新增目标需求/)).toBeVisible();
    });
});
