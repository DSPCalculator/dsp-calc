import structuredClone from '@ungap/structured-clone';
import { Modal } from 'bootstrap';
import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GameInfoContext } from './contexts.jsx';
import { ItemIcon } from './recipe.jsx';
import fuzzysort from 'fuzzysort'
import { pinyin } from 'pinyin-pro';

function ItemSelectPanel({ fuzz_result, onSelect, icons }) {
  let fuzz_set = new Set(fuzz_result);

  const doms = icons.map((row, i) => {
    if (row.length == 0) return <div key={i} className="m-2"></div>;
    let doms = row.map((r, i) => {
      // TODO is_ore
      let [is_ore, item] =
        r.startsWith("*") ? [true, r.substring(1)] : [false, r];

      if (item == "")
        return <div key={i} style={{ width: "48px", height: "48px" }}></div>;
      else {
        let class_opacity = fuzz_set.has(item) ? "" : "opacity-25";
        return <div key={i}
          className={`bg-body-secondary bg-opacity-10 cursor-pointer hover-bg-opacity-50 ${class_opacity}`}
          onClick={() => onSelect(item)}>
          <ItemIcon item={item} size={48} />
        </div>;
      }
    });
    return <div key={i} className="d-flex gap-1 px-2 w-fit">{doms}</div>;
  })

  return <div className="p-3 w-fit rounded-3">
    <div className="d-flex flex-column gap-1 py-2 w-fit">{doms}</div>
  </div>;
}

export function ItemSelect({ item, set_item, text, btn_class }) {
  const ref = useRef();
  const ref_modal = useRef();
  const input_ref = useRef();

  const game_info = useContext(GameInfoContext);
  let game_data = game_info.game_data;
  let all_targets = game_data.recipe_data.flatMap(recipe => Object.keys(recipe["产物"]));
  all_targets = Array.from(new Set(all_targets));
  const [fuzz_result, set_fuzz_result] = useState(all_targets);

  let icon_layouts = new Array(32);
  for (let i = 0; i < 32; i++) {
    icon_layouts[i] = new Array(17).fill("");
  }
  let max_row = 8;
  for (let item in game_info.item_data) {
    if (!(item in game_data.item_grid)) {
      //console.log(item);
      continue;
    }
    let grid = game_data.item_grid[item];
    if (grid > 4716) {
      //console.log(item, grid);
      continue;
    }
    icon_layouts[(Math.floor(grid / 1000) - 1) * max_row + (Math.floor((grid % 1000) / 100) - 1)][Math.floor((grid % 100) - 1)] = item;
  }
  let all_unused_targets = new Set(all_targets);
  let icons = structuredClone(icon_layouts);

  for (let row of icons) {
    for (let i in row) {
      let item = row[i];
      item = item.startsWith("*") ? item.substring(1) : item;
      if (all_unused_targets.has(item)) {
        all_unused_targets.delete(item);
      } else {
        row[i] = "";
      }
    }
  }

  let unused_targets = Array.from(all_unused_targets);
  if (unused_targets.length > 0) {
    icons.push([]);
    const chunkSize = 12;
    for (let i = 0; i < unused_targets.length; i += chunkSize) {
      const chunk = unused_targets.slice(i, i + chunkSize);
      icons.push(chunk);
    }
  }

  const search_targets = all_targets.map(item => ({
    item: item,
    py_first: pinyin(item, { pattern: 'first', type: 'array' }).join(""),
    py_full: pinyin(item, { toneType: 'none' })
  }));

  const RESULT_LIMIT = 10;

  function do_search(value) {
    if (!value) {
      set_fuzz_result(all_targets);
    } else {
      let search_result = fuzzysort.go(value, search_targets, {
        keys: ["item", "py_first", "py_full"],
        limit: RESULT_LIMIT,
      });
      console.log(search_result);
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
        <ItemIcon item={item} tooltip={false} />
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
    <button className={`btn py-1 px-2 ${btn_class} d-inline-flex align-items-center`}
      onClick={show}>
      {item && <><ItemIcon item={item} size={24} tooltip={false} />
        <span className="ms-1"></span></>}
      {(item) ?
        <small className="text-nowrap">{item}</small>
        : <span className="text-nowrap">{text}</span>}
    </button>

    {createPortal(
      <div ref={ref} className="modal" tabIndex="-1">
        <div className="modal-dialog mw-fit">
          <div className="modal-content bg-dark flex-row" style={{ "--bs-bg-opacity": 0.85 }}>
            <ItemSelectPanel fuzz_result={fuzz_result} icons={icons}
              onSelect={on_select_item} />
            <div className="p-3 d-flex flex-column gap-2">
              <input ref={input_ref} className="round rounded-3 py-1 px-2 my-1" placeholder="搜索（支持拼音）"
                onChange={e => do_search(e.target.value)} onKeyDown={on_search_keydown} />
              {search_result_doms}
            </div>
          </div>
        </div>
      </div>
      , document.body)}
  </>;
}
