# Certificado de aprovechamiento (plantilla provisional)

El modelo definitivo lo aportará David. Hasta entonces, el panel y el aviso de finalizados usan una **plantilla provisional**, marcada como tal en el propio PDF, fácil de sustituir sin tocar el resto del sistema.

## Cómo sustituir la plantilla

1. Edita `src/certificado-plantilla.html` con el nuevo diseño (A4 apaisado).
2. Conserva el contenedor raíz con clase `cert` (297 mm × 210 mm) y estos marcadores:

   | Marcador | Contenido |
   |---|---|
   | `{{logo}}` | Imagen del logotipo (data-URI o URL; no escapar) |
   | `{{nombre}}` | Nombre del alumno |
   | `{{dni}}` | DNI/NIE |
   | `{{empresa}}` | Empresa |
   | `{{curso}}` | Nombre del curso |
   | `{{codigo}}` | Código del curso (p. ej. PRL-CAT) |
   | `{{horas}}` | Duración, a partir de `meta.tot` (minutos) |
   | `{{fecha_realizacion}}` | Fecha en que quedó APTO |
   | `{{nota}}` | Nota del examen final |
   | `{{contenidos_html}}` | Lista `<li>…</li>` con los títulos de las lecciones (ya escapada) |
   | `{{fecha_emision}}` | Fecha de emisión del PDF |
   | `{{lugar}}` | Lugar de emisión (hoy vacío; no se inventa una ciudad) |

   Los textos se escapan solos, salvo `{{logo}}` y `{{contenidos_html}}`.
   No pongas nombres de personas firmantes; deja un cargo genérico («Técnico/a de PRL»).
3. Regenera el panel publicado:

   ```bash
   python3 scripts/build_panel.py
   ```

   Copia `src/certificado-plantilla.html` → `panel/certificado-plantilla.html` e inyecta el logo en `panel/index.html`.
4. Commit y push. Render actualiza el panel único (`/admin/`).

La función que rellena la plantilla y genera el PDF está en `src/panel.html` (`certificado()`). Solo hace falta tocarla si cambian los datos de entrada, no el diseño.

## Cursos y envío al cliente

El fichero `certificados_destinatarios.json` indica en qué cursos está activo el certificado y a qué correo del cliente se mandará (cuando se configure). Hoy:

```json
{ "cat": "", "ofi": "" }
```

- La clave presente = curso con certificado activo (se genera `certificado.pdf` al avisar un finalizado y el botón aparece en el panel para cualquier APTO).
- El valor es el correo del cliente. Si está vacío, **no se envía** al cliente.
- El aviso a Previjob (`--marcar`) y el envío al cliente (`--marcar-cliente`) tienen estado independiente (`finalizados_correo.json` y `finalizados_cliente.json`).

El script `notificar_finalizados.sh` no manda correos; solo prepara los PDF y el JSON. El envío lo hace la rutina, cuando se le indique.
