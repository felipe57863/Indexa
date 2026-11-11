import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'felipe57863/Indexa';
const ORIGIN = `https://github.com/${REPOSITORY}`;
const FILE = 'compose.coolify.yaml';
const SHA = /^[a-f0-9]{40}$/;
const IMAGES = ['backend', 'frontend'].map(service => `ghcr.io/felipe57863/indexa-${service}`);
class SafeError extends Error {}
const requireValue = (value, message) => { if (!value) throw new SafeError(message); };

// Altera apenas as duas linhas de imagem. Todo o restante, inclusive H2 e rede
// implícita do Compose, permanece byte a byte como no commit da main.
export function renderCompose(template, sha) {
  requireValue(SHA.test(sha), 'SHA completo inválido.');
  requireValue((template.match(/^\s*image:/gm) ?? []).length === 2, 'Esperadas exatamente duas imagens.');
  requireValue(!/^\s*build:/m.test(template), 'Compose de produção não pode conter build.');
  let rendered = template;
  for (const image of IMAGES) {
    const escaped = image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^    image: ${escaped}:(?:\\$\\{INDEXA_IMAGE_TAG:-sha-[a-f0-9]{40}\\}|sha-[a-f0-9]{40})(\\r?)$`, 'gm');
    requireValue([...template.matchAll(pattern)].length === 1, 'Formato de imagem inesperado no Compose.');
    rendered = rendered.replace(pattern, `    image: ${image}:sha-${sha}$1`);
  }
  return rendered;
}

// Nenhuma saída de subprocesso é repassada em erro (pode conter credenciais).
function command(program, args, options = {}) {
  try {
    return execFileSync(program, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 45000, maxBuffer: 4 * 1024 * 1024, ...options });
  } catch { throw new SafeError(`Falha em ${program}; operação interrompida, reconciliar antes de repetir.`); }
}

export function promote(env, io) {
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'push', 'Exige push no GitHub Actions.');
  requireValue(env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_REF === 'refs/heads/main', 'Exige main do Indexa.');
  requireValue(SHA.test(env.GITHUB_SHA ?? ''), 'GITHUB_SHA completo inválido.');
  requireValue(/^[\x21-\x7e]{1,4096}$/.test(env.GITHUB_TOKEN ?? ''), 'GITHUB_TOKEN ausente ou inválido.');
  requireValue(env.INDEXA_SOURCE_DIR && env.INDEXA_DEPLOY_DIR, 'Diretórios source/target obrigatórios.');
  const source = io.realpath(env.INDEXA_SOURCE_DIR), target = io.realpath(env.INDEXA_DEPLOY_DIR);
  requireValue(source !== target, 'Source e target precisam ser checkouts separados.');
  const sha = env.GITHUB_SHA;
  // Header só no ambiente do processo; nunca em argumento, URL ou config persistida.
  const auth = { ...env, GIT_TERMINAL_PROMPT: '0',
    INDEXA_GIT_AUTH_HEADER: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${env.GITHUB_TOKEN}`).toString('base64')}` };
  const git = (...args) => io.command('git', args, { cwd: target });
  const remote = (...args) => io.command('git', [
    '--config-env=http.https://github.com/.extraheader=INDEXA_GIT_AUTH_HEADER', ...args,
  ], { cwd: target, env: auth });
  requireValue([ORIGIN, `${ORIGIN}.git`].includes(git('remote', 'get-url', 'origin').trim()), 'Origin diferente do Indexa.');
  requireValue(git('status', '--porcelain', '--untracked-files=all').trim() === '', 'Target contém alterações locais.');
  requireValue(git('branch', '--show-current').trim() === 'deploy', 'Target precisa estar na branch deploy.');
  requireValue(io.command('git', ['rev-parse', 'HEAD'], { cwd: source }).trim() === sha, 'Fonte diferente do SHA publicado.');
  const previous = git('rev-parse', 'HEAD').trim();
  requireValue(SHA.test(previous), 'HEAD de deploy inválido.');
  function checkRefs() {
    const output = remote('ls-remote', '--exit-code', 'origin', 'refs/heads/main', 'refs/heads/deploy');
    const refs = new Map(output.trim().split(/\r?\n/).map(line => line.split(/\s+/).reverse()));
    requireValue(refs.get('refs/heads/main') === sha, 'Execução antiga: main avançou.');
    requireValue(refs.get('refs/heads/deploy') === previous, 'Deploy ausente ou alterada por outra execução/operador.');
  }
  checkRefs();
  for (const image of IMAGES) {
    const ref = `${image}:sha-${sha}`;
    let manifest;
    try { manifest = JSON.parse(io.command('docker', ['manifest', 'inspect', ref])); }
    catch { throw new SafeError('Imagem SHA indisponível ou manifesto inválido; deploy não atualizado.'); }
    requireValue(manifest?.schemaVersion === 2 &&
      ((manifest.config && Array.isArray(manifest.layers)) || (Array.isArray(manifest.manifests) && manifest.manifests.length)),
    'Manifesto remoto inválido; deploy não atualizado.');
    io.log(`Imagem publicada confirmada: ${ref}`);
  }
  const rendered = renderCompose(io.read(join(source, FILE)), sha);
  const targetFile = join(target, FILE);
  // Mesmo uma reexecução sem diff precisa comprovar que ambas as imagens existem.
  if (io.read(targetFile) === rendered) {
    io.log('SEM ALTERAÇÕES: deploy já referencia este SHA; nenhum commit/push.');
    return 'unchanged';
  }
  io.write(targetFile, rendered);
  io.command('docker', ['compose', '-f', FILE, 'config', '--quiet'], { cwd: target });
  // Revalida imediatamente antes do commit; push normal recusa avanço concorrente.
  checkRefs();
  git('add', '--', FILE);
  requireValue(git('diff', '--cached', '--name-only').trim() === FILE, 'Índice contém arquivos fora do escopo.');
  git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', '-m', `ci: promove imagens sha-${sha} para deploy`, '--', FILE);
  checkRefs();
  // Um único push, sem force, sem retry. Não copia main nem arquivos de workflow.
  remote('push', 'origin', 'HEAD:refs/heads/deploy');
  io.log(`PROMOVIDO: sha-${sha}. Webhook e implantação ainda exigem verificação externa.`);
  return 'promoted';
}

export function run(args = [], env = process.env, io = {}) {
  const runtime = { command, read: file => readFileSync(file, 'utf8'), write: writeFileSync,
    realpath: realpathSync, log: console.log, ...io };
  try {
    requireValue(args.every(arg => ['--help', '--execute'].includes(arg)), 'Opção inválida.');
    if (args.includes('--help') || !args.includes('--execute') || env.INDEXA_GIT_CD_ENABLED !== 'true') {
      runtime.log('INATIVO: exige --execute e INDEXA_GIT_CD_ENABLED=true; não acessou rede nem Git.');
      return 0;
    }
    promote(env, runtime);
    return 0;
  } catch (error) {
    // Erros inesperados de disco/transporte também não expõem valores do ambiente.
    runtime.log(`ERRO: ${error instanceof SafeError ? error.message : 'Falha local inesperada; reconciliar antes de repetir.'}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = run(process.argv.slice(2));
}
