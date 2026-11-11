import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './deploy-indexa.mjs';

// Qualquer tentativa acidental de usar o transporte real falha antes da rede.
let realRequests = 0;
globalThis.fetch = async () => { realRequests++; throw new Error('REDE REAL PROIBIDA NOS TESTES'); };
after(() => assert.equal(realRequests, 0, 'Os testes não podem chamar fetch real.'));

const uuid = 'cw2jnlz4m7qvaljcc6bhmdyj';
const sha = 'a'.repeat(40);
const oldTag = `sha-${'b'.repeat(40)}`;
const tag = `sha-${sha}`;
const sensitive = 'DADO-SENSIVEL-SIMULADO-NAO-IMPRIMIR';
const environment = () => ({ INDEXA_CD_ENABLED: 'true', COOLIFY_BASE_URL: 'https://coolify.example.invalid',
  COOLIFY_APP_UUID: uuid, COOLIFY_API_TOKEN: 'credencial-coolify-sintetica',
  GITHUB_TOKEN: 'credencial-github-sintetica', GITHUB_SHA: sha,
  GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'felipe57863/Indexa',
  INDEXA_PUBLIC_URL: 'http://indexa.example.invalid:8081' });
const response = (data, status = 200, headers = {}) => ({ status, headers, body: JSON.stringify(data) });

async function scenario(options = {}) {
  const calls = [], logs = [];
  let clock = 0, storedTag = oldTag, stateIndex = 0, envReads = 0, mainReads = 0;
  const lockDirectory = await mkdtemp(join(tmpdir(), 'indexa-cd-test-'));
  const env = { ...environment(), ...options.env };
  const request = async (url, init) => {
    const call = { url, ...init };
    calls.push(call);
    const intercepted = await options.intercept?.(call, calls);
    if (intercepted) return intercepted;
    if (url.startsWith('https://api.github.com/')) {
      mainReads++;
      return response({ object: { sha: options.staleAt === mainReads ? 'c'.repeat(40) : sha } });
    }
    if (url.startsWith('https://ghcr.io/token')) return response({ token: 'autorizacao-anonima-sintetica' });
    if (url.startsWith('https://ghcr.io/v2/')) return response({ schemaVersion: 2 }, 200, { 'docker-content-digest': `sha256:${'d'.repeat(64)}` });
    if (url === `${env.COOLIFY_BASE_URL}/api/v1/applications/${uuid}`) return response({ uuid, build_pack: 'dockercompose' });
    if (url.includes(`/deployments/applications/${uuid}?`)) {
      const skip = Number(new URL(url).searchParams.get('skip'));
      return response({ deployments: options.history?.(skip) ?? [] });
    }
    if (url.endsWith(`/applications/${uuid}/envs`)) {
      if (init.method === 'PATCH') {
        assert.deepEqual(JSON.parse(init.body), { key: 'INDEXA_IMAGE_TAG', value: tag, is_preview: false });
        storedTag = tag;
        return response({ key: 'INDEXA_IMAGE_TAG', value: tag, is_preview: false }, 201);
      }
      envReads++;
      return response([{ key: 'INDEXA_IMAGE_TAG', value: options.drift && envReads > 1 ? oldTag : storedTag,
        is_preview: false, is_runtime: true }]);
    }
    if (url.endsWith('/api/v1/deploy')) {
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), { uuid, force: false });
      return response({ deployments: [{ resource_uuid: uuid, deployment_uuid: 'deployment-sintetico' }] });
    }
    if (url.endsWith('/deployments/deployment-sintetico')) {
      const states = options.states ?? ['queued', 'in_progress', 'finished'];
      return response({ deployment_uuid: 'deployment-sintetico', status: states[Math.min(stateIndex++, states.length - 1)] });
    }
    if (url === `${env.INDEXA_PUBLIC_URL}/`) return { status: 200, body: '<!doctype html><app-root></app-root>' };
    if (url === `${env.INDEXA_PUBLIC_URL}/api/contatos`) return response([]);
    throw new Error('URL inesperada no simulador');
  };
  const lockPath = join(lockDirectory, `indexa-coolify-${uuid}.lock`);
  if (options.locked) await mkdir(lockPath);
  try {
    const code = await run(options.argv ?? ['--execute'], env, { request, log: message => logs.push(message),
      now: () => clock, sleep: async ms => { clock += ms; }, pollIntervalMs: 10,
      deployTimeoutMs: 20, readyTimeoutMs: 20, lockDirectory });
    const output = logs.join('\n');
    for (const hidden of [environment().COOLIFY_API_TOKEN, environment().GITHUB_TOKEN,
      'autorizacao-anonima-sintetica', sensitive, 'Authorization']) assert.ok(!output.includes(hidden), 'Saída expôs material sensível.');
    const posts = calls.filter(call => call.method === 'POST');
    assert.ok(posts.length <= 1, 'POST nunca pode ter retry automático.');
    for (const call of calls) {
      if (call.url.startsWith(env.COOLIFY_BASE_URL)) assert.equal(call.headers.Authorization, `Bearer ${env.COOLIFY_API_TOKEN}`);
      else assert.notEqual(call.headers?.Authorization, `Bearer ${env.COOLIFY_API_TOKEN}`, 'Token Coolify enviado a outro serviço.');
    }
    return { code, calls, posts, output };
  } finally {
    if (options.locked) await rmdir(lockPath);
    await rmdir(lockDirectory); // Só diretórios temporários vazios criados por este teste.
  }
}

