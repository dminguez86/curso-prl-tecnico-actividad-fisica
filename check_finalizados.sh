#!/usr/bin/env bash
# Imprime en JSON los trabajadores que han terminado el curso (examen final aprobado)
# y que aún no se habían notificado; después los añade a finalizados_notificados.json.
# Uso: ./check_finalizados.sh   (API distinta: API=https://... ./check_finalizados.sh)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
API="${API:-https://curso-prl-taf-api.onrender.com}"
PWF="$DIR/ADMIN_PASSWORD.txt"; STATE="$DIR/finalizados_notificados.json"
[ -f "$PWF" ] || { echo '{"error":"falta ADMIN_PASSWORD.txt"}' >&2; exit 1; }
[ -f "$STATE" ] || echo '[]' > "$STATE"

# Despierta el servicio (plan Free): espera hasta 90 s
deadline=$((SECONDS+90)); until curl -fs -m 15 "$API/api/health" >/dev/null 2>&1; do
  [ $SECONDS -ge $deadline ] && { echo '{"error":"el servidor no responde tras 90 s"}' >&2; exit 2; }; sleep 5; done

TOKEN=$(PWF="$PWF" python3 -c 'import json,os;print(json.dumps({"password":open(os.environ["PWF"]).read().strip()}))' \
  | curl -fsS -m 30 -X POST "$API/api/admin/login" -H 'Content-Type: application/json' --data-binary @- \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
DATA=$(curl -fsS -m 30 "$API/api/admin/finalizados" -H "Authorization: Bearer $TOKEN")

DATA="$DATA" STATE="$STATE" python3 - <<'PY'
import json,os,tempfile
st=os.environ["STATE"]
try: known=json.load(open(st))
except Exception: known=[]
ids={k["id"] for k in known}
new=[w for w in json.loads(os.environ["DATA"])["finalizados"] if w["id"] not in ids]
print(json.dumps(new,ensure_ascii=False,indent=2))
if new or not os.path.getsize(st):
    fd,tmp=tempfile.mkstemp(dir=os.path.dirname(st));os.close(fd)
    json.dump(known+new,open(tmp,"w"),ensure_ascii=False,indent=2);os.replace(tmp,st)
PY
