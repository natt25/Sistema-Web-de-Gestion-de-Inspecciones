export default function Button({ variant = "primary", className = "", ...props }) {
  const map = {
    primary: "btn-primary",
    outline: "btn-outline",
    ghost: "btn-ghost",
  };

  return <button className={`btn ${map[variant] || ""} ${className}`} {...props} />;
}
