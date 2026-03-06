const VARIANT_CLASS = {
  gray: "badge badge-gray",
  yellow: "badge badge-yellow",
  blue: "badge badge-blue",
  green: "badge badge-green",
  red: "badge badge-red",
  outline: "badge badge-outline",

  "status-draft": "badge badge-status-draft",
  "status-pending": "badge badge-status-pending",
  "status-progress": "badge badge-status-progress",
  "status-expired": "badge badge-status-expired",
  "status-closed": "badge badge-status-closed",

  "meta-primary": "badge badge-meta-primary",
};

export default function Badge({ children, variant, className = "" }) {
  const variantClass = variant ? VARIANT_CLASS[variant] || "" : "";
  const classes = ["badge", variantClass, className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}
