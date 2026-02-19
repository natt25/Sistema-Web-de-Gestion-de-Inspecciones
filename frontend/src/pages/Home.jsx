import { useMemo } from "react";
import { clearToken } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function Home() {
  const cards = useMemo(
    () => [
      { title: "Pendientes", value: "12" },
      { title: "En Proceso", value: "5" },
      { title: "Cerradas", value: "38" },
    ],
    []
  );

  const actions = (
    <Button
      variant="outline"
      onClick={() => {
        clearToken();
        window.location.href = "/login";
      }}
    >
      Cerrar sesiÃ³n
    </Button>
  );

  return (
    <DashboardLayout title="Dashboard" actions={actions}>
      <div className="grid-cards">
        {cards.map((c) => (
          <Card key={c.title} title={c.title}>
            <div className="card-body">{c.value}</div>
          </Card>
        ))}
      </div>

      <Card title="Actividad reciente">
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          Ultimas inspecciones y cambios se mostraran aqui.
        </div>
      </Card>
    </DashboardLayout>
  );
}
