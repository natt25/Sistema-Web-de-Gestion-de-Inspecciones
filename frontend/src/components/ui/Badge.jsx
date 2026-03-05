const VARIANT_CLASS = {
  gray: "badge-gray",
  yellow: "badge-yellow",
  blue: "badge-blue",
  green: "badge-green",
  red: "badge-red",
  success: "badge-green",
  danger: "badge-red",
  outline: "badge-outline",
};

export default function Badge({ children, variant, className = "" }) {
  const variantClass = variant ? VARIANT_CLASS[variant] || "" : "";
  const classes = ["badge", variantClass, className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}
