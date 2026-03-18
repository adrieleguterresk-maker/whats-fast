/**
 * UI Module — Controle da interface
 * 
 * - Renderização dos resultados por agente
 * - Controle de abas e visualizações
 * - Exportação JSON/CSV
 * - Gerenciamento de progresso visual
 */

/**
 * Atualiza o status visual de um agente na pipeline
 * @param {number} agentNumber - 1, 2 ou 3
 * @param {'idle'|'running'|'done'|'error'} status
 * @param {string} message - Mensagem de status
 */
export function updateAgentStatus(agentNumber, status, message = '') {
  const card = document.getElementById(`agent${agentNumber}-card`);
  const statusEl = document.getElementById(`agent${agentNumber}-status`);
  const progressEl = document.getElementById(`agent${agentNumber}-progress`);
  
  if (!card) return;

  // Remover classes anteriores
  card.classList.remove('agent-idle', 'agent-running', 'agent-done', 'agent-error');
  card.classList.add(`agent-${status}`);

  if (statusEl) {
    const statusLabels = {
      idle: 'Aguardando',
      running: 'Processando...',
      done: 'Concluído ✓',
      error: 'Erro ✗'
    };
    statusEl.textContent = message || statusLabels[status];
  }

  if (progressEl) {
    if (status === 'running') {
      progressEl.classList.add('active');
    } else {
      progressEl.classList.remove('active');
    }
  }
}

/**
 * Atualiza a barra de progresso de um agente
 * @param {number} agentNumber - 1, 2 ou 3
 * @param {number} current - Progresso atual
 * @param {number} total - Total
 */
export function updateAgentProgress(agentNumber, current, total) {
  const progressBar = document.getElementById(`agent${agentNumber}-progress-bar`);
  const progressText = document.getElementById(`agent${agentNumber}-progress-text`);
  
  if (progressBar && total > 0) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
  }
  
  if (progressText) {
    progressText.textContent = total > 0 ? `${current}/${total}` : '';
  }
}

/**
 * Renderiza os resultados do Agente 1 (Transcrições)
 * @param {Array} transcriptions - Output do Agente 1
 */
