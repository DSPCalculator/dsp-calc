import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext} from '../src/contexts.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {LogisticsOverview} from '../src/logistics_overview.jsx';
import {Result} from '../src/result.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const beltOptions = [
    {tier: 'belt1', name: '传送带', capacityPerSecond: 6, count: 2},
    {tier: 'belt2', name: '高速传送带', capacityPerSecond: 12, count: 1},
    {tier: 'belt3', name: '极速传送带', capacityPerSecond: 30, count: 1},
];
const sorterOptions = [
    {tier: 'sorter1', name: '分拣器', capacityPerSecond: 1.5, count: 2},
    {tier: 'sorter2', name: '高速分拣器', capacityPerSecond: 3, count: 1},
    {tier: 'sorter3', name: '极速分拣器', capacityPerSecond: 6, count: 1},
];
const estimate = {
    supported: true, totalPerSecond: 10,
    belt: {status: 'ready', throughputPerSecond: 10, recommended: beltOptions[1], alternatives: beltOptions},
    sorter: {status: 'ready', throughputPerSecond: 2, recommended: sorterOptions[1], alternatives: sorterOptions, complete: true},
    sources: [],
    assumptions: ['传送带未叠堆；分拣器按 1 格距离、每次 1 件且无额外研究加成'],
    warnings: ['不包括原料输入、共生产物和实际建筑端口限制'],
};

function Fixture({value = estimate, minute = true, fixed = 2}) {
    return <TooltipProvider><GlobalStateContext.Provider value={{game_data: default_game_data, settings: {is_time_unit_minute: minute, fixed_num: fixed}}}>
        <LogisticsOverview item="铁块" estimate={value}/><button>外部控件</button>
    </GlobalStateContext.Provider></TooltipProvider>;
}

function Overview({mode = 'full', initialNeeds = {'铁块': 600}}) {
    const [needs, setNeeds] = useState(initialNeeds);
    return <TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={false} set_show_ore_popup={() => {}}
            show_building_popup={false} set_show_building_popup={() => {}}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>;
}

