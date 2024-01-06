export const AutoSizedInput = ({ value, onChange, className }) => {
  return (
    <label className={`auto-sized-input ${className || ""}`}>
      <span>{value}</span>
      <input type="text" value={value} onChange={onChange} />
    </label>
  )
}