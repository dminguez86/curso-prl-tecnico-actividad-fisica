// node meta.js -> JSON con títulos y duración (usado por build.py para el panel admin)
const fs=require('fs');const T=()=>'',UL=T,OL=T,NOTE=T,ALERT=T,CASO=T,FLOW=T,V=T,RK=T,LEY=T;let s='';
for(let i=1;i<=7;i++)s+=fs.readFileSync(__dirname+'/m'+i+'.js','utf8')+'\n';
eval(s+';globalThis.MODS=[M1,M2,M3,M4,M5,M6,M7]');
const tot=MODS.reduce((a,M)=>a+M.L.reduce((b,l)=>b+l.min,0)+M.fmin,0)+20;
const lq=MODS.map(M=>M.L.map(l=>l.q.length)),fn=MODS.map(M=>Math.min(15,M.L.reduce((a,l)=>a+l.q.length+(l.x||[]).length,0))),en=Math.min(25,lq.flat().reduce((a,b)=>a+b,0));
console.log(JSON.stringify({titles:MODS.map(M=>M.t),lessons:MODS.map(M=>M.L.length),tot,lessonQ:lq,finalN:fn,examN:en}));