describe('compact logistics alternatives', () => {
    it('starts collapsed with only minimum tier icons, previews on hover, and closes after pointer leave', async () => {
        const user = userEvent.setup();
        render(<Fixture/>);
        const trigger = screen.getByRole('button', {name: /铁块物流估算/});
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveClass('w-20', 'text-base');
        expect(within(trigger).getAllByRole('img')).toHaveLength(2);
        expect(within(trigger).getByRole('img', {name: 'belt-2'})).toBeInTheDocument();
        expect(within(trigger).getByRole('img', {name: 'inserter-2'})).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        screen.getByRole('button', {name: '外部控件'}).focus();
        await user.hover(trigger);
        const panel = await screen.findByRole('dialog', {name: '铁块物流估算'});
        expect(panel).toHaveClass('text-base', 'overflow-y-auto');
        expect(within(panel).getByRole('listitem', {name: '合并出料流量，未叠堆 传送带 2 条'})).toHaveTextContent('2 条');
        expect(within(panel).getByRole('listitem', {name: '合并出料流量，未叠堆 高速传送带 1 条'})).toHaveTextContent('1 条');
        expect(screen.getByText(/分拣器按 1 格距离/)).toBeInTheDocument();
        expect(document.activeElement).not.toBe(within(panel).getByRole('button', {name: '关闭铁块物流估算'}));
        await user.unhover(trigger);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByRole('button', {name: '外部控件'})).toHaveFocus();
    });

    it('keeps a click-pinned preview open, supports explicit close, and opens again with keyboard and Escape', async () => {
        const user = userEvent.setup();
        render(<Fixture/>);
        const trigger = screen.getByRole('button', {name: /铁块物流估算/});
        await user.click(trigger);
        await user.unhover(trigger);
        expect(screen.getByRole('dialog', {name: '铁块物流估算'})).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '关闭铁块物流估算'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        trigger.focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('dialog', {name: '铁块物流估算'})).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('dismisses on outside click and repeated trigger clicks without affecting other controls', async () => {
        const user = userEvent.setup();
        render(<Fixture/>);
        const trigger = screen.getByRole('button', {name: /铁块物流估算/});
        await user.click(trigger);
        await user.click(screen.getByRole('button', {name: '外部控件'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.click(trigger);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.click(trigger);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows top-tier parallel overflow counts in the collapsed cell and explains the layout limit', async () => {
        const user = userEvent.setup();
        const alternatives = beltOptions.map(option => ({...option, count: Math.ceil(70 / option.capacityPerSecond)}));
        render(<Fixture value={{...estimate, belt: {...estimate.belt, throughputPerSecond: 70, alternatives, recommended: alternatives[2]}}}/>);
        const trigger = screen.getByRole('button', {name: /传送带 极速传送带 × 3/});
        expect(within(trigger).getByText('×3')).toBeInTheDocument();
        await user.click(trigger);
        expect(screen.getByText(/超过最高档单条容量，需 3 条并行/)).toBeInTheDocument();
    });

    it('renders unsupported capacity data without pretending to recommend a tier', async () => {
        const user = userEvent.setup();
        const unavailable = {status: 'unavailable', alternatives: [], reason: '当前模组物流容量尚未核实'};
        render(<Fixture value={{supported: false, belt: unavailable, sorter: unavailable, sources: [], assumptions: [], warnings: []}}/>);
        const trigger = screen.getByRole('button', {name: /传送带暂无法估算/});
        expect(within(trigger).queryByRole('img')).not.toBeInTheDocument();
        await user.click(trigger);
        expect(screen.getAllByText('当前模组物流容量尚未核实')).toHaveLength(2);
    });

    it('marks incomplete sorter coverage as unknown in the compact cell while keeping scoped alternatives', async () => {
        const user = userEvent.setup();
        render(<Fixture value={{...estimate, sorter: {...estimate.sorter, complete: false, reason: '副产物来源尚未评估'}}}/>);
        const trigger = screen.getByRole('button', {name: /部分来源未评估/});
        expect(within(trigger).getAllByRole('img')).toHaveLength(1);
        expect(within(trigger).getByLabelText('分拣器仅有部分来源估算')).toHaveTextContent('?');
        await user.click(trigger);
        expect(screen.getByText(/尚不能确定整个产品组的分拣器需求/)).toBeInTheDocument();
        expect(screen.getByRole('listitem', {name: '单台满载出料（最繁忙已评估来源） 高速分拣器 1 个'})).toBeInTheDocument();
    });

    it('changes only displayed rate units, not recommended tiers or parallel counts', async () => {
        const user = userEvent.setup();
        const {rerender} = render(<Fixture/>);
        let trigger = screen.getByRole('button', {name: /铁块物流估算/});
        const label = trigger.getAttribute('aria-label');
        await user.click(trigger);
        expect(screen.getByText('流量 600.00 / min')).toBeInTheDocument();
        rerender(<Fixture minute={false}/>);
        trigger = screen.getByRole('button', {name: /^铁块物流估算/});
        expect(trigger).toHaveAttribute('aria-label', label);
        expect(screen.getByText('流量 10.00 / s')).toBeInTheDocument();
        expect(screen.getByRole('listitem', {name: '合并出料流量，未叠堆 传送带 2 条'})).toHaveTextContent('2 条');
    });

    it('preserves fractional equipment capacity even when production precision is set to zero', async () => {
        const user = userEvent.setup();
        render(<Fixture minute={false} fixed={0}/>);
        await user.click(screen.getByRole('button', {name: /^铁块物流估算/}));
        const mk1 = screen.getByRole('listitem', {name: '单台满载出料（最繁忙已评估来源） 分拣器 2 个'});
        expect(mk1).toHaveTextContent('单个 1.5 / s');
        expect(mk1).not.toHaveTextContent('单个 2 / s');
    });
});

describe('rightmost production logistics column', () => {
    it.each(['full', 'compact', 'mobile'])('adds only one narrow column while retaining all row controls in %s mode', mode => {
        render(<Overview mode={mode}/>);
        const table = screen.getByRole('region', {name: '生产结果表，可横向滚动'}).querySelector('table');
        const headers = within(table).getAllByRole('columnheader');
        expect(headers).toHaveLength(9);
        expect(headers.at(-1)).toHaveTextContent('物流估算');
        const row = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'}).closest('tr');
        const cells = within(row).getAllByRole('cell');
        expect(cells).toHaveLength(9);
        expect(cells.at(-1)).toHaveClass('dsp-logistics-cell', 'w-24', 'px-2', 'py-3');
        expect(within(cells.at(-1)).getByRole('button', {name: /铁块物流估算/})).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('gives grouped sources a separate rightmost cell and includes every source rate and alternatives', async () => {
        const user = userEvent.setup();
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: [{id: 'manual-iron', target_item: '铁块', output_per_minute: 150, standalone: true,
            recipe_choice: 1, building: 0, proliferator_mode: 0, proliferator_points: 0}]}));
        render(<Overview/>);
        const group = screen.getByRole('region', {name: '铁块生产来源'});
        const row = group.closest('tr');
        expect(group.closest('td')).toHaveAttribute('colspan', '8');
        expect(within(row).getAllByRole('cell')).toHaveLength(2);
        expect(within(row).getAllByRole('cell').at(-1)).toHaveClass('dsp-logistics-cell');
        await user.click(within(row).getByRole('button', {name: /铁块物流估算/}));
        const panel = screen.getByRole('dialog', {name: '铁块物流估算'});
        const sources = within(panel).getByRole('region', {name: '各来源物流明细'});
        expect(within(sources).getByText('需求产线')).toBeInTheDocument();
        expect(within(sources).getByText('现有产线 1')).toBeInTheDocument();
        expect(within(sources).getByText('450.00 / min')).toBeInTheDocument();
        expect(within(sources).getByText('150.00 / min')).toBeInTheDocument();
        await user.click(within(sources).getByText('现有产线 1'));
        expect(within(sources).getByRole('region', {name: '现有产线 1出料传送带'})).toBeVisible();
        expect(within(sources).getByRole('region', {name: '现有产线 1单台满载出料分拣器'})).toBeVisible();
    });
});
