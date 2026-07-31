// helpers/commission.js
// Identifica o corretor (você, ou outro cadastrado no futuro) e calcula a comissão.

// Variações aceitas do seu nome — ajuste aqui se cadastrar mais corretores no futuro.
export const BROKER_NAME_PATTERNS = [
  'suelen padão', 'suelen padao',
  'suelen rodrigues padão', 'suelen rodrigues padao',
  'p. suelen padão', 'p suelen padão', 'p. suelen padao',
  'suelen padão imóveis', 'suelen padao imoveis',
  'padão imóveis', 'padao imoveis',
];

function stripAccents(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Retorna { matched: bool, confidence: 0-100 } em vez de só true/false —
// permite à UI mostrar "89% de confiança" em vez de um sim/não seco.
export function matchBrokerName(nameFound) {
  if (!nameFound) return { matched: false, confidence: 0 };
  const n = stripAccents(nameFound);
  const exact = BROKER_NAME_PATTERNS.some(p => n === stripAccents(p));
  if (exact) return { matched: true, confidence: 98 };
  const partial = BROKER_NAME_PATTERNS.some(p => n.includes(stripAccents(p)) || stripAccents(p).includes(n));
  if (partial) return { matched: true, confidence: 82 };
  // Só o primeiro nome bate ("Suelen" aparece mas o resto diverge)
  if (n.includes('suelen')) return { matched: true, confidence: 55 };
  return { matched: false, confidence: 0 };
}

export function calcCommission(valorTotal, percentual) {
  const v = Number(valorTotal) || 0;
  const p = Number(percentual) || 0;
  if (!v || !p) return 0;
  return v * (p / 100);
}

export function calcPercentual(valorTotal, comissao) {
  const v = Number(valorTotal) || 0;
  const c = Number(comissao) || 0;
  if (!v || !c) return 0;
  return (c / v) * 100;
}
