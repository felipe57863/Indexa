import { mkdir, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_UUID = 'cw2jnlz4m7qvaljcc6bhmdyj';
const REPOSITORY = 'felipe57863/Indexa';
const SHA = /^[a-f0-9]{40}$/;
const TAG = /^sha-[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const TERMINAL = ['finished', 'failed', 'cancelled-by-user'];
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };

function configuration(env) {
  for (const name of ['COOLIFY_BASE_URL', 'COOLIFY_APP_UUID', 'COOLIFY_API_TOKEN',
    'INDEXA_PUBLIC_URL', 'GITHUB_SHA', 'GITHUB_TOKEN']) {
    requireValue(typeof env[name] === 'string' && env[name].length > 0, `Configuração ausente: ${name}.`);
  }
  requireValue(SHA.test(env.GITHUB_SHA), 'GITHUB_SHA inválido: usar SHA completo, hexadecimal e minúsculo.');
  const tag = `sha-${env.GITHUB_SHA}`;
  requireValue(!env.INDEXA_IMAGE_TAG || env.INDEXA_IMAGE_TAG === tag, 'INDEXA_IMAGE_TAG não corresponde ao commit.');
  requireValue(env.COOLIFY_APP_UUID === APP_UUID, 'UUID diferente do recurso Indexa autorizado.');
  requireValue(!env.GITHUB_REPOSITORY || env.GITHUB_REPOSITORY === REPOSITORY, 'Repositório diferente do Indexa.');
  requireValue(env.GITHUB_REF === 'refs/heads/main', 'A promoção exige GITHUB_REF=refs/heads/main.');
  for (const name of ['COOLIFY_API_TOKEN', 'GITHUB_TOKEN']) {
    requireValue(/^[\x21-\x7e]{1,4096}$/.test(env[name]), `Formato inválido de ${name}.`);
  }
  let base, publicUrl;
  try { base = new URL(env.COOLIFY_BASE_URL); publicUrl = new URL(env.INDEXA_PUBLIC_URL); }
  catch { throw new SafeError('URL de configuração inválida.'); }
  for (const url of [base, publicUrl]) {
    requireValue(!url.username && !url.password && !url.search && !url.hash, 'URL não pode conter credenciais, query ou fragmento.');
  }
  requireValue(base.protocol === 'https:' && base.pathname === '/', 'COOLIFY_BASE_URL exige HTTPS e apenas a origem, sem /api/v1.');
  requireValue(['http:', 'https:'].includes(publicUrl.protocol), 'INDEXA_PUBLIC_URL exige HTTP ou HTTPS.');
  publicUrl.pathname = `${publicUrl.pathname.replace(/\/+$/, '')}/`;
  return { base: base.origin, publicUrl: publicUrl.href, sha: env.GITHUB_SHA, tag,
    token: env.COOLIFY_API_TOKEN, githubToken: env.GITHUB_TOKEN };
}

// Só este adaptador faz rede real. Testes fornecem uma função substituta.
async function request(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
}

async function deploy(config, io) {
  const apiHeaders = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' };
  async function http(url, options, label, status = 200) {
    let response;
    try { response = await io.request(url, options); }
    catch { throw new SafeError(`${label}: falha de rede ou timeout; resultado não confirmado.`); }
    const code = Number.isInteger(response?.status) ? response.status : 'inválido';
    requireValue(response?.status === status, `${label}: HTTP ${code} inesperado; verificar disponibilidade e permissões sem repetir o deploy.`);
    return response;
  }
  function json(response, label) {
    try { return JSON.parse(response.body); }
    catch { throw new SafeError(`${label}: resposta JSON inválida.`); }
  }
  async function coolify(path, method = 'GET', body, status = 200) {
    return json(await http(`${config.base}/api/v1${path}`, {
      method, headers: apiHeaders, ...(body ? { body: JSON.stringify(body) } : {}),
    }, `Coolify ${method}`, status), 'Coolify');
  }
  async function currentMain() {
    const result = json(await http(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/main`, {
      method: 'GET', headers: { Authorization: `Bearer ${config.githubToken}`, Accept: 'application/vnd.github+json' },
    }, 'Verificação da main'), 'GitHub');
    requireValue(result?.object?.sha === config.sha, 'Commit antigo ou main inesperada; promoção interrompida.');
  }
  async function idle() {
    // Paginar também o histórico antigo: nenhum queued/in_progress pode passar despercebido.
    for (let skip = 0; skip < 10000; skip += 100) {
      const result = await coolify(`/deployments/applications/${APP_UUID}?take=100&skip=${skip}`);
      requireValue(Array.isArray(result?.deployments), 'Histórico de deploys inesperado.');
      for (const entry of result.deployments) {
        requireValue(TERMINAL.includes(entry.status), 'Há implantação ativa ou estado desconhecido; aguardar e reconciliar antes de continuar.');
      }
      if (result.deployments.length < 100) return;
    }
    throw new SafeError('Histórico excedeu o limite seguro; revisar antes de promover.');
  }
  async function image(name) {
    const repository = `felipe57863/indexa-${name}`;
    const auth = json(await http(`https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
      { method: 'GET' }, `GHCR ${name}`), 'GHCR');
    requireValue(typeof auth?.token === 'string' && /^[\x21-\x7e]+$/.test(auth.token), 'GHCR: autorização anônima inesperada.');
    const response = await http(`https://ghcr.io/v2/${repository}/manifests/${config.tag}`, {
      method: 'GET', headers: { Authorization: `Bearer ${auth.token}`,
        Accept: 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' },
    }, `Imagem ${name}`);
    const manifest = json(response, 'Manifesto GHCR');
    const digest = response.headers?.['docker-content-digest'];
    requireValue(manifest?.schemaVersion === 2 && DIGEST.test(digest), 'GHCR: manifesto ou digest inesperado.');
    io.log(`${name}: ${config.tag}, ${digest}`);
  }
  async function tagValue() {
    const envs = await coolify(`/applications/${APP_UUID}/envs`);
    requireValue(Array.isArray(envs), 'Lista de variáveis inesperada.');
    const values = envs.filter(item => item.key === 'INDEXA_IMAGE_TAG' && item.is_preview === false);
    requireValue(values.length === 1, 'INDEXA_IMAGE_TAG de produção inexistente ou duplicada.');
    const variable = values[0];
    requireValue(TAG.test(variable.value) && variable.is_runtime === true,
      'INDEXA_IMAGE_TAG precisa de valor SHA legível e uso em runtime; revisar configuração/read:sensitive.');
    return variable.value;
  }

  await currentMain();
  await image('frontend');
  await image('backend');
  const application = await coolify(`/applications/${APP_UUID}`);
  requireValue(application?.uuid === APP_UUID && application.build_pack === 'dockercompose', 'Aplicação ou build pack inesperado.');
  await idle();
  const previousTag = await tagValue();
  io.log(`Versão anterior configurada: ${previousTag}. Conferir digests em execução para recuperação.`);
  await currentMain();
  await idle();
  const changed = await coolify(`/applications/${APP_UUID}/envs`, 'PATCH', {
    key: 'INDEXA_IMAGE_TAG', value: config.tag, is_preview: false,
  }, 201);
  requireValue(changed?.key === 'INDEXA_IMAGE_TAG' && changed.value === config.tag && changed.is_preview === false,
    'PATCH sem confirmação do valor esperado; não solicitar deploy.');
  requireValue(await tagValue() === config.tag, 'Valor salvo diverge da versão esperada; não solicitar deploy.');
  io.log('Tag salva. Qualquer falha posterior exige reconciliação; não há rollback automático.');
  await currentMain();
  await idle();
  requireValue(await tagValue() === config.tag, 'Tag alterada por outro operador; não solicitar deploy.');

  // Uma tentativa apenas: repetir POST após timeout pode enfileirar dois deploys.
  io.log('Solicitando um único deploy; se a resposta for incerta, consultar o histórico antes de repetir.');
  const result = await coolify('/deploy', 'POST', { uuid: APP_UUID, force: false });
  requireValue(Array.isArray(result?.deployments) && result.deployments.length === 1,
    'POST sem implantação única confirmada; resultado incerto, consultar histórico.');
  const deployment = result.deployments[0];
  requireValue(deployment.resource_uuid === APP_UUID && typeof deployment.deployment_uuid === 'string'
    && /^[a-zA-Z0-9_-]{1,128}$/.test(deployment.deployment_uuid),
    'POST sem deployment_uuid válido do Indexa; resultado incerto, consultar histórico.');
  const uuid = deployment.deployment_uuid;
  io.log(`Deployment: ${uuid}.`);
  const deadline = io.now() + io.deployTimeoutMs;
  while (true) {
    const state = await coolify(`/deployments/${uuid}`);
    requireValue(state?.deployment_uuid === uuid, 'Consulta retornou outra implantação.');
    requireValue(['queued', 'in_progress', ...TERMINAL].includes(state.status), 'Estado de deploy desconhecido.');
    io.log(`Estado: ${state.status}.`);
    requireValue(!['failed', 'cancelled-by-user'].includes(state.status), 'Deploy falhou ou foi cancelado; verificar o recurso Indexa.');
    if (state.status === 'finished') break;
    requireValue(io.now() < deadline, 'Timeout de deploy; pode continuar no servidor. Reconciliar antes de nova tentativa.');
    await io.sleep(io.pollIntervalMs);
  }

  const readyDeadline = io.now() + io.readyTimeoutMs;
  while (true) {
    try {
      const frontend = await http(config.publicUrl, { method: 'GET' }, 'Frontend');
      requireValue(/<app-root(?:\s|>)/i.test(frontend.body), 'Frontend não retornou a SPA Indexa.');
      const api = json(await http(new URL('api/contatos', config.publicUrl).href, { method: 'GET' }, 'API pública'), 'API pública');
      requireValue(Array.isArray(api), 'API pública não retornou a lista esperada.');
      break;
    } catch {
      requireValue(io.now() < readyDeadline, 'Validação HTTP falhou após o prazo; implantação não aprovada.');
      await io.sleep(io.pollIntervalMs);
    }
  }
  io.log('Deploy finished e verificações HTTP aprovadas. Confirmar digests, instância única e persistência H2 no teste assistido.');
}

// Ponto de entrada testável: o transporte é substituído, sem modo de teste que habilite rede.
export async function run(argv, env, overrides = {}) {
  const io = { request, log: message => console.log(message), sleep, now: Date.now,
    deployTimeoutMs: 600000, readyTimeoutMs: 90000, pollIntervalMs: 10000,
    lockDirectory: tmpdir(), ...overrides };
  let locked = false;
  const lockPath = join(io.lockDirectory, `indexa-coolify-${APP_UUID}.lock`);
  try {
    requireValue(argv.every(arg => ['--execute', '--help'].includes(arg)), 'Opção desconhecida; usar --help.');
    if (argv.includes('--help')) {
      io.log('Uso: bash scripts/coolify/deploy-indexa.sh [--execute]. Exige também INDEXA_CD_ENABLED=true. Sem ambas as travas, nenhuma rede é acessada.');
      return 0;
    }
    if (!argv.includes('--execute') || env.INDEXA_CD_ENABLED !== 'true') {
      io.log('INATIVO: exige --execute e INDEXA_CD_ENABLED=true; nenhuma requisição realizada.');
      return 0;
    }
    const config = configuration(env);
    try { await mkdir(lockPath); locked = true; }
    catch { throw new SafeError('Execução local concorrente ou trava pendente; reconciliar antes de continuar.'); }
    await deploy(config, io);
    return 0;
  } catch (error) {
    io.log(`ERRO: ${error instanceof SafeError ? error.message : 'Falha interna; operação interrompida sem divulgar respostas ou credenciais.'}`);
    return 1;
  } finally {
    if (locked) {
      try { await rmdir(lockPath); }
      catch { io.log('Aviso: trava local mantida; revisar antes de nova execução.'); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await run(process.argv.slice(2), process.env);
}
