const KEY="curso-prl-taf-v1";
let st={};try{st=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){st={}}
st.done=st.done||{};st.scores=st.scores||{};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
const $=s=>document.querySelector(s),main=$("#main"),nav=$("#nav");
const theme=t=>{document.documentElement.dataset.theme=t;$("#theme").textContent=t==="dark"?"☀️":"🌙";st.theme=t;save()};
theme(st.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));
$("#theme").onclick=()=>theme(st.theme==="dark"?"light":"dark");
$("#menu").onclick=()=>nav.classList.toggle("open");
const FINALN=15,EXAMN=25;
const mins=m=>MODS[m].L.reduce((a,l)=>a+l.min,0)+MODS[m].fmin;
const TOT=()=>MODS.reduce((a,_,m)=>a+mins(m),0)+20;
const hm=t=>(t>=60?Math.floor(t/60)+" h ":"")+(t%60?t%60+" min":"");
const keys=m=>MODS[m].L.map((_,i)=>m+"-"+i).concat(m+"-final");
const modPct=m=>{const ks=keys(m);return Math.round(ks.filter(k=>st.done[k]).length/ks.length*100)};
const allKeys=()=>MODS.flatMap((_,m)=>keys(m)).concat("exam");
function progress(){const ks=allKeys(),p=Math.round(ks.filter(k=>st.done[k]).length/ks.length*100);$("#bar").style.width=p+"%";$("#pct").textContent=p+"%";}
function renderNav(v){nav.innerHTML=`<a data-v="home" class="${v.p==="home"?"on":""}">🏠 Portada</a>`+MODS.map((M,m)=>`<details class="ng" ${v.m===m||v.p==="home"?"open":""}><summary>Módulo ${m+1} <small>· ${modPct(m)}% · ${hm(mins(m))}</small></summary>`+M.L.map((l,i)=>`<a data-v="${m}-${i}" class="${v.m===m&&v.p===i?"on":""}">${l.ico} ${m+1}.${i+1} ${l.t}<span class="ck">${st.done[m+"-"+i]?"✅":""}</span></a>`).join("")+`<a data-v="${m}-final" class="${v.m===m&&v.p==="final"?"on":""}">🏁 Test final del módulo<span class="ck">${st.done[m+"-final"]?"✅":""}</span></a></details>`).join("")+`<a data-v="exam" class="${v.p==="exam"?"on":""}">🎓 Examen final del curso<span class="ck">${st.exam&&st.exam.pass?"✅":""}</span></a><a data-v="cert" class="${v.p==="cert"?"on":""}">📜 Certificado</a><p style="font-size:.8rem;color:var(--mut);padding:8px">Tu progreso se guarda en este navegador. <button id="reset" style="font-size:.8rem">Reiniciar</button></p>`;
nav.querySelectorAll("a").forEach(a=>a.onclick=()=>go(parse(a.dataset.v)));
$("#reset").onclick=()=>{if(confirm("¿Borrar todo el progreso?")){st={theme:st.theme,done:{},scores:{},name:st.name};save();go({p:"home"})}};}
function parse(s){if(!s||s==="home")return{p:"home"};if(s==="exam"||s==="cert")return{p:s};const[m,p]=s.split("-");return{m:+m,p:p==="final"?"final":+p}}
function go(v){nav.classList.remove("open");st.last=(v.p==="home"||v.p==="exam"||v.p==="cert")?v.p:v.m+"-"+v.p;save();renderNav(v);progress();
if(v.p==="home")home();else if(v.p==="exam")exam();else if(v.p==="cert")cert();else if(v.p==="final")finalTest(v.m);else lesson(v.m,v.p);main.firstElementChild.classList.add("view");scrollTo({top:0,behavior:"smooth"});}
function nextStep(){for(let m=0;m<MODS.length;m++){const i=MODS[m].L.findIndex((_,j)=>!st.done[m+"-"+j]);if(i>=0)return m+"-"+i;if(!st.done[m+"-final"])return m+"-final"}return "exam"}
const RACK=`<svg class="gym" viewBox="0 0 320 270" aria-hidden="true">
<rect x="0" y="246" width="320" height="6" fill="#ffffff40"/>
<g class="kb"><path d="M232 186a26 26 0 1 0 52 0a26 26 0 1 0-52 0z" fill="#16B14C"/><path d="M243 166c0-20 30-20 30 0" fill="none" stroke="#16B14C" stroke-width="8"/><text x="258" y="192" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">16</text></g>
<rect x="232" y="240" width="52" height="6" rx="3" fill="#0b3a55"/>
<g class="bar"><rect x="40" y="0" width="190" height="7" rx="3" fill="#cfe0ee"/><rect x="48" y="-22" width="14" height="51" rx="3" fill="#009CD7"/><rect x="64" y="-14" width="9" height="35" rx="2" fill="#0277ab"/><rect x="208" y="-22" width="14" height="51" rx="3" fill="#009CD7"/><rect x="197" y="-14" width="9" height="35" rx="2" fill="#0277ab"/></g>
<g class="lifter" fill="#ffd9b0"><circle cx="135" cy="124" r="14"/></g>
<g stroke="#ffffff" stroke-width="10" stroke-linecap="round" fill="none"><path class="arm1" d="M115 150 L100 120"/><path class="arm2" d="M155 150 L170 120"/></g>
<rect x="114" y="142" width="42" height="56" rx="12" fill="#16B14C"/>
<g stroke="#0b3a55" stroke-width="12" stroke-linecap="round"><path d="M124 196 L118 244"/><path d="M146 196 L152 244"/></g>
<rect x="14" y="210" width="70" height="14" rx="7" fill="#f28c28" opacity=".9"/><rect x="8" y="224" width="82" height="6" rx="3" fill="#ffffff55"/>
<g class="pulse"><path d="M10 40 H60 L70 20 L82 62 L92 40 H130" fill="none" stroke="#9ff0bb" stroke-width="3"/></g>
<g font-size="11" font-weight="800" text-anchor="middle"><rect x="240" y="20" width="66" height="20" rx="5" fill="#16B14C"/><text x="273" y="34" fill="#fff">PRL ✔</text></g>
</svg>`;
function heroX(){const nL=MODS.reduce((a,M)=>a+M.L.length,0),nQ=MODS.reduce((a,M)=>a+M.L.reduce((b,l)=>b+l.q.length,0),0);
const ks=allKeys(),dn=ks.filter(k=>st.done[k]).length,pc=Math.round(dn/ks.length*100),nx=nextStep();
const mc=MODS.map((M,m)=>`<div class="mc lc" data-v="${nx.startsWith(m+"-")?nx:m+"-0"}"><span class="n" aria-hidden="true">0${m+1}</span><span class="tag">Módulo ${m+1}</span><h3>${M.t}</h3><p>${M.L.length} lecciones · ${hm(mins(m))}</p><div class="mp"><i style="width:${modPct(m)}%"></i></div></div>`).join("");
return `<section class="hx"><div><img class="logo-x" src="${LOGO}" alt="PREVIJOB · Servicio de Prevención"><br><span class="eyb">Formación PRL · Art. 19 Ley 31/1995</span><h2>Técnico/a de actividades físicas y entrenamiento: <em>entrena seguro</em></h2><p class="sub">Formación teórica y práctica en prevención de riesgos laborales específica de tu puesto, basada en la evaluación de riesgos del centro: cada riesgo, su valoración y sus medidas preventivas, emergencias y primeros auxilios.</p>
<div class="cta"><button class="go lc" data-v="${nx}">${dn?"Continuar curso ▶":"Empezar curso ▶"}</button><button class="go2 lc" data-v="0-3">🎯 Riesgos de tu puesto</button></div>
<div class="pbar"><small>Tu progreso: ${pc}% (${dn}/${ks.length} hitos)</small><div><i style="width:${pc}%"></i></div></div></div>${RACK}</section>
<div class="stats"><div class="stat"><b>${MODS.length}</b><span>módulos</span></div><div class="stat"><b>${nL}</b><span>lecciones</span></div><div class="stat"><b>${nQ+EXAMN}</b><span>preguntas de autoevaluación</span></div><div class="stat"><b>≈ ${hm(TOT())}</b><span>duración estimada</span></div></div>
<div class="mods">${mc}</div>`}
function home(){main.innerHTML=`<div>`+heroX()+`<div class="sech">Contenido del curso</div>`+MODS.map((M,m)=>`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><span class="tag">Módulo ${m+1} · ${hm(mins(m))}</span><h3 style="margin:.3em 0">${M.t}</h3><p style="color:var(--mut);margin:0">${M.s}</p></div><button class="btn st" data-m="${m}">${modPct(m)?"Continuar ▶":"Empezar ▶"}</button></div><div class="mp"><i style="width:${modPct(m)}%"></i></div><div class="grid">${M.L.map((l,i)=>`<div class="card lc" data-v="${m}-${i}"><div style="font-size:1.7rem">${l.ico}</div><span class="tag">Lección ${m+1}.${i+1} · ${l.min} min</span><h4>${l.t}</h4><p style="color:var(--mut);margin:0;font-size:.88rem">${l.q.length} preguntas · ${st.scores[m+"-"+i]!=null?"Nota: "+st.scores[m+"-"+i]+"/"+l.q.length:"Pendiente"}</p></div>`).join("")}<div class="card lc" data-v="${m}-final"><div style="font-size:1.7rem">🏁</div><span class="tag t2">Evaluación · ${M.fmin} min</span><h4>Test final del módulo</h4><p style="color:var(--mut);margin:0;font-size:.88rem">${FINALN} preguntas al azar · ${st.done[m+"-final"]?"Superado ✅":"Pendiente"}</p></div></div></div>`).join("")+`<div class="card lc" data-v="exam" style="border-top:3px solid var(--acc2)"><span class="tag t2">Evaluación final del curso · 20 min</span><h3 style="margin:.3em 0">🎓 Examen final y certificado</h3><p style="color:var(--mut);margin:0">${EXAMN} preguntas al azar de todo el curso (aprobado con el 70 %). ${st.exam?"Mejor nota: "+st.exam.ok+"/"+st.exam.n+(st.exam.pass?" ✅":""):"Pendiente"}</p></div><div class="card note"><b>ℹ️ Fuentes del curso.</b> Evaluación de riesgos laborales inicial del centro de entrenamiento (ref. ER001, 22/10/2026), puesto «Técnico/a de actividades físicas y entrenamiento», lugares de trabajo, equipos de trabajo y preparados químicos; Ley 31/1995 de Prevención de Riesgos Laborales (arts. 18, 19 y 29 y los citados en la evaluación). Los fragmentos de normativa que no proceden de la evaluación se marcan como <b>Texto legal</b>.</div></div></div>`;
main.querySelectorAll(".lc").forEach(c=>c.onclick=()=>go(parse(c.dataset.v)));
main.querySelectorAll(".st").forEach(b=>b.onclick=()=>{const m=+b.dataset.m,nx=MODS[m].L.findIndex((_,i)=>!st.done[m+"-"+i]);go({m,p:nx<0?"final":nx})});}
function quizHTML(qs,id){return qs.map((q,k)=>`<div class="q" data-k="${k}"><p>${k+1}. ${q[0]}</p>${q[1].map((o,j)=>`<button class="opt" data-j="${j}">${"abcd"[j]}) ${o}</button>`).join("")}<div class="fb" role="status"></div></div>`).join("")+`<div class="score" id="sc-${id}"></div>`;}
function bindQuiz(qs,id,need,onDone){let ans=0,ok=0;main.querySelectorAll(".q").forEach(el=>{const q=qs[+el.dataset.k];el.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const j=+b.dataset.j,bs=el.querySelectorAll(".opt");bs.forEach(x=>x.disabled=true);bs[q[2]].classList.add("ok");const fb=el.querySelector(".fb");
if(j===q[2]){ok++;fb.textContent="✔ ¡Correcto!";fb.style.color="var(--ok)"}else{b.classList.add("ko");fb.textContent="✘ Incorrecto. Respuesta correcta: "+q[1][q[2]];fb.style.color="var(--ko)"}
if(++ans===qs.length){const s=$("#sc-"+id);s.innerHTML=`Puntuación: ${ok}/${qs.length} ${ok>=need?"🎉 ¡Superado!":"🔁 Repasa la lección y vuelve a intentarlo."} <button id="retry-${id}">Repetir</button>`;$("#retry-"+id).onclick=()=>go(parse(st.last));onDone(ok)}})});}
function lesson(m,i){const LL=MODS[m].L,l0=LL[i],l=Object.assign({},l0,{q:l0.q.map(q=>{const o=shuffle(q[1].map((t,j)=>({t,c:j===q[2]})));return[q[0],o.map(x=>x.t),o.findIndex(x=>x.c)]})}),k=m+"-"+i,need=Math.ceil(l.q.length*.7);main.innerHTML=`<div><span class="tag">Módulo ${m+1} · Lección ${i+1} de ${LL.length}</span><h2>${l.ico} ${l.t}</h2><div class="meta"><span>⏱️ ${l.min} min</span><span>📝 ${l.q.length} preguntas</span><span>📚 ${l.src}</span></div>
<div class="card"><b>🎯 Objetivos.</b> Al terminar esta lección podrás:${UL(l.obj)}</div>
${l.b.map((b,j)=>`<details class="bl" ${j<2?"open":""}><summary>${b[0]}</summary><div>${b[1]}</div></details>`).join("")}
<div class="card key"><b>💡 Idea clave.</b> ${l.key}</div>
<div class="card"><h3>📝 Autoevaluación</h3><p style="color:var(--mut)">Necesitas ${need} aciertos de ${l.q.length} para dar la lección por superada.</p>${quizHTML(l.q,"q"+k)}</div>
<div class="pn"><button id="prev">◀ ${i?"Lección "+(m+1)+"."+i:"Portada"}</button><button class="btn" id="next">${i<LL.length-1?"Lección "+(m+1)+"."+(i+2):"Test final del módulo"} ▶</button></div></div>`;
bindQuiz(l.q,"q"+k,need,ok=>{st.scores[k]=Math.max(ok,st.scores[k]||0);if(ok>=need)st.done[k]=1;save();renderNav({m,p:i});progress()});
$("#prev").onclick=()=>go(i?{m,p:i-1}:{p:"home"});$("#next").onclick=()=>go({m,p:i<LL.length-1?i+1:"final"});bindMedia();}
function shuffle(a){for(let k=a.length-1;k>0;k--){const r=Math.floor(Math.random()*(k+1));[a[k],a[r]]=[a[r],a[k]]}return a}
function finalTest(m){const pool=shuffle(MODS[m].L.flatMap(l=>l.q.concat(l.x||[])));
const n=Math.min(FINALN,pool.length),need=Math.ceil(n*.7),k=m+"-final";
const qs=pool.slice(0,n).map(q=>{const o=shuffle(q[1].map((t,j)=>({t,c:j===q[2]})));return[q[0],o.map(x=>x.t),o.findIndex(x=>x.c)]});
main.innerHTML=`<div><div class="hero"><span class="tag" style="background:#ffffff22;color:#fff;border-color:#ffffff55">Evaluación · ${MODS[m].fmin} min</span><h2>🏁 Test final · Módulo ${m+1}: ${MODS[m].t}</h2><p>${n} preguntas al azar de un banco de ${pool.length}. Necesitas ${need} aciertos (70 %). ${st.scores[k]!=null?"Mejor nota: "+st.scores[k]+"/"+n:""}</p></div><div class="card">${quizHTML(qs,"f"+m)}</div>
<div class="pn"><button id="prev">◀ Última lección</button><button class="btn" id="next">${m<MODS.length-1?"Módulo "+(m+2):"Examen final"} ▶</button></div></div>`;
bindQuiz(qs,"f"+m,need,ok=>{st.scores[k]=Math.max(ok,st.scores[k]||0);if(ok>=need)st.done[k]=1;save();renderNav({m,p:"final"});progress()});
$("#prev").onclick=()=>go({m,p:MODS[m].L.length-1});$("#next").onclick=()=>go(m<MODS.length-1?{m:m+1,p:0}:{p:"exam"});}

