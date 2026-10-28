# Curso PRL · Técnico/a de actividades físicas y entrenamiento

Formación PRL (art. 19 Ley 31/1995) basada en la evaluación de riesgos del puesto. Web estática de un solo archivo (index.html). Fuentes en src/ (python3 src/build.py).

## Base de datos y panel de administración (v2)

- **Curso**: https://curso-prl-tecnico-actividad-fisica.onrender.com (static site, sin cambios de URL).
- **API + panel**: servicio web Node/Express `curso-prl-taf-api` (https://curso-prl-taf-api.onrender.com), plan Free, Frankfurt. `server.js`.
- **BD**: Render Postgres Free `curso-prl-taf-db` (tablas `workers` y `progress`, creadas al arrancar).
- **Panel**: https://curso-prl-tecnico-actividad-fisica.onrender.com/admin/ (contraseña en la variable `ADMIN_PASSWORD` del servicio; nunca en el repositorio). Sin certificado: el panel muestra APTO/NO APTO.
- **Avance secuencial** (cliente y servidor): cada lección exige aprobar el test de la anterior (70 %), el test de módulo todas sus lecciones, el módulo siguiente el test del anterior y el examen final todo lo anterior. El servidor responde 409 y descarta notas fuera de orden.
- Alta con DNI/NIE único y PIN obligatorio (bcrypt); progreso fusionado en el servidor (nunca se pierde avance entre dispositivos); `localStorage` como caché y modo sin conexión.
- Variables de entorno: `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `ALLOWED_ORIGINS`, `NODE_VERSION`.
- Límites del plan gratuito: el servicio se duerme tras 15 min sin tráfico (≈1 min en despertar); **la BD Free caduca a los 30 días** (14 días de gracia para pasarla a un plan de pago; después se borra) y no tiene copias de seguridad.
- Compilar: `cd src && python3 build.py` (genera `index.html` y `admin/index.html`).

## Avisos de finalización

Endpoint (requiere token de administración):

```bash
API=https://curso-prl-taf-api.onrender.com
TOKEN=$(curl -s -X POST $API/api/admin/login -H 'Content-Type: application/json' \
  -d '{"password":"<ADMIN_PASSWORD>"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
curl -s $API/api/admin/finalizados -H "Authorization: Bearer $TOKEN"
# {"finalizados":[{"id":"<DNI>","nombre":"…","empresa":"…","nota":"23/25","nota_pct":92,"fecha_finalizacion":"2026-10-28"}]}
```

El token dura 8 h. `check_finalizados.sh` lee `ADMIN_PASSWORD.txt`, espera hasta 90 s si el servicio está dormido, imprime en JSON solo los finalizados nuevos y los añade a `finalizados_notificados.json` (no versionado).
