"use strict";
// Curso PRL · Técnico/a de actividades físicas y entrenamiento — API + panel de administración
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://curso-prl-tecnico-actividad-fisica.onrender.com").split(",").map(s => s.trim()).filter(Boolean);
if (!process.env.DATABASE_URL) console.warn("DATABASE_URL no definida");
if (ADMIN_PASSWORD.length < 4) console.warn("ADMIN_PASSWORD no definida o demasiado corta: panel deshabilitado");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
  max: 5
});

// Estructura del curso (debe coincidir con src/m1..m7.js)
const META = require("./course-meta.json"); // generado por src/build.py
const LESSONS = META.lessons;
const FINALN = 15, EXAMN = META.examN;
const KEYS = LESSONS.flatMap((n, m) => [...Array(n).keys()].map(i => `${m}-${i}`).concat(`${m}-final`)).concat("exam");
const KEYSET = new Set(KEYS);
const maxScore = k => { if (k === "exam") return EXAMN; const [m, p] = k.split("-"); return p === "final" ? META.finalN[+m] : META.lessonQ[+m][+p]; };
const needOf = k => Math.ceil(maxScore(k) * 0.7); // mismo umbral que el curso (70 %)

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS workers(
    dni varchar(9) PRIMARY KEY,
    name varchar(80) NOT NULL,
    company varchar(80) NOT NULL,
    email varchar(100) NOT NULL,
    pin_hash text NOT NULL,
    consent_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login timestamptz)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS progress(
    dni varchar(9) PRIMARY KEY REFERENCES workers(dni) ON DELETE CASCADE,
    data jsonb NOT NULL DEFAULT '{}',
    pct int NOT NULL DEFAULT 0,
    exam_ok int, exam_n int,
    passed boolean NOT NULL DEFAULT false,
    passed_at date,
    updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS workers_company ON workers(lower(company))`);
}

// ---------- validación ----------
const LET = "TRWAGMYFPDXBNJZSQVHLCKE";
const normDni = s => String(s || "").toUpperCase().replace(/[\s.-]/g, "");
function validDni(s) {
  const m = s.match(/^([XYZ]|\d)(\d{7})([A-Z])$/);
  if (!m) return false;
  const n = +(("XYZ".indexOf(m[1]) >= 0 ? "XYZ".indexOf(m[1]) : m[1]) + m[2]);
  return LET[n % 23] === m[3];
}
const clean = (s, max) => String(s ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().replace(/\s+/g, " ").slice(0, max);
const validMail = s => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 100;
const validPin = p => typeof p === "string" && p.length >= 4 && p.length <= 40;
const isDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Sanea el progreso recibido y lo fusiona con el guardado (nunca se pierde avance entre dispositivos)
function sanitize(d) {
  const o = { done: {}, scores: {}, exam: null, last: "home" };
  if (!d || typeof d !== "object") return o;
  if (d.scores && typeof d.scores === "object") for (const k of Object.keys(d.scores)) {
    const v = d.scores[k];
    if (KEYSET.has(k) && k !== "exam" && Number.isInteger(v) && v >= 0 && v <= maxScore(k)) o.scores[k] = v;
  }
  // una lección/test solo cuenta como aprobado si su nota alcanza el umbral
  if (d.done && typeof d.done === "object") for (const k of Object.keys(d.done)) if (KEYSET.has(k) && k !== "exam" && d.done[k] && (o.scores[k] ?? -1) >= needOf(k)) o.done[k] = 1;
  const e = d.exam;
  if (e && Number.isInteger(e.ok) && Number.isInteger(e.n) && e.n > 0 && e.n <= EXAMN && e.ok >= 0 && e.ok <= e.n) {
    o.exam = { ok: e.ok, n: e.n, pass: e.ok >= Math.ceil(e.n * 0.7), date: isDate(e.date) ? e.date : null };
    if (o.exam.pass && !o.exam.date) o.exam.date = new Date().toISOString().slice(0, 10);
  }
  if (!o.exam || !o.exam.pass) delete o.done.exam;
  if (typeof d.last === "string" && (d.last === "home" || ["exam", "account"].includes(d.last) || KEYSET.has(d.last))) o.last = d.last;
  return o;
}
function merge(a, b) { // a = servidor, b = cliente
  const o = { done: { ...a.done, ...b.done }, scores: { ...a.scores }, exam: a.exam, last: b.last || a.last };
  for (const k of Object.keys(b.scores)) o.scores[k] = Math.max(o.scores[k] ?? 0, b.scores[k]);
  const ea = a.exam, eb = b.exam;
  if (!ea) o.exam = eb;
  else if (eb) {
    const pass = ea.pass || eb.pass;
    const best = eb.ok > ea.ok ? eb : ea;
    const pdates = [ea, eb].filter(x => x.pass && x.date).map(x => x.date).sort();
    o.exam = { ok: best.ok, n: best.n, pass, date: pass ? (pdates[0] || best.date) : best.date };
  }
  if (o.exam && o.exam.pass) o.done.exam = 1;
  return o;
}
const DUMMY = bcrypt.hashSync("x-no-user-x", 10);
// Avance secuencial: descarta notas y aprobados de hitos cuyo anterior no está aprobado
function enforce(d) {
  const out = { done: {}, scores: {}, exam: null, last: d.last }, dropped = [];
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i], open = i === 0 || !!out.done[KEYS[i - 1]];
    if (k === "exam") {
      if (d.exam) { if (open) { out.exam = d.exam; if (d.exam.pass) out.done.exam = 1; } else dropped.push("exam"); }
      continue;
    }
    if (d.scores[k] != null || d.done[k]) {
      if (open) { if (d.scores[k] != null) out.scores[k] = d.scores[k]; if (d.done[k]) out.done[k] = 1; } else dropped.push(k);
    }
  }
  return { data: out, dropped };
}
const pctOf = d => Math.round(KEYS.filter(k => d.done[k]).length / KEYS.length * 100);

// ---------- tokens firmados (HMAC) ----------
const b64 = s => Buffer.from(s).toString("base64url");
function sign(payload, hours) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + hours * 3600e3 }));
  return body + "." + crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}
function verify(tok) {
  if (typeof tok !== "string" || !tok.includes(".")) return null;
  const [body, sig] = tok.split(".");
  const exp = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const bearer = req => (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
function needUser(req, res, next) { const p = verify(bearer(req)); if (!p || p.t !== "u") return res.status(401).json({ error: "Sesión caducada. Vuelve a acceder." }); req.dni = p.dni; next(); }
function needAdmin(req, res, next) { const p = verify(bearer(req)); if (!p || p.t !== "a") return res.status(401).json({ error: "No autorizado" }); next(); }

// ---------- app ----------
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") return res.redirect(301, "https://" + req.get("host") + req.originalUrl);
  res.set({ "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" });
  const o = req.get("origin");
  if (o && ORIGINS.includes(o)) res.set({ "Access-Control-Allow-Origin": o, "Vary": "Origin", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Max-Age": "600" });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use("/api", express.json({ limit: "64kb" }));
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Demasiados intentos. Espera 15 minutos." } });
const adminLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Demasiados intentos. Espera 15 minutos." } });
const registerLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Demasiadas altas desde esta conexión. Inténtalo más tarde." } });
const apiLimiter = rateLimit({ windowMs: 60e3, limit: 120, standardHeaders: "draft-7", legacyHeaders: false });
app.use("/api", apiLimiter);

const userOut = r => ({ name: r.name, dni: r.dni, company: r.company, email: r.email, created: r.created_at, consent: r.consent_at });
async function loadProgress(dni) {
  const r = await pool.query("SELECT data FROM progress WHERE dni=$1", [dni]);
  return enforce(sanitize(r.rows[0] ? r.rows[0].data : {})).data;
}
async function storeProgress(dni, data) {
  const e = data.exam;
  await pool.query(`INSERT INTO progress(dni,data,pct,exam_ok,exam_n,passed,passed_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())
    ON CONFLICT(dni) DO UPDATE SET data=$2,pct=$3,exam_ok=$4,exam_n=$5,passed=$6,passed_at=$7,updated_at=now()`,
    [dni, data, pctOf(data), e ? e.ok : null, e ? e.n : null, !!(e && e.pass), e && e.pass ? e.date : null]);
}
const wrap = fn => (req, res) => fn(req, res).catch(err => { console.error(err); res.status(500).json({ error: "Error del servidor. Inténtalo de nuevo." }); });

app.get("/api/health", wrap(async (req, res) => { await pool.query("SELECT 1"); res.json({ ok: true }); }));

app.post("/api/register", registerLimiter, wrap(async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 80), dni = normDni(b.dni), company = clean(b.company, 80), email = clean(b.email, 100).toLowerCase();
  const bad = [];
  if (name.length < 5 || !name.includes(" ")) bad.push("nombre y apellidos");
  if (!validDni(dni)) bad.push("DNI/NIE válido");
  if (company.length < 2) bad.push("empresa");
  if (!validMail(email)) bad.push("correo válido");
  if (!validPin(b.pin)) bad.push("PIN o contraseña (4 a 40 caracteres)");
  if (b.consent !== true) bad.push("aceptar la información de protección de datos");
  if (bad.length) return res.status(400).json({ error: "Revisa: " + bad.join(", ") + "." });
  const hash = await bcrypt.hash(b.pin, 10);
  const r = await pool.query(`INSERT INTO workers(dni,name,company,email,pin_hash,consent_at,last_login) VALUES($1,$2,$3,$4,$5,now(),now()) ON CONFLICT(dni) DO NOTHING RETURNING *`, [dni, name, company, email, hash]);
  if (!r.rows[0]) return res.status(409).json({ error: "Ya existe una persona dada de alta con este DNI/NIE. Usa «Acceder»." });
  const data = enforce(merge(sanitize({}), sanitize(b.progress))).data;
  await storeProgress(dni, data);
  res.status(201).json({ token: sign({ t: "u", dni }, 24 * 30), user: userOut(r.rows[0]), progress: data });
}));

app.post("/api/login", loginLimiter, wrap(async (req, res) => {
  const b = req.body || {}, dni = normDni(b.dni);
  if (!validDni(dni) || typeof b.pin !== "string" || b.pin.length > 40) return res.status(400).json({ error: "DNI/NIE o PIN incorrectos." });
  const r = await pool.query("SELECT * FROM workers WHERE dni=$1", [dni]);
  const ok = r.rows[0] ? await bcrypt.compare(b.pin, r.rows[0].pin_hash) : (await bcrypt.compare(b.pin, DUMMY), false);
  if (!ok) return res.status(401).json({ error: "DNI/NIE o PIN incorrectos." });
  await pool.query("UPDATE workers SET last_login=now() WHERE dni=$1", [dni]);
  res.json({ token: sign({ t: "u", dni }, 24 * 30), user: userOut(r.rows[0]), progress: await loadProgress(dni) });
}));

app.get("/api/me", needUser, wrap(async (req, res) => {
  const r = await pool.query("SELECT * FROM workers WHERE dni=$1", [req.dni]);
  if (!r.rows[0]) return res.status(401).json({ error: "Usuario no encontrado." });
  res.json({ user: userOut(r.rows[0]), progress: await loadProgress(req.dni) });
}));

app.put("/api/progress", needUser, wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query("SELECT data FROM progress WHERE dni=$1 FOR UPDATE", [req.dni]);
    const w = await client.query("SELECT 1 FROM workers WHERE dni=$1", [req.dni]);
    if (!w.rows[0]) { await client.query("ROLLBACK"); return res.status(401).json({ error: "Usuario no encontrado." }); }
    const prev = enforce(sanitize(r.rows[0] ? r.rows[0].data : {})).data;
    const { data, dropped } = enforce(merge(prev, sanitize(req.body && req.body.progress)));
    const e = data.exam;
    await client.query(`INSERT INTO progress(dni,data,pct,exam_ok,exam_n,passed,passed_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())
      ON CONFLICT(dni) DO UPDATE SET data=$2,pct=$3,exam_ok=$4,exam_n=$5,passed=$6,passed_at=$7,updated_at=now()`,
      [req.dni, data, pctOf(data), e ? e.ok : null, e ? e.n : null, !!(e && e.pass), e && e.pass ? e.date : null]);
    await client.query("COMMIT");
    if (dropped.length) return res.status(409).json({ error: "Avance no permitido: hay que aprobar antes lo anterior.", rejected: dropped, progress: data });
    res.json({ progress: data });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
}));

app.delete("/api/me", needUser, wrap(async (req, res) => {
  await pool.query("DELETE FROM workers WHERE dni=$1", [req.dni]);
  res.json({ ok: true });
}));

// ---------- administración ----------
app.post("/api/admin/login", adminLimiter, (req, res) => {
  const p = String((req.body || {}).password || "");
  if (ADMIN_PASSWORD.length < 4) return res.status(503).json({ error: "Panel no configurado." });
  const a = crypto.createHash("sha256").update(p).digest(), b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Contraseña incorrecta." });
  res.json({ token: sign({ t: "a" }, 8) });
});

const LIST_SQL = `SELECT w.dni,w.name,w.company,w.email,w.created_at,w.last_login,
  coalesce(p.pct,0) pct,p.data,p.exam_ok,p.exam_n,coalesce(p.passed,false) passed,to_char(p.passed_at,'YYYY-MM-DD') passed_at,p.updated_at
  FROM workers w LEFT JOIN progress p USING(dni)`;
function rowOut(r) {
  const d = sanitize(r.data || {});
  return { dni: r.dni, name: r.name, company: r.company, email: r.email, created: r.created_at, lastLogin: r.last_login, updated: r.updated_at,
    pct: r.pct, examOk: r.exam_ok, examN: r.exam_n, passed: r.passed, passedAt: r.passed_at,
    modules: LESSONS.map((n, m) => ({ done: [...Array(n).keys()].filter(i => d.done[`${m}-${i}`]).length + (d.done[`${m}-final`] ? 1 : 0), total: n + 1, final: d.scores[`${m}-final`] ?? null })),
    scores: d.scores };
}
app.get("/api/admin/workers", needAdmin, wrap(async (req, res) => {
  const r = await pool.query(LIST_SQL + " ORDER BY w.company, w.name");
  res.json({ workers: r.rows.map(rowOut), lessons: LESSONS, finalN: FINALN, examN: EXAMN });
}));
app.get("/api/admin/workers/:dni", needAdmin, wrap(async (req, res) => {
  const r = await pool.query(LIST_SQL + " WHERE w.dni=$1", [normDni(req.params.dni)]);
  if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json({ worker: rowOut(r.rows[0]) });
}));
// Trabajadores que han terminado el curso (examen final aprobado)
app.get("/api/admin/finalizados", needAdmin, wrap(async (req, res) => {
  const r = await pool.query(`SELECT w.dni,w.name,w.company,p.exam_ok,p.exam_n,to_char(p.passed_at,'YYYY-MM-DD') passed_at
    FROM workers w JOIN progress p USING(dni) WHERE p.passed ORDER BY p.passed_at, w.name`);
  res.json({ finalizados: r.rows.map(x => ({ id: x.dni, nombre: x.name, empresa: x.company, nota: `${x.exam_ok}/${x.exam_n}`,
    nota_pct: Math.round(x.exam_ok / x.exam_n * 100), fecha_finalizacion: x.passed_at })) });
}));
app.delete("/api/admin/workers/:dni", needAdmin, wrap(async (req, res) => {
  const r = await pool.query("DELETE FROM workers WHERE dni=$1", [normDni(req.params.dni)]);
  res.json({ deleted: r.rowCount });
}));
const csvCell = v => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
app.get("/api/admin/export.csv", needAdmin, wrap(async (req, res) => {
  const q = String(req.query.q || "").toLowerCase().slice(0, 80), emp = String(req.query.empresa || "").slice(0, 80);
  const r = await pool.query(LIST_SQL + " ORDER BY w.company, w.name");
  const rows = r.rows.map(rowOut).filter(w => (!emp || w.company === emp) && (!q || (w.name + " " + w.dni + " " + w.email + " " + w.company).toLowerCase().includes(q)));
  const f = d => d ? new Date(d).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "";
  const head = ["Nombre", "DNI/NIE", "Empresa", "Correo", "Alta", "Último acceso", "Progreso %", ...LESSONS.map((_, m) => `Test M${m + 1} (/${FINALN})`), "Examen final", "Resultado", "Fecha aprobado"];
  const lines = [head, ...rows.map(w => [w.name, w.dni, w.company, w.email, f(w.created), f(w.lastLogin), w.pct, ...w.modules.map(m => m.final ?? ""), w.examOk != null ? `${w.examOk}/${w.examN}` : "", w.passed ? "APTO" : "NO APTO", w.passedAt ? w.passedAt.split("-").reverse().join("/") : ""])];
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trabajadores-prl-taf-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send("\ufeff" + lines.map(l => l.map(csvCell).join(";")).join("\r\n"));
}));

// ---------- estáticos: solo el curso y el panel ----------
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/admin", (req, res) => res.redirect(301, "/admin/"));
app.get(["/admin/", "/admin/index.html"], (req, res) => res.sendFile(path.join(__dirname, "admin", "index.html")));
app.use((req, res) => res.status(404).json({ error: "No encontrado" }));

init().then(() => app.listen(PORT, () => console.log("Escuchando en " + PORT))).catch(e => { console.error("Error iniciando BD", e); process.exit(1); });
