import React from 'react';
import { useRef, useState } from 'react';
const input_style = {
  padding: 0,
  margin: 0,
  border: "1px solid black",
  borderRadius: '5px',
  /* added styles */
  fontFamily: 'inherit',
  fontSize: 'inherit',
  position: 'absolute',
  verticalAlign: 'top',
  top: 0,
  left: 0,
  width: '100%',
  background: 'white',
  paddingLeft: '4px',
  paddingRight: '4px',
}

const label_style = {
  display: 'inline-block',
  position: 'relative',
  minWidth: '1em',
  minHeight: '1.4em',
}

const template_style = {
  /* max-width : could be wised to set a maximum width and overflow:hidden; */
  whiteSpace: 'pre',
  paddingLeft: '6px',
  paddingRight: '6px',
}

const DelayedInput_style = {
  ...input_style,
  position: 'relative',
  width: '80%',
  minWidth: '80px',
  margin: 5,
}

export const DelayedInput = ({ value, onChange }) => {
  const [displayedValue, setDisplayedValue] = useState(null);
  return (
    <input style={DelayedInput_style}
      type="text"
      value={displayedValue || value}
      onBlur={e => {
        const num = Number(e.target.value);
        if (!isNaN(num)) {
          onChange(num);
          setDisplayedValue(null);
        }
        else (setDisplayedValue(value))
      }}
      onChange={e => setDisplayedValue(e.target.value)}
      onKeyDown={e => { if (e.key == "Enter") onChange(e.target.value); }}
    />
  );
}
export const AutoSizedInput = ({ value, onChange }) => {
  return (
    <label style={label_style}>
      <span style={template_style}>{value}</span>
      <input style={input_style}
        type="text"
        value={value}
        onChange={onChange}
      />
    </label>
  )
}