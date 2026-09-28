const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const db = require("./db");
const { firmarToken, requiereAuth } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

/* ---------- AUTENTICACIÓN ---------- */

// Registrar un usuario nuevo (solo se usa la primera vez, o para agregar personas de la casa)
app.post("/api/auth/registro", (req, res) => {
  const { nombre, usuario, password } = req.body;
  if (!nombre || !usuario || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  const existe = db.prepare("SELECT 1 FROM usuarios WHERE usuario = ?").get(usuario);
  if (existe) return res.status(409).json({ error: "Ese usuario ya existe" });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO usuarios (nombre, usuario, password_hash) VALUES (?, ?, ?)")
    .run(nombre, usuario, hash);

  const nuevo = { id: info.lastInsertRowid, usuario };
  res.json({ token: firmarToken(nuevo), nombre });
});

app.post("/api/auth/login", (req, res) => {
  const { usuario, password } = req.body;
  const fila = db.prepare("SELECT * FROM usuarios WHERE usuario = ?").get(usuario);
  if (!fila || !bcrypt.compareSync(password, fila.password_hash)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  res.json({ token: firmarToken(fila), nombre: fila.nombre });
});

// Todo lo que sigue requiere sesión iniciada
app.use("/api", requiereAuth);

/* ---------- PERSONAS / SALARIOS ---------- */

app.get("/api/personas", (req, res) => {
  res.json(db.prepare("SELECT * FROM personas ORDER BY id").all());
});

app.post("/api/personas", (req, res) => {
  const { nombre, salario, frecuencia } = req.body;
  const info = db
    .prepare("INSERT INTO personas (nombre, salario, frecuencia) VALUES (?, ?, ?)")
    .run(nombre, salario || 0, frecuencia || "mensual");
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/personas/:id", (req, res) => {
  const { nombre, salario, frecuencia } = req.body;
  db.prepare("UPDATE personas SET nombre=?, salario=?, frecuencia=? WHERE id=?").run(
    nombre,
    salario,
    frecuencia,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/personas/:id", (req, res) => {
  db.prepare("DELETE FROM personas WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------- GASTOS FIJOS ---------- */

app.get("/api/gastos-fijos", (req, res) => {
  res.json(db.prepare("SELECT * FROM gastos_fijos ORDER BY dia_vencimiento").all());
});

app.post("/api/gastos-fijos", (req, res) => {
  const { nombre, categoria, monto, dia_vencimiento, estado } = req.body;
  const info = db
    .prepare(
      "INSERT INTO gastos_fijos (nombre, categoria, monto, dia_vencimiento, estado) VALUES (?, ?, ?, ?, ?)"
    )
    .run(nombre, categoria || "otro", monto || 0, dia_vencimiento || null, estado || "pendiente");
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/gastos-fijos/:id", (req, res) => {
  const { nombre, categoria, monto, dia_vencimiento, estado } = req.body;
  db.prepare(
    "UPDATE gastos_fijos SET nombre=?, categoria=?, monto=?, dia_vencimiento=?, estado=? WHERE id=?"
  ).run(nombre, categoria, monto, dia_vencimiento, estado, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/gastos-fijos/:id", (req, res) => {
  db.prepare("DELETE FROM gastos_fijos WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------- COMPRAS PLANIFICADAS DEL MES ---------- */

app.get("/api/compras", (req, res) => {
  const { mes } = req.query;
  const filas = mes
    ? db.prepare("SELECT * FROM compras_planificadas WHERE mes = ? ORDER BY id").all(mes)
    : db.prepare("SELECT * FROM compras_planificadas ORDER BY mes DESC, id").all();
  res.json(filas);
});

app.post("/api/compras", (req, res) => {
  const { nombre, monto_estimado, prioridad, mes } = req.body;
  const info = db
    .prepare(
      "INSERT INTO compras_planificadas (nombre, monto_estimado, prioridad, mes) VALUES (?, ?, ?, ?)"
    )
    .run(nombre, monto_estimado || 0, prioridad || "media", mes);
  res.json({ id: info.lastInsertRowid });
});

app.delete("/api/compras/:id", (req, res) => {
  db.prepare("DELETE FROM compras_planificadas WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------- LISTA SEMANAL (FERIA) ---------- */

app.get("/api/lista-semanal", (req, res) => {
  const { semana } = req.query;
  const filas = semana
    ? db.prepare("SELECT * FROM lista_semanal WHERE semana = ? ORDER BY id").all(semana)
    : db.prepare("SELECT * FROM lista_semanal ORDER BY semana DESC, id").all();
  res.json(filas);
});

app.post("/api/lista-semanal", (req, res) => {
  const { semana, producto, precio_estimado } = req.body;
  const info = db
    .prepare(
      "INSERT INTO lista_semanal (semana, producto, precio_estimado) VALUES (?, ?, ?)"
    )
    .run(semana, producto, precio_estimado || 0);
  res.json({ id: info.lastInsertRowid });
});

// Marcar / desmarcar producto comprado (el checkbox), y opcionalmente cargar el precio real
app.put("/api/lista-semanal/:id/marcar", (req, res) => {
  const { comprado, precio_real } = req.body;
  db.prepare("UPDATE lista_semanal SET comprado=?, precio_real=? WHERE id=?").run(
    comprado ? 1 : 0,
    precio_real ?? null,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/lista-semanal/:id", (req, res) => {
  db.prepare("DELETE FROM lista_semanal WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------- AHORRO PARA VACACIONES ---------- */

app.get("/api/ahorro", (req, res) => {
  const aportes = db.prepare("SELECT * FROM ahorro_aportes ORDER BY mes DESC, id DESC").all();
  const acumulado = aportes.reduce((s, a) => s + a.monto, 0);
  const meta = db.prepare("SELECT valor FROM config WHERE clave='meta_vacaciones'").get();
  res.json({ aportes, acumulado, meta: Number(meta?.valor || 0) });
});

// Registrar el aporte del 10% de un mes (manual, tras revisar los salarios cargados)
app.post("/api/ahorro/aporte", (req, res) => {
  const { mes, monto, nota } = req.body;
  const info = db
    .prepare("INSERT INTO ahorro_aportes (mes, monto, nota) VALUES (?, ?, ?)")
    .run(mes, monto || 0, nota || null);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/ahorro/meta", (req, res) => {
  const { meta } = req.body;
  db.prepare("UPDATE config SET valor=? WHERE clave='meta_vacaciones'").run(String(meta || 0));
  res.json({ ok: true });
});

/* ---------- RESUMEN / DASHBOARD ---------- */

app.get("/api/resumen", (req, res) => {
  const personas = db.prepare("SELECT * FROM personas").all();
  const gastosFijos = db.prepare("SELECT * FROM gastos_fijos").all();
  const totalSalarios = personas.reduce((s, p) => s + p.salario, 0);
  const totalGastosFijos = gastosFijos.reduce((s, g) => s + g.monto, 0);
  const ahorroSugerido10 = totalSalarios * 0.1;
  const saldoDisponible = totalSalarios - totalGastosFijos - ahorroSugerido10;

  const aportes = db.prepare("SELECT * FROM ahorro_aportes").all();
  const acumuladoVacaciones = aportes.reduce((s, a) => s + a.monto, 0);

  res.json({
    totalSalarios,
    totalGastosFijos,
    ahorroSugerido10,
    saldoDisponible,
    acumuladoVacaciones,
    cantidadPersonas: personas.length,
    cantidadGastosFijos: gastosFijos.length,
  });
});

app.listen(PORT, () => {
  console.log(`API corriendo en el puerto ${PORT}`);
});
