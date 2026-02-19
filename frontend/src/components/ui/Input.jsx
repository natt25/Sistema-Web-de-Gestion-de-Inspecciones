export default function Input({ label, error, className = "", ...props }) {
  return (
    <label className="input-row">
      {label && <span className="label">{label}</span>}
      <input className={`input ${className}`} {...props} />
      {error && <span className="help error">{error}</span>}
    </label>
  );
}