function exam(){const pool=shuffle(MODS.flatMap(M=>M.L.flatMap(l=>l.q)));const n=Math.min(EXAMN,pool.length),need=Math.ceil(n*.7);
const qs=pool.slice(0,n).map(q=>{const o=shuffle(q[1].map((t,j)=>({t,c:j===q[2]})));return[q[0],o.map(x=>x.t),o.findIndex(x=>x.c)]});
main.innerHTML=`<div><div class="hero"><span class="tag" style="background:#ffffff22;color:#fff;border-color:#ffffff55">Evaluación final del curso · 20 min</span><h2>🎓 Examen final</h2><p>${n} preguntas al azar de un banco de ${pool.length}, de todos los módulos. Necesitas ${need} aciertos (70 %) para obtener el certificado. ${st.exam?"Mejor nota: "+st.exam.ok+"/"+st.exam.n:""}</p></div><div class="card">${quizHTML(qs,"ex")}</div><div class="pn"><button id="prev">◀ Portada</button><button class="btn" id="next">📜 Certificado ▶</button></div></div>`;
bindQuiz(qs,"ex",need,ok=>{const pass=ok>=need,d=new Date().toISOString().slice(0,10);if(!st.exam||ok>st.exam.ok||(pass&&!st.exam.pass))st.exam={ok,n,pass:pass||(st.exam&&st.exam.pass)||false,date:pass?d:(st.exam&&st.exam.date)||d};if(pass)st.done.exam=1;save();renderNav({p:"exam"});progress()});
$("#prev").onclick=()=>go({p:"home"});$("#next").onclick=()=>go({p:"cert"});}
function cert(){const E=st.exam,ok=E&&E.pass,mods=MODS.filter((_,m)=>modPct(m)===100).length,f=d=>d?d.split("-").reverse().join("/"):"";
main.innerHTML=`<div>${ok?"":`<div class="card alert">Para emitir el certificado debes <b>superar el examen final</b> (70 %). Se recomienda completar antes todas las lecciones. <button class="btn" id="toex">Ir al examen ▶</button></div>`}
<div class="card noprint"><label for="nm"><b>Nombre y apellidos para el certificado</b></label><br><input id="nm" value="${(st.name||"").replace(/"/g,"&quot;")}" maxlength="80" style="font:inherit;width:100%;max-width:460px;padding:8px 12px;border-radius:10px;border:1px solid var(--bd);background:var(--card);color:var(--txt);margin-top:6px"> <button class="btn" id="pr" ${ok?"":"disabled"}>🖨️ Imprimir / guardar PDF</button></div>
<div class="cert"><img src="${LOGO}" alt="PREVIJOB" style="height:56px"><h2>Certificado de formación en prevención de riesgos laborales</h2><p>Se certifica que</p><p class="cn" id="cn">${st.name||"…"}</p><p>ha realizado el curso <b>«PRL para el puesto de Técnico/a de actividades físicas y entrenamiento»</b>, formación teórica y práctica específica del puesto en cumplimiento del <b>artículo 19 de la Ley 31/1995</b> de Prevención de Riesgos Laborales, basada en la evaluación de riesgos del centro de trabajo.</p>
<div class="tbl"><table><tr><th>Duración</th><th>Módulos completados</th><th>Examen final</th><th>Fecha</th></tr><tr><td>${hm(TOT())}</td><td>${mods} de ${MODS.length}</td><td>${E?E.ok+"/"+E.n+" ("+Math.round(E.ok/E.n*100)+" %) · "+(ok?"APTO":"NO APTO"):"Pendiente"}</td><td>${ok?f(E.date):"—"}</td></tr></table></div>
<p style="font-size:.85rem;color:var(--mut)">Contenidos: ${MODS.map((M,m)=>(m+1)+". "+M.t).join(" · ")}.</p><div class="firmas"><div>Firma de la persona trabajadora</div><div>Firma y sello de la empresa</div></div></div></div>`;
const nm=$("#nm");nm.oninput=()=>{st.name=nm.value.trim();$("#cn").textContent=st.name||"…";save()};
$("#pr").onclick=()=>{if(!st.name){alert("Escribe tu nombre y apellidos.");nm.focus();return}print()};if($("#toex"))$("#toex").onclick=()=>go({p:"exam"});}
function bindMedia(){main.querySelectorAll("img.zoom").forEach(im=>im.onclick=()=>{const b=document.createElement("div");b.className="lb";b.innerHTML=`<img src="${im.src}" alt="${im.alt}"><button aria-label="Cerrar">✕</button>`;b.onclick=()=>b.remove();document.body.append(b)});}
addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".lb").forEach(b=>b.remove())});
go(parse(st.last&&st.last!=="home"?"home":"home"));
