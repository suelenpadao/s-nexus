// helpers/clientMatcher.js
// Duas responsabilidades:
//  1) achar um lead já existente no CRM que bate com o comprador do contrato
//  2) detectar se ESSE contrato (ou uma venda muito parecida) já foi importado antes

function norm(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function onlyDigits(s) {
  return (s || '').toString().replace(/\D/g, '');
}

// Acha um lead existente pelo nome (e CPF, se disponível) — usado pro "criar ou atualizar" no CRM
export function findExistingLead(leads, { name, cpf }) {
  if (!Array.isArray(leads)) return null;
  const n = norm(name);
  const cpfDigits = onlyDigits(cpf);
  return leads.find(l => {
    if (cpfDigits && onlyDigits(l.cpf) === cpfDigits) return true;
    return n && norm(l.name) === n;
  }) || null;
}

// Calcula um SHA-256 do arquivo — identifica se é literalmente o mesmo arquivo já enviado antes
export async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica duplicidade contra os contratos já importados.
// Critérios (em ordem de força): mesmo arquivo (hash) > mesmo CPF+empreendimento > mesmo
// nome+empreendimento+unidade > nome+empreendimento+valor+data muito próximos.
export function findDuplicateContract(contracts, candidate) {
  if (!Array.isArray(contracts)) return null;
  const { fileHash, comprador, cpf, empreendimento, unidade, valor_total, data_compra } = candidate;

  for (const c of contracts) {
    if (fileHash && c.fileHash && c.fileHash === fileHash) {
      return { contract: c, reason: 'Mesmo arquivo já foi enviado antes' };
    }
    const ex = c.extracted || {};
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits && onlyDigits(ex.cpf) === cpfDigits && norm(ex.empreendimento) === norm(empreendimento) && empreendimento) {
      return { contract: c, reason: 'Mesmo CPF e empreendimento já cadastrados' };
    }
    if (comprador && empreendimento && unidade &&
        norm(ex.comprador) === norm(comprador) &&
        norm(ex.empreendimento) === norm(empreendimento) &&
        norm(ex.unidade) === norm(unidade)) {
      return { contract: c, reason: 'Mesmo cliente, empreendimento e unidade já cadastrados' };
    }
    if (comprador && empreendimento && valor_total && data_compra &&
        norm(ex.comprador) === norm(comprador) &&
        norm(ex.empreendimento) === norm(empreendimento) &&
        Math.abs((Number(ex.valor_total)||0) - (Number(valor_total)||0)) < 1 &&
        ex.data_compra === data_compra) {
      return { contract: c, reason: 'Mesmo cliente, empreendimento, valor e data já cadastrados' };
    }
  }
  return null;
}
