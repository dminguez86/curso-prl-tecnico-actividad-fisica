# Certificado de aprovechamiento

Plantilla según el modelo de David Minguez Motos (PREVIJOB, S.L.), A4 vertical, en `src/certificado-plantilla.html`. Incluye su firma y sello (`src/firma-sello.png`) y el logotipo del certificado (`src/logo-certificado.png`).

## Cómo sustituir la plantilla o la firma

1. Edita `src/certificado-plantilla.html` (A4 vertical, contenedor `.cert` de 210 mm × 297 mm).
2. Conserva estos marcadores:

   | Marcador | Contenido |
   |---|---|
   | `{{logo}}` | Logotipo (data-URI) |
   | `{{firma_sello}}` | Firma y sello de David (data-URI) |
   | `{{lugar}}` | Lugar de emisión (Tarragona) |
   | `{{fecha_emision_larga}}` | «martes, 17 de noviembre de 2026» |
   | `{{nombre}}` {{dni}} | Alumno |
   | `{{empresa}}` | Razón social (si hay equivalencia en `courses/<id>-cert.json`) |
   | `{{empresa_nif_html}}` | `, con NIF …` o vacío |
   | `{{accion_formativa}}` | Título de la acción (p. ej. RIESGOS ESPECIFICOS DE TRABAJOS DE CATERING) |
   | `{{contenidos_html}}` | Párrafos `.ln` con el temario del certificado |
   | `{{horas}}` | Duración en horas (sin la «h.»; sale en el texto «de 1h.») |
   | `{{fecha_realizacion}}` | Fecha en que quedó APTO (dd/mm/aaaa) |
   | `{{firmante}}` {{cargo}} | «David Minguez Motos» / «Tecnico superior PRL» |

3. Si cambias la firma o el logo, sustituye `src/firma-sello.png` o `src/logo-certificado.png`.
4. Regenera el panel:

   ```bash
   python3 scripts/build_panel.py
   ```

5. Commit y push. Render actualiza el panel único (`/admin/`).

El temario, las horas oficiales del certificado y la equivalencia de empresa/NIF van en `courses/<id>-cert.json` (hoy está el de cátering). Si no hay fichero, se usan el nombre del curso, las lecciones y `meta.tot`.

## Envío al cliente y marca en el panel

- Destinatarios: `certificados_destinatarios.json` (correo o lista, o `{to, cc}`). Cátering: `marger2010@originalcatering.es`, copia a `d.minguez@previjob.com`. Housfy (ofi): Lorena Segura y Anna Forgàs. El JSON incluye `cliente_email` y `cliente_cc`.

- Oficinas (Housfy, `ofi`): acción «RIESGOS ESPECÍFICOS DE TRABAJOS DE OFICINA», 2 h, temario = títulos de las lecciones (`courses/ofi-cert.json`). Las 11 empresas del grupo van con su NIF; el cruce es insensible a mayúsculas y puntuación. Si la empresa del alumno no está en la tabla, `cliente_bloqueo` es `empresa sin NIF` y no se envía. El envío al cliente de Housfy queda con `enviar: false` hasta el visto bueno de David.
- El estado «certificado enviado» vive en la API (`workers.cert_at`, `workers.cert_origen`: `manual` o `automatico`). Se ve en la columna «Certificado» del panel, con filtro, y se puede marcar o desmarcar a mano (con confirmación).
- `--marcar-cliente <id>` lo graba en la API con origen `automatico`. Si ya está marcado (también a mano), no se vuelve a enviar.
- El correo al cliente debe llevar **siempre 3 PDF**: certificado generado, entrega de información firmada y ofrecimiento firmado de la revisión médica. Van en `adjuntos_cliente`. Si falta alguno, `cliente_pendiente` es `false` y aparece `cliente_bloqueo` con el motivo. `aviso_pendiente` indica si aún falta el correo a Previjob.
- El script no manda correos. Sin opciones, lista los avisos a Previjob pendientes y también a los ya avisados con `cliente_pendiente` (para que la rutina de las 7:00 pueda enviar al cliente). David autorizó el envío de cátering; Housfy sigue a la espera de datos de la acción formativa.
