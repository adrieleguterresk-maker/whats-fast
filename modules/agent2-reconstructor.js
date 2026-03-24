/**
 * Agente 2 — Reconstrutor (Controller B)
 * 
 * 🎯 FUNÇÃO: Unir os dados fornecidos pelo MODEL e gerar uma conversa cronológica
 * completa, fiel e organizada.
 * 
 * 📥 INPUT (MODEL):
 * - Histórico com mensagens classificadas por tipo
 * - Transcrições de áudio em JSON
 * 
 * ⚙️ PROCESSAMENTO:
 * - Percorrer todas as mensagens do histórico
 * - Manter ordem cronológica original
 * - Inserir cada elemento conforme seu tipo
 * - Integrar áudios e imagens com base nas referências
 * 
 * 📍 TIPOS SUPORTADOS:
 * texto | audio | imagem_comum | imagem_print | video | documento | apagada
 * 
 * ⚠️ REGRAS CRÍTICAS:
 * - Proibido resumir, reescrever, corrigir, interpretar ou alterar conteúdo
 * - Proibido realizar OCR ou interpretar imagem
 * - Proibido agrupar múltiplos elementos seguidos
 * - Reconstrutor estrutural, NÃO analista
 */

/**
 * Determina se uma imagem é um print/screenshot
 */
function isScreenshot(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.includes('screenshot') ||
         lower.includes('print') ||
         lower.includes('captura') ||
         lower.includes('screen');
}

/**
 * Cria mapa de transcrições indexado por linha de referência
 */
function buildTranscriptionMap(transcriptions) {
  const map = new Map();
  for (const t of transcriptions) {
    // Indexar por audio_id para matching mais robusto
    map.set(t.audio_id, t);
  }
  return map;
}

/**
 * Encontra a transcrição correspondente a uma mensagem
 */
function findTranscription(msg, transcriptionMap, transcriptions) {
  // Match por mediaFilename
  if (msg.mediaFilename && transcriptionMap.has(msg.mediaFilename)) {
    return transcriptionMap.get(msg.mediaFilename);
  }
  
  // Match por correlação de contexto
  for (const t of transcriptions) {
    if (t.data === msg.data && t.hora === msg.hora && t.remetente === msg.remetente) {
      return t;
    }
  }
  
  return null;
}

/**
 * Executa o Agente 2: Reconstrução Estrutural
 * 
 * 📤 OUTPUT (MODEL PADRONIZADO):
 * {
 *   "data": "DD/MM/AAAA",
 *   "hora": "HH:MM",
 *   "remetente": "Nome",
 *   "tipo": "texto | audio | imagem_comum | imagem_print | video | documento | apagada",
 *   "conteudo": "mensagem original",
 *   "transcricao": "se for áudio",
 *   "conteudo_extraido": "se for imagem_print"
 * }
 * 
 * @param {Array} messages - Mensagens parseadas (histórico bruto)
 * @param {Array} transcriptions - Model JSON do Agente 1
 * @param {Map} mediaFiles - Mapa de arquivos de mídia
 * @param {Function} onProgress - Callback de progresso
 * @returns {Array} Model de Conversa Unificada
 */
export function executeAgent2(messages, transcriptions, mediaFiles, onProgress = () => {}) {
  const transcriptionMap = buildTranscriptionMap(transcriptions);
  const unifiedConversation = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (i % 50 === 0) {
      onProgress(i, messages.length);
    }

    // === MENSAGEM DE SISTEMA ===
    if (msg.tipo === 'sistema') {
      unifiedConversation.push({
        data: msg.data,
        hora: msg.hora,
        remetente: '__SISTEMA__',
        tipo: 'sistema',
        conteudo: msg.conteudo,
        transcricao: null,
        conteudo_extraido: null
      });
      continue;
    }

    // === MENSAGEM APAGADA ===
    if (msg.tipo === 'apagada') {
      unifiedConversation.push({
        data: msg.data,
        hora: msg.hora,
        remetente: msg.remetente,
        tipo: 'apagada',
        conteudo: '[ Mensagem apagada ]',
        transcricao: null,
        conteudo_extraido: null
      });
      continue;
    }

    // === ÁUDIO ===
    if (msg.tipo === 'audio' || (msg.tipo === 'media_omitida' && findTranscription(msg, transcriptionMap, transcriptions))) {
      const transcription = findTranscription(msg, transcriptionMap, transcriptions);
      
      if (transcription) {
        unifiedConversation.push({
          data: msg.data,
          hora: msg.hora,
          remetente: msg.remetente,
          tipo: 'audio',
          conteudo: `[ Áudio ]`,
          transcricao: transcription.transcricao,
          conteudo_extraido: null,
          audio_id: transcription.audio_id
        });
      } else {
        unifiedConversation.push({
          data: msg.data,
          hora: msg.hora,
          remetente: msg.remetente,
          tipo: 'audio',
          conteudo: '[ Áudio ]',
          transcricao: '[ERRO: Áudio não encontrado no ZIP]',
          conteudo_extraido: null
        });
      }
      continue;
    }

    // === IMAGEM ===
    if (msg.tipo === 'imagem') {
      if (msg.mediaFilename && isScreenshot(msg.mediaFilename)) {
        // imagem_print — Inserir conteúdo extraído (se disponível via MODEL)
        unifiedConversation.push({
          data: msg.data,
          hora: msg.hora,
          remetente: msg.remetente,
          tipo: 'imagem_print',
          conteudo: '[ Imagem - Print de conversa ]',
          transcricao: null,
          conteudo_extraido: `[CONTEÚDO EXTRAÍDO DA IMAGEM]\n${msg.mediaFilename}`,
          mediaFilename: msg.mediaFilename
        });
      } else {
        // imagem_comum
        unifiedConversation.push({
          data: msg.data,
          hora: msg.hora,
          remetente: msg.remetente,
          tipo: 'imagem_comum',
          conteudo: '[ Imagem enviada ]',
          transcricao: null,
          conteudo_extraido: null,
          mediaFilename: msg.mediaFilename
        });
      }
      continue;
    }

    // === VÍDEO ===
    if (msg.tipo === 'video') {
      unifiedConversation.push({
        data: msg.data,
        hora: msg.hora,
        remetente: msg.remetente,
        tipo: 'video',
        conteudo: '[ Vídeo enviado ]',
        transcricao: null,
        conteudo_extraido: null
      });
      continue;
    }

    // === DOCUMENTO ===
    if (msg.tipo === 'documento') {
      unifiedConversation.push({
        data: msg.data,
        hora: msg.hora,
        remetente: msg.remetente,
        tipo: 'documento',
        conteudo: `[ Documento enviado${msg.mediaFilename ? ': ' + msg.mediaFilename : ''} ]`,
        transcricao: null,
        conteudo_extraido: null
      });
      continue;
    }

    // === MÍDIA OMITIDA (sem correlação com áudio) ===
    if (msg.tipo === 'media_omitida') {
      unifiedConversation.push({
        data: msg.data,
        hora: msg.hora,
        remetente: msg.remetente,
        tipo: 'media_omitida',
        conteudo: msg.conteudo,
        transcricao: null,
        conteudo_extraido: null
      });
      continue;
    }

    // === TEXTO (padrão) — manter ipsis litteris ===
    unifiedConversation.push({
      data: msg.data,
      hora: msg.hora,
      remetente: msg.remetente,
      tipo: 'texto',
      conteudo: msg.conteudo,
      transcricao: null,
      conteudo_extraido: null
    });
  }

  onProgress(messages.length, messages.length);

  return unifiedConversation;
}
