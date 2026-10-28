# Curso PRL · Técnico/a de actividades físicas y entrenamiento

Formación PRL (art. 19 Ley 31/1995) basada en la evaluación de riesgos del puesto. Web estática de un solo archivo (index.html). Fuentes en src/ (python3 src/build.py).

## Base de datos y panel de administración (v2)

- **Curso**: https://curso-prl-tecnico-actividad-fisica.onrender.com (static site, sin cambios de URL).
- **API + panel**: servicio web Node/Express `curso-prl-taf-api` (https://curso-prl-taf-api.onrender.com), plan Free, Frankfurt. `server.js`.
- **BD**: Render Postgres Free `curso-prl-taf-db` (tablas `workers` y `progress`, creadas al arrancar).
- **Panel**: https://curso-prl-tecnico-actividad-fisica.onrender.com/admin/ (contraseña en la variable `ADMIN_PASSWORD` del servicio; nunca en el repositorio).
- Alta con DNI/NIE único y PIN obligatorio (bcrypt); progreso fusionado en el servidor (nunca se pierde avance entre dispositivos); `localStorage` como caché y modo sin conexión.
- Variables de entorno: `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `ALLOWED_ORIGINS`, `NODE_VERSION`.
- Límites del plan gratuito: el servicio se duerme tras 15 min sin tráfico (≈1 min en despertar); **la BD Free caduca a los 30 días** (14 días de gracia para pasarla a un plan de pago; después se borra) y no tiene copias de seguridad.
- Compilar: `cd src && python3 build.py` (genera `index.html` y `admin/index.html`).
