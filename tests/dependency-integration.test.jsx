import '@testing-library/jest-dom/vitest';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderApp() {
    return {user: userEvent.setup(), ...render(<TooltipProvider><App/></TooltipProvider>)};
}
async function addItem(user, item) {
    await user.click(screen.getByRole('button', {name: '添加需求物品', exact: true}));
    const dialog = screen.getByRole('dialog', {name: '选择物品'});
    await user.type(within(dialog).getByRole('searchbox'), item);
    await user.click(within(dialog).getAllByRole('button', {name: `选择${item}`, exact: true})[0]);
}
const flatButton = () => within(screen.getByRole('group', {name: '生产结果视图'})).getByRole('button', {name: '平铺'});
const treeButton = () => within(screen.getByRole('group', {name: '生产结果视图'})).getByRole('button', {name: '树状'});
const summary = () => screen.getByRole('complementary', {name: '生产统计'}).textContent;

describe('flat and dependency view integration', () => {
    it('starts flat, keeps calculation/settings unchanged through repeated toggles, and remounts flat', async () => {
        let {user, unmount} = renderApp();
        await addItem(user, '电磁矩阵');
        expect(flatButton()).toHaveAttribute('aria-pressed', 'true');
        const before = summary();
        const settings = localStorage.getItem('auto_settings');
        const strategy = localStorage.getItem('auto_scheme');
        for (let repeat = 0; repeat < 3; repeat++) {
            await user.click(treeButton());
            expect(treeButton()).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('region', {name: '依赖树生产视图'})).toBeInTheDocument();
            expect(screen.queryByRole('region', {name: '生产结果表，可横向滚动'})).not.toBeInTheDocument();
            expect(summary()).toBe(before);
            expect(localStorage.getItem('auto_settings')).toBe(settings);
            expect(localStorage.getItem('auto_scheme')).toBe(strategy);
            await user.click(flatButton());
            expect(screen.getByRole('textbox', {name: '电磁矩阵产能，等比例调整需求'})).toHaveValue('60.00');
            expect(summary()).toBe(before);
        }
        await user.click(treeButton());
        unmount();
        ({user} = renderApp());
        expect(flatButton()).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('region', {name: '依赖树生产视图'})).not.toBeInTheDocument();
        await user.click(treeButton());
        expect(screen.getByText('添加正数目标需求后可查看依赖树')).toBeInTheDocument();
    });

    it('shows separate blue-matrix branch demands and navigates to the unique global editor', async () => {
        const {user} = renderApp();
        await addItem(user, '电磁矩阵');
        const before = summary();
        await user.click(treeButton());
        expect(screen.getByRole('button', {name: '收起电磁矩阵的上游原料'})).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByLabelText('电路板本支需求')).toHaveTextContent(/^60.00$/);
        expect(screen.getByLabelText('磁线圈本支需求')).toHaveTextContent(/^60.00$/);
        await user.click(screen.getByRole('button', {name: '展开电路板的上游原料'}));
        await user.click(screen.getByRole('button', {name: '展开磁线圈的上游原料'}));
        expect(screen.getAllByLabelText('铜块本支需求')).toHaveLength(2);
        for (const output of screen.getAllByLabelText('铜块本支需求')) expect(output).toHaveTextContent(/^30.00$/);
        expect(screen.getAllByLabelText('铜块本支产能')).toHaveLength(2);
        for (const output of screen.getAllByLabelText('铜块本支产能')) expect(output).toHaveTextContent(/^30.00$/);
        for (const output of screen.getAllByLabelText('铜块本支工厂数量')) expect(output).toHaveTextContent(/^0.50$/);
        expect(screen.queryByRole('textbox', {name: '铜块产能，等比例调整需求'})).not.toBeInTheDocument();
        expect(summary()).toBe(before);
        await user.click(screen.getByLabelText('电路板依赖说明'));
        await user.click(screen.getByRole('button', {name: '查看电路板全局产线'}));
        expect(flatButton()).toHaveAttribute('aria-pressed', 'true');
        const row = screen.getByRole('row', {name: '电路板全局产线', exact: true});
        expect(row).toHaveFocus();
        expect(screen.getAllByRole('row', {name: '电路板全局产线', exact: true})).toHaveLength(1);
        expect(within(row).getByRole('textbox', {name: '电路板产能，等比例调整需求'})).toHaveValue('60.00');
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({block: 'nearest', inline: 'nearest'});
    });

    it('keeps source IDs, allocations and global totals intact while tree references the one source group', async () => {
        const {user} = renderApp();
        await addItem(user, '重氢');
        await user.click(screen.getByRole('button', {name: '使用重氢配方 3添加产线'}));
        const input = screen.getByRole('textbox', {name: '重氢现有产线 1分配产量'});
        await user.clear(input);
        await user.type(input, '30');
        await user.keyboard('{Enter}');
        const source = screen.getByRole('article', {name: '重氢现有产线 1'});
        const id = source.dataset.sourceId;
        const before = summary();
        await user.click(treeButton());
        expect(screen.getByLabelText('重氢本支需求')).toHaveTextContent(/^60.00$/);
        expect(screen.getByLabelText('重氢本支产能')).toHaveTextContent('—');
        expect(screen.getByLabelText('重氢本支工厂数量')).toHaveTextContent('—');
        const sourceToggle = screen.getByLabelText('重氢全局来源设置');
        expect(sourceToggle.closest('details')).not.toHaveAttribute('open');
        await user.click(sourceToggle);
        expect(screen.getAllByText(/现有产线供给；引用全局供给/).length).toBeGreaterThan(0);
        for (const input of screen.getAllByRole('textbox', {name: '重氢现有产线 1分配产量'})) expect(input).toHaveValue('30.00');
        expect(summary()).toBe(before);
        const demandTable = screen.getByRole('region', {name: '目标依赖表，可横向滚动'});
        await user.click(within(demandTable).getByLabelText('重氢依赖说明'));
        await user.click(within(demandTable).getByRole('button', {name: '查看重氢全局产线'}));
        expect(screen.getByRole('row', {name: '重氢全局产线'})).toHaveFocus();
        expect(screen.getByRole('article', {name: '重氢现有产线 1'})).toHaveAttribute('data-source-id', id);
        expect(screen.getByRole('textbox', {name: '重氢现有产线 1分配产量'})).toHaveValue('30.00');
        expect(screen.getByLabelText('重氢需求产线产量')).toHaveTextContent(/^30.00$/);
        expect(summary()).toBe(before);
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
    });

    it('switches from tree to the flat source group when the sibling target panel requests 查看产线', async () => {
        const {user} = renderApp();
        await addItem(user, '电磁矩阵');
        await user.click(treeButton());
        await user.click(screen.getByRole('button', {name: '添加现有产线', exact: true}));
        const dialog = screen.getByRole('dialog', {name: '选择物品'});
        await user.type(within(dialog).getByRole('searchbox'), '铜块');
        await user.click(within(dialog).getByRole('button', {name: '选择铜块', exact: true}));
        expect(treeButton()).toHaveAttribute('aria-pressed', 'true');
        await user.click(screen.getByRole('link', {name: '查看产线', exact: true}));
        expect(flatButton()).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('row', {name: '铜块全局产线'})).toHaveFocus();
        expect(screen.getByRole('region', {name: '铜块生产来源'})).toHaveAttribute('id', 'production-sources-铜块');
        expect(screen.getByRole('textbox', {name: '铜块现有产线 1分配产量'})).toHaveValue('0.00');
    });

});
