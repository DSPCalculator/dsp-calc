import '@testing-library/jest-dom/vitest';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ItemSelect} from '../src/item_select.jsx';
import {CompactModeContext, GameInfoContext, GlobalStateContext} from '../src/contexts.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

const gameInfo = {
    all_target_items: ['铁块', '铜块', '处理器', '氢', '传送带'],
    game_data: {item_grid: {'铁块': 1101, '铜块': 1102, '处理器': 1304, '非目标物品': 1103, '传送带': 2201, '边界': 1305}},
    icon_grid: {
        ncol: 5,
        nrow: 3,
        icons: [
            {item: '处理器', col: 4, row: 3},
            {item: '铁块', col: 1, row: 1},
            {item: '铜块', col: 2, row: 1},
            {item: '非目标物品', col: 3, row: 1},
        ],
    },
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function renderPicker({mode = 'full', info = gameInfo, onSelect = vi.fn(), item} = {}) {
    const user = userEvent.setup();
    const view = render(<CompactModeContext.Provider value={mode}>
        <GameInfoContext.Provider value={info}>
            <GlobalStateContext.Provider value={{game_data: {mods: []}}}>
                <TooltipProvider delayDuration={0}>
                    <ItemSelect text="添加需求物品" item={item} set_item={onSelect}/>
                </TooltipProvider>
            </GlobalStateContext.Provider>
        </GameInfoContext.Provider>
    </CompactModeContext.Provider>);
    return {user, onSelect, ...view};
}

async function openPicker(user) {
    await user.click(screen.getByRole('button', {name: /^添加需求物品/}));
    return screen.getByRole('dialog', {name: '选择物品'});
}

describe('compact game-layout item picker', () => {
    it('preserves original row/column positions and gaps using dense icon-only buttons', async () => {
        const {user} = renderPicker();
        const dialog = await openPicker(user);
        const grid = within(dialog).getByRole('group', {name: '物品固定位置网格'});
        expect(grid).toHaveStyle({gridTemplateColumns: 'repeat(5, var(--picker-tile-size))', gridTemplateRows: 'repeat(3, var(--picker-tile-size))'});
        expect(within(grid).getAllByRole('button')).toHaveLength(3);
        const iron = within(grid).getByRole('button', {name: '选择铁块'});
        const processor = within(grid).getByRole('button', {name: '选择处理器'});
        expect(iron).toHaveStyle({gridColumn: '1', gridRow: '1'});
        expect(processor).toHaveStyle({gridColumn: '4', gridRow: '3'});
        expect(iron).toHaveClass('size-[var(--picker-tile-size)]', 'p-0');
        expect(iron).not.toHaveTextContent('铁块');
        expect(within(dialog).queryByRole('button', {name: '选择非目标物品'})).not.toBeInTheDocument();
        expect(dialog.style.getPropertyValue('--picker-tile-size')).toBe('44px');
        expect(dialog).toHaveClass('max-h-[90dvh]', 'max-w-[calc(100vw-1rem)]', 'overflow-hidden');
        expect(grid.closest('[aria-label="游戏物品布局"]')).toHaveClass('overflow-auto');
        expect(grid.querySelectorAll('[data-slot="picker-empty-slot"]')).toHaveLength(12);
        expect(within(dialog).getByLabelText('第 2 行')).toHaveTextContent('2');
    });

    it('shows names in a tooltip on compact tiles and exposes the current choice', async () => {
        const {user} = renderPicker({item: '铜块'});
        const dialog = await openPicker(user);
        const copper = within(dialog).getByRole('button', {name: '选择铜块'});
        expect(copper).toHaveAttribute('aria-pressed', 'true');
        expect(within(dialog).getByRole('button', {name: '选择铁块'})).toHaveAttribute('aria-pressed', 'false');
        await user.hover(copper);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('铜块');
    });

    it('uses smaller mobile icons while retaining the full scrollable game grid', async () => {
        const {user} = renderPicker({mode: 'mobile'});
        const dialog = await openPicker(user);
        expect(dialog.style.getPropertyValue('--picker-tile-size')).toBe('32px');
        const grid = within(dialog).getByRole('group', {name: '物品固定位置网格'});
        expect(grid).toHaveStyle({gridTemplateColumns: 'repeat(5, var(--picker-tile-size))'});
        const icon = within(within(grid).getByRole('button', {name: '选择铁块'})).getByRole('img');
        expect(icon).toHaveStyle({width: '28px', height: '28px'});
        expect(within(dialog).getByText(/可横向滚动/)).toBeInTheDocument();
    });

    it('keeps targets without a game-grid slot selectable in a compact fallback group', async () => {
        const {user, onSelect} = renderPicker();
        const dialog = await openPicker(user);
        await user.click(within(dialog).getByRole('tab', {name: '其它', exact: true}));
        const extra = within(dialog).getByRole('group', {name: '其它可选物品'});
        const hydrogen = within(extra).getByRole('button', {name: '选择氢', exact: true});
        expect(within(extra).getAllByRole('button')).toHaveLength(1);
        await user.click(hydrogen);
        expect(onSelect).toHaveBeenCalledWith('氢');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each(['铁块', 'tk', 'tiekuai'])('finds %s with dense named search results and Enter selects the first result', async query => {
        const {user, onSelect} = renderPicker();
        const dialog = await openPicker(user);
        await user.type(within(dialog).getByRole('searchbox'), query);
        const result = within(dialog).getByRole('button', {name: '选择铁块', exact: true});
        expect(result).toHaveTextContent('铁块');
        expect(result).toHaveClass('h-9', 'justify-start');
        expect(within(dialog).queryByRole('group', {name: '物品固定位置网格'})).not.toBeInTheDocument();
        // "tk" also matches 铜块; Enter follows the visible ranking, not a guessed tie-break.
        const firstResult = within(dialog).getAllByRole('button', {name: /^选择/})[0];
        const firstName = firstResult.getAttribute('aria-label').replace(/^选择/, '');
        await user.keyboard('{Enter}');
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(firstName);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('also searches targets without grid positions and ignores Enter during text composition', async () => {
        const {user, onSelect} = renderPicker();
        const dialog = await openPicker(user);
        const search = within(dialog).getByRole('searchbox');
        await user.type(search, 'qing');
        expect(within(dialog).getByRole('button', {name: '选择氢', exact: true})).toHaveTextContent('氢');
        fireEvent.keyDown(search, {key: 'Enter', isComposing: true});
        expect(onSelect).not.toHaveBeenCalled();
        expect(dialog).toBeInTheDocument();
        await user.keyboard('{Enter}');
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('氢');
    });

    it('clears search back to the original grid and resets it after Escape and reopen', async () => {
        const {user, onSelect} = renderPicker();
        let dialog = await openPicker(user);
        let search = within(dialog).getByRole('searchbox');
        await user.type(search, 'zzzzzzz');
        expect(within(dialog).getByText('没有找到相关物品')).toBeInTheDocument();
        await user.keyboard('{Enter}');
        expect(onSelect).not.toHaveBeenCalled();
        await user.click(within(dialog).getByRole('button', {name: '清除搜索'}));
        expect(search).toHaveValue('');
        expect(within(dialog).getByRole('group', {name: '物品固定位置网格'})).toBeInTheDocument();
        await user.type(search, 'tk');
        await user.keyboard('{Escape}');
        expect(screen.getByRole('button', {name: '添加需求物品'})).toHaveFocus();
        dialog = await openPicker(user);
        search = within(dialog).getByRole('searchbox');
        expect(search).toHaveValue('');
        expect(search).toHaveFocus();
        expect(within(dialog).getByRole('group', {name: '物品固定位置网格'})).toBeInTheDocument();
    });

    it('keeps the dialog open if the consuming component rejects a selection', async () => {
        const onSelect = vi.fn(() => false);
        const {user} = renderPicker({onSelect});
        const dialog = await openPicker(user);
        await user.click(within(dialog).getByRole('button', {name: '选择铁块', exact: true}));
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('铁块');
        expect(dialog).toBeInTheDocument();
    });

    it('handles datasets that provide targets without any icon layout', async () => {
        const {user, onSelect} = renderPicker({info: {all_target_items: ['铁块', '氢']}});
        const dialog = await openPicker(user);
        expect(within(dialog).queryByRole('group', {name: '物品固定位置网格'})).not.toBeInTheDocument();
        await user.click(within(dialog).getByRole('tab', {name: '其它', exact: true}));
        const extra = within(dialog).getByRole('group', {name: '其它可选物品'});
        expect(within(extra).getAllByRole('button')).toHaveLength(2);
        await user.click(within(extra).getByRole('button', {name: '选择铁块', exact: true}));
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('铁块');
    });
});