for (const [name, argv, enabled] of [
  ['padrão sem opções', [], undefined], ['somente habilitação', [], 'true'],
  ['somente --execute', ['--execute'], undefined], ['habilitação falsa', ['--execute'], 'false'],
  ['ajuda', ['--help'], 'true'],
]) test(`${name}: nenhuma rede nem escrita`, async () => {
  const result = await scenario({ argv, env: { INDEXA_CD_ENABLED: enabled } });
  assert.equal(result.code, 0);
  assert.equal(result.calls.length, 0);
});

for (const [name, env] of [
  ['token ausente', { COOLIFY_API_TOKEN: '' }], ['GitHub token ausente', { GITHUB_TOKEN: '' }],
  ['URL ausente', { COOLIFY_BASE_URL: '' }], ['SHA curto', { GITHUB_SHA: 'abc' }],
  ['SHA com injeção', { GITHUB_SHA: 'a;echo segredo' }], ['tag divergente', { INDEXA_IMAGE_TAG: 'latest' }],
  ['outro recurso', { COOLIFY_APP_UUID: 'outro-aluno' }], ['outra branch', { GITHUB_REF: 'refs/heads/dev' }],
  ['outro repositório', { GITHUB_REPOSITORY: 'outro/aluno' }], ['URL inválida', { COOLIFY_BASE_URL: 'não-url' }],
  ['Coolify sem TLS', { COOLIFY_BASE_URL: 'http://coolify.example.invalid' }],
  ['URL com credencial', { INDEXA_PUBLIC_URL: 'http://usuario:segredo@example.invalid' }],
  ['header com quebra de linha', { COOLIFY_API_TOKEN: 'sintetico\r\ninjetado' }],
]) test(`Configuração inválida: ${name}`, async () => {
  const result = await scenario({ env });
  assert.equal(result.code, 1);
  assert.equal(result.calls.length, 0);
});

test('Opção desconhecida não inicia rede', async () => {
  const result = await scenario({ argv: ['--force'] });
  assert.equal(result.code, 1);
  assert.equal(result.calls.length, 0);
});

