import Modal from 'bootstrap/js/dist/modal';
import fuzzysort from 'fuzzysort';
import {pinyin} from 'pinyin-pro';
import {useContext, useEffect, useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {createPortal} from 'react-dom';
import {GameInfoContext} from '@ui/app/providers/app-contexts';
import type {ItemName} from '@engine/types/domain';
import type {ItemSelectPanelProps, ItemSelectProps, SearchKeyEvent, StyleWithVars} from '@ui/types/ui';
import {ItemIcon, ITEM_ICON_CONTENT_SIZE, ITEM_ICON_OUTER_SIZE} from '../icons/ItemIcon';

function ItemSelectPanel({fuzz_result, onSelect, icon_grid, icon_size}: ItemSelectPanelProps) {
    const fuzz_set = new Set(fuzz_result);
    const icon_outer_size = icon_size === ITEM_ICON_CONTENT_SIZE ? ITEM_ICON_OUTER_SIZE : icon_size;

    const doms = icon_grid.icons.map(({col, row, item}) => {
        const class_opacity = fuzz_set.has(item) ? "" : "opacity-25";
        return <div key={col + "#" + row}
                    className={`bg-body-secondary bg-opacity-10 cursor-pointer hover-bg-opacity-50 ${class_opacity}`}
                    style={{
                        gridRow: row,
                        gridColumn: col,
                        width: icon_outer_size,
                        height: icon_outer_size,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => onSelect(item)}>
            <ItemIcon item={item} size={icon_size} tooltip={false}/>
        </div>;
    });

    return <div className="px-3 pb-3 pt-0 w-fit rounded-3 gap-1"
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${icon_grid.ncol}, max-content)`,
                    gridTemplateRows: `repeat(${icon_grid.nrow}, max-content)`,
                }}>
        {doms}
    </div>;
}

const ITEM_SELECT_MOBILE_MEDIA_QUERY = '(max-width: 767.98px)';
const ITEM_SELECT_MOBILE_GRID_ICON_SIZE = 28;
const ITEM_SELECT_MOBILE_SEARCH_ICON_SIZE = 24;

function useIsMobileItemSelectViewport() {
    const [is_mobile_viewport, set_is_mobile_viewport] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.matchMedia(ITEM_SELECT_MOBILE_MEDIA_QUERY).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const media_query = window.matchMedia(ITEM_SELECT_MOBILE_MEDIA_QUERY);
        const update_match_state = () => set_is_mobile_viewport(media_query.matches);
        update_match_state();

        // portal 弹窗挂在 body 下，拿不到 calculator-main-stack 的缩放变量，
        // 这里按 main 分支原来的思路，在 ItemSelect 内自己切换移动端图标尺寸。
        if (typeof media_query.addEventListener === 'function') {
            media_query.addEventListener('change', update_match_state);
            return () => media_query.removeEventListener('change', update_match_state);
        }

        media_query.addListener(update_match_state);
        return () => media_query.removeListener(update_match_state);
    }, []);

    return is_mobile_viewport;
}

export function ItemSelect({
    item,
    set_item,
    text = '选择',
    btn_class = 'btn-outline-primary',
    icon_size = 24,
    icon_only = false,
    icon,
    compact_on_mobile = false,
}: ItemSelectProps) {
    const modal_ref = useRef<HTMLDivElement | null>(null);
    const modal_instance_ref = useRef<Modal | null>(null);
    const input_ref = useRef<HTMLInputElement | null>(null);

    const game_info = useContext(GameInfoContext);
    const all_target_items = game_info.all_target_items;
    const [fuzz_result, set_fuzz_result] = useState<ItemName[]>([]);
    const is_mobile_viewport = useIsMobileItemSelectViewport();
    const panel_icon_size = is_mobile_viewport ? ITEM_SELECT_MOBILE_GRID_ICON_SIZE : ITEM_ICON_CONTENT_SIZE;
    const search_icon_size = is_mobile_viewport ? ITEM_SELECT_MOBILE_SEARCH_ICON_SIZE : ITEM_ICON_CONTENT_SIZE;

    const search_targets = all_target_items.map((current_item) => ({
        item: current_item,
        py_first: pinyin(current_item, {pattern: 'first', type: 'array'}).join(""),
        py_full: pinyin(current_item, {toneType: 'none'}),
    }));

    const RESULT_LIMIT = 10;

    useEffect(() => {
        set_fuzz_result(game_info.all_target_items);
    }, [game_info]);

    function do_search(value: string) {
        if (!value) {
            set_fuzz_result(all_target_items);
            return;
        }

        const search_result = fuzzysort.go(value, search_targets, {
            keys: ["item", "py_first", "py_full"],
            limit: RESULT_LIMIT,
        });
        set_fuzz_result(search_result.map(result => result.obj.item));
    }

    function on_select_item(next_item: ItemName) {
        set_item(next_item);
        modal_instance_ref.current?.hide();
    }

    const search_result_doms = fuzz_result.length > RESULT_LIMIT ? [] : fuzz_result.map((matched_item, i) => {
        const hl_class = i === 0 ? "bg-opacity-75" : "bg-opacity-25";
        return <div key={matched_item}
                    className={`text-white bg-secondary ${hl_class} rounded-3 p-1 d-flex align-items-center gap-2 cursor-pointer`}
                    onClick={() => on_select_item(matched_item)}>
            <ItemIcon item={matched_item} size={search_icon_size} tooltip={false}/>
            <small>{matched_item}</small>
        </div>;
    });

    function on_search_keydown(e: SearchKeyEvent) {
        if (e.key === 'Enter' && fuzz_result.length > 0 && fuzz_result.length <= RESULT_LIMIT) {
            on_select_item(fuzz_result[0]);
        }
    }

    useEffect(() => {
        if (!modal_ref.current) {
            return;
        }
        modal_instance_ref.current = new Modal(modal_ref.current);
        return () => {
            modal_instance_ref.current?.dispose();
            modal_instance_ref.current = null;
        };
    }, []);

    function show() {
        modal_instance_ref.current?.show();
        if (input_ref.current) {
            input_ref.current.select();
            input_ref.current.focus();
        }
    }

    const modalContentStyle: StyleWithVars = {"--bs-bg-opacity": 0.85};
    const trigger_padding_class = icon_only ? "p-0" : "py-1 px-2";
    const compact_trigger_class = compact_on_mobile ? " compact-on-mobile" : "";

    return <>
        <button className={`btn ${trigger_padding_class} ${btn_class} d-inline-flex align-items-center gap-1 item-select-trigger${compact_trigger_class}`}
                aria-label={text}
                title={text}
                onClick={show}>
            {item && <><ItemIcon item={item} size={icon_size} tooltip={!icon_only}/>
                {!icon_only && <span className="ms-1"></span>}</>}
            {!item && icon}
            {(item && !icon_only) ?
                <small className="text-nowrap item-select-trigger-label">{item}</small>
                : <span className="text-nowrap item-select-trigger-label">{text}</span>}
        </button>

        {createPortal(
            <div ref={modal_ref} className="modal" tabIndex={-1}>
                <div className="modal-dialog mw-fit item-select-dialog">
                    <div className="modal-content bg-dark d-flex flex-column" style={modalContentStyle}>
                        <div className="px-3 pt-3 pb-1 d-flex flex-column gap-2">
                            <input ref={input_ref} className="round rounded-3 py-1 px-2 my-1"
                                   placeholder="搜索（支持拼音）"
                                   onChange={(e: ChangeEvent<HTMLInputElement>) => do_search(e.target.value)}
                                   onKeyDown={on_search_keydown}/>
                            {search_result_doms}
                        </div>
                        <ItemSelectPanel fuzz_result={fuzz_result} icon_grid={game_info.icon_grid}
                                         icon_size={panel_icon_size}
                                         onSelect={on_select_item}/>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </>;
}
