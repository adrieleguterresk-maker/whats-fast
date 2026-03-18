/**
 * Agente 3 — Analista de Extração (Controller C)
 * 
 * 🎯 FUNÇÃO: Analisar a conversa estruturada e identificar perguntas relevantes
 * do cliente com respostas correspondentes.
 * 
 * ⚙️ PROCESSAMENTO:
 * - Identificar perguntas relevantes
 * - Ignorar perguntas sociais (small talk)
 * - Agrupar mensagens consecutivas do mesmo remetente
 * - Associar resposta correta
 * 
 * ⚠️ REGRAS:
 * - Proibido alterar texto
 * - Proibido resumir
 * - Proibido interpretar
 * - Deve ignorar small talk
 */

// Padrões de small talk / saudações para ignorar
const SMALLTALK_PATTERNS = [
  /^(oi|olá|ola|hey|hi|hello|e aí|eai|fala)\s*[!.,]?\s*$/i,
  /^(tudo bem|tudo bom|como vai|como está|td bem|td bom)\s*[!?.,]?\s*$/i,
  /^(bom dia|boa tarde|boa noite|bom diaaa*|boa tardeee*|boa noiteee*)\s*[!.,]?\s*$/i,
  /^(obrigad[oa]|vlw|valeu|thanks|brigad[oa]|agradeço)\s*[!.,]?\s*$/i,
  /^(tchau|até mais|até logo|flw|falou|bye|até)\s*[!.,]?\s*$/i,
  /^(ok|okay|blz|beleza|certo|entendi|entendido|perfeito|show)\s*[!.,]?\s*$/i,
  /^(sim|não|nao|yes|no|s|n)\s*[!.,]?\s*$/i,
  /^[.!,?]+$/,
  /^(kk+|haha+|rsrs+|kkk+)\s*$/i,
  /^[\u{1F600}-\u{1F64F}\u{1F44D}\u{1F64F}\u{2764}\u{FE0F}\u{1F389}\u{1F4AA}]+\s*$/u,
  /^(tudo ótimo|tudo certo|estou bem|to bem|tô bem)\s*[!.,]?\s*$/i,
];

/**
 * Verifica se uma mensagem é small talk
 */
function isSmallTalk(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length <= 3 && !trimmed.includes('?')) return true;
  
  return SMALLTALK_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Verifica se uma mensagem contém uma pergunta relevante
 */
function isRelevantQuestion(text) {
  if (!text) return false;
  const trimmed = text.trim();
  
  // Ignorar small talk mesmo com interrogação
  if (isSmallTalk(trimmed)) return false;
  
  // Interrogação explícita
  if (trimmed.includes('?')) return true;
  
  // Padrões interrogativos em português
  const questionPatterns = [
    /^(como|qual|quais|quanto|quantos|quantas|quando|onde|quem|por ?qu[eê]|porque)\s/i,
    /^(o que|tem como|é possível|pode|poderia|consegue|dá pra|da pra|da para|tem)\s/i,
    /^(vocês?\s+tem|vocês?\s+faz|vocês?\s+trabalha|vocês?\s+atende)/i,
    /^(gostaria de saber|queria saber|preciso saber|me (explica|fala|diz))/i,
    /^(qual o|qual a|quais os|quais as)\s/i,
    /(informações?|info|orçamento|preço|valor|custo|prazo)\s*\??/i,
  ];
  
  return questionPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Agrupa mensagens consecutivas do mesmo remetente
 * @param {Array} messages - Lista de mensagens
 * @returns {Array} Lista de mensagens agrupadas
 */
function groupConsecutiveMessages(messages) {
  if (messages.length === 0) return [];
  
  const grouped = [];
  let current = { ...messages[0], conteudo_agrupado: [messages[0].conteudo] };
  
  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    
    if (msg.remetente === current.remetente) {
      // Mesmo remetente → agrupar
      current.conteudo_agrupado.push(msg.conteudo);
    } else {
      // Remetente diferente → finalizar grupo e iniciar novo
      current.conteudo = current.conteudo_agrupado.join('\n');
      delete current.conteudo_agrupado;
      grouped.push(current);
      current = { ...msg, conteudo_agrupado: [msg.conteudo] };
    }
  }
  
  // Finalizar último grupo
  current.conteudo = current.conteudo_agrupado.join('\n');
  delete current.conteudo_agrupado;
  grouped.push(current);
  
  return grouped;
}

/**
 * Executa o Agente 3: Extração de Perguntas e Respostas
 * 
 * 📤 OUTPUT (MODEL PADRONIZADO):
 * [
 *   {
 *     "data_pergunta": "03/03/2026",
 *     "hora_pergunta": "10:26",
 *     "pergunta": "texto exato",
 *     "resposta": "texto exato"
 *   }
 * ]
 * 
 * @param {Array} conversation - Model de Conversa Unificada do Agente 2
 * @param {Function} onProgress - Callback de progresso
 * @returns {Object} { qaList, roles, stats }
 */
export function executeAgent3(conversation, onProgress = () => {}) {
  // Filtrar apenas mensagens de participantes (excluir sistema e apagadas)
  const userMessages = conversation.filter(m => 
    m.remetente !== '__SISTEMA__' && m.tipo !== 'sistema' && m.tipo !== 'apagada'
  );

  // Preparar conteúdo: para áudios, usar transcricao; para prints, usar conteudo_extraido
  const preparedMessages = userMessages.map(m => ({
    ...m,
    textoAnalise: m.transcricao && m.transcricao !== null && !m.transcricao.startsWith('[ERRO')
      ? m.transcricao
      : m.conteudo_extraido || m.conteudo
  }));

  // Agrupar mensagens consecutivas do mesmo remetente
  const grouped = groupConsecutiveMessages(preparedMessages);
  
  // Identificar participantes
  const participants = [...new Set(grouped.map(m => m.remetente))];
  
  const qaList = [];
  
  for (let i = 0; i < grouped.length; i++) {
    if (i % 10 === 0) {
      onProgress(i, grouped.length);
    }

    const msg = grouped[i];
    
    // Ignorar small talk
    if (isSmallTalk(msg.textoAnalise || msg.conteudo)) continue;
    
    // Verificar se é uma pergunta relevante
    if (!isRelevantQuestion(msg.textoAnalise || msg.conteudo)) continue;
    
    // Procurar resposta: próximo grupo de mensagem de remetente diferente
    let resposta = null;
    
    for (let j = i + 1; j < grouped.length; j++) {
      const nextMsg = grouped[j];
      
      // Mesmo remetente → pular
      if (nextMsg.remetente === msg.remetente) continue;
      
      // Small talk do respondente → pular
      if (isSmallTalk(nextMsg.textoAnalise || nextMsg.conteudo)) continue;
      
      // Encontrou resposta — usar texto exato (ipsis litteris)
      resposta = nextMsg.conteudo;
      break;
    }
    
    // Montar saída — texto exato, sem alteração
    qaList.push({
      data_pergunta: msg.data,
      hora_pergunta: msg.hora,
      pergunta: msg.conteudo,
      resposta: resposta || '[Sem resposta identificada]'
    });
  }

  onProgress(grouped.length, grouped.length);

  return {
    qaList,
    roles: { participantes: participants },
    stats: {
      totalPerguntas: qaList.length,
      comResposta: qaList.filter(q => q.resposta !== '[Sem resposta identificada]').length,
      semResposta: qaList.filter(q => q.resposta === '[Sem resposta identificada]').length
    }
  };
}
