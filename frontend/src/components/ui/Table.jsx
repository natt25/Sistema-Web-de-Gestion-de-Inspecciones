export default function Table({
  columns,
  data,
  emptyText = "Sin registros.",
  renderActions,
  tableClassName = "",
  actionsHeaderStyle,
  actionsCellStyle,
}) {
  return (
    <div className="table-wrap">
      <table className={`table ${tableClassName}`.trim()}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.headerStyle}>
                {c.label}
              </th>
            ))}
            {renderActions && <th style={actionsHeaderStyle}>AcciÃ³n</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (renderActions ? 1 : 0)}>{emptyText}</td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row?.id ?? row?.id_inspeccion ?? row?.id_accion ?? idx}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      verticalAlign: "middle",
                      paddingTop: 14,
                      paddingBottom: 14,
                      ...c.cellStyle,
                    }}
                  >
                    {c.render ? c.render(row) : row?.[c.key] ?? "-"}
                  </td>
                ))}

                {renderActions && (
                  <td
                    className="table-row-actions"
                    style={{
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                      textAlign: "left",
                      paddingTop: 14,
                      paddingBottom: 14,
                      ...actionsCellStyle,
                    }}
                  >
                    {renderActions(row)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
