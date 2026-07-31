// providers/CloudProvider.js
// Único ponto do sistema que fala com um backend externo — e mesmo assim, indiretamente:
// chama a Edge Function 'ai-extract' no Supabase, que decide (via configuração no servidor)
// qual IA paga usar (Anthropic, OpenAI, Gemini, DeepSeek...) e guarda as chaves em segredo.
// Nenhuma tela do CRM, nenhum outro arquivo, chama uma API de IA diretamente.

export const CloudProvider = {
  name: 'cloud',

  // sbClient = cliente Supabase já autenticado (window.sb no app principal)
  async extract({ file, sbClient }) {
    if (!sbClient) return failResult('Cliente Supabase indisponível');

    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      const { data: { session } } = await sbClient.auth.getSession();
      const { data, error } = await sbClient.functions.invoke('ai-extract', {
        body: { base64, mediaType },
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });

      if (error) return failResult(error.message || 'Erro ao chamar a IA');
      if (data?.error) return failResult(data.error);

      const extracted = data?.extracted || {};
      // A IA em nuvem normalmente acerta o que retorna com boa confiança — assumimos 90%
      // pros campos que ela de fato preencheu, e 0 pros que ficaram vazios.
      const confidenceByField = {};
      Object.keys(extracted).forEach(k => {
        const v = extracted[k];
        const filled = Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && v !== '' && v !== 0);
        confidenceByField[k] = filled ? 90 : 0;
      });

      return {
        extracted,
        confidenceByField,
        overallConfidence: data?.providerUsed === 'mock' ? 0 : 88,
        source: data?.providerUsed || 'cloud',
      };
    } catch (e) {
      return failResult(String(e?.message || e));
    }
  },
};

function failResult(errorMsg) {
  return {
    extracted: {}, confidenceByField: {}, overallConfidence: 0,
    source: 'cloud_error', error: errorMsg,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