test('Fluxo completo queued → in_progress → finished e HTTP', async () => {
  const result = await scenario();
  assert.equal(result.code, 0);
  assert.equal(result.posts.length, 1);
  assert.match(result.output, /Estado: queued/);
  assert.match(result.output, /Estado: in_progress/);
  assert.match(result.output, /Estado: finished/);
  assert.ok(result.calls.findIndex(c => c.method === 'PATCH') > result.calls.findIndex(c => c.url.includes('indexa-backend/manifests')));
  assert.equal(result.calls.at(-1).url, 'http://indexa.example.invalid:8081/api/contatos');
});

for (const [name, match, status, data] of [
  ['frontend não publicado', c => c.url.includes('indexa-frontend/manifests'), 404, {}],
  ['backend não publicado', c => c.url.includes('indexa-backend/manifests'), 404, {}],
  ['API indisponível', c => c.url.includes('/api/v1/applications/'), 503, {}],
  ['API desativada/sem permissão', c => c.url.includes('/api/v1/applications/'), 403, { message: sensitive }],
  ['token inválido', c => c.url.includes('/api/v1/applications/'), 401, {}],
  ['variável ausente', c => c.url.endsWith('/envs'), 200, []],
  ['valor oculto', c => c.url.endsWith('/envs'), 200, [{ key: 'INDEXA_IMAGE_TAG', is_preview: false, is_runtime: true }]],
  ['falha no PATCH', c => c.method === 'PATCH', 422, { message: sensitive }],
  ['PATCH sem confirmação', c => c.method === 'PATCH', 201, {}],
  ['POST sem UUID', c => c.method === 'POST', 200, { deployments: [{ resource_uuid: uuid }] }],
  ['POST outro recurso', c => c.method === 'POST', 200, { deployments: [{ resource_uuid: 'outro', deployment_uuid: 'id' }] }],
  ['POST vazio', c => c.method === 'POST', 200, {}],
  ['POST erro de servidor', c => c.method === 'POST', 500, { message: sensitive }],
  ['POST redirect', c => c.method === 'POST', 302, {}],
  ['consulta outro deployment', c => c.url.endsWith('/deployments/deployment-sintetico'), 200, { deployment_uuid: 'outro', status: 'finished' }],
]) test(name, async () => {
  const result = await scenario({ intercept: c => match(c) ? response(data, status) : undefined });
  assert.equal(result.code, 1);
  if (!name.startsWith('POST') && !name.startsWith('consulta')) assert.equal(result.posts.length, 0, 'Falha anterior não pode solicitar deploy.');
});

for (const state of ['failed', 'cancelled-by-user', 'desconhecido']) test(`Estado ${state} reprova`, async () => {
  const result = await scenario({ states: [state] });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 1);
});

test('Timeout de acompanhamento não repete POST nem aprova HTTP', async () => {
  const result = await scenario({ states: ['queued'] });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 1);
  assert.match(result.output, /Timeout de deploy/);
  assert.ok(!result.calls.some(c => c.url.startsWith('http://indexa.')));
});

for (const phase of ['PATCH', 'POST', 'GET']) test(`Falha de rede em ${phase} é sanitizada`, async () => {
  const result = await scenario({ intercept: c => {
    if (c.method === phase && c.url.includes('/api/v1/')) throw new Error(sensitive);
  } });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, phase === 'POST' ? 1 : 0);
});

test('HTML inesperado da API interrompe antes de escrever', async () => {
  const result = await scenario({ intercept: c => c.url.includes('/api/v1/') ? { status: 200, body: sensitive } : undefined });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
});

test('Digest ausente reprova imagem e impede PATCH', async () => {
  const result = await scenario({ intercept: c => c.url.includes('/manifests/') ? response({ schemaVersion: 2 }) : undefined });
  assert.equal(result.code, 1);
  assert.ok(!result.calls.some(c => c.method === 'PATCH'));
});

for (const staleAt of [1, 2, 3]) test(`main avançou na verificação ${staleAt}: não implanta`, async () => {
  const result = await scenario({ staleAt });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
});

