import { Modal } from 'bootstrap';
import { useEffect, useRef } from 'react';
import { icon_layout } from '../data/icon_layout.jsx';
import { ItemIcon } from './recipe.jsx';

// TODO this should depend on the game data

function ItemSelectPanel({ onSelect }) {
  const doms = icon_layout.map((row, i) => {
    if (row.length == 0) return <div key={i} className="m-1"></div>;
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
      <small className="text-nowrap">{item || text}</small>
    </button>

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
  </>;
}
