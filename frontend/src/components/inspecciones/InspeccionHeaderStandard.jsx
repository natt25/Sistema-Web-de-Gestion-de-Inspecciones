import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Autocomplete from "../ui/Autocomplete";
import Input from "../ui/Input";
import {
  buscarAreas,
  buscarCargos,
  buscarClientes,
  buscarEmpleados,
  buscarLugares,
  buscarServicios,
  crearArea,
  crearLugar,
} from "../../api/busquedas.api";

export default function InspeccionHeaderStandard({ value, onChange, user }) {
  // value: { empleado, cargo, firma_ruta, cliente, servicio, area, lugar, fecha_inspeccion }

  // --- estados de texto escrito (lo que el usuario teclea)
  const [qEmp, setQEmp] = useState("");
  const [qCargo, setQCargo] = useState("");
  const [qCli, setQCli] = useState("");
  const [qSrv, setQSrv] = useState("");
  const [qArea, setQArea] = useState("");
  const [qLugar, setQLugar] = useState("");

  // --- resultados
  const [optEmp, setOptEmp] = useState([]);
  const [optCargo, setOptCargo] = useState([]);
  const [optCli, setOptCli] = useState([]);
  const [optSrv, setOptSrv] = useState([]);
  const [optArea, setOptArea] = useState([]);
  const [optLugar, setOptLugar] = useState([]);

  const [loading, setLoading] = useState({
    emp: false, cargo: false, cli: false, srv: false, area: false, lugar: false
  });

  const setField = (k, v) => onChange({ ...value, [k]: v });

  // Autollenar inspector principal desde usuario logueado
  useEffect(() => {
    if (!user) return;
    if (!value.empleado) {
      // user debería tener dni + nombre + cargo + firma_ruta guardado en auth.storage
      setField("empleado", { dni: user.dni, nombre: user.nombre });
      setQEmp(user.nombre || user.dni || "");
    }
    if (!value.cargo && user.cargo) {
      setField("cargo", { id_cargo: user.id_cargo, nombre_cargo: user.cargo });
      setQCargo(user.cargo);
    }
    if (!value.firma_ruta && user.firma_ruta) {
      setField("firma_ruta", user.firma_ruta);
    }
    if (!value.fecha_inspeccion) {
      setField("fecha_inspeccion", new Date().toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // helpers búsqueda con debounce simple
  const debounce = (fn, ms=250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const doSearchEmp = debounce(async (q) => {
    if (!q || q.trim().length < 2) return setOptEmp([]);
    setLoading(p => ({...p, emp:true}));
    try { setOptEmp(await buscarEmpleados(q.trim())); }
    finally { setLoading(p => ({...p, emp:false})); }
  });

  const doSearchCargo = debounce(async (q) => {
    if (!q || q.trim().length < 2) return setOptCargo([]);
    setLoading(p => ({...p, cargo:true}));
    try { setOptCargo(await buscarCargos(q.trim())); }
    finally { setLoading(p => ({...p, cargo:false})); }
  });

  const doSearchCli = debounce(async (q) => {
    if (!q || q.trim().length < 2) return setOptCli([]);
    setLoading(p => ({...p, cli:true}));
    try { setOptCli(await buscarClientes(q.trim())); }
    finally { setLoading(p => ({...p, cli:false})); }
  });

  const doSearchSrv = debounce(async (q) => {
    if (!q || q.trim().length < 2) return setOptSrv([]);
    setLoading(p => ({...p, srv:true}));
    try { setOptSrv(await buscarServicios(q.trim())); }
    finally { setLoading(p => ({...p, srv:false})); }
  });

  const doSearchArea = debounce(async (q) => {
    if (!q || q.trim().length < 2) return setOptArea([]);
    setLoading(p => ({...p, area:true}));
    try { setOptArea(await buscarAreas(q.trim())); }
    finally { setLoading(p => ({...p, area:false})); }
  });

  const doSearchLugar = debounce(async (q) => {
    if (!q || q.trim().length < 2) return setOptLugar([]);
    setLoading(p => ({...p, lugar:true}));
    try { setOptLugar(await buscarLugares({ q: q.trim(), id_area: value.area?.id_area })); }
    finally { setLoading(p => ({...p, lugar:false})); }
  });

  return (
    <Card title="Datos generales">
      <div className="ins-grid">
        <Autocomplete
          label="Realizado por"
          required
          placeholder="Escribe DNI o apellido..."
          displayValue={qEmp}
          onInputChange={(t) => { setQEmp(t); doSearchEmp(t); }}
          options={optEmp}
          loading={loading.emp}
          getOptionLabel={(e) => `${e.apellido_paterno ?? ""} ${e.apellido_materno ?? ""} ${e.nombres ?? ""}`.trim() || e.dni}
          onSelect={(e) => {
            setField("empleado", e);
            setQEmp(`${e.apellido_paterno ?? ""} ${e.apellido_materno ?? ""} ${e.nombres ?? ""}`.trim());
            // si tu backend te devuelve id_cargo del empleado, aquí podrías setear cargo directo
          }}
        />

        <Autocomplete
          label="Cargo"
          required
          placeholder="Escribe cargo..."
          displayValue={qCargo}
          onInputChange={(t) => { setQCargo(t); doSearchCargo(t); }}
          options={optCargo}
          loading={loading.cargo}
          getOptionLabel={(c) => c.nombre_cargo || c.nombre || `${c.id_cargo}`}
          onSelect={(c) => {
            setField("cargo", c);
            setQCargo(c.nombre_cargo || c.nombre || "");
          }}
        />

        <div className="ins-field">
          <span>Firma (del perfil)</span>
          <Input
            value={value.firma_ruta || ""}
            onChange={(e) => setField("firma_ruta", e.target.value)}
            placeholder="Se autocompleta (ruta de firma)"
            disabled
          />
          <div className="help">Se toma de la firma subida en el perfil del usuario.</div>
        </div>
      </div>

      <div className="ins-grid" style={{ marginTop: 12 }}>
        <Autocomplete
          label="Cliente / Unidad Minera"
          required
          placeholder="Escribe razón social..."
          displayValue={qCli}
          onInputChange={(t) => { setQCli(t); doSearchCli(t); }}
          options={optCli}
          getOptionLabel={(c) => c.raz_social || c.nombre || c.id_cliente}
          onSelect={(c) => {
            setField("cliente", c);
            setQCli(c.raz_social || "");
          }}
          onFocus={() => setTCliente(true)}
          loading={loadingCliente}
        />

        <Autocomplete
          label="Servicio"
          required
          placeholder="Escribe servicio..."
          displayValue={qSrv}
          onInputChange={(t) => { setQSrv(t); doSearchSrv(t); }}
          options={optSrv}
          getOptionLabel={(s) => s.nombre_servicio || s.nombre || `${s.id_servicio}`}
          onSelect={(s) => {
            setField("servicio", s);
            setQSrv(s.nombre_servicio || s.nombre || "");
          }}
          onFocus={() => setTServicio(true)}
          loading={loadingServicio}
        />

        <div className="ins-field">
          <span>Fecha de inspección *</span>
          <input
            type="date"
            className="ins-input"
            value={value.fecha_inspeccion || ""}
            onChange={(e) => setField("fecha_inspeccion", e.target.value)}
          />
        </div>
      </div>

      <div className="ins-grid" style={{ marginTop: 12 }}>
        <Autocomplete
          label="Área"
          required
          placeholder="Escribe área..."
          displayValue={qArea}
          onInputChange={(t) => { setQArea(t); doSearchArea(t); }}
          options={optArea}
          allowCustom
          onCreateCustom={async (text) => {
            const created = await crearArea(text);
            setField("area", created);
            setQArea(created.desc_area || text);
          }}
          getOptionLabel={(a) => a.desc_area || a.nombre || `${a.id_area}`}
          onSelect={(a) => {
            setField("area", a);
            setQArea(a.desc_area || "");
            // al cambiar área, resetea lugar
            setField("lugar", null);
            setQLugar("");
          }}
          onFocus={() => setTArea(true)}
          loading={loadingArea}
        />

        <Autocomplete
          label="Lugar"
          required
          placeholder={!value.area ? "Primero selecciona área" : "Escribe lugar..."}
          displayValue={qLugar}
          onInputChange={(t) => { setQLugar(t); if (value.area) doSearchLugar(t); }}
          options={optLugar}
          allowCustom={!!value.area}
          onCreateCustom={async (text) => {
            if (!value.area?.id_area) return;
            const created = await crearLugar({ id_area: value.area.id_area, desc_lugar: text });
            setField("lugar", created);
            setQLugar(created.desc_lugar || text);
          }}
          getOptionLabel={(l) => l.desc_lugar || l.nombre || `${l.id_lugar}`}
          onSelect={(l) => {
            setField("lugar", l);
            setQLugar(l.desc_lugar || "");
          }}
          hint={!value.area ? "Selecciona un área para buscar/crear lugares." : ""}
          onFocus={() => setTLugar(true)}
          loading={loadingLugar}
        />
      </div>
    </Card>
  );
}