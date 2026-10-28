const KEY="curso-prl-taf-v1";
const SK="curso-prl-taf-session",TK="curso-prl-taf-theme",RK_="curso-prl-taf-recent";
const API=location.hostname==="curso-prl-tecnico-actividad-fisica.onrender.com"?"https://curso-prl-taf-api.onrender.com":(location.protocol==="file:"?"https://curso-prl-taf-api.onrender.com":"");
const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let U=null,TOKEN=null,st={done:{},scores:{}},syncT=null,syncing=false;
async function api(p,o={}){const r=await fetch(API+p,{...o,headers:{"Content-Type":"application/json",...(TOKEN?{Authorization:"Bearer "+TOKEN}:{})}});let j={};try{j=await r.json()}catch(e){}return{ok:r.ok,status:r.status,j}}
function syncState(s){const el=document.getElementById("sync");if(!el)return;el.dataset.s=s;el.textContent={ok:"☁️ Sincronizado",wait:"⏳ Guardando…",off:"📴 Sin conexión · guardado en este dispositivo",err:"⚠️ Pendiente de sincronizar"}[s]||"";}
const save=()=>{if(!U)return;st.dirty=1;LS.set(KEY+":"+U.dni,st);clearTimeout(syncT);syncState("wait");syncT=setTimeout(sync,800)};
async function sync(){if(!U||!TOKEN||syncing)return;if(!navigator.onLine){syncState("off");return}syncing=true;try{const{dirty,...p}=st,r=await api("/api/progress",{method:"PUT",body:JSON.stringify({progress:p})});
if(r.status===401){syncing=false;expired();return}if(!r.ok)throw 0;const last=st.last;st={...r.j.progress,last};LS.set(KEY+":"+U.dni,st);syncState("ok");refreshNav()}catch(e){syncState(navigator.onLine?"err":"off")}syncing=false}
let curV={p:"home"};function refreshNav(){if(U&&nav.innerHTML){renderNav(curV);progress()}}
addEventListener("online",()=>{if(U)sync()});addEventListener("offline",()=>syncState("off"));
const $=s=>document.querySelector(s),main=$("#main"),nav=$("#nav");
let TH;const theme=t=>{TH=t;document.documentElement.dataset.theme=t;$("#theme").textContent=t==="dark"?"☀️":"🌙";LS.set(TK,t)};
theme(LS.get(TK,null)||LS.get(KEY,{}).theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));
$("#theme").onclick=()=>theme(TH==="dark"?"light":"dark");
$("#menu").onclick=()=>nav.classList.toggle("open");
const FINALN=15,EXAMN=25;
const mins=m=>MODS[m].L.reduce((a,l)=>a+l.min,0)+MODS[m].fmin;
const TOT=()=>MODS.reduce((a,_,m)=>a+mins(m),0)+20;
const hm=t=>(t>=60?Math.floor(t/60)+" h ":"")+(t%60?t%60+" min":"");
const keys=m=>MODS[m].L.map((_,i)=>m+"-"+i).concat(m+"-final");
const modPct=m=>{const ks=keys(m);return Math.round(ks.filter(k=>st.done[k]).length/ks.length*100)};
const allKeys=()=>MODS.flatMap((_,m)=>keys(m)).concat("exam");
function progress(){const ks=allKeys(),p=Math.round(ks.filter(k=>st.done[k]).length/ks.length*100);$("#bar").style.width=p+"%";$("#pct").textContent=p+"%";}
function renderNav(v){nav.innerHTML=`<a data-v="home" class="${v.p==="home"?"on":""}">🏠 Portada</a>`+MODS.map((M,m)=>`<details class="ng" ${v.m===m||v.p==="home"?"open":""}><summary>Módulo ${m+1} <small>· ${modPct(m)}% · ${hm(mins(m))}</small></summary>`+M.L.map((l,i)=>`<a data-v="${m}-${i}" class="${v.m===m&&v.p===i?"on":""}">${l.ico} ${m+1}.${i+1} ${l.t}<span class="ck">${st.done[m+"-"+i]?"✅":""}</span></a>`).join("")+`<a data-v="${m}-final" class="${v.m===m&&v.p==="final"?"on":""}">🏁 Test final del módulo<span class="ck">${st.done[m+"-final"]?"✅":""}</span></a></details>`).join("")+`<a data-v="exam" class="${v.p==="exam"?"on":""}">🎓 Examen final del curso<span class="ck">${st.exam&&st.exam.pass?"✅":""}</span></a><a data-v="cert" class="${v.p==="cert"?"on":""}">📜 Certificado</a><a data-v="account" class="${v.p==="account"?"on":""}">👤 Mi cuenta y registro</a><p style="font-size:.8rem;color:var(--mut);padding:8px">Tu progreso se guarda en tu cuenta y se sincroniza entre dispositivos. <span id="sync"></span></p>`;
nav.querySelectorAll("a").forEach(a=>a.onclick=()=>go(parse(a.dataset.v)));syncState(st.dirty?(navigator.onLine?"err":"off"):"ok");}
function parse(s){if(!s||s==="home")return{p:"home"};if(s==="exam"||s==="cert"||s==="account")return{p:s};const[m,p]=s.split("-");return{m:+m,p:p==="final"?"final":+p}}
function go(v){if(!U){auth();return}curV=v;nav.classList.remove("open");st.last=(v.p==="home"||v.p==="exam"||v.p==="cert"||v.p==="account")?v.p:v.m+"-"+v.p;save();renderNav(v);progress();
if(v.p==="home")home();else if(v.p==="exam")exam();else if(v.p==="cert")cert();else if(v.p==="account")account();else if(v.p==="final")finalTest(v.m);else lesson(v.m,v.p);main.firstElementChild.classList.add("view");scrollTo({top:0,behavior:"smooth"});}
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
<div class="card noprint">Los datos del certificado proceden de tu alta y no pueden editarse aquí. <button class="btn" id="pr" ${ok?"":"disabled"}>🖨️ Imprimir / guardar PDF</button></div>
<div class="cert"><img src="${LOGO}" alt="PREVIJOB" style="height:56px"><h2>Certificado de formación en prevención de riesgos laborales</h2><p>Se certifica que</p><p class="cn" id="cn">${esc(U.name)}</p><p>con DNI/NIE <b id="cdni">${esc(U.dni)}</b>, de la empresa <b id="cemp">${esc(U.company)}</b>, ha realizado el curso <b>«PRL para el puesto de Técnico/a de actividades físicas y entrenamiento»</b>, formación teórica y práctica específica del puesto en cumplimiento del <b>artículo 19 de la Ley 31/1995</b> de Prevención de Riesgos Laborales, basada en la evaluación de riesgos del centro de trabajo.</p>
<div class="tbl"><table><tr><th>Duración</th><th>Módulos completados</th><th>Examen final</th><th>Fecha</th></tr><tr><td>${hm(TOT())}</td><td>${mods} de ${MODS.length}</td><td>${E?E.ok+"/"+E.n+" ("+Math.round(E.ok/E.n*100)+" %) · "+(ok?"APTO":"NO APTO"):"Pendiente"}</td><td>${ok?f(E.date):"—"}</td></tr></table></div>
<p style="font-size:.85rem;color:var(--mut)">Contenidos: ${MODS.map((M,m)=>(m+1)+". "+M.t).join(" · ")}.</p><div class="firmas"><div>Firma de la persona trabajadora</div><div>Firma y sello de la empresa</div></div></div></div>`;
$("#pr").onclick=()=>print();if($("#toex"))$("#toex").onclick=()=>go({p:"exam"});}
function bindMedia(){main.querySelectorAll("img.zoom").forEach(im=>im.onclick=()=>{const b=document.createElement("div");b.className="lb";b.innerHTML=`<img src="${im.src}" alt="${im.alt}"><button aria-label="Cerrar">✕</button>`;b.onclick=()=>b.remove();document.body.append(b)});}
addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".lb").forEach(b=>b.remove())});

const LET="TRWAGMYFPDXBNJZSQVHLCKE";
function normDni(s){return String(s||"").toUpperCase().replace(/[\s.-]/g,"")}
function validDni(s){const d=normDni(s),m=d.match(/^([XYZ]|\d)(\d{7})([A-Z])$/);if(!m)return false;const n=+(("XYZ".indexOf(m[1])>=0?"XYZ".indexOf(m[1]):m[1])+m[2]);return LET[n%23]===m[3]}
const validMail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
async function setHeader(){$("#uname").textContent=U?U.name:"";$("#ubtn").hidden=!U;$("#menu").hidden=!U;document.body.classList.toggle("noauth",!U)}
function recent(){return LS.get(RK_,[])}
function remember(u){LS.set(RK_,[{dni:u.dni,name:u.name}].concat(recent().filter(x=>x.dni!==u.dni)).slice(0,6))}
function emptySt(){return{done:{},scores:{}}}
function start(user,token,prog){U=user;TOKEN=token;LS.set(SK,{token,user});remember(user);const cache=LS.get(KEY+":"+user.dni,null);
st=Object.assign(emptySt(),prog||{});if(cache&&cache.dirty){/* cambios offline pendientes: se fusionan en el servidor */const l=st.last;st=Object.assign(emptySt(),cache);st.last=cache.last||l;st.dirty=1}
LS.set(KEY+":"+user.dni,st);setHeader();go(parse(st.last||"home"));if(st.dirty)sync()}
function expired(){const d=U&&U.dni;U=null;TOKEN=null;LS.del(SK);setHeader();auth("login",d,"Tu sesión ha caducado. Vuelve a introducir tu PIN; tu progreso local se conserva.")}
function logout(){U=null;TOKEN=null;st=emptySt();LS.del(SK);setHeader();auth("login")}
const WAKE="Conectando con el servidor… si estaba en reposo puede tardar hasta 1 minuto.";
function auth(mode,pre,msg){nav.innerHTML="";const list=recent();mode=mode||(list.length?"login":"signup");
main.innerHTML=`<div class="view auth"><section class="hx ah"><div><img class="logo-x" src="${LOGO}" alt="PREVIJOB · Servicio de Prevención"><br><span class="eyb">Formación PRL · Art. 19 Ley 31/1995</span><h2>Técnico/a de actividades físicas y entrenamiento: <em>entra al curso</em></h2><p class="sub">Date de alta una sola vez con tus datos y un PIN. Tu progreso, tus notas y tu certificado quedan registrados a tu nombre y podrás continuar desde cualquier dispositivo.</p></div>${RACK}</section>
<div class="tabs" role="tablist"><button role="tab" id="tsign" aria-selected="${mode==="signup"}" class="${mode==="signup"?"btn":""}">✍️ Darme de alta</button><button role="tab" id="tlog" aria-selected="${mode==="login"}" class="${mode==="login"?"btn":""}">🔑 Acceder</button></div>
${mode==="signup"?`<form class="card af" id="fs" novalidate><h3>Alta de la persona trabajadora</h3>
<label>Nombre y apellidos *<input id="fn" autocomplete="name" maxlength="80" required></label>
<label>DNI / NIE *<input id="fd" maxlength="12" placeholder="12345678Z o X1234567L" autocapitalize="characters" required></label>
<label>Empresa *<input id="fe" autocomplete="organization" maxlength="80" required></label>
<label>Correo electrónico *<input id="fm" type="email" autocomplete="email" maxlength="100" required></label>
<label>PIN o contraseña * <small>(mínimo 4 caracteres)</small><input id="fp" type="password" autocomplete="new-password" maxlength="40" minlength="4" required></label>
<label>Repite el PIN *<input id="fp2" type="password" autocomplete="new-password" maxlength="40" required></label>
<div class="note rgpd"><b>Protección de datos.</b> Tus datos (nombre, DNI/NIE, empresa y correo) se usarán únicamente para identificarte en este curso, registrar tu progreso y tus resultados y emitir tu certificado de formación en prevención de riesgos laborales (art. 19 Ley 31/1995). Se guardan en el servidor del curso (base de datos con acceso restringido; el PIN se almacena cifrado) y una copia de tu progreso en este navegador. Tu empresa y su servicio de prevención pueden consultar tu progreso y tus resultados para acreditar la formación. Puedes descargar o eliminar tus datos desde «Mi cuenta». El responsable del tratamiento es tu empresa, ante la que puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad.</div>
<label class="chk"><input type="checkbox" id="fc"> He leído y acepto la información de protección de datos *</label>
<p class="err" id="ferr" role="alert"></p><button class="go" type="submit">Darme de alta y empezar ▶</button></form>`:
`<form class="card af" id="fl" novalidate><h3>Acceder con mi DNI/NIE y PIN</h3>${list.length?`<p style="font-size:.9rem">Recientes en este dispositivo: ${list.map(u=>`<button type="button" class="sw" data-d="${esc(u.dni)}">👤 ${esc(u.name)}</button>`).join(" ")}</p>`:""}
<label>DNI / NIE *<input id="ld" maxlength="12" autocapitalize="characters" autocomplete="username" required value="${esc(pre||"")}"></label>
<label>PIN o contraseña *<input id="lp" type="password" autocomplete="current-password" maxlength="40" required></label>
<p class="err" id="lerr" role="alert">${esc(msg||"")}</p><button class="go" type="submit">Entrar ▶</button><p style="font-size:.85rem;color:var(--mut)">¿Has olvidado tu PIN? Pide a tu empresa o al servicio de prevención que restablezca tu alta.</p></form>`}</div>`;
$("#tsign").onclick=()=>auth("signup");$("#tlog").onclick=()=>auth("login");
const busy=(f,on)=>{const b=f.querySelector("button[type=submit]");b.disabled=on};
if(mode==="signup")$("#fs").onsubmit=async ev=>{ev.preventDefault();const f=ev.target,n=$("#fn").value.trim().replace(/\s+/g," "),d=normDni($("#fd").value),c=$("#fe").value.trim(),m=$("#fm").value.trim(),p=$("#fp").value,er=$("#ferr");
const bad=[];if(n.length<5||!/\s/.test(n))bad.push("nombre y apellidos");if(!validDni(d))bad.push("DNI/NIE válido (comprueba la letra)");if(c.length<2)bad.push("empresa");if(!validMail(m))bad.push("correo válido");if(p.length<4)bad.push("PIN de al menos 4 caracteres");else if(p!==$("#fp2").value)bad.push("los dos PIN deben coincidir");if(!$("#fc").checked)bad.push("aceptar la información de protección de datos");
if(bad.length){er.textContent="Revisa: "+bad.join(", ")+".";return}
const anon=LS.get(KEY,null),old=LS.get(KEY+":"+d,null),prog=old||anon||{};
busy(f,true);er.textContent=WAKE;try{const r=await api("/api/register",{method:"POST",body:JSON.stringify({name:n,dni:d,company:c,email:m,pin:p,consent:true,progress:prog})});
if(!r.ok){er.textContent=r.j.error||"No se pudo completar el alta.";busy(f,false);return}if(anon&&!old)LS.del(KEY);LS.del(KEY+":"+d);start(r.j.user,r.j.token,r.j.progress)}catch(e){er.textContent="No hay conexión con el servidor. El alta necesita conexión a internet; inténtalo de nuevo.";busy(f,false)}};
else{main.querySelectorAll(".sw").forEach(b=>b.onclick=()=>{$("#ld").value=b.dataset.d;$("#lp").focus()});
$("#fl").onsubmit=async ev=>{ev.preventDefault();const f=ev.target,d=normDni($("#ld").value),p=$("#lp").value,er=$("#lerr");
if(!validDni(d)){er.textContent="Introduce un DNI/NIE válido.";return}if(!p){er.textContent="Introduce tu PIN.";return}
busy(f,true);er.textContent=WAKE;try{const r=await api("/api/login",{method:"POST",body:JSON.stringify({dni:d,pin:p})});
if(!r.ok){er.textContent=r.j.error||"No se pudo acceder.";busy(f,false);return}start(r.j.user,r.j.token,r.j.progress)}catch(e){er.textContent="No hay conexión con el servidor. Inténtalo de nuevo.";busy(f,false)}}}}
function account(){
main.innerHTML=`<div><div class="hero"><h2>👤 Mi cuenta</h2><p>${esc(U.name)} · ${esc(U.dni)} · ${esc(U.company)} · ${esc(U.email)}</p></div>
<div class="card"><h3>Mi registro</h3><p>Tu progreso se guarda en tu cuenta y se sincroniza entre dispositivos: puedes continuar el curso desde otro ordenador o móvil accediendo con tu DNI/NIE y tu PIN. Estado: <span id="sync2"></span></p><button class="btn" id="dl">⬇️ Descargar mi registro (JSON)</button> <button id="sn">🔄 Sincronizar ahora</button></div>
<div class="card"><h3>Sesión</h3><p><button id="nu">➕ Dar de alta a otra persona</button> <button id="sw">🔁 Cambiar de usuario</button> <button id="lo">🚪 Cerrar sesión</button></p></div>
<div class="card alert"><b>Eliminar mi cuenta.</b> Borra definitivamente tu alta, tu progreso y tus notas del servidor y de este navegador. <button id="del">Eliminar</button></div></div>`;
$("#sync2").textContent=$("#sync")?$("#sync").textContent:"";
$("#dl").onclick=download;$("#lo").onclick=logout;$("#sw").onclick=logout;$("#nu").onclick=()=>{logout();auth("signup")};$("#sn").onclick=async()=>{await sync();$("#sync2").textContent=$("#sync").textContent};
$("#del").onclick=async()=>{if(!confirm("¿Eliminar definitivamente tu cuenta, tu progreso y tus notas?"))return;const r=await api("/api/me",{method:"DELETE"}).catch(()=>({ok:false}));if(!r.ok){alert("No se pudo eliminar: necesitas conexión a internet.");return}LS.del(KEY+":"+U.dni);LS.set(RK_,recent().filter(x=>x.dni!==U.dni));logout()}}
function download(){const det=MODS.map((M,m)=>({modulo:m+1,titulo:M.t,porcentaje:modPct(m),lecciones:M.L.map((l,i)=>({leccion:(m+1)+"."+(i+1),titulo:l.t,minutos:l.min,superada:!!st.done[m+"-"+i],nota:st.scores[m+"-"+i]??null,preguntas:l.q.length})),test_modulo:{superado:!!st.done[m+"-final"],nota:st.scores[m+"-final"]??null,preguntas:FINALN}}));
const r={curso:"PRL · Técnico/a de actividades físicas y entrenamiento (art. 19 Ley 31/1995)",generado:new Date().toISOString(),usuario:{...U},duracion_horas:+(TOT()/60).toFixed(2),progreso_total:Math.round(allKeys().filter(k=>st.done[k]).length/allKeys().length*100),examen_final:st.exam||null,modulos:det};
const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:"application/json"}));a.download="registro-prl-"+U.dni+".json";document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
$("#ubtn").onclick=()=>go({p:"account"});
{const S=LS.get(SK,null);if(S&&S.token&&S.user){U=S.user;TOKEN=S.token;st=Object.assign(emptySt(),LS.get(KEY+":"+U.dni,null)||{});setHeader();go(parse(st.last||"home"));
api("/api/me").then(r=>{if(r.status===401)return expired();if(!r.ok)return;U=r.j.user;LS.set(SK,{token:TOKEN,user:U});setHeader();if(st.dirty)sync();else{const l=st.last;st=Object.assign(emptySt(),r.j.progress);st.last=l||st.last;LS.set(KEY+":"+U.dni,st);refreshNav();syncState("ok")}}).catch(()=>syncState("off"))}
else{setHeader();auth()}}
