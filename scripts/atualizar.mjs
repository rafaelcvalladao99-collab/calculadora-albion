// Atualização automática: confere no GitHub se há versão nova e aplica.
// Chamado pelo "Abrir Calculadora Albion.bat" antes de abrir o app.
// Se não houver internet ou algo falhar, o app abre com a versão atual.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = 'rafaelcvalladao99-collab/calculadora-albion';
const RAMO = 'main';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const arquivoVersao = path.join(raiz, '.versao');

// Nunca sobrescritos: dependências instaladas, tela montada, o próprio iniciador
// (que está rodando agora) e configurações locais.
const IGNORAR = new Set([
  'node_modules',
  'dist',
  '.git',
  '.versao',
  '.env',
  'Abrir Calculadora Albion.bat',
]);

function lerVersaoAtual() {
  try {
    return fs.readFileSync(arquivoVersao, 'utf-8').trim();
  } catch {
    return '';
  }
}

async function versaoMaisNova() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${RAMO}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'calculadora-albion' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const dados = await res.json();
  return { sha: dados.sha, mensagem: String(dados.commit?.message || '').split('\n')[0] };
}

async function baixar(destino) {
  const res = await fetch(`https://codeload.github.com/${REPO}/zip/refs/heads/${RAMO}`, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Download respondeu ${res.status}`);
  fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
}

function lerSeExistir(arquivo) {
  try {
    return fs.readFileSync(arquivo, 'utf-8');
  } catch {
    return null;
  }
}

function copiar(origem, destino) {
  for (const nome of fs.readdirSync(origem)) {
    if (IGNORAR.has(nome)) continue;
    const de = path.join(origem, nome);
    const para = path.join(destino, nome);
    if (fs.statSync(de).isDirectory()) {
      fs.mkdirSync(para, { recursive: true });
      copiar(de, para);
    } else {
      fs.copyFileSync(de, para);
    }
  }
}

async function main() {
  const atual = lerVersaoAtual();
  const nova = await versaoMaisNova();
  if (nova.sha === atual) {
    console.log('  Voce ja esta na versao mais nova.');
    return;
  }

  console.log('  Versao nova encontrada. Atualizando...');
  if (nova.mensagem) console.log(`  Novidade: ${nova.mensagem}`);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'calc-albion-'));
  try {
    const zip = path.join(temp, 'versao.zip');
    await baixar(zip);
    // O Windows 10/11 já vem com o "tar", que também abre arquivos .zip.
    execFileSync('tar', ['-xf', zip, '-C', temp], { stdio: 'ignore' });
    const pasta = fs.readdirSync(temp).find((n) => fs.statSync(path.join(temp, n)).isDirectory());
    if (!pasta) throw new Error('Arquivo baixado veio vazio');
    const origem = path.join(temp, pasta);

    // Se mudou a lista de peças de alguma parte, apaga as peças antigas
    // para o iniciador instalar de novo.
    for (const parte of ['backend', 'frontend']) {
      const antes = lerSeExistir(path.join(raiz, parte, 'package.json'));
      const depois = lerSeExistir(path.join(origem, parte, 'package.json'));
      if (antes !== null && depois !== null && antes !== depois) {
        fs.rmSync(path.join(raiz, parte, 'node_modules'), { recursive: true, force: true });
        console.log(`  As pecas de "${parte}" mudaram e serao reinstaladas.`);
      }
    }

    copiar(origem, raiz);
    fs.writeFileSync(arquivoVersao, nova.sha);
    console.log('  Atualizado!');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.log(`  Nao consegui verificar atualizacoes (${err.message}). Abrindo a versao atual.`);
});
