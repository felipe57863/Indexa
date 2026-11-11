#!/usr/bin/env bash
# Inativo por padrão. Não contém credenciais nem configura o workflow.
set +x
set -euo pipefail
script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$script_dir/deploy-indexa.mjs" "$@"
