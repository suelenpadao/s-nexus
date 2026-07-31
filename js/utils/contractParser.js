// utils/contractParser.js
// Recebe o TEXTO já extraído do contrato (via OCR ou camada de texto do PDF)
// e tenta identificar os campos usando regras/padrões — sem IA, sem custo.
// Cada campo vem com um "confidence" de 0 a 100 pra UI poder destacar o que precisa de conferência.

import { PATTERNS, findAllCurrency, findCPF, findValueNearLabel, findLineAfterLabel } from './regex.js';
import { parseBRDate, findAllDatesBR } from '../helpers/dateParser.js';
import { matchBrokerName, calcPercentual } from '../helpers/commission.js';

const LABELS = {
  comprador: ['comprador', 'adquirente', 'contratante', 'promissário comprador', 'cliente'],
  empreendimento: ['empreendimento', 'imóvel', 'edifício', 'residencial'],
  unidade: ['unidade', 'apartamento', 'apto', 'lote', 'sala'],
  valorTotal: ['valor total', 'valor do imóvel', 'preço total', 'valor da venda'],
  entrada: ['entrada', 'sinal', 'ato'],
  comissao: ['comissão', 'corretagem'],
  corretor: ['corretor', 'corretor responsável', 'imobiliária', 'creci'],
  entregaChaves: ['entrega das chaves', 'entrega de chaves', 'previsão de entrega'],
  indice: ['incc', 'ipca', 'igp-m', 'igpm', 'índice de correção'],
};

export function parseContractText(text) {
  const t = text || '';
  const confidence = {};
  const extracted = {};

  // Comprador
  const compradorLine = findLineAfterLabel(t, LABELS.comprador);
  extracted.comprador = cleanName(compradorLine);
  confidence.comprador = extracted.comprador ? (compradorLine.length < 60 ? 80 : 60) : 0;

  // CPF (ajuda a confirmar o comprador e a checar duplicidade)
  extracted.cpf = findCPF(t);
  if (extracted.cpf) confidence.comprador = Math.min(100, (confidence.comprador || 0) + 15);

  // Empreendimento / Unidade
  extracted.empreendimento = cleanName(findLineAfterLabel(t, LABELS.empreendimento));
  confidence.empreendimento = extracted.empreendimento ? 70 : 0;

  extracted.unidade = cleanName(findLineAfterLabel(t, LABELS.unidade));
  confidence.unidade = extracted.unidade ? 75 : 0;

  // Valores monetários — pega o maior valor perto do rótulo "valor total"
  const valorStr = findValueNearLabel(t, LABELS.valorTotal, PATTERNS.currency);
  extracted.valor_total = valorStr ? currencyToNumber(valorStr) : maxOf(findAllCurrency(t));
  confidence.valor_total = valorStr ? 90 : (extracted.valor_total ? 55 : 0);

  const entradaStr = findValueNearLabel(t, LABELS.entrada, PATTERNS.currency);
  extracted.entrada = entradaStr ? currencyToNumber(entradaStr) : null;
  confidence.entrada = entradaStr ? 85 : 0;

  const comissaoStr = findValueNearLabel(t, LABELS.comissao, PATTERNS.currency);
  extracted.comissao = comissaoStr ? currencyToNumber(comissaoStr) : null;
  confidence.comissao = comissaoStr ? 80 : 0;

  const pctStr = findValueNearLabel(t, LABELS.comissao, PATTERNS.percent);
  extracted.percentual_comissao = pctStr ? parseFloat(pctStr.replace(',', '.')) : (extracted.comissao && extracted.valor_total ? Number(calcPercentual(extracted.valor_total, extracted.comissao).toFixed(2)) : null);
  confidence.percentual_comissao = pctStr ? 85 : (extracted.percentual_comissao ? 60 : 0);

  // Corretor
  const corretorLine = findLineAfterLabel(t, LABELS.corretor);
  extracted.corretor_identificado = cleanName(corretorLine);
  const brokerMatch = matchBrokerName(extracted.corretor_identificado);
  extracted.corretor_confirmado = brokerMatch.matched;
  confidence.corretor = extracted.corretor_identificado ? brokerMatch.confidence : 0;

  // Datas
  const allDates = findAllDatesBR(t);
  extracted.data_compra = allDates[0] || null;
  confidence.data_compra = extracted.data_compra ? 65 : 0;

  extracted.entrega_chaves = findLineAfterLabel(t, LABELS.entregaChaves);
  confidence.entrega_chaves = extracted.entrega_chaves ? 70 : 0;

  extracted.indice_correcao = detectIndice(t);
  confidence.indice_correcao = extracted.indice_correcao ? 90 : 0;

  // Parcelas mensais — tenta achar "36x de R$ 5.000,00"
  const parcelaMatch = t.match(/(\d{1,3})\s*x\s*(?:de)?\s*(R\$\s?[\d.]+,\d{2})/i);
  extracted.parcelas_mensais = parcelaMatch
    ? { quantidade: parseInt(parcelaMatch[1], 10), valor: currencyToNumber(parcelaMatch[2]), data_inicio: null }
    : { quantidade: 0, valor: 0, data_inicio: null };
  confidence.parcelas_mensais = parcelaMatch ? 75 : 0;

  // Reforços — regras simples: procura por "reforço semestral/anual" perto de valor e data
  extracted.reforcos = findReforcos(t);
  confidence.reforcos = extracted.reforcos.length ? 60 : 0;

  extracted.observacoes = '';

  const overall = weightedOverall(confidence);

  return { extracted, confidenceByField: confidence, overallConfidence: overall };
}

function cleanName(s) {
  if (!s) return null;
  const v = s.replace(/^[:\-–\s]+/, '').split(/\s{2,}|\||CPF|R\$/i)[0].trim();
  return v.length > 1 && v.length < 100 ? v : null;
}

function currencyToNumber(str) {
  if (!str) return null;
  const clean = str.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function maxOf(arr) {
  return arr.length ? Math.max(...arr) : null;
}

function detectIndice(t) {
  const lower = t.toLowerCase();
  if (lower.includes('incc')) return 'INCC';
  if (lower.includes('ipca')) return 'IPCA';
  if (lower.includes('igp-m') || lower.includes('igpm')) return 'IGP-M';
  return null;
}

function findReforcos(t) {
  const reforcos = [];
  const lines = t.split(/\n+/);
  const tipoMap = { semestral: 'semestral', anual: 'anual', intermediári: 'intermediaria', intermediar: 'intermediaria' };
  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    const tipoKey = Object.keys(tipoMap).find(k => lower.includes(k) && lower.includes('reforço'));
    if (tipoKey) {
      const window = lines.slice(i, i + 2).join(' ');
      const valorMatch = window.match(PATTERNS.currency);
      const dateMatch = window.match(PATTERNS.dateBR);
      reforcos.push({
        tipo: tipoMap[tipoKey],
        valor: valorMatch ? currencyToNumber(valorMatch[0]) : 0,
        data: dateMatch ? parseBRDate(dateMatch[0]) : null,
        descricao: line.trim().slice(0, 120),
      });
    }
  });
  return reforcos;
}

// Confiança geral = média ponderada, dando mais peso pros campos que realmente importam
function weightedOverall(confidence) {
  const weights = { comprador: 3, valor_total: 3, corretor: 2, comissao: 2, data_compra: 1, empreendimento: 1, unidade: 1 };
  let sum = 0, wsum = 0;
  Object.entries(weights).forEach(([k, w]) => {
    if (confidence[k] !== undefined) { sum += (confidence[k] || 0) * w; wsum += w; }
  });
  return wsum ? Math.round(sum / wsum) : 0;
}
