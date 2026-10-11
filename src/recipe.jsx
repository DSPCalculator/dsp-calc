import {useRef, useState, useEffect} from 'react';
import {ItemIcon} from './icon';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';
import {cn} from './lib/utils';

function CompactRecipeIcons({input_entries, time, icon_size, gap}) {
    const container_ref = useRef(null);
    const [visible_count, set_visible_count] = useState(input_entries.length);

    useEffect(() => {
        const el = container_ref.current;
        if (!el) return;
        const slot_w = icon_size + gap;
        const badge_w = 30;
        const time_w = 40;

        function recalc() {
            const avail = el.offsetWidth;
            if (avail <= 0) return;
            const n = input_entries.length;
            if (slot_w * n + time_w <= avail) {
                set_visible_count(n);
                return;
            }
            for (let k = n - 1; k >= 1; k--) {
                if (slot_w * k + badge_w + time_w <= avail) {
                    set_visible_count(k);
                    return;
                }
            }
            set_visible_count(1);
        }

        recalc();
        const ro = new ResizeObserver(recalc);
        ro.observe(el);
        return () => ro.disconnect();
    }, [input_entries.length, icon_size, gap]);

    const hidden_count = input_entries.length - visible_count;
    return <span ref={container_ref} className="flex min-w-0 items-center overflow-hidden" style={{gap}}>
        {input_entries.slice(0, visible_count).map(([item]) =>
            <ItemIcon key={item} item={item} size={icon_size}/>
        )}
        {hidden_count > 0 && <Badge variant="secondary" className="shrink-0 px-1 text-xs">+{hidden_count}</Badge>}
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{time}s</span>
    </span>;
}

export function describeRecipe(recipe) {
    const ingredients = Object.entries(recipe["原料"]).map(([item, count]) => `${item} × ${count}`).join(' + ') || '直接采集';
    const products = Object.entries(recipe["产物"]).map(([item, count]) => `${item} × ${count}`).join(' + ');
    return `${ingredients} → ${products} · ${Math.ceil(recipe["时间"] * 100) / 100}s`;
}

export function Recipe({recipe, compact}) {
    function findNonZeroPosition(num) {
        const numStr = num.toString();
        const dotIndex = numStr.indexOf('.');
        if (dotIndex === -1) return undefined;
        for (let i = dotIndex + 1; i < numStr.length; i++) {
            if (numStr[i] !== '0') return i - dotIndex;
        }
        return undefined;
    }

    function item_to_doms([item, count]) {
        const count_used = count >= 1
            ? Math.round(count * 100) / 100
            : count.toFixed(findNonZeroPosition(count) + 2);
        return <span key={item} className="dsp-recipe-ingredient inline-flex shrink-0 items-center gap-0.5">
            <ItemIcon item={item} size={28}/>
            <span className="mr-1 self-end text-sm tabular-nums text-muted-foreground">{count_used}</span>
        </span>;
    }

    const input_entries = Object.entries(recipe["原料"]);
    const input_doms = input_entries.map(item_to_doms);
    const output_doms = Object.entries(recipe["产物"]).map(item_to_doms);
    const time = Math.ceil(recipe["时间"] * 100) / 100;
    const description = describeRecipe(recipe);

    if (compact === "mobile") {
        return <span className="inline-flex items-center gap-1" title={description} role="img" aria-label={description}>
            {input_entries.length > 0 && <ItemIcon item={input_entries[0][0]} size={20}/>}
            {input_entries.length > 1 && <Badge variant="secondary" className="px-1 text-xs">+{input_entries.length - 1}</Badge>}
            <span className="text-sm tabular-nums text-muted-foreground">{time}s</span>
        </span>;
    }

    if (compact === "narrow" || compact === "compact") {
        if (input_entries.length === 0) return <span className="text-sm text-muted-foreground" title={description} role="img" aria-label={description}>{time}s</span>;
        return <span className={cn("dsp-compact-recipe block w-max min-w-0", compact === "narrow" ? "max-w-28" : "max-w-32")} title={description} role="img" aria-label={description}>
            <CompactRecipeIcons input_entries={input_entries} time={time} icon_size={compact === "narrow" ? 22 : 24} gap={4}/>
        </span>;
    }

    return <span className="dsp-full-recipe inline-flex max-w-72 flex-wrap items-center gap-x-1 gap-y-1" title={description} role="img" aria-label={description}>
        {input_doms.length > 0 && <>
            {input_doms}
            <span className="mx-0.5 inline-flex min-w-6 flex-col items-center text-muted-foreground">
                <span aria-hidden="true" className="text-lg leading-4">→</span>
                <span className="text-xs leading-4 tabular-nums">{time}s</span>
            </span>
        </>}
        {output_doms}
        {input_doms.length === 0 && <span className="ml-1 self-end text-xs text-muted-foreground">{time}s</span>}
    </span>;
}

export function HorizontalMultiButtonSelect({choice, options, onChange, no_gap, className, icon_size}) {
    const resolved_icon_size = icon_size || 32;
    return <div className={cn("dsp-segmented-control inline-flex w-fit items-center rounded-md border bg-muted/40 p-0.5", no_gap ? "gap-0" : "gap-1", className)} role="group">
        {options.map(({value, label, item_icon, className: optionClassName}) => {
            const selected = choice == value;
            return <Button key={value} type="button" variant="ghost" size="sm"
                aria-pressed={selected}
                aria-label={typeof label === 'string' ? label : item_icon || String(value)}
                className={cn("h-auto min-h-8 min-w-7 gap-0.5 rounded-md px-0.5 py-1 text-sm font-medium whitespace-nowrap", selected ? "bg-background text-foreground shadow-sm ring-1 ring-border hover:bg-background" : "text-muted-foreground hover:text-foreground", optionClassName)}
                onClick={() => onChange(value)}>
                {item_icon && <ItemIcon item={item_icon} size={resolved_icon_size}/>}
                {label != null && (typeof label === 'string' ? <span className="px-0.5">{label}</span> : label)}
            </Button>;
        })}
    </div>;
}
