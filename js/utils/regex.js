// utils/regex.js
// Padrões e funções de baixo nível para achar campos dentro do texto do contrato.
// Usado só pelo contractParser.js — nenhuma outra parte do sistema deve importar isso direto.

export const PATTERNS = {
  cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  cnpj: /\b\d{2}\.?\d{3}\.?\d{3}\/?0001-?\d{2}\b/g,
  currency: /R\$\s?[\d.]+,\d{2}/g,
  dateBR: /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g,
  dateISO: /\b\d{4}-\d{2}-\d{2}\b/g,
  percent: /\d{1,2}(?:,\d{1,2})?\s?%/g,
};

// Converte "R$ 850.000,00" -> 850000.00
export function parseCurrencyToNumber(str) {
  if (!str) return null;
  const clean = str.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

export function findAllCurrency(text) {
  return (text.match(PATTERNS.currency) || []).map(parseCurrencyToNumber).filter(v => v !== null);
}

export function findCPF(text) {
  const m = text.match(PATTERNS.cpf);
  return m ? m[0] : null;
}

// Procura um valor logo após um rótulo, na mesma linha ou nas próximas 2 linhas
// Ex: findValueNearLabel(text, ['valor total', 'valor do imóvel']) -> "R$ 850.000,00" | null
export function findValueNearLabel(text, labels, pattern) {
  const lines = text.split(/\n+/);
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (labels.some(l => lower.includes(l))) {
      const window = lines.slice(i, i + 3).join(' ');
      const match = window.match(pattern);
      if (match) return match[0];
    }
  }
  return null;
}

export function findLineAfterLabel(text, labels) {
  const lines = text.split(/\n+/);
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const hit = labels.find(l => lower.includes(l));
    if (hit) {
      // tenta pegar o resto da própria linha depois do rótulo
      const idx = lower.indexOf(hit);
      const rest = lines[i].slice(idx + hit.length).replace(/^[:\s-]+/, '').trim();
      if (rest) return rest;
      // senão, pega a linha seguinte
      if (lines[i+1]) return lines[i+1].trim();
    }
  }
  return null;
}
