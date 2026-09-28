const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "data", "hogar.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  usuario TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  salario REAL NOT NULL DEFAULT 0,
  frecuencia TEXT NOT NULL DEFAULT 'mensual'
);

CREATE TABLE IF NOT EXISTS gastos_fijos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otro',
  monto REAL NOT NULL DEFAULT 0,
  dia_vencimiento INTEGER,
  estado TEXT NOT NULL DEFAULT 'pendiente'
);

CREATE TABLE IF NOT EXISTS compras_planificadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  monto_estimado REAL NOT NULL DEFAULT 0,
  prioridad TEXT NOT NULL DEFAULT 'media',
  mes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lista_semanal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semana TEXT NOT NULL,
  producto TEXT NOT NULL,
  precio_estimado REAL NOT NULL DEFAULT 0,
  precio_real REAL,
  comprado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ahorro_aportes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mes TEXT NOT NULL,
  monto REAL NOT NULL DEFAULT 0,
  nota TEXT
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);
`);

// Meta de ahorro por defecto (0 = sin meta definida)
const metaExiste = db.prepare("SELECT 1 FROM config WHERE clave = 'meta_vacaciones'").get();
if (!metaExiste) {
  db.prepare("INSERT INTO config (clave, valor) VALUES ('meta_vacaciones', '0')").run();
}

module.exports = db;
