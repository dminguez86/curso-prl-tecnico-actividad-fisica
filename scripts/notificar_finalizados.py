#!/usr/bin/env python3
"""Finalizados de TODOS los cursos del panel único, con los PDF listos para enviar por correo.
Ver notificar_finalizados.sh para el uso. Estado propio: finalizados_correo.json (no toca finalizados_notificados.json)."""
import json,os,sys,time,re,unicodedata,tempfile,urllib.request,urllib.error,argparse,shutil
DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.join(DIR,'scripts'))
API=os.environ.get('API','https://curso-prl-taf-api.onrender.com').rstrip('/')
STATE=os.path.join(DIR,'finalizados_correo.json')
OUT=os.environ.get('OUT_DIR','/workspace/finalizados')
SIGN_FALLBACK={'ofi','fis','cat'}
def err(m,c=1): print(json.dumps({'error':m},ensure_ascii=False),file=sys.stderr);sys.exit(c)
def req(path,data=None,tok=None,timeout=40):
    h={'Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=urllib.request.Request(API+path,data=json.dumps(data).encode() if data is not None else None,headers=h)
    return json.load(urllib.request.urlopen(r,timeout=timeout))
def wake():
    t=time.time()+120
    while True:
        try: req('/api/health',timeout=15);return
        except Exception:
            if time.time()>t: err('el servidor no responde tras 120 s',2)
            time.sleep(5)
TOKF=os.path.join(DIR,'.admin_token')
def login():
    # El login de administración está limitado a 5 intentos/15 min: se reutiliza el token (válido 8 h) entre ejecuciones
    try:
        if time.time()-os.path.getmtime(TOKF)<7*3600:
            t=open(TOKF).read().strip();req('/api/admin/courses',tok=t);return t
    except Exception: pass
    pwf=os.path.join(DIR,'ADMIN_PASSWORD.txt')
    if not os.path.exists(pwf): err('falta ADMIN_PASSWORD.txt')
    try: t=req('/api/admin/login',{'password':open(pwf).read().strip()})['token']
    except urllib.error.HTTPError as e:
        err('demasiados intentos de login en la API (límite 5 cada 15 min); reintenta más tarde' if e.code==429 else f'login de administración fallido (HTTP {e.code})',3)
    fd=os.open(TOKF,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600);os.write(fd,t.encode());os.close(fd);return t
def load_state():
    try: return json.load(open(STATE))
    except Exception: return []
def save_state(st):
    fd,tmp=tempfile.mkstemp(dir=DIR);os.close(fd)
    json.dump(st,open(tmp,'w'),ensure_ascii=False,indent=2);os.replace(tmp,STATE)
def wid(w): return f"{w['curso']}:{w['dni']}"
def fetch(tok):
    F=req('/api/admin/finalizados?course=all',tok=tok)['finalizados']
    for w in F: w['dni']=w['id'].split(':')[-1]; w['id']=wid(w)
    return F
def safe(n):
    n=unicodedata.normalize('NFKD',n).encode('ascii','ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+','_',n).strip('_') or 'alumno'
def fdmy(d): return '/'.join(reversed(d.split('-'))) if d else None

def generate(tok,items):
    """Abre el panel publicado en Chrome headless y descarga los PDF con su mismo generador."""
    from cdp import B
    tmpdl=tempfile.mkdtemp(prefix='finpdf');b=B(tmpdl)
    try:
        b.go(API+'/admin/',4)
        b.js('sessionStorage.setItem("prl-adm-token",%s);1'%json.dumps(tok))
        b.go(API+'/admin/?curso='+items[0]['curso'],4)
        b.wait('typeof CUR!=="undefined"&&document.querySelector("#panel")&&!document.querySelector("#panel").hidden&&W.length>=0&&CUR',120)
        courses=b.js('Object.fromEntries(Object.entries(CS).map(([k,v])=>[k,{name:v.name,needSign:!!v.needSign}]))') or {}
        for w in items:
            c=w['curso'];d=os.path.join(OUT,f"{c}_{w['dni']}_{w['fecha_finalizacion']}");os.makedirs(d,exist_ok=True)
            b.js('if(CUR!==%s){document.querySelector("#cur").value=%s;document.querySelector("#cur").onchange()};1'%(json.dumps(c),json.dumps(c)))
            b.wait('CUR===%s&&W.length&&W[0].course===%s'%(json.dumps(c),json.dumps(c)),90)
            row=b.js('(()=>{const x=W.find(v=>v.dni===%s);return x?{firma:x.firma}:null})()'%json.dumps(w['dni']))
            if not row: w['error']='no aparece en el panel';continue
            nm=safe(w['nombre']);att=[];nd=[]
            jobs=[('informe','Informe_curso_%s.pdf'%nm,'informe(%s,document.createElement("button"))')]
            sign=courses.get(c,{}).get('needSign',c in SIGN_FALLBACK)
            if sign and row['firma']:
                jobs+= [('info','Entrega_informacion_%s.pdf'%nm,'docPdf(%s,"info",document.createElement("button"))'),
                        ('med','Revision_medica_%s.pdf'%nm,'docPdf(%s,"med",document.createElement("button"))')]
            else:
                why='el curso no tiene firma' if not sign else 'el alumno no ha firmado'
                nd=[{'documento':'Entrega de información','motivo':why},{'documento':'Consentimiento revisión médica','motivo':why}]
            for k,fn,call in jobs:
                for f in os.listdir(tmpdl): os.remove(os.path.join(tmpdl,f))
                b.js('window.__alert=null;window.alert=m=>{window.__alert=String(m)};'+call%json.dumps(w['dni'])+';1')
                got=None
                for _ in range(240):
                    fs=[f for f in os.listdir(tmpdl) if f.endswith('.pdf')]
                    if fs and not any(f.endswith('.crdownload') for f in os.listdir(tmpdl)):
                        time.sleep(.5);got=fs[0];break
                    a=b.js('window.__alert')
                    if a: break
                    time.sleep(.5)
                if got:
                    dst=os.path.join(d,fn);shutil.move(os.path.join(tmpdl,got),dst);att.append(dst)
                else: w.setdefault('errores',[]).append(f"{fn}: {b.js('window.__alert') or 'no se descargó'}")
            w['adjuntos']=att;w['no_disponibles']=nd;w['carpeta']=d
            if c in courses: w['curso_nombre']=courses[c]['name']
    finally: b.close();shutil.rmtree(tmpdl,ignore_errors=True)

def out(w):
    return {'id':w['id'],'nombre':w['nombre'],'dni':w['dni'],'empresa':w['empresa'],'curso':w.get('curso_nombre') or w['curso'],'curso_id':w['curso'],
            'fecha_realizacion':fdmy(w['fecha_finalizacion']),'nota':(f"{w['nota']} ({w['nota_pct']} %)" if w.get('nota') and 'None' not in w['nota'] else None),
            'adjuntos':w.get('adjuntos',[]),'no_disponibles':w.get('no_disponibles',[]),**({'errores':w['errores']} if w.get('errores') else {}),**({'error':w['error']} if w.get('error') else {})}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--dry-run',action='store_true');ap.add_argument('--marcar',metavar='ID')
    ap.add_argument('--forzar',metavar='ID',action='append',default=[]);ap.add_argument('--inicializar',action='store_true')
    ap.add_argument('--sin-pdf',action='store_true')
    a=ap.parse_args()
    if a.forzar and not a.dry_run: err('--forzar solo se puede usar con --dry-run')
    wake();tok=login();F=fetch(tok);st=load_state();known={x['id'] for x in st}
    if a.inicializar:
        new=[{'id':w['id'],'nombre':w['nombre'],'curso':w['curso'],'fecha_finalizacion':w['fecha_finalizacion'],'marcado':time.strftime('%Y-%m-%d %H:%M'),'motivo':'inicial (terminado antes de crear la rutina)'} for w in F if w['id'] not in known]
        if not a.dry_run: save_state(st+new)
        print(json.dumps({'marcados':new,'dry_run':a.dry_run},ensure_ascii=False,indent=2));return
    if a.marcar:
        w=next((x for x in F if x['id']==a.marcar),None)
        if not w: err('no hay ningún finalizado con id '+a.marcar)
        if a.marcar in known: print(json.dumps({'marcado':a.marcar,'ya_estaba':True},ensure_ascii=False));return
        st.append({'id':w['id'],'nombre':w['nombre'],'curso':w['curso'],'fecha_finalizacion':w['fecha_finalizacion'],'marcado':time.strftime('%Y-%m-%d %H:%M'),'motivo':'correo enviado'})
        save_state(st);print(json.dumps({'marcado':a.marcar,'ya_estaba':False},ensure_ascii=False));return
    pend=[w for w in F if w['id'] not in known or w['id'] in a.forzar]
    for f in a.forzar:
        if not any(w['id']==f for w in F): err('no hay ningún finalizado con id '+f)
    if pend and not a.sin_pdf: generate(tok,pend)
    print(json.dumps([out(w) for w in pend],ensure_ascii=False,indent=2))
main()
