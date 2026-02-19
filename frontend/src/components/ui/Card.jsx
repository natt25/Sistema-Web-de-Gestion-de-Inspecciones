export default function Card({ title, children, className = "", actions }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          {title && <div className="card-title">{title}</div>}
          {actions}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
