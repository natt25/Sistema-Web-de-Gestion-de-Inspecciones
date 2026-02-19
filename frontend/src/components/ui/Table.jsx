export default function Table({ columns, data, emptyText = "Sin registros.", renderActions }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {renderActions && <th>Accion</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length + (renderActions ? 1 : 0)} style={{ padding: 12, opacity: 0.7 }}>
                {emptyText}
              </td>
            </tr>
          )}
          {data.map((row) => (
            <tr key={row.__key || row.id || row.id_inspeccion || JSON.stringify(row)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
              {renderActions && <td className="table-row-actions">{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
