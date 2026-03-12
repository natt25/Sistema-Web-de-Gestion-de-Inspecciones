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
          {data.map((row, idx) => (
            <tr key={row?.id ?? row?.id_inspeccion ?? row?.id_accion ?? idx}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    verticalAlign: "top",
                    paddingTop: 14,
                    paddingBottom: 14,
                  }}
                >
                  {c.render ? c.render(row) : row?.[c.key] ?? "-"}
                </td>
              ))}

              {renderActions && (
                <td
                  className="table-row-actions"
                  style={{
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    paddingTop: 14,
                    paddingBottom: 14,
                  }}
                >
                  {renderActions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
