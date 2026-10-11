import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider} from '../src/contexts.jsx';
import {Result} from '../src/result.jsx';
import {describeRecipe, Recipe} from '../src/recipe.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function Overview({mode, initialNeeds = {'铁块': 60}}) {
    const [needs, setNeeds] = useState(initialNeeds);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingOpen, setBuildingOpen] = useState(false);
    return <TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <Result needs_list={needs} set_needs_list={setNeeds}
            show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
            show_building_popup={buildingOpen} set_show_building_popup={setBuildingOpen}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>;
}

describe('compact production overview', () => {
    it('uses content-sized columns and an adjacent bounded sidebar without stretching or reducing row height', () => {
        const {container} = render(<Overview mode="compact"/>);
        const result = screen.getByRole('region', {name: '生产总览'});
        expect(result).toHaveAttribute('data-density', 'comfortable');
        // These are the responsive layout contract; pixel layout is checked in-browser.
        expect(result).toHaveClass('w-fit', 'max-w-full');
        expect(container.querySelector('.dsp-result-layout')).toHaveClass('flex', 'max-w-full', 'gap-4');
        expect(container.querySelector('.dsp-result-layout').className).not.toContain('1fr');
        expect(container.querySelector('.dsp-result-table-card')).toHaveClass('w-fit', 'min-w-0', 'max-w-full', 'flex-[0_1_auto]');
        expect(container.querySelector('.dsp-production-table')).toHaveClass('w-auto');
        expect(container.querySelector('.dsp-production-table')).not.toHaveClass('w-full');
        const summary = screen.getByRole('complementary', {name: '生产统计'});
        expect(summary).toHaveClass('hidden', 'lg:grid', 'w-max', 'max-w-80', 'shrink-0', 'max-h-[70dvh]', 'overflow-y-auto');
        expect(within(summary).getByText('预估电力')).toBeInTheDocument();
        expect(within(summary).getByText('原矿输入总需求')).toBeInTheDocument();
        expect(within(summary).getByText('建筑统计')).toBeInTheDocument();
        const scroll = screen.getByRole('region', {name: '生产结果表，可横向滚动'});
        expect(scroll).toHaveAttribute('tabindex', '0');
        expect(scroll).toHaveClass('overflow-auto', 'max-h-[70dvh]', 'max-w-full');
        expect(scroll).not.toHaveClass('w-full');
        expect(scroll.querySelector('thead')).toHaveClass('sticky', 'top-0');
        const amount = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        expect(amount).toHaveValue('60.00');
        expect(amount).toHaveClass('h-8', 'px-1', 'text-base', 'md:text-base');
        expect(container.querySelector('.dsp-production-table')).toHaveClass('text-base');
        expect(result).toHaveClass('space-y-4');
        const row = amount.closest('tr');
        expect(row.querySelector('.dsp-item-name')).toHaveClass('sr-only');
        expect(row.querySelector('.dsp-item-name')).toHaveTextContent('铁块');
        // Linked-source groups span the eight production columns, retaining the ninth logistics column.
            expect(within(row).getAllByRole('cell').reduce((sum, cell) => sum + cell.colSpan, 0)).toBe(9);
        for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveClass('px-2', 'py-3');
        expect(within(row).getByRole('button', {name: '位面熔炉'})).toHaveClass('min-h-8', 'min-w-7', 'py-1');
    });

    it('retains visible item names and complete recipe details in the wide layout', () => {
        const {container} = render(<Overview mode="full"/>);
        const amount = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        const row = amount.closest('tr');
        expect(row.querySelector('.dsp-item-name')).not.toHaveClass('sr-only');
        expect(within(row).getByRole('group', {name: '铁块配方'})).toBeInTheDocument();
        const recipe = container.querySelector('[title*="铁矿 × 1 → 铁块 × 1"]');
        expect(recipe).toBeInTheDocument();
        expect(recipe.getAttribute('title')).toContain('1s');
        expect(screen.getByRole('columnheader', {name: '工厂类型'})).toBeInTheDocument();
    });

    it('lets simple compact recipes use only their content width while retaining full accessible details', () => {
        const {container} = render(<Overview mode="compact"/>);
        const recipe = container.querySelector('.dsp-compact-recipe[title*="铁矿 × 1 → 铁块 × 1"]');
        expect(recipe).toHaveClass('w-max', 'max-w-32');
        expect(recipe).not.toHaveClass('w-28');
        expect(recipe).toHaveAccessibleName('铁矿 × 1 → 铁块 × 1 · 1s');
        expect(screen.getByRole('button', {name: '铁块配方 1'})).toHaveAccessibleDescription('铁矿 × 1 → 铁块 × 1 · 1s');
    });

    it('bounds real multi-input recipes and keeps each icon with its quantity when wrapping', () => {
        const recipe = default_game_data.recipe_data.find(entry => Object.keys(entry['原料']).length >= 4);
        expect(recipe).toBeDefined();
        const {container} = render(<TooltipProvider><ContextProvider><Recipe recipe={recipe} compact="full"/></ContextProvider></TooltipProvider>);
        const display = container.querySelector('.dsp-full-recipe');
        expect(display).toHaveClass('max-w-72', 'flex-wrap');
        expect(display).toHaveAccessibleName(describeRecipe(recipe));
        expect(display).toHaveAttribute('title', describeRecipe(recipe));
        const entries = [...Object.entries(recipe['原料']), ...Object.entries(recipe['产物'])];
        const groups = display.querySelectorAll('.dsp-recipe-ingredient');
        expect(groups).toHaveLength(entries.length);
        groups.forEach((group, index) => {
            expect(group).toHaveClass('inline-flex', 'shrink-0');
            expect(group.querySelector('[role="img"]')).toBeInTheDocument();
            expect(group).toHaveTextContent(String(entries[index][1]));
        });
    });

    it('keeps a complex quantum-chip production chain content-sized with all controls and a narrow logistics column', () => {
        const {container} = render(<Overview mode="compact" initialNeeds={{'量子芯片': 60}}/>);
        const table = container.querySelector('.dsp-production-table');
        expect(table).toHaveClass('w-auto');
        expect(within(table).getAllByRole('row').length).toBeGreaterThan(20);
        expect(within(table).getAllByRole('columnheader')).toHaveLength(9);
        expect(screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'})).toHaveValue('60.00');
        expect(container.querySelector('.dsp-result-summary')).toHaveClass('max-w-80');
        for (const row of table.querySelectorAll('tbody > tr')) {
            // Linked-source groups span the eight production columns, retaining the ninth logistics column.
            expect(within(row).getAllByRole('cell').reduce((sum, cell) => sum + cell.colSpan, 0)).toBe(9);
        }
        for (const recipe of container.querySelectorAll('.dsp-compact-recipe')) {
            expect(recipe).toHaveClass('w-max', 'max-w-32');
            expect(recipe).toHaveAccessibleName(recipe.getAttribute('title'));
        }
    });

    it.each(['full', 'compact', 'narrow'])('restores original desktop item, summary and selector icon sizes in %s mode', mode => {
        render(<Overview mode={mode}/>);
        const row = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'}).closest('tr');
        expect(row.children[1].querySelector('[role="img"]')).toHaveStyle({width: '40px', height: '40px'});
        expect(row.children[3].querySelector('[role="img"]')).toHaveStyle({width: '30px', height: '30px'});
        const furnace = within(row).getByRole('button', {name: '位面熔炉'});
        expect(furnace.querySelector('[role="img"]')).toHaveStyle({width: '32px', height: '32px'});
        const proliferator = within(row).getByRole('button', {name: /增产剂\s+Mk\.II$/});
        expect(proliferator.querySelector('[role="img"]')).toHaveStyle({width: '32px', height: '32px'});
        const summary = screen.getByRole('complementary', {name: '生产统计'});
        for (const icon of summary.querySelectorAll('[role="img"]')) {
            expect(icon).toHaveStyle({width: '40px', height: '40px'});
        }
        expect(furnace.parentElement).toHaveClass('gap-1');
        for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveClass('px-2', 'py-3');
    });

    it('restores 28px full-recipe icons without changing compact, narrow or mobile recipe sizes', () => {
        const recipe = default_game_data.recipe_data.find(entry => Object.hasOwn(entry['原料'], '铁矿') && Object.hasOwn(entry['产物'], '铁块'));
        const {container, rerender} = render(<TooltipProvider><ContextProvider><Recipe recipe={recipe} compact="full"/></ContextProvider></TooltipProvider>);
        const full = container.querySelector('.dsp-full-recipe');
        expect(full).toHaveClass('gap-x-1');
        for (const icon of full.querySelectorAll('.dsp-recipe-ingredient [role="img"]')) {
            expect(icon).toHaveStyle({width: '28px', height: '28px'});
        }
        for (const [mode, size] of [['compact', 24], ['narrow', 22], ['mobile', 20]]) {
            rerender(<TooltipProvider><ContextProvider><Recipe recipe={recipe} compact={mode}/></ContextProvider></TooltipProvider>);
            const icon = container.querySelector('[role="img"] [role="img"]');
            expect(icon).toHaveStyle({width: `${size}px`, height: `${size}px`});
            expect(container.querySelector('[title]')).toHaveAccessibleName(describeRecipe(recipe));
        }
    });

    it('preserves the approved mobile main, factory and selector icon sizes', () => {
        render(<Overview mode="mobile"/>);
        const row = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'}).closest('tr');
        expect(row.children[1].querySelector('[role="img"]')).toHaveStyle({width: '24px', height: '24px'});
        expect(row.children[3].querySelector('[role="img"]')).toHaveStyle({width: '20px', height: '20px'});
        expect(within(row).getByRole('button', {name: '位面熔炉'}).querySelector('[role="img"]')).toHaveStyle({width: '18px', height: '18px'});
        for (const icon of screen.getByRole('complementary', {name: '生产统计'}).querySelectorAll('[role="img"]')) {
            expect(icon).toHaveStyle({width: '26px', height: '26px'});
        }
    });

    it('retains 30px migrated-source factory icons and 32px desktop selectors inside the product group', () => {
        localStorage.setItem('auto_settings', JSON.stringify({natural_production_line: [{'目标物品': '铁块', '建筑数量': 10, '配方id': 1, '增产点数': 0, '增产模式': 0, '建筑': 0, standalone: true}]}));
        render(<Overview mode="full" initialNeeds={{'铁块': 600}}/>);
        const group = screen.getByRole('region', {name: '铁块生产来源'});
        const card = within(group).getByRole('article', {name: '铁块现有产线 1'});
        expect(within(card).getByRole('textbox', {name: '铁块现有产线 1分配产量'})).toHaveValue('600.00');
        const factory = within(card).getByLabelText('铁块现有产线 1工厂数量');
        expect(factory).toHaveValue('10.00');
        expect(factory.parentElement.querySelector('[role="img"]')).toHaveStyle({width: '30px', height: '30px'});
        expect(within(card).getByRole('button', {name: '位面熔炉'}).querySelector('[role="img"]')).toHaveStyle({width: '32px', height: '32px'});
    });

    it('keeps mobile quantities editable and all summaries reachable in dismissible dialogs', async () => {
        const user = userEvent.setup();
        render(<Overview mode="mobile"/>);
        expect(screen.getByText('左右滑动表格，查看配方与生产设置')).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader')).toHaveLength(9);
        const amount = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        await user.clear(amount);
        await user.type(amount, '120');
        await user.keyboard('{Enter}');
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('120.00');
        await user.click(screen.getByRole('button', {name: '建筑与需求', exact: true}));
        const buildingDialog = screen.getByRole('dialog', {name: '建筑与需求'});
        expect(within(buildingDialog).getByText('建筑统计')).toBeInTheDocument();
        expect(within(buildingDialog).getByText('预估电力')).toBeInTheDocument();
        expect(within(buildingDialog).getByText('原矿输入总需求')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '原矿与溢出', exact: true}));
        const oreDialog = screen.getByRole('dialog', {name: '原矿与多余产物'});
        expect(within(oreDialog).getByText('原矿化列表')).toBeInTheDocument();
        expect(within(oreDialog).getByText('多余产物')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('120.00');
    });
});
