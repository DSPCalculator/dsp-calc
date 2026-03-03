import {Modal} from 'bootstrap';
import {useContext, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {CompactModeContext, GameInfoContext} from './contexts.jsx';
import {ItemIcon} from './icon';
import fuzzysort from 'fuzzysort'
import {pinyin} from 'pinyin-pro';

function ItemSelectPanel({fuzz_result, onSelect, icon_grid, icon_size}) {
    let fuzz_set = new Set(fuzz_result);

    const doms = icon_grid.icons.map(({col, row, item}) => {
        let class_opacity = fuzz_set.has(item) ? "" : "opacity-25";
        return <div key={col + "#" + row}
                    className={`bg-body-secondary bg-opacity-10 cursor-pointer hover-bg-opacity-50 ${class_opacity}`}
                    style={{gridRow: row, gridColumn: col}}
                    onClick={() => onSelect(item)}>
            <ItemIcon item={item} size={icon_size}/>
        </div>;
    })

    return <div className="p-3 py-4 w-fit rounded-3 gap-1"
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${icon_grid.ncol}, max-content)`,
                    gridTemplateRows: `repeat(${icon_grid.nrow}, max-content)`,
                }}>
        {doms}
    </div>;
}

export function ItemSelect({item, set_item, text, btn_class, icon}) {
    const ref = useRef();
    const ref_modal = useRef();
    const input_ref = useRef();

    const game_info = useContext(GameInfoContext);
    const compact_mode = useContext(CompactModeContext);
    const icon_size = compact_mode === "mobile" ? 28 : compact_mode === "narrow" ? 40 : 48;
    const search_icon_size = compact_mode === "mobile" ? 24 : compact_mode === "narrow" ? 32 : 40;
    const all_target_items = game_info.all_target_items;
    const [fuzz_result, set_fuzz_result] = useState([]);

    const search_targets = all_target_items.map(item => ({
        item: item,
        py_first: pinyin(item, {pattern: 'first', type: 'array'}).join(""),
        py_full: pinyin(item, {toneType: 'none'})
    }));

    const RESULT_LIMIT = 10;

    useEffect(() => {
        set_fuzz_result(game_info.all_target_items);
    }, [game_info]);

    function do_search(value) {
        if (!value) {
            set_fuzz_result(all_target_items);
        } else {
            let search_result = fuzzysort.go(value, search_targets, {
                keys: ["item", "py_first", "py_full"],
                limit: RESULT_LIMIT,
            });
            set_fuzz_result(search_result.map(e => e.obj.item));
        }
    }

    function on_select_item(item) {
        set_item(item);
        ref_modal.current.hide();
    }

    let search_result_doms = fuzz_result.length > RESULT_LIMIT ? [] : fuzz_result.map((item, i) => {
        let hl_class = i == 0 ? "bg-opacity-75" : "bg-opacity-25";
        return <>
            <div key={item} className={`text-white bg-secondary ${hl_class} rounded-3\
      p-1 d-flex align-items-center gap-2 cursor-pointer`}
                 onClick={() => on_select_item(item)}>
                <ItemIcon item={item} tooltip={false} size={search_icon_size}/>
                <small>{item}</small>
            </div>
        </>
    });

    function on_search_keydown(e) {
        if (e.keyCode == 13 && fuzz_result.length > 0 && fuzz_result.length <= RESULT_LIMIT) {
            on_select_item(fuzz_result[0]);
        }
    }

    useEffect(() => {
        ref_modal.current = new Modal(ref.current);
    }, [ref]);

    btn_class = btn_class || "btn-outline-primary";

    function show() {
        ref_modal.current.show();
        if (input_ref.current) {
            input_ref.current.select();
            input_ref.current.focus();
        }
    }

    return <>
        <button className={`btn py-1 px-2 ${btn_class} d-inline-flex align-items-center gap-1`}
                onClick={show} title={text}>
            {item && <><ItemIcon item={item} size={24} tooltip={false}/>
                <span className="ms-1"></span></>}
            {icon}
            {(item) ?
                <small className="text-nowrap">{item}</small>
                : <span className="text-nowrap compact-hide-text">{text}</span>}
        </button>

        {createPortal(
            <div ref={ref} className="modal" tabIndex="-1">
                <div className="modal-dialog mw-fit">
                    <div className="modal-content bg-dark flex-column" style={{"--bs-bg-opacity": 0.85}}>
                        <div className="px-3 pt-3 pb-1 d-flex flex-column gap-2">
                            <input ref={input_ref} className="round rounded-3 py-1 px-2"
                                   placeholder="搜索（支持拼音）"
                                   onChange={e => do_search(e.target.value)} onKeyDown={on_search_keydown}/>
                            {search_result_doms.length > 0 &&
                                <div className="d-flex flex-column gap-1">{search_result_doms}</div>}
                        </div>
                        <div className="overflow-x-auto">
                            <ItemSelectPanel fuzz_result={fuzz_result} icon_grid={game_info.icon_grid}
                                             onSelect={on_select_item} icon_size={icon_size}/>
                        </div>
                    </div>
                </div>
            </div>
            , document.body)}
    </>;
}
