import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderCompose, run } from './promover-deploy.mjs';

// Todos os comandos, escrita e realpath são simulados. Não cria repositórios,
// commits, pushes, sockets, containers nem volumes, mesmo nos casos de sucesso.
let realRequests = 0;
globalThis.fetch = async () => { realRequests++; throw new Error('REDE REAL PROIBIDA'); };
after(() => assert.equal(realRequests, 0));
const root = new URL('../../', import.meta.url);
const template = readFileSync(new URL('compose.coolify.yaml', root), 'utf8');
const workflow = readFileSync(new URL('.github/workflows/publicar-imagens.yaml', root), 'utf8');
const sha = 'a'.repeat(40), previous = 'b'.repeat(40), advanced = 'c'.repeat(40);
const source = resolve('source-sintetica'), target = resolve('deploy-sintetica');
const token = 'TOKEN-SINTETICO-NAO-IMPRIMIR';
const env = () => ({ INDEXA_GIT_CD_ENABLED: 'true', GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'felipe57863/Indexa', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha,
  GITHUB_TOKEN: token, INDEXA_SOURCE_DIR: source, INDEXA_DEPLOY_DIR: target });

function scenario(options = {}) {
  const calls = [], writes = [], logs = [];
  let refsRead = 0;
  const config = { ...env(), ...options.env };
  const io = {
    realpath: value => resolve(value),
    read: path => path === join(source, 'compose.coolify.yaml') ? (options.template ?? template) :
      (options.current ?? template),
    write: (path, content) => writes.push({ path, content, callsBeforeWrite: calls.length }),
    log: message => logs.push(message),
    command: (program, args, settings = {}) => {
      calls.push({ program, args, settings });
      const intercepted = options.intercept?.(program, args, settings, calls);
      if (intercepted !== undefined) return intercepted;
      if (program === 'git') {
        const action = args[0].startsWith('--config-env=') ? args[1] : args[0];
        if (action === 'remote') return options.origin ?? 'https://github.com/felipe57863/Indexa.git\n';
        if (action === 'status') return options.dirty ?? '';
        if (action === 'branch') return options.branch ?? 'deploy\n';
        if (action === 'rev-parse') return `${settings.cwd === source ? (options.sourceSha ?? sha) : previous}\n`;
        if (action === 'ls-remote') {
          refsRead++;
          const main = options.staleAt === refsRead ? advanced : sha;
          const deploy = options.driftAt === refsRead ? advanced : previous;
          return `${main}\trefs/heads/main\n${deploy}\trefs/heads/deploy\n`;
        }
        if (action === 'diff') return options.staged ?? 'compose.coolify.yaml\n';
        if (action === 'add' || action === '-c' || action === 'push') return '';
      }
      if (program === 'docker' && args[0] === 'manifest') return JSON.stringify({ schemaVersion: 2, config: {}, layers: [] });
      if (program === 'docker' && args[0] === 'compose') return '';
      throw new Error('Comando não previsto pelo simulador.');
    },
  };
  const code = run(options.args ?? ['--execute'], config, io);
  return { code, calls, writes, logs };
}
const pushes = result => result.calls.filter(call => call.args.includes('push'));
const commits = result => result.calls.filter(call => call.args.includes('commit'));
const manifests = result => result.calls.filter(call => call.args[0] === 'manifest');

test('renderiza ambas as imagens literais com o mesmo SHA e preserva o restante byte a byte', () => {
  for (const input of [template.replace(/\r\n/g, '\n'), template.replace(/\r?\n/g, '\r\n')]) {
    const output = renderCompose(input, sha);
    const withoutImages = value => value.replace(/^    image: [^\r\n]*/gm, '    image: PRESERVADA');
    assert.equal(withoutImages(output), withoutImages(input));
    assert.equal((output.match(new RegExp(`:sha-${sha}`, 'g')) ?? []).length, 2);
    assert.doesNotMatch(output, /INDEXA_IMAGE_TAG|latest|\sbuild:/);
    assert.match(output, /h2-data:\/data/);
    assert.match(output, /condition: service_healthy/);
    assert.equal(renderCompose(output, sha), output);
  }
});

test('preserva também redes explícitas futuras no modelo', () => {
  const input = `${template}\nnetworks:\n  default:\n    driver: bridge\n`;
  assert.ok(renderCompose(input, sha).endsWith('networks:\n  default:\n    driver: bridge\n'));
});

