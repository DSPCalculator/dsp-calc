import { useState } from "react";

/** When `delayed` is `true`, validation (number) is also enabled. */
export const AutoSizedInput = ({ value, onChange, className, delayed }) => {
  const [disp_value, set_disp_value] = useState(null);

  let valid_class = "";
  if (disp_value) {
    valid_class = isNaN(disp_value) ? "invalid" : "valid";
  }

  function commit(new_value) {
    onChange(isNaN(new_value) ? value : new_value);
  }

  return (
    <label className={`auto-sized-input ${className || ""}`}>
      <span>{disp_value || value}</span>
      {delayed
        ? <input
          className={(className || "") + " " + valid_class}
          type="text"
          value={disp_value || value}
          onBlur={e => {
            commit(e.target.value);
            set_disp_value(null);
          }}
          onChange={e => set_disp_value(e.target.value)}
          onKeyDown={e => { if (e.key == "Enter") commit(e.target.value); }}
        />
        : <input type="text" value={value} onChange={onChange} />
      }
    </label>
  )
}