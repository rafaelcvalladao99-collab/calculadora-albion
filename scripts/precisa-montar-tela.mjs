// Usado pelo "Abrir Calculadora Albion.bat".
// Sai com código 0 se a tela (frontend/dist) precisa ser montada de novo,
// ou 1 se a versão montada já está em dia com o código.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const montada = path.join(raiz, 'frontend', 'dist', 'index.html');

if (!fs.existsSync(montada)) process.exit(0);
const dataMontagem = fs.statSync(montada).mtimeMs;

function maisNovo(caminho) {
  const info = fs.statSync(caminho);
  if (info.isDirectory()) {
    return fs.readdirSync(caminho).some((nome) => maisNovo(path.join(caminho, nome)));
  }
  return info.mtimeMs > dataMontagem;
}

const fontes = ['src', 'index.html', 'vite.config.js', 'package.json']
  .map((p) => path.join(raiz, 'frontend', p))
  .filter((p) => fs.existsSync(p));

process.exit(fontes.some(maisNovo) ? 0 : 1);
