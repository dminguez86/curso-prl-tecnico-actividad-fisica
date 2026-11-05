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
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://curso-prl-tecnico-actividad-fisica.onrender.com,https://curso-prl-oficina-housfy.onrender.com,https://curso-prl-higienista-bucodental.onrender.com").split(",").map(s => s.trim()).filter(Boolean);
if (!process.env.DATABASE_URL) console.warn("DATABASE_URL no definida");
if (ADMIN_PASSWORD.length < 4) console.warn("ADMIN_PASSWORD no definida o demasiado corta: panel deshabilitado");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
  max: 5
});

// ---------- cursos (multi-curso) ----------
// Cada curso tiene su estructura (generada por src/build.py de cada curso). «taf» es el curso por defecto
// (compatibilidad con la web y los tokens anteriores, que no indican curso).
const FINALN = 15;
function mkCourse(id, name, code, meta, origin) {
  const LESSONS = meta.lessons, EXAMN = meta.examN;
  const KEYS = LESSONS.flatMap((n, m) => [...Array(n).keys()].map(i => `${m}-${i}`).concat(`${m}-final`)).concat("exam");
  const maxScore = k => { if (k === "exam") return EXAMN; const [m, p] = k.split("-"); return p === "final" ? meta.finalN[+m] : meta.lessonQ[+m][+p]; };
  return { id, name, code, meta, origin, LESSONS, EXAMN, KEYS, KEYSET: new Set(KEYS), maxScore, needOf: k => Math.ceil(maxScore(k) * 0.7) };
}
const COURSES = {
  taf: mkCourse("taf", "Técnico/a de actividades físicas y entrenamiento", "PRL-TAF-ART19", require("./course-meta.json"), "https://curso-prl-tecnico-actividad-fisica.onrender.com"),
  ofi: mkCourse("ofi", "Personal de oficinas – Grupo Housfy", "PRL-OFI-HOUSFY", require("./courses/ofi-meta.json"), "https://curso-prl-oficina-housfy.onrender.com"),
  hbd: mkCourse("hbd", "Higienista bucodental", "PRL-HBD", require("./courses/hbd-meta.json"), "https://curso-prl-higienista-bucodental.onrender.com")
};
// Las webs de cada curso siempre son orígenes permitidos (además de ALLOWED_ORIGINS)
for (const c of Object.values(COURSES)) if (c.origin && !ORIGINS.includes(c.origin)) ORIGINS.push(c.origin);
const DEFAULT_COURSE = "taf";
const courseId = v => (typeof v === "string" && Object.prototype.hasOwnProperty.call(COURSES, v)) ? v : null;
// Curso de la petición: cabecera X-Course, ?course= o body.course; si no, el curso de la web de origen; si no, «taf».
function reqCourse(req) {
  const o = req.get("origin");
  const byOrigin = o ? Object.values(COURSES).find(c => c.origin === o) : null;
  return courseId(req.get("x-course")) || courseId(req.query && req.query.course) || courseId(req.body && req.body.course) || (byOrigin && byOrigin.id) || DEFAULT_COURSE;
}

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
  await pool.query(`ALTER TABLE progress ADD COLUMN IF NOT EXISTS time_sec int NOT NULL DEFAULT 0`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions(
    id bigserial PRIMARY KEY,
    dni varchar(9) NOT NULL REFERENCES workers(dni) ON DELETE CASCADE,
    at timestamptz NOT NULL DEFAULT now(),
    kind varchar(12) NOT NULL,
    ip text, user_agent text)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sessions_dni_at ON sessions(dni, at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS workers_company ON workers(lower(company))`);
  await migrateMultiCourse();
}
// Migración multi-curso (idempotente, en una transacción): añade la columna «course» (por defecto 'taf', así
// todos los datos existentes quedan en el curso de actividad física sin cambiar ningún valor) y pasa las claves
// a (course, dni) para que una misma persona pueda estar en varios cursos.
async function migrateMultiCourse() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("LOCK TABLE workers, progress, sessions IN ACCESS EXCLUSIVE MODE");
    for (const t of ["workers", "progress", "sessions"]) await c.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS course varchar(16) NOT NULL DEFAULT 'taf'`);
    const pk = await c.query(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='workers'::regclass AND contype='p'`);
    if (!pk.rows[0] || pk.rows[0].d !== "PRIMARY KEY (course, dni)") {
      const fks = await c.query(`SELECT conrelid::regclass::text t, conname FROM pg_constraint WHERE contype='f' AND confrelid='workers'::regclass`);
      for (const f of fks.rows) await c.query(`ALTER TABLE ${f.t} DROP CONSTRAINT "${f.conname}"`);
      for (const t of ["progress", "workers"]) {
        const p = await c.query(`SELECT conname FROM pg_constraint WHERE conrelid=$1::regclass AND contype='p'`, [t]);
        if (p.rows[0]) await c.query(`ALTER TABLE ${t} DROP CONSTRAINT "${p.rows[0].conname}"`);
      }
      await c.query("ALTER TABLE workers ADD PRIMARY KEY (course, dni)");
      await c.query("ALTER TABLE progress ADD PRIMARY KEY (course, dni)");
      await c.query("ALTER TABLE progress ADD CONSTRAINT progress_worker_fk FOREIGN KEY (course, dni) REFERENCES workers(course, dni) ON DELETE CASCADE");
      await c.query("ALTER TABLE sessions ADD CONSTRAINT sessions_worker_fk FOREIGN KEY (course, dni) REFERENCES workers(course, dni) ON DELETE CASCADE");
      console.log("Migración multi-curso aplicada");
    }
    await c.query("CREATE INDEX IF NOT EXISTS sessions_course_dni_at ON sessions(course, dni, at DESC)");
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
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
function sanitize(C, d) {
  const { KEYSET, EXAMN, maxScore, needOf } = C;
  const o = { done: {}, scores: {}, exam: null, last: "home", timeSec: 0, timeByKey: {}, attempts: {} };
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
  if (Number.isFinite(d.timeSec) && d.timeSec > 0) o.timeSec = Math.min(Math.floor(d.timeSec), 10 * 365 * 86400);
  for (const [f, cap] of [["timeByKey", 10 * 365 * 86400], ["attempts", 100000]]) if (d[f] && typeof d[f] === "object") for (const k of Object.keys(d[f])) {
    const v = d[f][k]; if (KEYSET.has(k) && Number.isFinite(v) && v > 0) o[f][k] = Math.min(Math.floor(v), cap);
  }
  if (typeof d.last === "string" && (d.last === "home" || ["exam", "account"].includes(d.last) || KEYSET.has(d.last))) o.last = d.last;
  return o;
}
function merge(a, b) { // a = servidor, b = cliente
  const o = { done: { ...a.done, ...b.done }, scores: { ...a.scores }, exam: a.exam, last: b.last || a.last, timeSec: Math.max(a.timeSec || 0, b.timeSec || 0), timeByKey: { ...(a.timeByKey || {}) }, attempts: { ...(a.attempts || {}) } };
  for (const f of ["timeByKey", "attempts"]) for (const k of Object.keys(b[f] || {})) o[f][k] = Math.max(o[f][k] || 0, b[f][k]);
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
function enforce(C, d) {
  const { KEYS } = C;
  const out = { done: {}, scores: {}, exam: null, last: d.last, timeSec: d.timeSec || 0, timeByKey: d.timeByKey || {}, attempts: d.attempts || {} }, dropped = [];
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
const pctOf = (C, d) => Math.round(C.KEYS.filter(k => d.done[k]).length / C.KEYS.length * 100);

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
function needUser(req, res, next) { const p = verify(bearer(req)); if (!p || p.t !== "u") return res.status(401).json({ error: "Sesión caducada. Vuelve a acceder." }); req.dni = p.dni; req.course = courseId(p.c) || DEFAULT_COURSE; req.C = COURSES[req.course]; next(); }
function needAdmin(req, res, next) { const p = verify(bearer(req)); if (!p || p.t !== "a") return res.status(401).json({ error: "No autorizado" }); next(); }

// ---------- app ----------
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") return res.redirect(301, "https://" + req.get("host") + req.originalUrl);
  res.set({ "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" });
  const o = req.get("origin");
  if (o && ORIGINS.includes(o)) res.set({ "Access-Control-Allow-Origin": o, "Vary": "Origin", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Course", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Max-Age": "600" });
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
async function loadProgress(C, dni) {
  const r = await pool.query("SELECT data FROM progress WHERE course=$1 AND dni=$2", [C.id, dni]);
  return enforce(C, sanitize(C, r.rows[0] ? r.rows[0].data : {})).data;
}
const PROG_UPSERT = `INSERT INTO progress(course,dni,data,pct,exam_ok,exam_n,passed,passed_at,time_sec,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
    ON CONFLICT(course,dni) DO UPDATE SET data=$3,pct=$4,exam_ok=$5,exam_n=$6,passed=$7,passed_at=$8,time_sec=$9,updated_at=now()`;
const progArgs = (C, dni, data) => { const e = data.exam; return [C.id, dni, data, pctOf(C, data), e ? e.ok : null, e ? e.n : null, !!(e && e.pass), e && e.pass ? e.date : null, data.timeSec || 0]; };
async function storeProgress(C, dni, data) { await pool.query(PROG_UPSERT, progArgs(C, dni, data)); }
// Registro de conexiones (evidencia de formación): fecha, IP y navegador. Máx. 500 por trabajador.
const clientIp = req => clean(String(req.get("x-forwarded-for") || "").split(",")[0] || req.ip || "", 45) || null;
async function logConn(req, course, dni, kind) {
  try {
    await pool.query("INSERT INTO sessions(course,dni,kind,ip,user_agent) VALUES($1,$2,$3,$4,$5)", [course, dni, kind, clientIp(req), clean(req.get("user-agent"), 200) || null]);
    await pool.query("DELETE FROM sessions WHERE course=$1 AND dni=$2 AND id NOT IN (SELECT id FROM sessions WHERE course=$1 AND dni=$2 ORDER BY at DESC LIMIT 500)", [course, dni]);
  } catch (e) { console.error("logConn", e.message); }
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
  const C = COURSES[reqCourse(req)];
  const hash = await bcrypt.hash(b.pin, 10);
  const r = await pool.query(`INSERT INTO workers(course,dni,name,company,email,pin_hash,consent_at,last_login) VALUES($1,$2,$3,$4,$5,$6,now(),now()) ON CONFLICT(course,dni) DO NOTHING RETURNING *`, [C.id, dni, name, company, email, hash]);
  if (!r.rows[0]) return res.status(409).json({ error: "Ya existe una persona dada de alta con este DNI/NIE. Usa «Acceder»." });
  const data = enforce(C, merge(sanitize(C, {}), sanitize(C, b.progress))).data;
  await storeProgress(C, dni, data);
  await logConn(req, C.id, dni, "alta");
  res.status(201).json({ token: sign({ t: "u", dni, c: C.id }, 24 * 30), user: userOut(r.rows[0]), progress: data });
}));

app.post("/api/login", loginLimiter, wrap(async (req, res) => {
  const b = req.body || {}, dni = normDni(b.dni);
  if (!validDni(dni) || typeof b.pin !== "string" || b.pin.length > 40) return res.status(400).json({ error: "DNI/NIE o PIN incorrectos." });
  const C = COURSES[reqCourse(req)];
  const r = await pool.query("SELECT * FROM workers WHERE course=$1 AND dni=$2", [C.id, dni]);
  const ok = r.rows[0] ? await bcrypt.compare(b.pin, r.rows[0].pin_hash) : (await bcrypt.compare(b.pin, DUMMY), false);
  if (!ok) return res.status(401).json({ error: "DNI/NIE o PIN incorrectos." });
  await pool.query("UPDATE workers SET last_login=now() WHERE course=$1 AND dni=$2", [C.id, dni]);
  await logConn(req, C.id, dni, "login");
  res.json({ token: sign({ t: "u", dni, c: C.id }, 24 * 30), user: userOut(r.rows[0]), progress: await loadProgress(C, dni) });
}));

app.get("/api/me", needUser, wrap(async (req, res) => {
  const r = await pool.query("SELECT * FROM workers WHERE course=$1 AND dni=$2", [req.course, req.dni]);
  if (!r.rows[0]) return res.status(401).json({ error: "Usuario no encontrado." });
  res.json({ user: userOut(r.rows[0]), progress: await loadProgress(req.C, req.dni) });
}));

const sessionLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
app.post("/api/session", sessionLimiter, needUser, wrap(async (req, res) => {
  const w = await pool.query("UPDATE workers SET last_login=now() WHERE course=$1 AND dni=$2 RETURNING 1", [req.course, req.dni]);
  if (!w.rows[0]) return res.status(401).json({ error: "Usuario no encontrado." });
  await logConn(req, req.course, req.dni, "sesion");
  res.json({ ok: true });
}));

app.put("/api/progress", needUser, wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const C = req.C;
    const r = await client.query("SELECT data FROM progress WHERE course=$1 AND dni=$2 FOR UPDATE", [C.id, req.dni]);
    const w = await client.query("SELECT 1 FROM workers WHERE course=$1 AND dni=$2", [C.id, req.dni]);
    if (!w.rows[0]) { await client.query("ROLLBACK"); return res.status(401).json({ error: "Usuario no encontrado." }); }
    const prev = enforce(C, sanitize(C, r.rows[0] ? r.rows[0].data : {})).data;
    const { data, dropped } = enforce(C, merge(prev, sanitize(C, req.body && req.body.progress)));
    await client.query(PROG_UPSERT, progArgs(C, req.dni, data));
    await client.query("COMMIT");
    if (dropped.length) return res.status(409).json({ error: "Avance no permitido: hay que aprobar antes lo anterior.", rejected: dropped, progress: data });
    res.json({ progress: data });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
}));

app.delete("/api/me", needUser, wrap(async (req, res) => {
  await pool.query("DELETE FROM workers WHERE course=$1 AND dni=$2", [req.course, req.dni]);
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

const LIST_SQL = `SELECT w.course,w.dni,w.name,w.company,w.email,w.created_at,w.last_login,
  coalesce(p.pct,0) pct,p.data,p.exam_ok,p.exam_n,coalesce(p.passed,false) passed,to_char(p.passed_at,'YYYY-MM-DD') passed_at,p.updated_at,coalesce(p.time_sec,0) time_sec,
  (SELECT count(*)::int FROM sessions s WHERE s.course=w.course AND s.dni=w.dni) connections
  FROM workers w LEFT JOIN progress p USING(course,dni) WHERE w.course=$1`;
const KIND = { alta: "Alta", login: "Acceso (login)", sesion: "Sesión" };
function rowOut(C, r) {
  const d = sanitize(C, r.data || {}), LESSONS = C.LESSONS;
  return { course: C.id, dni: r.dni, name: r.name, company: r.company, email: r.email, created: r.created_at, lastLogin: r.last_login, updated: r.updated_at,
    timeSec: Math.max(r.time_sec || 0, d.timeSec || 0), pct: r.pct, examOk: r.exam_ok, examN: r.exam_n, passed: r.passed, passedAt: r.passed_at,
    modules: LESSONS.map((n, m) => ({ done: [...Array(n).keys()].filter(i => d.done[`${m}-${i}`]).length + (d.done[`${m}-final`] ? 1 : 0), total: n + 1, final: d.scores[`${m}-final`] ?? null })),
    scores: d.scores, timeByKey: d.timeByKey, attempts: d.attempts, connections: r.connections || 0,
    attemptsTotal: Object.values(d.attempts).reduce((a, b) => a + b, 0) };
}
// Cursos disponibles y nº de personas en cada uno (para el selector del panel)
app.get("/api/admin/courses", needAdmin, wrap(async (req, res) => {
  const r = await pool.query("SELECT course, count(*)::int n FROM workers GROUP BY course");
  const n = Object.fromEntries(r.rows.map(x => [x.course, x.n]));
  res.json({ default: DEFAULT_COURSE, courses: Object.values(COURSES).map(C => ({ id: C.id, name: C.name, code: C.code, url: C.origin, titles: C.meta.titles, lessons: C.LESSONS, totMin: C.meta.tot, examN: C.EXAMN, workers: n[C.id] || 0 })) });
}));
app.get("/api/admin/workers", needAdmin, wrap(async (req, res) => {
  const C = COURSES[reqCourse(req)];
  const r = await pool.query(LIST_SQL + " ORDER BY w.company, w.name", [C.id]);
  res.json({ course: C.id, courseName: C.name, workers: r.rows.map(x => rowOut(C, x)), lessons: C.LESSONS, titles: C.meta.titles, finalN: C.id === DEFAULT_COURSE ? FINALN : C.meta.finalN, examN: C.EXAMN });
}));
app.get("/api/admin/workers/:dni", needAdmin, wrap(async (req, res) => {
  const C = COURSES[reqCourse(req)];
  const r = await pool.query(LIST_SQL + " AND w.dni=$2", [C.id, normDni(req.params.dni)]);
  if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" });
  const c = await pool.query("SELECT at,kind,ip FROM sessions WHERE course=$1 AND dni=$2 ORDER BY at DESC LIMIT 200", [C.id, r.rows[0].dni]);
  res.json({ worker: { ...rowOut(C, r.rows[0]), connectionLog: c.rows.map(x => ({ at: x.at, ip: x.ip, tool: KIND[x.kind] || x.kind })) } });
}));
// Trabajadores que han terminado el curso (examen final aprobado)
// ?course=taf (por defecto, igual que antes) · ?course=ofi · ?course=hbd · ?course=all (todos; id = «curso:DNI» salvo en taf, que mantiene el DNI)
app.get("/api/admin/finalizados", needAdmin, wrap(async (req, res) => {
  const all = req.query.course === "all", C = COURSES[reqCourse(req)];
  const r = await pool.query(`SELECT w.course,w.dni,w.name,w.company,p.exam_ok,p.exam_n,to_char(p.passed_at,'YYYY-MM-DD') passed_at
    FROM workers w JOIN progress p USING(course,dni) WHERE p.passed AND ($1::text IS NULL OR w.course=$1) ORDER BY p.passed_at, w.name`, [all ? null : C.id]);
  res.json({ finalizados: r.rows.map(x => ({ id: x.course === DEFAULT_COURSE ? x.dni : `${x.course}:${x.dni}`, curso: x.course, curso_nombre: COURSES[x.course] ? COURSES[x.course].name : x.course,
    nombre: x.name, empresa: x.company, nota: `${x.exam_ok}/${x.exam_n}`, nota_pct: Math.round(x.exam_ok / x.exam_n * 100), fecha_finalizacion: x.passed_at })) });
}));
app.delete("/api/admin/workers/:dni", needAdmin, wrap(async (req, res) => {
  const r = await pool.query("DELETE FROM workers WHERE course=$1 AND dni=$2", [reqCourse(req), normDni(req.params.dni)]);
  res.json({ deleted: r.rowCount });
}));
// Copia de seguridad completa (solo administración): todas las filas de workers, progress y sessions
app.get("/api/admin/backup", needAdmin, wrap(async (req, res) => {
  const out = { at: new Date().toISOString() };
  for (const t of ["workers", "progress", "sessions"]) out[t] = (await pool.query(`SELECT * FROM ${t}`)).rows;
  res.json(out);
}));
const fmtT = t => { const m = Math.floor((t || 0) / 60); return `${Math.floor(m / 60)} h ${m % 60} min`; };
const csvCell = v => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
app.get("/api/admin/export.csv", needAdmin, wrap(async (req, res) => {
  const q = String(req.query.q || "").toLowerCase().slice(0, 80), emp = String(req.query.empresa || "").slice(0, 80);
  const C = COURSES[reqCourse(req)], LESSONS = C.LESSONS;
  const r = await pool.query(LIST_SQL + " ORDER BY w.company, w.name", [C.id]);
  const rows = r.rows.map(x => rowOut(C, x)).filter(w => (!emp || w.company === emp) && (!q || (w.name + " " + w.dni + " " + w.email + " " + w.company).toLowerCase().includes(q)));
  const f = d => d ? new Date(d).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "";
  const head = ["Nombre", "DNI/NIE", "Empresa", "Correo", "Alta", "Último acceso", "Progreso %", "Tiempo conexión", "Nº conexiones", "Intentos test", ...LESSONS.map((_, m) => C.id === DEFAULT_COURSE ? `Test M${m + 1} (/${FINALN})` : `Test L${m} (/${C.meta.finalN[m]})`), "Examen final", "Resultado", "Fecha aprobado"];
  const lines = [head, ...rows.map(w => [w.name, w.dni, w.company, w.email, f(w.created), f(w.lastLogin), w.pct, fmtT(w.timeSec), w.connections, w.attemptsTotal, ...w.modules.map(m => m.final ?? ""), w.examOk != null ? `${w.examOk}/${w.examN}` : "", w.passed ? "APTO" : "NO APTO", w.passedAt ? w.passedAt.split("-").reverse().join("/") : ""])];
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trabajadores-prl-${C.id}-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send("\ufeff" + lines.map(l => l.map(csvCell).join(";")).join("\r\n"));
}));

// ---------- estáticos: solo el curso y el panel ----------
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/admin", (req, res) => res.redirect(301, "/admin/"));
app.get(["/admin/", "/admin/index.html"], (req, res) => res.sendFile(path.join(__dirname, "admin", "index.html")));
app.use((req, res) => res.status(404).json({ error: "No encontrado" }));

init().then(() => app.listen(PORT, () => console.log("Escuchando en " + PORT))).catch(e => { console.error("Error iniciando BD", e); process.exit(1); });
