/** Converte data da API (UTC, com ou sem "Z") em milissegundos, ou null. */
export function paraMs(valor) {
  if (!valor) return null;
  const s = String(valor).trim().replace(' ', 'T');
  if (s.startsWith('0001')) return null;
  const temFuso = /[zZ]$|[+-]\d\d:?\d\d$/.test(s);
  const ms = new Date(temFuso ? s : `${s}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** "agora", "há 12 min", "há 3 h", "há 2 d". */
export function tempoDesde(valor, agora = Date.now()) {
  const ms = paraMs(valor);
  if (ms == null) return '—';
  const min = Math.max(0, Math.floor((agora - ms) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Classe de cor pela idade: até 1 h verde, até 6 h amarelo, mais que isso vermelho. */
export function classeIdade(valor, agora = Date.now()) {
  const ms = paraMs(valor);
  if (ms == null) return 'idade idade-nada';
  const h = (agora - ms) / 3_600_000;
  if (h <= 1) return 'idade idade-ok';
  if (h <= 6) return 'idade idade-media';
  return 'idade idade-velha';
}
