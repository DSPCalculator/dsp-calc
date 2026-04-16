import {useContext, useLayoutEffect, useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {Trash} from 'react-bootstrap-icons';
import {FaPlusCircle, FaPlusSquare, FaTrashAlt} from 'react-icons/fa';
import {GlobalStateContext, SettingsSetterContext} from '@ui/app/providers/app-contexts';
import type {NumericMap} from '@engine/types/domain';
import {ItemIcon} from '@ui/components/icons/ItemIcon';
import {ItemSelect} from '@ui/components/selectors/ItemPickerButton';

type NeedsEntryControlsMode = 'full' | 'icons-only';

function measureNeedsEntryWidth(controls: HTMLDivElement, mode: NeedsEntryControlsMode): number {
    const clone = controls.cloneNode(true) as HTMLDivElement;
    clone.classList.remove('needs-entry-controls-icons-only');
    if (mode === 'icons-only') {
        clone.classList.add('needs-entry-controls-icons-only');
    }
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = 'max-content';
    clone.style.maxWidth = 'none';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);
    const width = Math.ceil(clone.getBoundingClientRect().width);
    document.body.removeChild(clone);
    return width;
}

function measureNeedsChipInlineWidth(chip_list: HTMLDivElement): number {
    const clone = chip_list.cloneNode(true) as HTMLDivElement;
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = 'max-content';
    clone.style.maxWidth = 'none';
    clone.style.flexWrap = 'nowrap';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);
    const width = Math.ceil(clone.getBoundingClientRect().width);
    document.body.removeChild(clone);
    return width;
}

