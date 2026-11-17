#!/usr/bin/env bash
# Finalizados de TODOS los cursos (taf, ofi, hbd, bar, fis, cat y futuros) pendientes de avisar por correo.
# Genera en /workspace/finalizados/<curso>_<dni>_<fecha>/ los PDF con el mismo generador del panel único
# (Informe_curso_<Nombre>.pdf y, si el curso tiene firma y el alumno firmó, Entrega_informacion_<Nombre>.pdf y Revision_medica_<Nombre>.pdf).
# Si el curso está en certificados_destinatarios.json y el alumno es APTO, genera también certificado.pdf
# (plantilla provisional; ver CERTIFICADO.md) e imprime un JSON con los datos, adjuntos,
# cliente_email, certificado (ruta) y cliente_pendiente.
# NUNCA marca como notificado por sí solo ni envía correos:
#   ./notificar_finalizados.sh                   -> lista pendientes + PDF (no marca nada)
#   ./notificar_finalizados.sh --marcar <id>     -> marca <id> (p. ej. bar:Z0292897C) tras enviar el correo a Previjob
#   ./notificar_finalizados.sh --marcar-cliente <id> -> marca el envío del certificado al cliente
#                                                   (finalizados_cliente.json, independiente del aviso a Previjob).
#                                                   Si el correo del cliente está vacío, no se marca ni se debe enviar.
#   ./notificar_finalizados.sh --dry-run [--forzar <id>]  -> prueba; con --forzar incluye un alumno ya notificado
#   ./notificar_finalizados.sh --inicializar     -> marca como notificados todos los finalizados actuales
#   --sin-pdf                                    -> solo el JSON, sin generar PDF
# Estado: finalizados_correo.json (aviso a Previjob) y finalizados_cliente.json (envío al cliente).
# Independiente de finalizados_notificados.json del aviso diario TAF (ya retirado).
set -euo pipefail
exec python3 "$(cd "$(dirname "$0")" && pwd)/scripts/notificar_finalizados.py" "$@"
