import json,subprocess,time,urllib.request,websocket,base64,os,sys
class B:
    def __init__(s,dl):
        import random,tempfile;s.port=random.randint(20000,40000);s.prof=tempfile.mkdtemp(prefix='cdp')
        s.p=subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=%d'%s.port,'--window-size=1400,1000','--user-data-dir='+s.prof,'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                t=[x for x in json.load(urllib.request.urlopen('http://127.0.0.1:%d/json'%s.port)) if x['type']=='page'][0];break
            except Exception: time.sleep(.3)
        s.ws=websocket.create_connection(t['webSocketDebuggerUrl'],timeout=120);s.i=0;s.ev=[]
        s.c('Page.enable');s.c('Runtime.enable')
        s.c('Browser.setDownloadBehavior',behavior='allow',downloadPath=dl,eventsEnabled=True)
        s.c('Emulation.setDeviceMetricsOverride',width=1400,height=1000,deviceScaleFactor=1,mobile=False)
    def c(s,m,**p):
        s.i+=1;i=s.i;s.ws.send(json.dumps({'id':i,'method':m,'params':p}))
        while True:
            r=json.loads(s.ws.recv())
            if r.get('id')==i:
                if 'error' in r: raise Exception(r['error'])
                return r.get('result')
            s.ev.append(r)
    def go(s,u,w=3): s.c('Page.navigate',url=u);time.sleep(w)
    def js(s,e):
        r=s.c('Runtime.evaluate',expression=e,awaitPromise=True,returnByValue=True)
        if 'exceptionDetails' in r: raise Exception(json.dumps(r['exceptionDetails'])[:500])
        return r['result'].get('value')
    def wait(s,e,t=90):
        for _ in range(int(t*2)):
            try:
                if s.js(e): return True
            except Exception: pass
            time.sleep(.5)
        raise Exception('timeout '+e)
    def shot(s,f,full=False):
        p={'format':'png'}
        if full: p['captureBeyondViewport']=True
        open(f,'wb').write(base64.b64decode(s.c('Page.captureScreenshot',**p)['data']))
    def close(s):
        s.p.kill()
        import shutil;shutil.rmtree(s.prof,ignore_errors=True)
