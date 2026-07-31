// services/AIService.js
//
//   CRM  →  AIService.extractContract()  →  Provider (rule_based | mock | cloud)  →  resposta
//
// Nenhuma outra parte do sistema deve importar um provider diretamente ou falar com uma API de IA.
// Fluxo: OCR (texto) → RuleBasedProvider (grátis) → se confiança boa, PARA aqui.
//        Senão, complementa com CloudProvider (que por sua vez pode estar em modo mock).

import { getTextFromFile } from '../utils/ocr.js';
import { RuleBasedProvider } from '../providers/RuleBasedProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { CloudProvider } from '../providers/CloudProvider.js';

// Abaixo disso, a extração por regras sozinha não é confiável o bastante — busca complemento.
export const CONFIDENCE_THRESHOLD = 80;
// Campos que precisam estar presentes pra considerarmos a extração "suficiente" sem IA paga.
const REQUIRED_FIELDS = ['comprador', 'valor_total'];

export const AIService = {
  CONFIDENCE_THRESHOLD,

  // options.sbClient: cliente Supabase autenticado — necessário só se cair pro CloudProvider
  // options.useCloudFallback: default true; pode desligar (ex: modo 100% grátis) passando false
  async extractContract(file, options = {}) {
    const { sbClient, useCloudFallback = true } = options;
    const startedAt = Date.now();
    const t0 = performance.now();

    // 1) OCR — mesmo fluxo pra PDF e imagem
    const { text, method: ocrMethod, timeMs: ocrTimeMs } = await getTextFromFile(file);

    // 2) Extração por regras (grátis)
    const ruleResult = await RuleBasedProvider.extract({ text, file });
    const hasRequired = REQUIRED_FIELDS.every(f => ruleResult.extracted[f]);

    let final = ruleResult;
    let escalated = false;

    // 3) Se confiança baixa ou campos essenciais faltando, complementa com o provider em nuvem
    if (useCloudFallback && (!hasRequired || ruleResult.overallConfidence < CONFIDENCE_THRESHOLD)) {
      escalated = true;
      const cloudResult = sbClient
        ? await CloudProvider.extract({ file, sbClient })
        : await MockProvider.extract();
      final = mergeResults(ruleResult, cloudResult);
    }

    const totalTimeMs = Math.round(performance.now() - t0);

    final.extractionLog = {
      timestamp: new Date(startedAt).toISOString(),
      ocrMethod,
      ocrTimeMs,
      totalTimeMs,
      escalatedToCloud: escalated,
      source: final.source,
      overallConfidence: final.overallConfidence,
    };

    return final;
  },
};

// Combina os dois resultados: pra cada campo, fica com o de MAIOR confiança.
// Assim, se as regras acertaram o valor mas erraram o comprador, e a nuvem foi o
// contrário, o resultado final pega o melhor dos dois mundos.
function mergeResults(ruleResult, cloudResult) {
  const extracted = {};
  const confidenceByField = {};
  const allKeys = new Set([...Object.keys(ruleResult.extracted || {}), ...Object.keys(cloudResult.extracted || {})]);

  allKeys.forEach(key => {
    const ruleConf = ruleResult.confidenceByField?.[key] || 0;
    const cloudConf = cloudResult.confidenceByField?.[key] || 0;
    if (cloudConf >= ruleConf && cloudResult.extracted[key] !== undefined && cloudResult.extracted[key] !== null && cloudResult.extracted[key] !== '') {
      extracted[key] = cloudResult.extracted[key];
      confidenceByField[key] = cloudConf;
    } else {
      extracted[key] = ruleResult.extracted[key];
      confidenceByField[key] = ruleConf;
    }
  });

  const overall = Math.max(ruleResult.overallConfidence || 0, cloudResult.overallConfidence || 0);

  return {
    extracted,
    confidenceByField,
    overallConfidence: overall,
    source: cloudResult.error ? `${ruleResult.source}+cloud_failed` : `${ruleResult.source}+${cloudResult.source}`,
  };
}
