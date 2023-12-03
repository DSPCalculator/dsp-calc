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