test('recusa SHA inválido, latest, interpolação desconhecida, imagens extras e build', () => {
  for (const value of ['main', 'latest', 'a'.repeat(7), 'A'.repeat(40), '', `${sha};echo`]) {
    assert.throws(() => renderCompose(template, value), /SHA/);
  }
  for (const input of [template.replace(/sha-[a-f0-9]{40}/g, 'latest'),
    template.replaceAll('INDEXA_IMAGE_TAG', 'OUTRA_TAG'),
    `${template}\n    image: extra:latest\n`, `${template}\n    build: .\n`,
    template.replace('indexa-backend', 'outra-imagem')]) {
    assert.throws(() => renderCompose(input, sha));
  }
});

test('travas e help não fazem sequer leitura local nem comandos', () => {
  for (const options of [{ args: [] }, { args: ['--help'] },
    { env: { INDEXA_GIT_CD_ENABLED: undefined } }, { env: { INDEXA_GIT_CD_ENABLED: 'false' } },
    { env: { INDEXA_GIT_CD_ENABLED: 'TRUE' } }]) {
    const result = scenario(options);
    assert.equal(result.code, 0);
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.writes, []);
    assert.match(result.logs.join(), /INATIVO/);
  }
  assert.equal(scenario({ args: ['--force'] }).code, 1);
});

test('fluxo simulado verifica duas imagens antes de escrever, valida Compose e faz um único push normal', () => {
  const result = scenario();
  assert.equal(result.code, 0);
  assert.equal(manifests(result).length, 2);
  assert.ok(manifests(result).every(call => call.args[2].endsWith(`:sha-${sha}`)));
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].path, join(target, 'compose.coolify.yaml'));
  assert.equal(result.writes[0].content, renderCompose(template, sha));
  const beforeWrite = result.calls.slice(0, result.writes[0].callsBeforeWrite);
  assert.equal(beforeWrite.filter(call => call.args[0] === 'manifest').length, 2);
  assert.ok(result.calls.some(call => call.program === 'docker' && call.args.join(' ') === 'compose -f compose.coolify.yaml config --quiet'));
  assert.equal(commits(result).length, 1);
  assert.equal(pushes(result).length, 1);
  assert.deepEqual(pushes(result)[0].args.slice(1), ['push', 'origin', 'HEAD:refs/heads/deploy']);
  assert.ok(result.calls.every(call => !call.args.some(arg => /--force|reset|clean|merge|rebase/.test(arg))));
  for (const call of result.calls) {
    assert.ok(!call.args.join(' ').includes(token));
    if (call.args[0].startsWith('--config-env=')) {
      assert.match(call.settings.env.INDEXA_GIT_AUTH_HEADER, /^AUTHORIZATION: basic /);
      assert.equal(call.settings.env.GIT_TERMINAL_PROMPT, '0');
    }
  }
  assert.ok(!result.logs.join().includes(token));
});

test('mesmo SHA já promovido é idempotente: verifica imagens mas não escreve nem envia evento', () => {
  const result = scenario({ current: renderCompose(template, sha) });
  assert.equal(result.code, 0);
  assert.equal(manifests(result).length, 2);
  assert.equal(result.writes.length, 0);
  assert.equal(commits(result).length, 0);
  assert.equal(pushes(result).length, 0);
  assert.match(result.logs.join(), /SEM ALTERAÇÕES/);
});

test('contextos, configuração e checkouts incorretos bloqueiam qualquer escrita/push', () => {
  for (const fields of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REPOSITORY: 'outro/repo' }, { GITHUB_REF: 'refs/heads/deploy' },
    { GITHUB_SHA: 'curto' }, { GITHUB_TOKEN: '' }, { GITHUB_TOKEN: 'valor\ninválido' },
    { INDEXA_DEPLOY_DIR: source }, { INDEXA_SOURCE_DIR: '' }]) {
    const result = scenario({ env: fields });
    assert.equal(result.code, 1, JSON.stringify(Object.keys(fields)));
    assert.equal(result.writes.length, 0);
    assert.equal(pushes(result).length, 0);
  }
  for (const fields of [{ dirty: ' M arquivo\n' }, { branch: 'main' }, { sourceSha: advanced },
    { origin: 'https://github.com/outro/repo.git' }]) {
    const result = scenario(fields);
    assert.equal(result.code, 1);
    assert.equal(result.writes.length, 0);
    assert.equal(pushes(result).length, 0);
  }
});

