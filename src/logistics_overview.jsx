import {useContext, useEffect, useId, useRef, useState} from 'react';
import {GlobalStateContext} from './contexts.jsx';
import {ItemIcon} from './icon.jsx';
import {Button} from './components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from './components/ui/popover';

function recommendationLabel(estimate, noun) {
    const option = estimate?.recommended;
    if (option) return `${noun} ${option.name} × ${option.count}${estimate.complete === false ? '，部分来源未评估' : ''}`;
    if (estimate?.status === 'unavailable') return `${noun}暂无法估算`;
    if (estimate?.status === 'not-applicable') return `${noun}不适用`;
    return `${noun}无当前流量`;
}

function CompactRecommendation({estimate, noun}) {
    const option = estimate?.recommended;
    return <span className="inline-flex min-w-7 flex-col items-center gap-0.5" title={recommendationLabel(estimate, noun)}>
        {option ? <>{estimate.complete === false
            ? <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center text-base text-muted-foreground" aria-label={`${noun}仅有部分来源估算`}>?</span>
            : <ItemIcon item={option.name} size={26} tooltip={false}/>}
            {option.count > 1 && <span className="text-base leading-none tabular-nums">×{option.count}</span>}</>
            : <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center text-base text-muted-foreground" aria-hidden="true">{estimate?.status === 'unavailable' ? '?' : '—'}</span>}
    </span>;
}

function TierAlternatives({estimate, title, noun, unit, rate, capacity}) {
    if (!estimate) return null;
    return <section className="space-y-2" aria-label={title}>
        <h4 className="text-base font-medium">{title}</h4>
        {Number.isFinite(estimate.throughputPerSecond) && <p className="text-base text-muted-foreground tabular-nums">流量 {rate(estimate.throughputPerSecond)} / {unit}</p>}
        {Number.isFinite(estimate.cargoPerSecond) && <p className="text-base text-muted-foreground tabular-nums">货物占位 {rate(estimate.cargoPerSecond)} / {unit}{estimate.stackHeight ? ` · 按 ${estimate.stackHeight} 层` : ''}</p>}
        {estimate.alternatives?.length > 0 && <ul className="space-y-1.5">
            {estimate.alternatives.map(option => <li key={option.tier} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-base"
                aria-label={`${title} ${option.name} ${option.count} ${noun}`}>
                <span className="inline-flex items-center gap-2"><ItemIcon item={option.name} size={26}/><span>{option.name}</span></span>
                <span className="text-right tabular-nums">{option.count} {noun}<span className="ml-2 text-muted-foreground">单{noun} {capacity(option.capacityPerSecond)} / {unit}</span></span>
            </li>)}
        </ul>}
        {estimate.complete === false && <p className="text-base text-amber-700 dark:text-amber-400">这些档位仅供已评估来源参考；尚不能确定整个产品组的分拣器需求</p>}
        {estimate.reason && <p className="text-base text-muted-foreground">{estimate.reason}</p>}
        {estimate.recommended?.count > 1 && <p className="text-base text-amber-700 dark:text-amber-400">超过最高档单{noun}容量，需 {estimate.recommended.count} {noun}并行；实际布局还需检查端口与摆放位置</p>}
    </section>;
}

/** Compact by default; hover previews, click pins, and Radix handles dismissal. */
export function LogisticsOverview({item, estimate}) {
    const {settings} = useContext(GlobalStateContext);
    const [open, setOpen] = useState(false);
    const pinned = useRef(false);
    const trigger = useRef(null);
    const restoreFocus = useRef(false);
    const closeTimer = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    const tick = settings.is_time_unit_minute ? 60 : 1;
    const unit = tick === 60 ? 'min' : 's';
    const rate = value => (Number(value) * tick).toFixed(settings.fixed_num);
    // Tier capacities are physical constants, not user-rounded production totals.
    const capacity = value => (Number(value) * tick).toLocaleString('zh-CN', {useGrouping: false, maximumFractionDigits: 4});

    function clearCloseTimer() {
        if (closeTimer.current !== null) clearTimeout(closeTimer.current);
        closeTimer.current = null;
    }
    useEffect(() => () => {
        if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    }, []);

    function onOpenChange(next) {
        clearCloseTimer();
        if (!next) pinned.current = false;
        setOpen(next);
    }
    function preview(event) {
        if (event.pointerType === 'touch') return;
        clearCloseTimer();
        setOpen(true);
    }
    function leave(event) {
        if (pinned.current || event.currentTarget.contains(document.activeElement)) return;
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setOpen(false), 160);
    }
    function togglePinned(event) {
        // A click after hover should pin the preview rather than close it.
        event.preventDefault();
        clearCloseTimer();
        const next = !pinned.current;
        if (next) restoreFocus.current = true;
        pinned.current = next;
        setOpen(next);
    }

    const label = `${item}物流估算：${estimate.usePileSorter ? `${estimate.pileSorterLabel}，按来源叠堆；` : ''}${recommendationLabel(estimate.belt, '传送带')}；${recommendationLabel(estimate.sorter, '分拣器')}；查看各档并行数量`;
    let manualOrdinal = 0;
    return <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
            <Button ref={trigger} type="button" variant="ghost" className="dsp-logistics-trigger h-auto min-h-9 w-20 gap-2 px-1 py-1 text-base"
                aria-label={label} onPointerEnter={preview} onPointerLeave={leave} onClick={togglePinned}>
                <CompactRecommendation estimate={estimate.belt} noun="传送带"/>
                <CompactRecommendation estimate={estimate.sorter} noun="分拣器"/>
            </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="left" sideOffset={6} collisionPadding={12}
            className="dsp-logistics-popover max-h-[min(70dvh,42rem)] w-[min(28rem,calc(100vw-1.5rem))] space-y-4 overflow-y-auto p-4 text-base"
            aria-labelledby={titleId} aria-describedby={descriptionId}
            onPointerEnter={preview} onPointerLeave={leave}
            onInteractOutside={event => {
                // Pinning a hover preview clicks its trigger outside the panel.
                // Do not count that as outside interaction and lose Escape focus.
                if (trigger.current?.contains(event.target)) event.preventDefault();
            }}
            onOpenAutoFocus={event => { if (!pinned.current) event.preventDefault(); }}
            onCloseAutoFocus={event => { if (!restoreFocus.current) event.preventDefault(); restoreFocus.current = false; }}
            onFocusCapture={() => { pinned.current = true; restoreFocus.current = true; clearCloseTimer(); }}>
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1"><h3 id={titleId} className="text-base font-semibold">{item}物流估算</h3>
                    <p id={descriptionId} className="text-base text-muted-foreground">{estimate.usePileSorter
                        ? '传送带图标为可单路承担流量的最低档；分拣器按已选集装预设估算。数量为接口流量参考，非精确布局最小值'
                        : '图标为可单路承担流量的最低档；各档数量可作替代方案，非精确布局最小值'}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-1 text-base" aria-label={`关闭${item}物流估算`} onClick={() => onOpenChange(false)}>关闭</Button>
            </div>
            <TierAlternatives estimate={estimate.belt} title={estimate.beltTitle || '合并出料流量，未叠堆'} noun="条" unit={unit} rate={rate} capacity={capacity}/>
            <div className="border-t pt-3"><TierAlternatives estimate={estimate.sorter} title="单台满载出料（最繁忙已评估来源）" noun="个" unit={unit} rate={rate} capacity={capacity}/></div>
            {estimate.sources?.length > 0 && <section className="space-y-2 border-t pt-3" aria-label="各来源物流明细">
                <h4 className="text-base font-medium">各来源</h4>
                {estimate.sources.map(source => {
                    const label = source.kind === 'automatic' ? '需求产线' : source.kind === 'byproduct' ? '副产物供给' : `现有产线 ${++manualOrdinal}`;
                    return <details key={source.id} className="rounded-md border px-2 py-2">
                        <summary className="cursor-default text-base"><span className="font-medium">{label}</span><span className="ml-2 tabular-nums text-muted-foreground">{estimate.usePileSorter ? '净供给 ' : ''}{rate(source.outputPerSecond)} / {unit}</span></summary>
                        <div className="mt-3 space-y-3">
                            {source.factoryName && <p className="inline-flex items-center gap-2 text-base"><ItemIcon item={source.factoryName} size={26}/>{source.factoryName}</p>}
                            <TierAlternatives estimate={source.belt} title={`${label}出料传送带`} noun="条" unit={unit} rate={rate} capacity={capacity}/>
                            <TierAlternatives estimate={source.sorter} title={`${label}单台满载出料分拣器`} noun="个" unit={unit} rate={rate} capacity={capacity}/>
                            {source.reason && <p className="text-base text-muted-foreground">{source.reason}</p>}
                        </div>
                    </details>;
                })}
            </section>}
            {(estimate.assumptions?.length > 0 || estimate.warnings?.length > 0) && <section className="space-y-2 border-t pt-3" aria-label="物流估算假设">
                <h4 className="text-base font-medium">估算条件</h4>
                <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">{estimate.assumptions?.map(text => <li key={text}>{text}</li>)}</ul>
                {estimate.warnings?.map(text => <p key={text} className="text-base text-amber-700 dark:text-amber-400">{text}</p>)}
            </section>}
        </PopoverContent>
    </Popover>;
}
