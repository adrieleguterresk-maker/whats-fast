/**
 * Parser — Módulo de parsing de arquivo ZIP/TXT do WhatsApp
 * 
 * Responsabilidades:
 * - Descompactar .zip com JSZip
 * - Localizar o arquivo de texto do chat
 * - Identificar arquivos de mídia
 * - Parsear linhas do chat em objetos estruturados
 * - Classificar tipos: texto, audio, imagem_comum, imagem_print, video, documento, apagada
 */

import JSZip from 'jszip';

// Regex para parsear linhas do chat do WhatsApp
// Suporta: DD/MM/YYYY HH:MM ou DD/MM/YYYY HH:MM:SS
const LINE_REGEX = /^(\d{2}\/\d{2}\/\d{4})\s(\d{2}:\d{2}(?::\d{2})?)\s-\s([^:]+):\s(.+)$/;
const SYSTEM_LINE_REGEX = /^(\d{2}\/\d{2}\/\d{4})\s(\d{2}:\d{2}(?::\d{2})?)\s-\s(.+)$/;

// Extensões suportadas por tipo
const AUDIO_EXTENSIONS = ['.opus', '.ogg', '.mp3', '.m4a', '.wav', '.aac', '.amr'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXTENSIONS = ['.mp4', '.3gp', '.mkv', '.avi', '.mov', '.webm'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip', '.rar'];

/**
 * Verifica se um nome de arquivo é um arquivo de chat do WhatsApp
 */
function isChatFile(filename) {
  const lower = filename.toLowerCase();
  return lower.endsWith('.txt') && (
    lower.includes('chat') ||
    lower.includes('conversa') ||
    lower.includes('whatsapp')
  );
}

/**
 * Determina o tipo de mídia pelo nome do arquivo
 */
function getMediaType(filename) {
  const lower = filename.toLowerCase();
  if (AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'audio';
  if (IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'image';
  if (VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'video';
  if (DOCUMENT_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'documento';
  return 'other';
}

/**
 * Verifica se uma mensagem contém referência a mídia omitida
 */
function isMediaOmitted(content) {
  const lower = content.toLowerCase().trim();
  return lower.includes('<media omitted>') ||
         lower.includes('<mídia omitida>') ||
         lower.includes('(file attached)') ||
         lower.includes('(arquivo anexado)');
}

/**
 * Verifica se a mensagem é uma mensagem apagada
 */
function isDeletedMessage(content) {
  const lower = content.toLowerCase().trim();
  return lower.includes('this message was deleted') ||
         lower.includes('essa mensagem foi apagada') ||
         lower.includes('mensagem apagada') ||
         lower.includes('you deleted this message') ||
         lower.includes('você apagou essa mensagem');
}

/**
 * Verifica se a mensagem referencia um arquivo de mídia específico
 */
function extractMediaFilename(content) {
  // Padrões: "PTT-20260303-WA0001.opus (file attached)" ou nome de arquivo
  const patterns = [
    /([A-Z]{3}-\d{8}-WA\d{4,}\.\w+)/i,
    /([\w-]+\.(opus|ogg|mp3|m4a|wav|aac|amr|jpg|jpeg|png|webp|gif|mp4|3gp|mkv|avi|mov|pdf|doc|docx|xls|xlsx|ppt|pptx))/i
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parseia o conteúdo do arquivo de texto do chat
 * @param {string} textContent - Conteúdo do arquivo .txt
 * @returns {Array} Lista de objetos de mensagem parseados
 */
export function parseChatText(textContent) {
  const lines = textContent.split('\n');
  const messages = [];
  let currentMessage = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Tenta parsear como mensagem normal (com remetente)
    const match = trimmed.match(LINE_REGEX);
    if (match) {
      if (currentMessage) {
        messages.push(currentMessage);
      }
      
      const content = match[4];
      const mediaFilename = extractMediaFilename(content);
      const mediaOmitted = isMediaOmitted(content);
      const deleted = isDeletedMessage(content);
      
      currentMessage = {
        index: messages.length,
        data: match[1],
        hora: match[2],
        remetente: match[3].trim(),
        conteudo: content,
        tipo: 'texto',
        mediaOmitted: mediaOmitted,
        mediaFilename: mediaFilename,
        raw: trimmed
      };

      // Determinar tipo
      if (deleted) {
        currentMessage.tipo = 'apagada';
      } else if (mediaFilename) {
        const mediaType = getMediaType(mediaFilename);
        if (mediaType === 'audio') currentMessage.tipo = 'audio';
        else if (mediaType === 'image') currentMessage.tipo = 'imagem';
        else if (mediaType === 'video') currentMessage.tipo = 'video';
        else if (mediaType === 'documento') currentMessage.tipo = 'documento';
      } else if (mediaOmitted) {
        currentMessage.tipo = 'media_omitida';
      }

      continue;
    }

    // Tenta parsear como mensagem de sistema
    const sysMatch = trimmed.match(SYSTEM_LINE_REGEX);
    if (sysMatch) {
      if (currentMessage) {
        messages.push(currentMessage);
      }
      currentMessage = {
        index: messages.length,
        data: sysMatch[1],
        hora: sysMatch[2],
        remetente: '__SISTEMA__',
        conteudo: sysMatch[3],
        tipo: 'sistema',
        mediaOmitted: false,
        mediaFilename: null,
        raw: trimmed
      };
      continue;
    }

    // Linha de continuação da mensagem anterior
    if (currentMessage) {
      currentMessage.conteudo += '\n' + trimmed;
      currentMessage.raw += '\n' + trimmed;
    }
  }

  // Adicionar última mensagem
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

/**
 * Processa um arquivo ZIP exportado do WhatsApp
 * @param {File|Blob} zipFile - Arquivo .zip
 * @returns {Object} { chatText, messages, mediaFiles, stats }
 */
export async function parseZipFile(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);
  
  let chatText = '';
  let chatFileName = '';
  const mediaFiles = new Map();

  // Iterar sobre os arquivos do ZIP
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    
    const filename = relativePath.split('/').pop();
    
    // Identificar arquivo de chat
    if (isChatFile(filename)) {
      chatText = await zipEntry.async('string');
      chatFileName = filename;
      continue;
    }

    // Identificar arquivos de mídia
    const mediaType = getMediaType(filename);
    if (mediaType !== 'other') {
      const blob = await zipEntry.async('blob');
      mediaFiles.set(filename, {
        blob,
        type: mediaType,
        filename
      });
    }
  }

  if (!chatText) {
    // Tentar qualquer .txt no zip
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir && relativePath.endsWith('.txt')) {
        chatText = await zipEntry.async('string');
        chatFileName = relativePath.split('/').pop();
        break;
      }
    }
  }

  if (!chatText) {
    throw new Error('Nenhum arquivo de chat encontrado no ZIP. Certifique-se de que o arquivo contém um .txt exportado do WhatsApp.');
  }

  const messages = parseChatText(chatText);

  return {
    chatFileName,
    chatText,
    messages,
    mediaFiles,
    stats: {
      totalMessages: messages.length,
      audioFiles: [...mediaFiles.values()].filter(f => f.type === 'audio').length,
      imageFiles: [...mediaFiles.values()].filter(f => f.type === 'image').length,
      videoFiles: [...mediaFiles.values()].filter(f => f.type === 'video').length,
      docFiles: [...mediaFiles.values()].filter(f => f.type === 'documento').length,
      textMessages: messages.filter(m => m.tipo === 'texto').length,
      deletedMessages: messages.filter(m => m.tipo === 'apagada').length,
      systemMessages: messages.filter(m => m.tipo === 'sistema').length
    }
  };
}

/**
 * Processa um arquivo .txt do WhatsApp diretamente (sem ZIP)
 * @param {File} txtFile - Arquivo .txt
 * @returns {Object} { chatText, messages, mediaFiles, stats }
 */
export async function parseTxtFile(txtFile) {
  const chatText = await txtFile.text();
  const messages = parseChatText(chatText);

  return {
    chatFileName: txtFile.name,
    chatText,
    messages,
    mediaFiles: new Map(),
    stats: {
      totalMessages: messages.length,
      audioFiles: 0,
      imageFiles: 0,
      videoFiles: 0,
      docFiles: 0,
      textMessages: messages.filter(m => m.tipo === 'texto').length,
      deletedMessages: messages.filter(m => m.tipo === 'apagada').length,
      systemMessages: messages.filter(m => m.tipo === 'sistema').length
    }
  };
}
