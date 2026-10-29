#!/usr/bin/env node
// Uso: node scripts/informe.js <DNI> <salida.pdf> [--json worker.json]
// Descarga el detalle del trabajador del panel (contraseña en ADMIN_PASSWORD o ../ADMIN_PASSWORD.txt) y genera un PDF A4.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), API = process.env.API || "https://curso-prl-taf-api.onrender.com";
const [dni, out = "informe.pdf"] = process.argv.slice(2); const ji = process.argv.indexOf("--json");
if (!dni) { console.error("Uso: node scripts/informe.js <DNI> <salida.pdf> [--json worker.json]"); process.exit(1); }
const stub = new Proxy(function () { return ""; }, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : stub });
const ctx = new Proxy({}, { has: () => true, get: (t, k) => k in t ? t[k] : (k in globalThis ? globalThis[k] : stub), set: (t, k, v) => (t[k] = v, true) });
vm.createContext(ctx);
vm.runInContext([1,2,3,4,5,6,7].map(i => fs.readFileSync(path.join(ROOT, "src", `m${i}.js`), "utf8")).join("\n") .replace(/^const (M\d)=/gm, "$1=") + "\nMODS=[M1,M2,M3,M4,M5,M6,M7];", ctx);
const MODS = ctx.MODS, FINALN = 15;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fdt = d => d ? new Date(d).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }) + " (hora de Madrid)" : "—";
const fd = d => d ? d.split("-").reverse().join("/") : "—";
const fmtT = t => { const m = Math.floor((t || 0) / 60); return `${Math.floor(m / 60)} h ${m % 60} min`; };
async function getWorker() {
  if (ji > 0) { const j = JSON.parse(fs.readFileSync(process.argv[ji + 1], "utf8")); return j.worker || j; }
  const pw = process.env.ADMIN_PASSWORD || fs.readFileSync(path.join(ROOT, "ADMIN_PASSWORD.txt"), "utf8").trim();
  const t = await (await fetch(API + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) })).json();
  if (!t.token) throw new Error("Login admin fallido: " + JSON.stringify(t));
  const r = await (await fetch(API + "/api/admin/workers/" + encodeURIComponent(dni), { headers: { Authorization: "Bearer " + t.token } })).json();
  if (!r.worker) throw new Error("Trabajador no encontrado"); return r.worker;
}
(async () => {
  const w = await getWorker(), s = w.scores || {}, need = n => Math.ceil(n * 0.7);
  const ts = w.timeSec || 0;
  const tTxt = ts > 0 ? fmtT(ts) : (w.passed ? "Sin datos previos (curso finalizado antes de activar el registro de tiempo, 29/10/2026)" : "0 h 0 min");
  const row = (t, sc, n) => sc == null ? `<tr><td>${esc(t)}</td><td>—</td><td>—</td><td>Pendiente</td></tr>` :
    `<tr><td>${esc(t)}</td><td>${sc}/${n}</td><td>${Math.round(sc / n * 100)} %</td><td class=${sc >= need(n) ? "ok>Aprobado" : "no>No superado"}</td></tr>`;
  let nl = 0, okl = 0;
  const mods = MODS.map((M, m) => `<div class=mod><h3>Módulo ${m + 1}. ${esc(M.t)}</h3><table><tr><th>Test</th><th>Nota</th><th>%</th><th>Resultado</th></tr>` +
    M.L.map((l, i) => { nl++; const sc = s[`${m}-${i}`]; if (sc != null && sc >= need(l.q.length)) okl++; return row(`${i + 1}. ${l.t}`, sc, l.q.length); }).join("") +
    row("Test final del módulo", s[`${m}-final`], FINALN).replace("<tr>", "<tr class=fin>") + `</table></div>`).join("");
  const info = [["Trabajador/a", w.name], ["DNI/NIE", w.dni], ["Empresa", w.company], ["Correo electrónico", w.email], ["Fecha de alta", fdt(w.created)], ["Último acceso", fdt(w.lastLogin)],
    ["Última actividad registrada", fdt(w.updated)], ["Tiempo de conexión registrado", tTxt], ["Fecha de finalización", fd(w.passedAt)], ["Progreso", w.pct + " %"], ["Tests de lección superados", `${okl} de ${nl}`],
    ["Examen final", w.examOk != null ? `${w.examOk}/${w.examN} (${Math.round(w.examOk / w.examN * 100)} %)` : "—"]].map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join("");
  const html = `<html lang=es><meta charset=utf-8><style>
@page{size:A4;margin:16mm 14mm 18mm}body{font-family:Montserrat,Arial,sans-serif;font-size:10pt;color:#222}
.hd{border-bottom:4px solid #009CD7;padding-bottom:6px;margin-bottom:12px}.hd b{color:#009CD7;font-size:20pt}.hd span{float:right;color:#16B14C;font-weight:bold;margin-top:10px}
h2{color:#0277ab;font-size:13pt}h3{color:#fff;background:#009CD7;padding:5px 8px;font-size:10.5pt;margin:0}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccd;padding:4px 6px}th{background:#e6f5fb;text-align:left}
.mod{margin-bottom:12px;page-break-inside:avoid}.ok{color:#128a3c;font-weight:bold}.no{color:#b00020;font-weight:bold}.fin td{background:#eefaf2;font-weight:bold}
.info td:first-child{width:32%;background:#f4f8fa;font-weight:bold}.res{font-size:14pt;font-weight:bold}
.ft{margin-top:16px;font-size:8pt;color:#666;border-top:1px solid #ccc;padding-top:6px}</style><body>
<div class=hd><b>Previjob</b><span>Informe de progreso del curso</span></div>
<h2>Curso PRL · Técnico/a de actividades físicas y entrenamiento (art. 19 LPRL)</h2>
<table class=info>${info}<tr><td>Resultado global</td><td class="res ${w.passed ? "ok" : "no"}">${w.passed ? "APTO" : "NO APTO"}</td></tr></table>
<p style="font-size:8.5pt;color:#555">Criterio de superación: 70 % de aciertos en cada test. Tiempo de conexión: suma del tiempo activo con la sesión iniciada y el curso visible en pantalla (no cuenta pestañas en segundo plano ni pausas de más de 2 minutos); registrado desde el 29/10/2026.</p>
<h2>Detalle por módulos</h2>${mods}
<div class=ft>Generado el ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora de Madrid) a partir del registro de la plataforma del curso.</div></body></html>`;
  const tmp = path.join(require("os").tmpdir(), "informe-" + w.dni + ".html"); fs.writeFileSync(tmp, html);
  execFileSync("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", "--print-to-pdf=" + path.resolve(out), "file://" + tmp], { stdio: "ignore" });
  console.log("PDF:", path.resolve(out), "· tiempo:", tTxt);
})().catch(e => { console.error(e.message); process.exit(1); });