test('main antiga ou deploy concorrente são recusadas nas três revalidações', () => {
  for (const at of [1, 2, 3]) {
    for (const fields of [{ staleAt: at }, { driftAt: at }]) {
      const result = scenario(fields);
      assert.equal(result.code, 1);
      assert.equal(pushes(result).length, 0);
      if (at === 1) assert.equal(result.writes.length, 0);
      if (at < 3) assert.equal(commits(result).length, 0);
    }
  }
});

test('deploy remota inexistente falha sem criar branch', () => {
  const result = scenario({ intercept: (program, args) => args.includes('ls-remote') ? `${sha}\trefs/heads/main\n` : undefined });
  assert.equal(result.code, 1);
  assert.equal(result.writes.length, 0);
  assert.equal(pushes(result).length, 0);
});

test('ausência, negação, timeout ou manifesto inválido de qualquer imagem bloqueiam promoção', () => {
  for (const service of ['backend', 'frontend']) {
    for (const value of ['throw', 'não-json', '{}', 'null', '{"schemaVersion":2}', '{"schemaVersion":2,"manifests":[]}']) {
      const result = scenario({ intercept: (program, args) => {
        if (program === 'docker' && args[0] === 'manifest' && args[2].includes(service)) {
          if (value === 'throw') throw new Error(`403/timeout ${token}`);
          return value;
        }
      } });
      assert.equal(result.code, 1);
      assert.equal(result.writes.length, 0);
      assert.equal(commits(result).length, 0);
      assert.equal(pushes(result).length, 0);
      assert.ok(!result.logs.join().includes(token));
    }
  }
});

test('Compose inválido e índice com outro arquivo impedem commit/push', () => {
  for (const options of [{ staged: 'compose.coolify.yaml\nsegredo.env\n' }, {
    intercept: (program, args) => { if (program === 'docker' && args[0] === 'compose') throw new Error('config inválida'); },
  }, { template: template.replace('indexa-backend', 'outra-imagem') }]) {
    const result = scenario(options);
    assert.equal(result.code, 1);
    assert.equal(commits(result).length, 0);
    assert.equal(pushes(result).length, 0);
  }
});

test('falha de autenticação/leitura, commit e push não recebe retry nem expõe erro sensível', () => {
  for (const action of ['ls-remote', 'commit', 'push']) {
    const result = scenario({ intercept: (program, args) => {
      if (args.includes(action)) throw new Error(`erro sensível: ${token}`);
    } });
    assert.equal(result.code, 1);
    assert.equal(result.calls.filter(call => call.args.includes(action)).length, 1);
    assert.ok(!result.logs.join().includes(token));
    if (action !== 'push') assert.equal(pushes(result).length, 0);
  }
});

test('workflow mantém main como único gatilho, publicação como dependência e habilitação explícita', () => {
  assert.match(workflow, /on:\s+push:\s+branches: \[main\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|workflow_run:|branches: \[deploy\]/);
  const promotion = workflow.slice(workflow.indexOf('\n  promover-deploy:'));
  assert.match(promotion, /needs: publicar/);
  // A trava literal deve poder ser retirada na futura ativação sem quebrar o CI.
  assert.match(promotion, /if: \$\{\{ (?:false && )?github\.ref == 'refs\/heads\/main' && vars\.INDEXA_GIT_CD_ENABLED == 'true' \}\}/);
  assert.match(promotion, /contents: write\s+packages: read/);
  assert.match(promotion, /ref: \$\{\{ github.sha \}\}/);
  assert.match(promotion, /ref: deploy/);
  assert.equal((promotion.match(/persist-credentials: false/g) ?? []).length, 2);
  assert.match(workflow, /group: publicar-ghcr-main\s+cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /always\(\)|continue-on-error|COOLIFY_API_TOKEN|api\/v1|curl.*coolify/i);
  assert.equal((workflow.match(/docker push/g) ?? []).length, 4);
  assert.ok(workflow.indexOf('docker push "$BACKEND_IMAGE:latest"') < workflow.indexOf('\n  promover-deploy:'));
});
