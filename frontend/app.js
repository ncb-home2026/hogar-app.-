const API = "/api";
let token = localStorage.getItem("token");

function headers() {
  return { "Content-Type": "application/json", Authorization: "Bearer " + token };
}

async function api(path, options = {}) {
  const method = (options.method || (options.body ? "POST" : "GET")).toUpperCase();

  const res = await fetch(API + path, {
    ...options,
    method,
    headers: {
      ...headers(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    logout();
    throw new Error("Sesión vencida");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Error en la petición");
  }

  return res.json();
}

/* ---------- LOGIN / REGISTRO ---------- */

function mostrarRegistro() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("registro-form").style.display = "block";
}
function mostrarLogin() {
  document.getElementById("registro-form").style.display = "none";
  document.getElementById("login-form").style.display = "block";
}

async function login() {
  const usuario = document.getElementById("login-usuario").value;
  const password = document.getElementById("login-password").value;
  const res = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById("login-error").textContent = data.error;
    return;
  }
  token = data.token;
  localStorage.setItem("token", token);
  iniciarApp();
}

async function registrar() {
  const nombre = document.getElementById("reg-nombre").value;
  const usuario = document.getElementById("reg-usuario").value;
  const password = document.getElementById("reg-password").value;
  const res = await fetch(API + "/auth/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, usuario, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById("registro-error").textContent = data.error;
    return;
  }
  token = data.token;
  localStorage.setItem("token", token);
  iniciarApp();
}

function logout() {
  localStorage.removeItem("token");
  token = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
}

function iniciarApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  cargarResumen();
  cargarPersonas();
  cargarGastosFijos();
  const hoy = new Date().toISOString().slice(0, 7);
  document.getElementById("compras-mes").value = hoy;
  document.getElementById("a-mes").value = hoy;
  cargarCompras();
  cargarAhorro();
}

/* ---------- TABS ---------- */

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
    document.querySelectorAll(".tab-content").forEach((s) => (s.style.display = "none"));
    document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    if (btn.dataset.tab === "dashboard") cargarResumen();
  });
});

/* ---------- DASHBOARD ---------- */

async function cargarResumen() {
  const r = await api("/resumen");
  const cards = [
    ["Ingreso total", r.totalSalarios],
    ["Gastos fijos", r.totalGastosFijos],
    ["Ahorro sugerido (10%)", r.ahorroSugerido10],
    ["Saldo disponible", r.saldoDisponible],
    ["Acumulado vacaciones", r.acumuladoVacaciones],
  ];
  document.getElementById("resumen-cards").innerHTML = cards
    .map(
      ([titulo, valor]) =>
        `<div class="card"><span>${titulo}</span><strong>$${valor.toFixed(2)}</strong></div>`
    )
    .join("");
}

/* ---------- PERSONAS ---------- */

async function cargarPersonas() {
  const filas = await api("/personas");
  document.getElementById("tabla-personas").innerHTML = filas
    .map(
      (p) => `<tr>
        <td>${p.nombre}</td><td>$${p.salario}</td><td>${p.frecuencia}</td>
        <td><button onclick="borrarPersona(${p.id})">🗑</button></td>
      </tr>`
    )
    .join("");
}

async function agregarPersona() {
  const nombre = document.getElementById("p-nombre").value;
  const salario = parseFloat(document.getElementById("p-salario").value) || 0;
  const frecuencia = document.getElementById("p-frecuencia").value;
  if (!nombre) return;
  await api("/personas", { method: "POST", body: JSON.stringify({ nombre, salario, frecuencia }) });
  document.getElementById("p-nombre").value = "";
  document.getElementById("p-salario").value = "";
  cargarPersonas();
  cargarResumen();
}

async function borrarPersona(id) {
  await api("/personas/" + id, { method: "DELETE" });
  cargarPersonas();
  cargarResumen();
}

/* ---------- GASTOS FIJOS ---------- */

async function cargarGastosFijos() {
  const filas = await api("/gastos-fijos");
  document.getElementById("tabla-gastos").innerHTML = filas
    .map(
      (g) => `<tr>
        <td>${g.nombre}</td><td>${g.categoria}</td><td>$${g.monto}</td>
        <td>${g.dia_vencimiento || "-"}</td>
        <td>
          <select onchange="cambiarEstadoGasto(${g.id}, this.value)">
            <option value="pendiente" ${g.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="pagado" ${g.estado === "pagado" ? "selected" : ""}>Pagado</option>
          </select>
        </td>
        <td><button onclick="borrarGasto(${g.id})">🗑</button></td>
      </tr>`
    )
    .join("");
}

async function agregarGastoFijo() {
  const nombre = document.getElementById("g-nombre").value;
  const categoria = document.getElementById("g-categoria").value || "otro";
  const monto = parseFloat(document.getElementById("g-monto").value) || 0;
  const dia_vencimiento = parseInt(document.getElementById("g-dia").value) || null;
  if (!nombre) return;
  await api("/gastos-fijos", {
    method: "POST",
    body: JSON.stringify({ nombre, categoria, monto, dia_vencimiento, estado: "pendiente" }),
  });
  document.getElementById("g-nombre").value = "";
  document.getElementById("g-monto").value = "";
  document.getElementById("g-dia").value = "";
  cargarGastosFijos();
  cargarResumen();
}

