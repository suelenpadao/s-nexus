// providers/MockProvider.js
// Provider padrão quando nenhuma IA paga está configurada (AI_PROVIDER=mock no backend, ou ausente).
// Não inventa nenhum dado — devolve os campos vazios, com confiança 0, e deixa tudo pra
// conferência manual na tela de revisão. Garante que o sistema NUNCA fica bloqueado por
// falta de chave de API.

export const MockProvider = {
  name: 'mock',

  async extract() {
    const emptyExtracted = {
      comprador: null, cpf: null, empreendimento: null, unidade: null,
      valor_total: null, entrada: null, comissao: null, percentual_comissao: null,
      corretor_identificado: null, corretor_confirmado: false,
      data_compra: null, entrega_chaves: null, indice_correcao: null,
      parcelas_mensais: { quantidade: 0, valor: 0, data_inicio: null },
      reforcos: [], observacoes: '',
    };
    const confidenceByField = Object.fromEntries(Object.keys(emptyExtracted).map(k => [k, 0]));
    return {
      extracted: emptyExtracted,
      confidenceByField,
      overallConfidence: 0,
      source: 'mock',
    };
  },
};
