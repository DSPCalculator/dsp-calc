import React, {useRef, useState, useEffect} from 'react';
import {ItemIcon} from './icon';

// compact/narrow 模式下自适应截断图标的子组件
function CompactRecipeIcons({input_entries, time, icon_size, gap}) {
    const container_ref = useRef(null);
    const [visible_count, set_visible_count] = useState(input_entries.length);

    useEffect(() => {
        const el = container_ref.current;
        if (!el) return;

        // 每个图标槽位宽度 = 图标尺寸 + gap
        const slot_w = icon_size + gap;
        // "+N" 徽标的估算宽度（约 30px 足够 "+9"）
        const badge_w = 30;
        // 时间文字的估算宽度（"(Xs)" 最长约 40px）
        const time_w = 40;

        function recalc() {
            const avail = el.offsetWidth;
            if (avail <= 0) return;

            const n = input_entries.length;
            // 先尝试全部放下（时间文字占位）
            if (slot_w * n + time_w <= avail) {
                set_visible_count(n);
                return;
            }
            // 逐步减少，留出 badge 空间
            for (let k = n - 1; k >= 1; k--) {
                if (slot_w * k + badge_w + time_w <= avail) {
                    set_visible_count(k);
                    return;
                }
            }
            // 至少显示 1 个
            set_visible_count(1);
        }

        recalc();

        const ro = new ResizeObserver(recalc);
        ro.observe(el);
        return () => ro.disconnect();
    }, [input_entries.length, icon_size, gap]);

    const hidden_count = input_entries.length - visible_count;

    return (
        <span ref={container_ref}
              className="d-flex align-items-center"
              style={{gap: `${gap}px`, flexWrap: 'nowrap', overflow: 'hidden'}}>
            {input_entries.slice(0, visible_count).map(([item]) =>
                <ItemIcon key={item} item={item} size={icon_size}/>
            )}
            {hidden_count > 0 &&
                <small className="text-muted ssmall" style={{flexShrink: 0}}>+{hidden_count}</small>}
            <small className="text-recipe-time ssmall" style={{flexShrink: 0}}>({time}s)</small>
        </span>
    );
}

export function Recipe({recipe, compact}) {
    function findNonZeroPosition(num) {
        const numStr = num.toString();
        const dotIndex = numStr.indexOf('.');//1
        if (dotIndex === -1) {
            // 没有小数点，返回undefined
            return undefined;
        }
        // 寻找第一个不为0的数字的位置
        for (let i = dotIndex + 1; i < numStr.length; i++) {
            if (numStr[i] !== '0') {
                return i - dotIndex; // 返回小数点后的位置
            }
        }
        // 所有小数位都是0，返回undefined
        return undefined;
    }

    function item_to_doms([item, count]) {
        const count_used = count >= 1
            ? Math.round(count * 100) / 100
            : count.toFixed(findNonZeroPosition(count) + 2);
        return <React.Fragment key={item}>
            <ItemIcon item={item} size={28}/>
            <span className="me-1 ssmall align-self-end">{count_used}</span>
        </React.Fragment>;
    }

    const input_entries = Object.entries(recipe["原料"]);
    const input_doms = input_entries.map(item_to_doms);
    const output_doms = Object.entries(recipe["产物"]).map(item_to_doms);
    //时间向上取整，因为工厂也是向上取整
    const time = Math.ceil(recipe["时间"] * 100) / 100;

    // mobile 模式：极简显示，只有第一个原料图标 + 数量提示
    if (compact === "mobile") {
        if (input_entries.length === 0) {
            return <small className="text-recipe-time">({time}s)</small>;
        }
        return <span className="d-inline-flex align-items-center gap-1">
            <ItemIcon item={input_entries[0][0]} size={20}/>
            {input_entries.length > 1 &&
                <small className="text-muted ssmall">+{input_entries.length - 1}</small>}
        </span>;
    }

    // narrow/compact 模式：自适应截断，超出列宽时显示 +N
    if (compact === "narrow" || compact === "compact") {
        if (input_entries.length === 0) {
            return <small className="text-recipe-time">({time}s)</small>;
        }
        // narrow 模式图标被 CSS 强制为 22px；compact 为 24px
        const icon_size = compact === "narrow" ? 22 : 24;
        return <CompactRecipeIcons
            input_entries={input_entries}
            time={time}
            icon_size={icon_size}
            gap={4}
        />;
    }

    // full 模式：完整显示
    return <span className="d-inline-flex">
        {input_doms.length > 0 && <>
            {input_doms}
            <span className="me-1 position-relative"
                  style={{fontSize: "32px", lineHeight: "20px"}}>
                &#10230;
                <span className="position-absolute text-center text-recipe-time"
                      style={{left: 0, width: "100%", top: "50%", fontSize: "12px"}}>
                    {time}s
                </span>
            </span>
        </>}
        {output_doms}

        {input_doms.length === 0 && <small className="ms-1 align-self-end text-recipe-time">
            ({time}s)
        </small>}
    </span>;
}

export function HorizontalMultiButtonSelect({choice, options, onChange, no_gap, className, icon_size}) {
    let gap_class = no_gap ? "" : "gap-1";
    let resolved_icon_size = icon_size || 32;
    let option_doms = options.map(({value, label, item_icon, className}) => {
        let selected_class = choice == value ? "bg-selected" : "bg-unselected";
        // insert 1px white border if [no_gap == true]
        let gap_class = no_gap ? "border-between border-white" : "";
        return <div key={value}
                    className={`py-1 px-1 text-nowrap d-flex align-items-center cursor-pointer small
                ${selected_class} ${gap_class} ${className || ""}`}
                    onClick={() => onChange(value)}
        >{item_icon && <ItemIcon item={item_icon} size={resolved_icon_size}/>}
            {label && (typeof label === 'string' ? <span className="mx-1">{label}</span> : label)}
        </div>;
    })

    return <div className={`d-flex ${gap_class} ${className || ""}`}>{option_doms}</div>;
}