test('Deploy ativo na segunda página bloqueia escrita', async () => {
  const result = await scenario({ history: skip => skip === 0 ? Array.from({ length: 100 }, () => ({ status: 'finished' })) : [{ status: 'in_progress' }] });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
  assert.ok(!result.calls.some(c => c.method === 'PATCH'));
});

test('Deploy surgiu antes do POST: não duplica implantação', async () => {
  let checks = 0;
  const result = await scenario({ history: () => ++checks === 3 ? [{ status: 'queued' }] : [] });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
});

test('Trava local impede execução concorrente', async () => {
  const result = await scenario({ locked: true });
  assert.equal(result.code, 1);
  assert.equal(result.calls.length, 0);
});

test('Divergência no valor relido impede POST', async () => {
  const result = await scenario({ drift: true });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
});

test('Outro operador mudou a tag imediatamente antes do POST: interrompe', async () => {
  let reads = 0;
  const result = await scenario({ intercept: c => {
    if (c.url.endsWith('/envs') && c.method === 'GET' && ++reads === 3) {
      return response([{ key: 'INDEXA_IMAGE_TAG', value: oldTag, is_preview: false, is_runtime: true }]);
    }
  } });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
  assert.match(result.output, /Tag alterada/);
});

test('Nenhuma credencial é enviada nos GETs públicos', async () => {
  const result = await scenario();
  assert.equal(result.code, 0);
  for (const call of result.calls.filter(c => c.url.startsWith('http://indexa.'))) {
    assert.equal(call.headers, undefined);
    assert.equal(call.method, 'GET');
  }
});

test('PATCH com resposta 200 em vez de 201 não permite POST', async () => {
  const result = await scenario({ intercept: c => c.method === 'PATCH'
    ? response({ key: 'INDEXA_IMAGE_TAG', value: tag, is_preview: false }) : undefined });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 0);
});

test('POST com JSON inválido não recebe retry', async () => {
  const result = await scenario({ intercept: c => c.method === 'POST' ? { status: 200, body: sensitive } : undefined });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 1);
});

test('Segunda execução simultânea no mesmo cliente é bloqueada', async () => {
  const lockDirectory = await mkdtemp(join(tmpdir(), 'indexa-cd-concurrency-'));
  let release, started;
  const waiting = new Promise(resolve => { release = resolve; });
  const firstRequest = new Promise(resolve => { started = resolve; });
  const logs = [];
  const io = { lockDirectory, log: message => logs.push(message), request: async () => {
    started();
    await waiting;
    return response({}, 503);
  } };
  const first = run(['--execute'], environment(), io);
  try {
    await firstRequest;
    const second = await run(['--execute'], environment(), { ...io, request: async () => assert.fail('Segunda execução fez rede.') });
    assert.equal(second, 1);
    assert.ok(logs.some(message => message.includes('concorrente')));
  } finally {
    release();
    assert.equal(await first, 1);
    await rmdir(lockDirectory);
  }
});

test('Frontend temporariamente indisponível é reconsultado sem repetir deploy', async () => {
  let reads = 0;
  const result = await scenario({ intercept: c => c.url === 'http://indexa.example.invalid:8081/' && reads++ === 0 ? response({}, 503) : undefined });
  assert.equal(result.code, 0);
  assert.equal(result.posts.length, 1);
});

for (const [name, url, body] of [
  ['frontend incorreto', 'http://indexa.example.invalid:8081/', '<html>Outro site</html>'],
  ['API incorreta', 'http://indexa.example.invalid:8081/api/contatos', '{"erro":"simulado"}'],
]) test(`Deploy finished mas ${name}: reprova`, async () => {
  const result = await scenario({ intercept: c => c.url === url ? { status: 200, body } : undefined });
  assert.equal(result.code, 1);
  assert.equal(result.posts.length, 1);
  assert.match(result.output, /Validação HTTP falhou/);
});
