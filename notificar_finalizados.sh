#!/usr/bin/env bash
# Finalizados de TODOS los cursos (taf, ofi, hbd, bar, fis, cat, lim, ofg y futuros) pendientes de avisar por correo.
# Genera en /workspace/finalizados/<curso>_<dni>_<fecha>/ los PDF con el mismo generador del panel único
# (Informe_curso_<Nombre>.pdf y, si el curso tiene firma y el alumno firmó, Entrega_informacion_<Nombre>.pdf y Revision_medica_<Nombre>.pdf).
# Si el curso está en certificados_destinatarios.json y el alumno es APTO, genera también certificado.pdf
# (plantilla provisional; ver CERTIFICADO.md) e imprime un JSON con los datos, adjuntos,
# cliente_email, certificado (ruta) y cliente_pendiente.
# NUNCA marca como notificado por sí solo ni envía correos:
#   ./notificar_finalizados.sh                   -> lista aviso a Previjob pendientes + PDF, y también
#                                                   alumnos ya avisados con cliente_pendiente (pack al cliente).
#   ./notificar_finalizados.sh --marcar <id>     -> marca <id> (p. ej. bar:Z0292897C) tras enviar el correo a Previjob
#   ./notificar_finalizados.sh --marcar-cliente <id> -> marca el envío en la API (origen automático).
#                                                   Independiente del aviso a Previjob. Si el correo está vacío, no se marca.
#                                                   El envío al cliente exige 3 PDF: certificado, entrega de información y revisión médica.
#   ./notificar_finalizados.sh --dry-run [--forzar <id>]  -> prueba; con --forzar incluye un alumno ya notificado
#   ./notificar_finalizados.sh --inicializar     -> marca como notificados todos los finalizados actuales
#   --sin-pdf                                    -> solo el JSON, sin generar PDF
# Estado: finalizados_correo.json (aviso a Previjob). El envío al cliente se marca en la API.
# Independiente de finalizados_notificados.json del aviso diario TAF (ya retirado).
set -euo pipefail
exec python3 "$(cd "$(dirname "$0")" && pwd)/scripts/notificar_finalizados.py" "$@"
