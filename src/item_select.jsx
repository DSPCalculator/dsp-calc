import structuredClone from '@ungap/structured-clone';
import { Modal } from 'bootstrap';
import { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { icon_layout } from '../data/icon_layout.jsx';
import { GameInfoContext } from './contexts.jsx';
import { ItemIcon } from './recipe.jsx';

function ItemSelectPanel({ onSelect }) {
  const game_info = useContext(GameInfoContext);
  let game_data = game_info.game_data;

  let all_unused_targets = new Set(game_data.recipe_data
    .flatMap(recipe => Object.keys(recipe["产物"])));

  let icons = structuredClone(icon_layout);

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

  const doms = icons.map((row, i) => {
    if (row.length == 0) return <div key={i} className="m-2"></div>;
    let doms = row.map((r, i) => {
      // TODO is_ore
      let [is_ore, item] =
        r.startsWith("*") ? [true, r.substring(1)] : [false, r];

      if (item == "")
        return <div key={i} style={{ width: "48px" }}></div>;
      else {
        return <div key={i}
          className="bg-body-secondary bg-opacity-10 cursor-pointer hover-bg-opacity-50"
          onClick={() => onSelect(item)}>
          <ItemIcon item={item} size={48} />
        </div>;
      }
    });
    return <div key={i} className="d-flex gap-1 px-2 w-fit">{doms}</div>;
  })

  return <div className="bg-dark p-3 w-fit rounded-3"
    style={{ "--bs-bg-opacity": 0.9 }}>
    <div className="d-flex flex-column gap-1 py-2 w-fit">{doms}</div>
  </div>;
}

export function ItemSelect({ item, set_item, text, btn_class }) {
  const ref = useRef();
  const ref_modal = useRef();

  useEffect(() => {
    ref_modal.current = new Modal(ref.current);
  }, [ref]);

  btn_class = btn_class || "btn-outline-primary";

  return <>
    <button className={`btn py-1 px-2 ${btn_class} d-inline-flex align-items-center`}
      onClick={() => ref_modal.current.show()}>
      {item && <><ItemIcon item={item} size={24} tooltip={false} />
        <span className="ms-1"></span></>}
      {(item) ?
        <small className="text-nowrap">{item}</small>
        : text}
    </button>

    {createPortal(
      <div ref={ref} className="modal" tabIndex="-1">
        <div className="modal-dialog mw-fit">
          <div className="modal-content">
            <ItemSelectPanel onSelect={item => {
              set_item(item);
              ref_modal.current.hide();
            }} />
          </div>
        </div>
      </div>
      , document.body)}
  </>;
}