export function NeedsList({needs_list, set_needs_list}: {
    needs_list: NumericMap;
    set_needs_list: (next_needs_list: NumericMap) => void;
}) {
    const global_state = useContext(GlobalStateContext);
    const count_ref = useRef<HTMLInputElement | null>(null);
    const needs_entry_row_ref = useRef<HTMLDivElement | null>(null);
    const needs_entry_controls_ref = useRef<HTMLDivElement | null>(null);
    const needs_chip_list_ref = useRef<HTMLDivElement | null>(null);
    const set_settings = useContext(SettingsSetterContext);
    const item_data = global_state.item_data;
    const natural_production_line = global_state.settings.natural_production_line;
    const [controls_mode, set_controls_mode] = useState<NeedsEntryControlsMode>('full');
    const [chips_stacked, set_chips_stacked] = useState(false);
    const needs_doms = (Object.entries(needs_list) as Array<[string, number]>).map(([item, count]) => {
        function edit_count(e: ChangeEvent<HTMLInputElement>) {
            set_needs_list({
                ...needs_list,
                [item]: Number(e.target.value),
            });
        }

        function remove() {
            const rest_needs_list = {...needs_list};
            delete rest_needs_list[item];
            set_needs_list(rest_needs_list);
        }

        return <div key={item} className="needs-chip d-inline-flex align-items-center">
            <span className="needs-chip-icon">
                <ItemIcon item={item} size={24}/>
            </span>
            <span className="ms-1 me-2">x</span>
            <div key={item} className="input-group input-group-sm needs-chip-input d-inline-flex">
                <input type="text" className="form-control" style={{width: "6em"}} value={count} onChange={edit_count}/>
                <button className="btn btn-outline-danger d-inline-flex align-items-center" onClick={remove}>
                    <Trash/>
                </button>
            </div>
        </div>;
    });

    function add_need(item: string) {
        if (!(item in item_data)) {
            alert("请输入或选择正确的物品名字！");
            return;
        }
        const count = Number(count_ref.current?.value ?? 0);
        set_needs_list({
            ...needs_list,
            [item]: (needs_list[item] || 0) + count,
        });
    }

    function add_npl(item: string) {
        const count = Number(count_ref.current?.value ?? 0);
        const new_npl = [...natural_production_line, {
            "目标物品": item,
            "目标产量": count,
            "建筑数量": 10, "配方id": 1, "增产点数": 0, "增产模式": 0, "建筑": 0
        }];
        set_settings({"natural_production_line": new_npl});
    }

    const is_min = global_state.settings.is_time_unit_minute;
    const needs_list_measure_key = Object.entries(needs_list).map(([item, count]) => `${item}:${count}`).join('|');

    useLayoutEffect(() => {
        const needs_entry_row = needs_entry_row_ref.current;
        const needs_entry_controls = needs_entry_controls_ref.current;
        if (!needs_entry_row || !needs_entry_controls) {
            return;
        }

        // 按真实宽度决定按钮何时折叠，以及需求芯片何时整块下移。
        const updateLayout = () => {
            const available_width = needs_entry_row.clientWidth;
            if (available_width <= 0) {
                return;
            }

            const full_controls_width = measureNeedsEntryWidth(needs_entry_controls, 'full');
            const icons_only_controls_width = measureNeedsEntryWidth(needs_entry_controls, 'icons-only');
            const next_controls_mode = available_width >= full_controls_width ? 'full' : 'icons-only';
            const active_controls_width = next_controls_mode === 'full' ? full_controls_width : icons_only_controls_width;
            const chip_list = needs_chip_list_ref.current;
            let next_chips_stacked = false;

            if (chip_list) {
                const column_gap = Number.parseFloat(getComputedStyle(needs_entry_row).columnGap || '0') || 0;
                const chip_inline_width = measureNeedsChipInlineWidth(chip_list);
                next_chips_stacked = active_controls_width + column_gap + chip_inline_width > available_width;
            }

            set_controls_mode(prev_mode => prev_mode === next_controls_mode ? prev_mode : next_controls_mode);
            set_chips_stacked(prev_mode => prev_mode === next_chips_stacked ? prev_mode : next_chips_stacked);
        };

        const resize_observer = new ResizeObserver(updateLayout);
        resize_observer.observe(needs_entry_row);
        resize_observer.observe(needs_entry_controls);
        if (needs_chip_list_ref.current) {
            resize_observer.observe(needs_chip_list_ref.current);
        }
        updateLayout();

        return () => {
            resize_observer.disconnect();
        };
    }, [is_min, needs_list_measure_key]);

    return <>
        <div className="needs-panel">
            <div ref={needs_entry_row_ref} className="needs-entry-row">
                <div ref={needs_entry_controls_ref}
                     className={`needs-entry-controls${controls_mode === 'icons-only' ? ' needs-entry-controls-icons-only' : ''}`}>
                    <small className="fw-bold text-nowrap">添加需求</small>
                    <div className="input-group input-group-sm needs-entry-group d-inline-flex">
                        <input type="text" className="form-control" style={{width: "6em"}} ref={count_ref} defaultValue={60}/>
                        <span className="input-group-text">/{is_min ? "min" : "sec"}</span>
                        <button className="btn btn-sm btn-outline-danger text-nowrap d-inline-flex align-items-center gap-1 mobile-icon-button"
                                title="清空需求"
                                aria-label="清空需求"
                                onClick={() => set_needs_list({})}>
                            <FaTrashAlt/>
                            <span className="mobile-icon-button-label">清空需求</span>
                        </button>
                        <ItemSelect text="添加需求物品" set_item={add_need}
                                    icon={<FaPlusCircle/>}/>
                        <ItemSelect text="添加现有产线" set_item={add_npl}
                                    icon={<FaPlusSquare/>}
                                    btn_class="btn btn-sm btn-outline-success text-nowrap"/>
                    </div>
                </div>
                {Object.keys(needs_list).length == 0 ||
                    <div ref={needs_chip_list_ref}
                         className={`needs-chip-list d-flex flex-wrap gap-4 row-gap-0 align-items-center${chips_stacked ? ' needs-chip-list-stacked' : ' needs-chip-list-inline'}`}>
                        {needs_doms}
                    </div>
                }
            </div>
        </div>
    </>;
}
