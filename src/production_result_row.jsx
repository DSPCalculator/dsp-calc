import {Children, cloneElement, createContext, useContext} from 'react';
import {cn} from './lib/utils';
import {ItemIcon} from './icon.jsx';

/** Empty in flat view; each tree occurrence gets its own DOM identity. */
export const ProductionRowInstanceContext = createContext('');

/** Reuse global recipe controls, replacing tree quantities with read-only branch requirements. */
export function CanonicalProductionRow({row, instanceId = '', leadingCell, rowProps = {}, branch, settings}) {
    const {children, ...props} = row.props;
    let cells = children;
    if (branch) {
        const original = Children.toArray(children);
        const grouped = original[0]?.props.colSpan === 8;
        const format = value => Number.isFinite(value) ? (value + (branch.production?.displayOffset || 0)).toFixed(settings.fixed_num) : '—';
        const quantityCells = [
            <td key="branch-capacity" className="px-2 py-3 text-right tabular-nums">
                <output aria-label={`${branch.item}本支产能`}>{format(branch.production?.capacity)}</output>
                {branch.production?.status === 'unallocated' && <p className="whitespace-nowrap text-xs text-muted-foreground">{branch.reason === 'global-supply' ? '来源未分配' : branch.reason === 'cycle' ? '循环引用' : '暂无法确定'}</p>}
            </td>,
            <td key="branch-buildings" className="px-2 py-3 whitespace-nowrap tabular-nums">
                <span className="inline-flex items-center gap-1">
                    {branch.production?.factoryName && <ItemIcon item={branch.production.factoryName} size={24}/>}
                    <output aria-label={`${branch.item}本支工厂数量`}>{format(branch.production?.buildings)}</output>
                </span>
                {branch.production?.status === 'unallocated' && <p className="text-xs text-muted-foreground">{branch.reason === 'global-supply' ? '共享供给，无唯一分支数量' : '无法确定本支工厂数量'}</p>}
                {branch.production?.sharedCollector && <p className="text-xs text-muted-foreground">共享采集需求折算，非独立机组</p>}
                {branch.production?.status === 'external' && <p className="text-xs text-muted-foreground">外部供给，无需工厂</p>}
            </td>,
        ];
        if (grouped) {
            cells = <>
                <td className="px-2 py-3 text-muted-foreground">—</td>
                <td className="px-2 py-3 whitespace-nowrap font-medium">{branch.item}</td>
                {quantityCells}
                <td colSpan={5} className="px-2 py-3">
                    <details className="dsp-branch-global-settings">
                        <summary className="w-fit cursor-default whitespace-nowrap" aria-label={`${branch.item}全局来源设置`}>全局来源设置</summary>
                        <p className="py-2 text-sm text-muted-foreground">以下是全局来源及其设置，不是本支数量；修改会同步整个计划。</p>
                        <table><caption className="sr-only">{branch.item}全局来源及物流设置</caption><tbody><tr>{children}</tr></tbody></table>
                    </details>
                </td>
            </>;
        } else {
            cells = original.map((cell, index) => index === 2 ? quantityCells[0] : index === 3 ? quantityCells[1]
                : cloneElement(cell, {key: cell.key || index}));
        }
    }
    return <ProductionRowInstanceContext.Provider value={instanceId}>
        <tr {...props} {...rowProps} className={cn(props.className, rowProps.className)} data-row-instance={instanceId || undefined}>
            {leadingCell}{cells}
        </tr>
    </ProductionRowInstanceContext.Provider>;
}

/** Keep tree item names visible even when the flat layout uses icon-only labels. */
export function ProductionItemName({item, compact}) {
    const instanceId = useContext(ProductionRowInstanceContext);
    return <span className={cn('dsp-item-name text-sm font-medium', compact && !instanceId && 'sr-only')}>{item}</span>;
}

export function ProductionColumns({unit, global = false, branch = false}) {
    return <>
        <th scope="col" className="px-2 py-3 font-medium">操作</th><th scope="col" className="px-2 py-3 font-medium">物品</th>
        <th scope="col" className="px-2 py-3 text-right font-medium">{branch ? '本支产能' : global ? '全局产能' : '产能'} / {unit}</th>
        <th scope="col" className="px-2 py-3 font-medium">{branch ? '本支工厂数量' : global ? '全局工厂数量' : '工厂数量'}</th>
        <th scope="col" className="px-2 py-3 font-medium">配方选取</th><th scope="col" className="px-2 py-3 font-medium">增产模式</th>
        <th scope="col" className="px-2 py-3 font-medium">增产剂</th><th scope="col" className="px-2 py-3 font-medium">工厂类型</th>
        <th scope="col" className="w-24 px-2 py-3 font-medium">{branch ? '全局物流估算' : '物流估算'}</th>
    </>;
}
