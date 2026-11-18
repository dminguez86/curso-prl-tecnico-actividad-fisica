#!/usr/bin/env python3
"""Finalizados de TODOS los cursos del panel único, con los PDF listos para enviar por correo.
Ver notificar_finalizados.sh para el uso. Estado propio: finalizados_correo.json (no toca finalizados_notificados.json).
El envío del certificado al cliente se marca en la API (--marcar-cliente, origen automático), no en un JSON local."""
import json,os,sys,time,re,unicodedata,tempfile,urllib.request,urllib.error,argparse,shutil
DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.join(DIR,'scripts'))
API=os.environ.get('API','https://curso-prl-taf-api.onrender.com').rstrip('/')
STATE=os.path.join(DIR,'finalizados_correo.json')
CERT_CFG=os.path.join(DIR,'certificados_destinatarios.json')
OUT=os.environ.get('OUT_DIR','/workspace/finalizados')
SIGN_FALLBACK={'ofi','fis','cat'}
def err(m,c=1): print(json.dumps({'error':m},ensure_ascii=False),file=sys.stderr);sys.exit(c)
def req(path,data=None,tok=None,timeout=40,course=None,method=None):
    h={'Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if course: h['X-Course']=course
    body=None if data is None else json.dumps(data).encode()
    m=method or ('POST' if body is not None else 'GET')
    r=urllib.request.Request(API+path,data=body,headers=h,method=m)
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
def load_state(path=STATE):
    try: return json.load(open(path))
    except Exception: return []
def save_state(st,path=STATE):
    fd,tmp=tempfile.mkstemp(dir=DIR);os.close(fd)
    json.dump(st,open(tmp,'w'),ensure_ascii=False,indent=2);os.replace(tmp,path)
def emails_of(v):
    if isinstance(v,dict): v=v.get('to') or v.get('email') or v.get('emails') or ''
    if isinstance(v,list): return [str(x).strip() for x in v if str(x).strip()]
    s=(v or '').strip() if v is not None else ''
    return [s] if s else []
def load_cert_cfg():
    """Cursos con certificado activo: claves de certificados_destinatarios.json.
    Valor = correo, lista de correos, o {to, cc}. to/emails vacío = no enviar."""
    try: j=json.load(open(CERT_CFG))
    except Exception: return {}
    if not isinstance(j,dict): return {}
    out={}
    for k,v in j.items():
        cc=emails_of(v.get('cc') or v.get('copia') or '') if isinstance(v,dict) else []
        out[k]={'emails':emails_of(v),'cc':cc}
    return out
def attach_existing(w):
    """Reutiliza los PDF ya generados en OUT_DIR (p. ej. alumno ya avisado a Previjob con envío al cliente pendiente)."""
    d=w.get('carpeta') or os.path.join(OUT,f"{w['curso']}_{w['dni']}_{w['fecha_finalizacion']}")
    if not os.path.isdir(d): return
    w['carpeta']=d
    def find(pred):
        for fn in sorted(os.listdir(d)):
            if pred(fn): return os.path.join(d,fn)
        return None
    cert=os.path.join(d,'certificado.pdf')
    if not w.get('cert_pdf') and os.path.isfile(cert): w['cert_pdf']=cert
    if not w.get('info_pdf'): w['info_pdf']=find(lambda fn: fn.startswith('Entrega_informacion_') and fn.endswith('.pdf'))
    if not w.get('med_pdf'): w['med_pdf']=find(lambda fn: fn.startswith('Revision_medica_') and fn.endswith('.pdf'))
    if not w.get('adjuntos'):
        att=[]
        inf=find(lambda fn: fn.startswith('Informe_curso_') and fn.endswith('.pdf'))
        if inf: att.append(inf)
        if w.get('info_pdf'): att.append(w['info_pdf'])
        if w.get('med_pdf'): att.append(w['med_pdf'])
        w['adjuntos']=att
def wid(w): return f"{w['curso']}:{w['dni']}"
def fetch(tok):
    F=req('/api/admin/finalizados?course=all',tok=tok)['finalizados']
    for w in F:
        w['dni']=w['id'].split(':')[-1]; w['id']=wid(w)
        w['cert_estado']=w.get('certificado') if isinstance(w.get('certificado'),dict) else None
    return F
def safe(n):
    n=unicodedata.normalize('NFKD',n).encode('ascii','ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+','_',n).strip('_') or 'alumno'
def fdmy(d): return '/'.join(reversed(d.split('-'))) if d else None

def generate(tok,items,cfg):
    """Abre el panel publicado en Chrome headless y descarga los PDF con su mismo generador."""
    from cdp import B
    tmpdl=tempfile.mkdtemp(prefix='finpdf');b=B(tmpdl)
    try:
        b.go(API+'/admin/',4)
        b.js('sessionStorage.setItem("prl-adm-token",%s);1'%json.dumps(tok))
        b.go(API+'/admin/?curso='+items[0]['curso'],4)
        b.wait('typeof CUR!=="undefined"&&typeof certificado==="function"&&document.querySelector("#panel")&&!document.querySelector("#panel").hidden&&W.length>=0&&CUR',120)
        courses=b.js('Object.fromEntries(Object.entries(CS).map(([k,v])=>[k,{name:v.name,needSign:!!v.needSign}]))') or {}
        for w in items:
            c=w['curso'];d=os.path.join(OUT,f"{c}_{w['dni']}_{w['fecha_finalizacion']}");os.makedirs(d,exist_ok=True)
            b.js('if(CUR!==%s){document.querySelector("#cur").value=%s;document.querySelector("#cur").onchange()};1'%(json.dumps(c),json.dumps(c)))
            b.wait('CUR===%s&&W.length&&W[0].course===%s'%(json.dumps(c),json.dumps(c)),90)
            row=b.js('(()=>{const x=W.find(v=>v.dni===%s);return x?{firma:x.firma,passed:!!x.passed}:null})()'%json.dumps(w['dni']))
            if not row: w['error']='no aparece en el panel';continue
            nm=safe(w['nombre']);att=[];nd=[];paths={'cert':None,'info':None,'med':None}
            jobs=[('informe','Informe_curso_%s.pdf'%nm,'informe(%s,document.createElement("button"))')]
            sign=courses.get(c,{}).get('needSign',c in SIGN_FALLBACK)
            if sign and row['firma']:
                jobs+= [('info','Entrega_informacion_%s.pdf'%nm,'docPdf(%s,"info",document.createElement("button"))'),
                        ('med','Revision_medica_%s.pdf'%nm,'docPdf(%s,"med",document.createElement("button"))')]
            else:
                why='el curso no tiene firma' if not sign else 'el alumno no ha firmado'
                nd=[{'documento':'Entrega de información','motivo':why},{'documento':'Consentimiento revisión médica','motivo':why}]
            if c in cfg and row.get('passed'):
                jobs.append(('cert','certificado.pdf','certificado(%s,document.createElement("button"))'))
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
                    dst=os.path.join(d,fn);shutil.move(os.path.join(tmpdl,got),dst)
                    if k in paths: paths[k]=dst
                    if k!='cert': att.append(dst)
                else: w.setdefault('errores',[]).append(f"{fn}: {b.js('window.__alert') or 'no se descargó'}")
            w['adjuntos']=att;w['no_disponibles']=nd;w['carpeta']=d
            w['cert_pdf']=paths['cert'];w['info_pdf']=paths['info'];w['med_pdf']=paths['med']
            if c in courses: w['curso_nombre']=courses[c]['name']
    finally: b.close();shutil.rmtree(tmpdl,ignore_errors=True)

def pack_cliente(w):
    cert,info,med=w.get('cert_pdf'),w.get('info_pdf'),w.get('med_pdf')
    if not info:
        info=next((p for p in w.get('adjuntos',[]) if os.path.basename(p).startswith('Entrega_informacion_')),None)
    if not med:
        med=next((p for p in w.get('adjuntos',[]) if os.path.basename(p).startswith('Revision_medica_')),None)
    faltan=[]
    if not cert: faltan.append('el certificado de aprovechamiento')
    if not info: faltan.append('la entrega de información firmada')
    if not med: faltan.append('el ofrecimiento firmado de la revisión médica')
    return {'certificado':cert,'entrega_informacion':info,'revision_medica':med}, faltan

def out(w,cfg,known=None):
    cid=w['curso']
    activo=cid in cfg
    emails=cfg.get(cid,{}).get('emails',[]) if activo else []
    cc=cfg.get(cid,{}).get('cc',[]) if activo else []
    pack,faltan=pack_cliente(w)
    ya=bool(w.get('cert_estado') and w['cert_estado'].get('at'))
    pendiente=bool(activo and emails and not ya and not faltan and not w.get('error'))
    d={'id':w['id'],'nombre':w['nombre'],'dni':w['dni'],'empresa':w['empresa'],'curso':w.get('curso_nombre') or w['curso'],'curso_id':w['curso'],
       'fecha_realizacion':fdmy(w['fecha_finalizacion']),'nota':(f"{w['nota']} ({w['nota_pct']} %)" if w.get('nota') and 'None' not in str(w['nota']) else None),
       'adjuntos':w.get('adjuntos',[]),'no_disponibles':w.get('no_disponibles',[]),
       'cliente_email':(emails[0] if len(emails)==1 else emails) if activo else None,
       'cliente_cc':(cc[0] if len(cc)==1 else cc) if cc else None,
       'certificado':pack['certificado'],
       'adjuntos_cliente':pack,
       'cliente_pendiente':pendiente,
       'aviso_pendiente':(w['id'] not in known) if known is not None else None,
       'certificado_estado':w.get('cert_estado')}
    if faltan and activo and not ya: d['cliente_bloqueo']='Faltan documentos para el envío al cliente: '+', '.join(faltan)+'.'
    if w.get('errores'): d['errores']=w['errores']
    if w.get('error'): d['error']=w['error']
    return d

def marcar(F,st,path,wid_,motivo,extra=None):
    w=next((x for x in F if x['id']==wid_),None)
    if not w: err('no hay ningún finalizado con id '+wid_)
    known={x['id'] for x in st}
    if wid_ in known: print(json.dumps({'marcado':wid_,'ya_estaba':True},ensure_ascii=False));return
    rec={'id':w['id'],'nombre':w['nombre'],'curso':w['curso'],'fecha_finalizacion':w['fecha_finalizacion'],'marcado':time.strftime('%Y-%m-%d %H:%M'),'motivo':motivo}
    if extra: rec.update(extra)
    st.append(rec);save_state(st,path)
    print(json.dumps({'marcado':wid_,'ya_estaba':False},ensure_ascii=False))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--dry-run',action='store_true');ap.add_argument('--marcar',metavar='ID')
    ap.add_argument('--marcar-cliente',metavar='ID',dest='marcar_cliente')
    ap.add_argument('--forzar',metavar='ID',action='append',default=[]);ap.add_argument('--inicializar',action='store_true')
    ap.add_argument('--sin-pdf',action='store_true')
    a=ap.parse_args()
    if a.forzar and not a.dry_run: err('--forzar solo se puede usar con --dry-run')
    wake();tok=login();F=fetch(tok);st=load_state();known={x['id'] for x in st}
    cfg=load_cert_cfg()
    if a.inicializar:
        new=[{'id':w['id'],'nombre':w['nombre'],'curso':w['curso'],'fecha_finalizacion':w['fecha_finalizacion'],'marcado':time.strftime('%Y-%m-%d %H:%M'),'motivo':'inicial (terminado antes de crear la rutina)'} for w in F if w['id'] not in known]
        if not a.dry_run: save_state(st+new)
        print(json.dumps({'marcados':new,'dry_run':a.dry_run},ensure_ascii=False,indent=2));return
    if a.marcar:
        marcar(F,st,STATE,a.marcar,'correo enviado');return
    if a.marcar_cliente:
        w=next((x for x in F if x['id']==a.marcar_cliente),None)
        if not w: err('no hay ningún finalizado con id '+a.marcar_cliente)
        if w['curso'] not in cfg: err('el curso %s no tiene el certificado activado'%w['curso'])
        emails=cfg[w['curso']]['emails']
        if not emails: err('el curso %s no tiene correo del cliente; no se marca el envío'%w['curso'])
        if w.get('cert_estado') and w['cert_estado'].get('at'):
            print(json.dumps({'marcado':a.marcar_cliente,'ya_estaba':True,'origen':w['cert_estado'].get('origen'),'via':'api'},ensure_ascii=False));return
        try:
            j=req('/api/admin/workers/'+w['dni']+'/certificado',{'origen':'automatico'},tok=tok,course=w['curso'])
        except urllib.error.HTTPError as e:
            err('no se pudo marcar en la API (HTTP %s)'%e.code)
        print(json.dumps({'marcado':a.marcar_cliente,'ya_estaba':bool(j.get('ya_estaba')),'via':'api','origen':'automatico','certificado':j.get('certificado')},ensure_ascii=False));return
    pend_aviso=[w for w in F if w['id'] not in known or w['id'] in a.forzar]
    for f in a.forzar:
        if not any(w['id']==f for w in F): err('no hay ningún finalizado con id '+f)
    # También los ya avisados a Previjob cuyo pack al cliente sigue pendiente (lo necesita la rutina de las 7:00).
    seen={w['id'] for w in pend_aviso}
    pend_cliente=[]
    for w in F:
        if w['id'] in seen: continue
        if w['curso'] in cfg and not (w.get('cert_estado') and w['cert_estado'].get('at')):
            pend_cliente.append(w)
    pend=pend_aviso+pend_cliente
    for w in pend: attach_existing(w)
    if pend and not a.sin_pdf:
        todo=[]
        for w in pend:
            if w['id'] not in known or w['id'] in a.forzar:
                todo.append(w);continue
            _,faltan=pack_cliente(w)
            if faltan: todo.append(w)
        if todo: generate(tok,todo,cfg)
        for w in pend: attach_existing(w)
    print(json.dumps([out(w,cfg,known) for w in pend],ensure_ascii=False,indent=2))
main()
