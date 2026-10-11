import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider} from '../src/contexts.jsx';
import {Recipe} from '../src/recipe.jsx';
import {Result} from '../src/result.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function Provider({children}) {
    return <TooltipProvider delayDuration={0}><ContextProvider>{children}</ContextProvider></TooltipProvider>;
}

function QuantumOverview({mode}) {
    const [needs, setNeeds] = useState({'量子芯片': 60});
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingOpen, setBuildingOpen] = useState(false);
    return <Provider><CompactModeContext.Provider value={mode}>
        <Result needs_list={needs} set_needs_list={setNeeds}
            show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
            show_building_popup={buildingOpen} set_show_building_popup={setBuildingOpen}/>
    </CompactModeContext.Provider></Provider>;
}

const modes = ['full', 'compact', 'narrow', 'mobile'];
const multiRecipe = {原料: {'铁块': 2, '铜块': 3, '硅石': 4}, 产物: {'电路板': 5, '石材': 7}, 时间: 6.25};
const multiDescription = '铁块 × 2 + 铜块 × 3 + 硅石 × 4 → 电路板 × 5 + 石材 × 7 · 6.25s';

function quantitySnapshot() {
    // Automatically balanced source-group quantities are read-only outputs.
    const values = [...screen.getAllByRole('textbox'), ...document.querySelectorAll('[data-source-kind="automatic"] [data-source-field] output')]
        .filter(input => !input.closest('.dsp-inactive-automatic-route'));
    return Object.fromEntries(values.map(input => [input.getAttribute('aria-label'), input.value || input.textContent]));
}
function controlSnapshot() {
    const scroll = screen.getByRole('region', {name: '生产结果表，可横向滚动'});
    return within(scroll).getAllByRole('button').map(button => ({
        name: button.getAttribute('aria-label') || button.textContent,
        pressed: button.getAttribute('aria-pressed'),
        disabled: button.disabled,
    }));
}

describe('horizontal overview information and behavior parity', () => {
    it.each(modes)('keeps every ingredient, output, count and time accessible in %s recipes', mode => {
        render(<Provider><Recipe recipe={multiRecipe} compact={mode}/></Provider>);
        const recipe = screen.getByTitle(multiDescription);
        expect(recipe).toHaveAccessibleName(multiDescription);
        expect(within(recipe).getByText('6.25s')).toBeInTheDocument();
        if (mode === 'full') {
            // A wrapped full recipe still visibly contains all input/output amounts.
            for (const count of ['2', '3', '4', '5', '7']) {
                expect(within(recipe).getByText(count, {exact: true})).toBeInTheDocument();
            }
            expect(within(recipe).getAllByRole('img')).toHaveLength(5);
        }
    });

    it.each(modes)('keeps no-input collection recipe details in %s mode', mode => {
        render(<Provider><Recipe recipe={{原料: {}, 产物: {'铁矿': 1}, 时间: 1}} compact={mode}/></Provider>);
        const recipe = screen.getByTitle('直接采集 → 铁矿 × 1 · 1s');
        expect(recipe).toHaveAccessibleName('直接采集 → 铁矿 × 1 · 1s');
        expect(within(recipe).getByText('1s')).toBeInTheDocument();
    });

    it('preserves the 28-row quantum-chip calculation and every control across layout modes', () => {
        const {rerender} = render(<QuantumOverview mode="full"/>);
        const table = screen.getByRole('region', {name: '生产结果表，可横向滚动'}).querySelector('table');
        expect(table.querySelectorAll('tbody > tr')).toHaveLength(28);
        expect(screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'})).toHaveValue('60.00');
        expect(screen.getByRole('textbox', {name: '量子芯片工厂数量，等比例调整需求'})).toHaveValue('8.00');
        const quantities = quantitySnapshot();
        const controls = controlSnapshot();
        expect(Object.keys(quantities)).toHaveLength(56);
        for (const mode of modes.slice(1)) {
            rerender(<QuantumOverview mode={mode}/>);
            expect(quantitySnapshot()).toEqual(quantities);
            expect(controlSnapshot()).toEqual(controls);
            const scroll = screen.getByRole('region', {name: '生产结果表，可横向滚动'});
            expect(within(scroll).getAllByRole('columnheader')).toHaveLength(9);
            expect(scroll.querySelectorAll('tbody > tr')).toHaveLength(28);
            const quantumRow = screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'}).closest('tr');
            const recipeButton = within(quantumRow).getByRole('button', {name: '量子芯片配方 1', exact: true});
            expect(recipeButton).toHaveAttribute('aria-description', '处理器 × 2 + 位面过滤器 × 2 → 量子芯片 × 1 · 6s');
        }
    });

    it('keeps factory selection and proportional quantity edits working after a narrow resize', async () => {
        const user = userEvent.setup();
        const {rerender} = render(<QuantumOverview mode="full"/>);
        rerender(<QuantumOverview mode="narrow"/>);
        let quantumRow = screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'}).closest('tr');
        const mk3 = within(quantumRow).getByRole('button', {name: /制造台\sMk\.III/});
        await user.click(mk3);
        expect(screen.getByRole('textbox', {name: '量子芯片工厂数量，等比例调整需求'})).toHaveValue('4.00');
        const beforeScale = quantitySnapshot();
        const amount = screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'});
        await user.clear(amount);
        await user.type(amount, '120');
        await user.keyboard('{Enter}');
        expect(screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'})).toHaveValue('120.00');
        expect(screen.getByRole('textbox', {name: '量子芯片工厂数量，等比例调整需求'})).toHaveValue('8.00');
        const afterScale = quantitySnapshot();
        for (const [label, value] of Object.entries(beforeScale)) {
            if (label.includes('产能')) expect(Number(afterScale[label])).toBeCloseTo(Number(value) * 2, 1);
        }
        rerender(<QuantumOverview mode="mobile"/>);
        quantumRow = screen.getByRole('textbox', {name: '量子芯片产能，等比例调整需求'}).closest('tr');
        expect(within(quantumRow).getByRole('button', {name: /制造台\sMk\.III/})).toHaveAttribute('aria-pressed', 'true');
        expect(quantitySnapshot()).toEqual(afterScale);
    });
});
