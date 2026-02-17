import { useParams, Link } from "react-router-dom";

export default function InspeccionDetail() {
  const { id } = useParams();

  return (
    <div style={{ padding: 16 }}>
      <h2>Detalle Inspección #{id}</h2>
      <p>(Parte 3: aquí consumimos GET /api/inspecciones/:id/full)</p>

      <Link to="/inspecciones">← Volver</Link>
    </div>
  );
}
