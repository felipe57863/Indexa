#!/usr/bin/env bash
# Os testes substituem o transporte HTTP; nenhuma requisição real é permitida.
set +x
set -euo pipefail
script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node --test "$script_dir/test-deploy-indexa.mjs"