async function cambiarEstadoGasto(id, estado) {
  const g = (await api("/gastos-fijos")).find((x) => x.id === id);
  await api("/gastos-fijos/" + id, {
    method: "PUT",
    body: JSON.stringify({ ...g, estado }),
  });
}

async function borrarGasto(id) {
  await api("/gastos-fijos/" + id, { method: "DELETE" });
  cargarGastosFijos();
  cargarResumen();
}

/* ---------- COMPRAS PLANIFICADAS ---------- */

async function cargarCompras() {
  const mes = document.getElementById("compras-mes").value;
  const filas = await api("/compras?mes=" + mes);
  document.getElementById("tabla-compras").innerHTML = filas
    .map(
      (c) => `<tr>
        <td>${c.nombre}</td><td>$${c.monto_estimado}</td><td>${c.prioridad}</td>
        <td><button onclick="borrarCompra(${c.id})">🗑</button></td>
      </tr>`
    )
    .join("");
}

async function agregarCompra() {
  const nombre = document.getElementById("c-nombre").value;
  const monto_estimado = parseFloat(document.getElementById("c-monto").value) || 0;
  const prioridad = document.getElementById("c-prioridad").value;
  const mes = document.getElementById("compras-mes").value;
  if (!nombre || !mes) return;
  await api("/compras", { method: "POST", body: JSON.stringify({ nombre, monto_estimado, prioridad, mes }) });
  document.getElementById("c-nombre").value = "";
  document.getElementById("c-monto").value = "";
  cargarCompras();
}

async function borrarCompra(id) {
  await api("/compras/" + id, { method: "DELETE" });
  cargarCompras();
}

/* ---------- LISTA DE LA FERIA (con checkboxes) ---------- */

async function cargarFeria() {
  const semana = document.getElementById("feria-semana").value;
  const filas = await api("/lista-semanal?semana=" + semana);
  document.getElementById("lista-feria").innerHTML = filas
    .map(
      (f) => `<li class="${f.comprado ? "comprado" : ""}">
        <label>
          <input type="checkbox" ${f.comprado ? "checked" : ""} onchange="marcarFeria(${f.id}, this.checked)" />
          ${f.producto} — est. $${f.precio_estimado}
        </label>
        <button onclick="borrarFeria(${f.id})">🗑</button>
      </li>`
    )
    .join("");

  const totalEstimado = filas.reduce((s, f) => s + f.precio_estimado, 0);
  const comprados = filas.filter((f) => f.comprado).length;
  document.getElementById("feria-totales").textContent =
    `Total estimado: $${totalEstimado.toFixed(2)} — Comprados: ${comprados}/${filas.length}`;
}

async function agregarFeria() {
  const semana = document.getElementById("feria-semana").value;
  const producto = document.getElementById("f-producto").value;
  const precio_estimado = parseFloat(document.getElementById("f-monto").value) || 0;
  if (!producto || !semana) return;
  await api("/lista-semanal", { method: "POST", body: JSON.stringify({ semana, producto, precio_estimado }) });
  document.getElementById("f-producto").value = "";
  document.getElementById("f-monto").value = "";
  cargarFeria();
}

async function marcarFeria(id, comprado) {
  await api(`/lista-semanal/${id}/marcar`, { method: "PUT", body: JSON.stringify({ comprado }) });
  cargarFeria();
}

async function borrarFeria(id) {
  await api("/lista-semanal/" + id, { method: "DELETE" });
  cargarFeria();
}

/* ---------- AHORRO VACACIONES ---------- */

async function cargarAhorro() {
  const r = await api("/ahorro");
  document.getElementById("ahorro-resumen").innerHTML = `
    <div class="card"><span>Acumulado</span><strong>$${r.acumulado.toFixed(2)}</strong></div>
    <div class="card"><span>Meta</span><strong>$${r.meta.toFixed(2)}</strong></div>
    <div class="card"><span>Progreso</span><strong>${
      r.meta > 0 ? ((r.acumulado / r.meta) * 100).toFixed(1) : 0
    }%</strong></div>
  `;
  document.getElementById("a-meta").value = r.meta || "";
  document.getElementById("tabla-ahorro").innerHTML = r.aportes
    .map((a) => `<tr><td>${a.mes}</td><td>$${a.monto}</td><td>${a.nota || "-"}</td></tr>`)
    .join("");
}

async function agregarAporte() {
  const mes = document.getElementById("a-mes").value;
  const monto = parseFloat(document.getElementById("a-monto").value) || 0;
  const nota = document.getElementById("a-nota").value;
  if (!mes) return;
  await api("/ahorro/aporte", { method: "POST", body: JSON.stringify({ mes, monto, nota }) });
  document.getElementById("a-monto").value = "";
  document.getElementById("a-nota").value = "";
  cargarAhorro();
  cargarResumen();
}

async function guardarMeta() {
  const meta = parseFloat(document.getElementById("a-meta").value) || 0;
  await api("/ahorro/meta", { method: "PUT", body: JSON.stringify({ meta }) });
  cargarAhorro();
}

/* ---------- INICIO ---------- */

if (token) iniciarApp();