export function renderAgent1Results(transcriptions) {
  const container = document.getElementById('agent1-results');
  if (!container) return;

  if (transcriptions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎤</span>
        <p>Nenhum arquivo de áudio encontrado no ZIP</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="results-header">
      <h3>📝 Transcrições de Áudio</h3>
      <span class="badge">${transcriptions.length} áudio(s)</span>
    </div>
    <div class="results-table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>Áudio</th>
            <th>Data/Hora</th>
            <th>Remetente</th>
            <th>Transcrição</th>
            <th>Contexto</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const t of transcriptions) {
    const isError = t.transcricao.startsWith('[ERRO');
    html += `
      <tr class="${isError ? 'row-error' : ''}">
        <td class="cell-mono">${t.audio_id}</td>
        <td class="cell-nowrap">${t.data} ${t.hora}</td>
        <td>${t.remetente}</td>
        <td class="cell-content ${isError ? 'text-error' : ''}">${escapeHtml(t.transcricao)}</td>
        <td class="cell-context">
          ${t.mensagem_anterior ? `<div class="ctx-before">⬆ ${escapeHtml(truncate(t.mensagem_anterior, 60))}</div>` : ''}
          ${t.mensagem_posterior ? `<div class="ctx-after">⬇ ${escapeHtml(truncate(t.mensagem_posterior, 60))}</div>` : ''}
        </td>
      </tr>
    `;
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/**
 * Renderiza os resultados do Agente 2 (Conversa Unificada)
 * @param {Array} conversation - Model de Conversa Unificada
 */
export function renderAgent2Results(conversation) {
  const container = document.getElementById('agent2-results');
  if (!container) return;

  if (conversation.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>Nenhuma mensagem processada</p>
      </div>
    `;
    return;
  }

  // Agrupar por tipo para as estatísticas
  const stats = {
    texto: conversation.filter(m => m.tipo === 'texto').length,
    audio: conversation.filter(m => m.tipo === 'audio').length,
    imagem: conversation.filter(m => m.tipo === 'imagem_print' || m.tipo === 'imagem_comum').length,
    video: conversation.filter(m => m.tipo === 'video').length,
    documento: conversation.filter(m => m.tipo === 'documento').length,
    apagada: conversation.filter(m => m.tipo === 'apagada').length,
    sistema: conversation.filter(m => m.tipo === 'sistema').length
  };

  let html = `
    <div class="results-header">
      <h3>🔗 Conversa Unificada</h3>
      <div class="stats-row">
        <span class="badge badge-text">${stats.texto} texto</span>
        <span class="badge badge-audio">${stats.audio} áudio</span>
        <span class="badge badge-image">${stats.imagem} imagem</span>
        ${stats.video ? `<span class="badge badge-video">${stats.video} vídeo</span>` : ''}
        ${stats.documento ? `<span class="badge badge-doc">${stats.documento} doc</span>` : ''}
        ${stats.apagada ? `<span class="badge badge-deleted">${stats.apagada} apagada</span>` : ''}
        <span class="badge badge-system">${stats.sistema} sistema</span>
      </div>
    </div>
    <div class="chat-timeline">
  `;

  let lastDate = '';
  for (const msg of conversation) {
    // Separador de data
    if (msg.data !== lastDate) {
      html += `<div class="date-separator"><span>${msg.data}</span></div>`;
      lastDate = msg.data;
    }

    if (msg.tipo === 'sistema') {
      html += `<div class="chat-msg chat-system"><span>${escapeHtml(msg.conteudo)}</span></div>`;
      continue;
    }

    const typeIcon = getTypeIcon(msg.tipo);
    const typeClass = getTypeClass(msg.tipo);

    // Montar conteúdo com transcrição se for áudio
    let contentHtml = escapeHtml(msg.conteudo);
    if (msg.tipo === 'audio' && msg.transcricao) {
      contentHtml += `<div class="msg-transcription"><em>Transcrição:</em> ${escapeHtml(msg.transcricao)}</div>`;
    }
    if (msg.tipo === 'imagem_print' && msg.conteudo_extraido) {
      contentHtml += `<div class="msg-transcription">${escapeHtml(msg.conteudo_extraido)}</div>`;
    }

    html += `
      <div class="chat-msg ${typeClass}">
        <div class="msg-header">
          <span class="msg-sender">${escapeHtml(msg.remetente)}</span>
          <span class="msg-time">${msg.hora}</span>
          <span class="msg-type-badge">${typeIcon}</span>
        </div>
        <div class="msg-content">${contentHtml}</div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Cores por categoria
 */
const CATEGORY_COLORS = {
  'Arquétipo': '#a78bfa',
  'Preço / Valor': '#34d399',
  'Prazo / Agenda': '#fbbf24',
  'Processo / Método': '#60a5fa',
  'Material / Conteúdo': '#f472b6',
  'Entrega / Resultado': '#fb923c',
  'Dúvidas Gerais': '#94a3b8'
};

/**
 * Renderiza os resultados do Agente 3 (Perguntas e Respostas)
 * @param {Object} result - Output do Agente 3 { qaList, roles, stats, categorias }
 */
export function renderAgent3Results(result) {
  const container = document.getElementById('agent3-results');
  if (!container) return;

  const { qaList, stats, categorias } = result;

  if (qaList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">❓</span>
        <p>Nenhuma pergunta e resposta identificada</p>
      </div>
    `;
    return;
  }

  // Header com stats
  let html = `
    <div class="results-header">
      <h3>Perguntas & Respostas Extraidas</h3>
      <div class="stats-row">
        <span class="badge badge-question">${stats.totalPerguntas} pergunta(s)</span>
        <span class="badge badge-answer">${stats.comResposta} com resposta</span>
        <span class="badge badge-no-answer">${stats.semResposta} sem resposta</span>
      </div>
    </div>
  `;

  // Sub-abas por categoria
  const categoryKeys = Object.keys(categorias || {}).sort((a, b) => (categorias[b] || 0) - (categorias[a] || 0));

  html += `<div class="qa-subtabs">`;
  html += `<button class="qa-subtab active" data-category="todas">Todas (${qaList.length})</button>`;
  for (const cat of categoryKeys) {
    const color = CATEGORY_COLORS[cat] || '#94a3b8';
    html += `<button class="qa-subtab" data-category="${cat}" style="--cat-color: ${color}">${cat} (${categorias[cat]})</button>`;
  }
  html += `</div>`;

  // Lista de Q&A
  html += `<div class="qa-list">`;

  for (let i = 0; i < qaList.length; i++) {
    const qa = qaList[i];
    const noAnswer = qa.resposta === '[Sem resposta identificada]';
    const catColor = CATEGORY_COLORS[qa.categoria] || '#94a3b8';

    html += `
      <div class="qa-card ${noAnswer ? 'qa-no-answer' : ''}" data-category="${qa.categoria}">
        <div class="qa-card-header">
          <div class="qa-number">#${i + 1}</div>
          <span class="qa-category-badge" style="--cat-color: ${catColor}">${qa.categoria}</span>
        </div>
        <div class="qa-meta">
          <span class="qa-date">${qa.data_pergunta} ${qa.hora_pergunta}</span>
          ${qa.remetente ? `<span class="qa-sender">${escapeHtml(qa.remetente)}</span>` : ''}
        </div>
        <div class="qa-question">
          <div class="qa-label">PERGUNTA</div>
          <div class="qa-text">${escapeHtml(qa.pergunta)}</div>
        </div>
        <div class="qa-answer ${noAnswer ? 'qa-answer-missing' : ''}">
          <div class="qa-label">RESPOSTA</div>
          <div class="qa-text">${escapeHtml(qa.resposta)}</div>
        </div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  // Event listeners para sub-abas
  container.querySelectorAll('.qa-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      // Ativar sub-aba
      container.querySelectorAll('.qa-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.category;
      const cards = container.querySelectorAll('.qa-card');

      cards.forEach(card => {
        if (category === 'todas' || card.dataset.category === category) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/**
 * Renderiza o resumo do upload
 * @param {Object} parseResult - Resultado do parser
 */
export function renderUploadSummary(parseResult) {
  const container = document.getElementById('upload-summary');
  if (!container) return;

  const { stats, chatFileName } = parseResult;

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${stats.totalMessages}</div>
        <div class="summary-label">Mensagens</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${stats.audioFiles}</div>
        <div class="summary-label">Áudios</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${stats.imageFiles}</div>
        <div class="summary-label">Imagens</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${stats.textMessages}</div>
        <div class="summary-label">Texto</div>
      </div>
    </div>
    <div class="summary-file">📄 ${escapeHtml(chatFileName)}</div>
  `;
  container.classList.add('visible');
}

/**
 * Exporta dados como JSON
 * @param {Object} data - Dados a exportar
 * @param {string} filename - Nome do arquivo
 */
export function exportJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Exporta dados como CSV
 * @param {Array} data - Array de objetos
 * @param {string} filename - Nome do arquivo
 */
export function exportCSV(data, filename) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(';'),
    ...data.map(row =>
      headers.map(h => {
        const val = String(row[h] || '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(';')
    )
  ];

  const csv = '\ufeff' + csvRows.join('\n'); // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Alterna visibilidade de abas
 * @param {string} tabId - ID da aba a ativar
 */
export function switchTab(tabId) {
  // Desativar todas as abas
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  // Ativar aba selecionada
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  const content = document.getElementById(tabId);
  
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

// ===== HELPERS =====

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTypeIcon(tipo) {
  const icons = {
    texto: '💬',
    audio: '🎧',
    imagem_print: '📸',
    imagem_comum: '📷',
    video: '🎥',
    documento: '📄',
    apagada: '❌',
    media_omitida: '📎',
    sistema: '⚙️'
  };
  return icons[tipo] || '📝';
}

function getTypeClass(tipo) {
  const classes = {
    texto: 'msg-text',
    audio: 'msg-audio',
    imagem_print: 'msg-image-print',
    imagem_comum: 'msg-image',
    video: 'msg-video',
    documento: 'msg-doc',
    apagada: 'msg-deleted',
    media_omitida: 'msg-media',
    sistema: 'chat-system'
  };
  return classes[tipo] || 'msg-text';
}
