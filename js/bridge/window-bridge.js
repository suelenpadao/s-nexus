// bridge/window-bridge.js
// O index.html principal ainda é um <script> clássico (não-módulo), por isso essa
// pontezinha existe: importa a nova camada modular e expõe só o necessário em `window`.
// Nada de lógica de negócio aqui — é só um adaptador.

import { AIService } from '../services/AIService.js';
import { hashFile, findDuplicateContract, findExistingLead } from '../helpers/clientMatcher.js';
import { matchBrokerName, calcCommission, calcPercentual } from '../helpers/commission.js';

window.AIService = AIService;
window.ContractDedupe = { hashFile, findDuplicateContract, findExistingLead };
window.CommissionHelper = { matchBrokerName, calcCommission, calcPercentual };

window.dispatchEvent(new Event('snexus-ai-modules-ready'));
