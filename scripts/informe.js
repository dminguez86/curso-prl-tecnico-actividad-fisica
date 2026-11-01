#!/usr/bin/env node
// Uso: node scripts/informe.js <DNI> <salida.pdf> [--json worker.json]
// Informe de alumno con el formato de la plataforma GMM/Previjob (ref.: «Informe alumno: LEONARDO MANTILLA QUISPE», GMM):
// Datos del curso · Alumno · Progreso de lecciones · Realización de test · Desglose de tiempo · Conexiones a las herramientas.
// Solo datos reales: IP/conexiones, tiempo por lección e intentos se registran desde el 01/11/2026; sin foros/chat -> «N/D».
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), API = process.env.API || "https://curso-prl-taf-api.onrender.com";
const [dni, out = "informe.pdf"] = process.argv.slice(2); const ji = process.argv.indexOf("--json");
if (!dni) { console.error("Uso: node scripts/informe.js <DNI> <salida.pdf> [--json worker.json]"); process.exit(1); }
const stub = new Proxy(function () { return ""; }, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : stub });
const ctx = new Proxy({}, { has: () => true, get: (t, k) => k in t ? t[k] : (k in globalThis ? globalThis[k] : stub), set: (t, k, v) => (t[k] = v, true) });
vm.createContext(ctx);
vm.runInContext([1,2,3,4,5,6,7].map(i => fs.readFileSync(path.join(ROOT, "src", `m${i}.js`), "utf8")).join("\n").replace(/^const (M\d)=/gm, "$1=") + "\nMODS=[M1,M2,M3,M4,M5,M6,M7];", ctx);
const MODS = ctx.MODS, FINALN = 15, EXAMMIN = 20;
const TOTMIN = MODS.reduce((a, M) => a + M.L.reduce((b, l) => b + (+l.min || 0), 0) + (+M.fmin || 0), 0) + EXAMMIN;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mad = (d, o) => new Date(d).toLocaleString("es-ES", Object.assign({ timeZone: "Europe/Madrid" }, o));
const fdt = d => d ? mad(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(",", "") : "—";
const hms = t => { t = Math.floor(t || 0); return `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const LOGO = (() => { try { return fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8").match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/)[0]; } catch { return null; } })();
async function api() {
  if (ji > 0) { const j = JSON.parse(fs.readFileSync(process.argv[ji + 1], "utf8")); return { w: j.worker || j, n: j.nAlumnos ?? "N/D" }; }
  const pw = process.env.ADMIN_PASSWORD || fs.readFileSync(path.join(ROOT, "ADMIN_PASSWORD.txt"), "utf8").trim();
  const t = await (await fetch(API + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) })).json();
  if (!t.token) throw new Error("Login admin fallido");
  const H = { headers: { Authorization: "Bearer " + t.token } };
  const r = await (await fetch(API + "/api/admin/workers/" + encodeURIComponent(dni), H)).json();
  if (!r.worker) throw new Error("Trabajador no encontrado");
  let n = "N/D"; try { const l = await (await fetch(API + "/api/admin/workers", H)).json(); n = (l.workers || []).length; } catch {}
  return { w: r.worker, n };
}
(async () => {
  const { w, n } = await api(), s = w.scores || {}, tk = w.timeByKey || {}, at = w.attempts || {}, log = w.connectionLog || [], nc = w.connections ?? log.length, ts = w.timeSec || 0, last = fdt(w.updated || w.lastLogin);
  const pct = (sc, q) => sc == null ? "—" : Math.round(sc / q * 100) + "%";
  const prog = [], tests = [];
  MODS.forEach((M, m) => {
    M.L.forEach((l, i) => { const sc = s[`${m}-${i}`], nm = `${m + 1}.${i + 1} ${l.t}`;
      prog.push([nm, sc != null ? "Completado" : "Pendiente", `${m}-${i}`]); tests.push([`Test lección ${m + 1}.${i + 1}`, nm, pct(sc, l.q.length), `${m}-${i}`]); });
    const f = s[`${m}-final`], nm = `Test final módulo ${m + 1}`; prog.push([nm, f != null ? "Completado" : "Pendiente", `${m}-final`]); tests.push([nm, `Módulo ${m + 1}. ${M.t}`, pct(f, FINALN), `${m}-final`]);
  });
  const ex = w.examOk != null ? Math.round(w.examOk / w.examN * 100) + "%" : "—";
  prog.push(["Examen final del curso", w.passed ? "Completado" : "Pendiente", "exam"]); tests.push(["Examen final", "Examen final del curso", ex, "exam"]);
  const hasT = Object.keys(tk).length > 0, hasA = Object.keys(at).length > 0, tl = Object.values(tk).reduce((a, b) => a + b, 0);
  const kv = rows => rows.map(r => `<tr>${r.map((c, i) => `<td class=${i % 2 ? "v" : "k"}>${esc(c)}</td>`).join("")}</tr>`).join("");
  const now = new Date(), stamp = mad(now, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/(\d+)\/(\d+)\/(\d+),?/, "$3-$2-$1");
  const name = String(w.name || "").toUpperCase();
  const html = `<html lang=es><meta charset=utf-8><style>
@page{size:A4;margin:12mm 12mm 14mm}body{font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;color:#222}
.top{display:flex;align-items:center;gap:16px;margin-bottom:10px}.top img{height:42px}.top h1{font-size:13pt;font-weight:normal;margin:0}
h2{background:#0066a1;color:#fff;font-size:10pt;margin:14px 0 0;padding:5px 7px}
table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}td,th{border:1px solid #d5d9dd;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#0066a1;color:#fff;font-weight:bold}td.k{font-weight:bold;background:#f5f7f9;white-space:nowrap}.c{text-align:center}
.note{font-size:7.5pt;color:#555;margin:4px 0 0}</style><body>
<div class=top>${LOGO ? `<img src="${LOGO}">` : "<b style='color:#009CD7;font-size:18pt'>Previjob</b>"}<h1>Informe alumno: ${esc(name)} (${stamp})</h1></div>
<h2>Datos del curso</h2><table>${kv([
 ["Acción Formativa:", "PRL · Técnico/a de actividades físicas y entrenamiento (art. 19 LPRL)", "Cod. Acción Formativa:", "PRL-TAF-ART19"],
 ["Grupo:", "PRL-TAF-ART19 · " + (w.company || "—"), "Cod grupo:", "PRL-TAF-ART19"],
 ["Modalidad:", "ONLINE", "", ""],
 ["Horas Totales curso:", (TOTMIN / 60).toFixed(2) + " Horas", "Horas a cursar:", (TOTMIN / 60).toFixed(2) + " Horas (100 % del contenido)"],
 ["Fecha inicio curso:", "N/D (curso abierto)", "Fecha fin curso:", "N/D (curso abierto)"],
 ["Profesores:", "Previjob · Servicio de Prevención", "Nº de alumnos:", n]])}</table>
<h2>Alumno: ${esc(name)}</h2><table>${kv([
 ["Nombre", w.name, "Nº de conexiones", String(nc), "Post en foros", "N/D"],
 ["DNI", w.dni, "Tiempo invertido en lecciones", ts > 0 ? hms(ts) : "0:00:00 *", "Chat", "N/D"],
 ["E-mail", w.email || "—", "Tiempo mínimo (Lecciones)", "N/D", "Documentos compartidos", "N/D"],
 ["Empresa", w.company || "—", "Superación de contenidos", `${w.pct ?? 0} / 100 (${w.pct ?? 0} %)`, "Mensajes(enviados/recibidos)", "N/D"],
 ["Primera conexión", fdt(w.created), "Estado", w.passed ? "Apto" : "No apto", "Descarga del certificado", "No"],
 ["Última conexión", last, "Fecha de finalización", w.passedAt ? w.passedAt.split("-").reverse().join("/") : "—", "", ""]])}</table>
${ts > 0 ? "" : `<p class=note>* Sin tiempo registrado: el registro de tiempo de conexión se activó el 29/10/2026 y solo cuenta desde que el alumno recarga el curso con la versión nueva.</p>`}
<p class=note>Primera conexión = fecha de alta en la plataforma. N/D = dato no registrado por esta plataforma.</p>
<h2>Progreso de lecciones</h2><table><tr><th>Lecciones</th><th>Tiempo en la lección</th><th>Cumplimiento tiempo mínimo</th><th>Última conexión</th></tr>
${prog.map(([a, b, k]) => `<tr><td>${esc(a)}</td><td class=c>${tk[k] ? hms(tk[k]) : hasT ? "0:00:00" : "N/D"}</td><td>${b}</td><td>${b === "Completado" ? last : "—"}</td></tr>`).join("")}</table>
<p class=note>${hasT ? "Tiempo activo (pestaña visible y sesión iniciada) en cada lección/test." : "N/D: sin tiempo por lección registrado (el registro por lección se activó el 01/11/2026; la actividad anterior no se puede recuperar)."} «Última conexión» es la última actividad registrada del alumno en el curso.</p>
<h2>Realización de test</h2><table><tr><th>Ejercicios</th><th>Lecciones</th><th>Puntuación</th><th>Intentos</th></tr>
${tests.map(([a, b, c, k]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class=c>${c}</td><td class=c>${at[k] ? at[k] : hasA ? (c === "—" ? "0" : "N/D") : "N/D"}</td></tr>`).join("")}</table>
<p class=note>Puntuación: mejor nota obtenida. Criterio de superación: 70 % de aciertos. ${hasA ? "Intentos: veces que se ha completado el test." : "Intentos N/D: el registro de intentos se activó el 01/11/2026; los realizados antes no constan."}</p>
<h2>Desglose de tiempo por secciones/herramientas</h2><table><tr><th>Herramienta</th><th>Tiempo</th><th>Herramienta</th><th>Tiempo</th></tr>
<tr><td>Tiempo en lecciones y tests</td><td>${hasT ? hms(tl) : "N/D"}</td><td>Otras herramientas (foros, chat, notas…)</td><td>N/D</td></tr>
<tr><td class=k>Tiempo total en el curso</td><td><b>${hms(ts)}</b></td><td></td><td></td></tr></table>
<h2>Conexiones a las herramientas del curso</h2>${log.length ? `<table><tr><th>Herramienta</th><th>Fecha</th><th>IP</th></tr>${log.map(c => `<tr><td>${esc(c.tool || "Acceso")}</td><td>${fdt(c.at)}</td><td>${esc(c.ip || "N/D")}</td></tr>`).join("")}</table>` : ""}
<p class=note style="font-size:8.5pt">${log.length ? "Registro de accesos al curso (alta, login y reanudación de sesión) con la IP de origen." : "Sin conexiones registradas: el registro de conexiones e IP se activó el 01/11/2026; los accesos anteriores no constan."}</p>
</body></html>`;
  const tmp = path.join(require("os").tmpdir(), "informe-" + w.dni + ".html"); fs.writeFileSync(tmp, html);
  execFileSync("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", "--print-to-pdf=" + path.resolve(out), "file://" + tmp], { stdio: "ignore" });
  console.log("PDF:", path.resolve(out), "· tiempo:", hms(ts), "· alumnos:", n);
})().catch(e => { console.error(e.message); process.exit(1); });
