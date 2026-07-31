// providers/RuleBasedProvider.js
// Provider gratuito — usa apenas regras/regex sobre o texto (já extraído por OCR).
// Implementa a mesma interface que qualquer outro provider: extract({ text, file }) -> resultado padronizado.

import { parseContractText } from '../utils/contractParser.js';

export const RuleBasedProvider = {
  name: 'rule_based',

  async extract({ text }) {
    const { extracted, confidenceByField, overallConfidence } = parseContractText(text || '');
    return {
      extracted,
      confidenceByField,
      overallConfidence,
      source: 'rule_based',
    };
  },
};
