export const config = {
  maxDuration: 60, // Permitir até 60 segundos de execução (pode requerer Vercel Pro se > 10s em alguns planos, mas 60 é o limite do Hobby para algumas rotas agora, ou 10s. Deixamos 60 por precaução).
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY não configurada nas variáveis de ambiente da Vercel',
    });
  }

  try {
    const { qas } = req.body;
    
    if (!qas || !Array.isArray(qas)) {
      return res.status(400).json({ error: 'Body inválido. Esperado um array "qas".' });
    }

    // Preparar o payload para a LLM
    const promptData = qas.map((qa, index) => {
      return `ID: ${index}\nPERGUNTA: ${qa.pergunta}\nRESPOSTA DO ESPECIALISTA: ${qa.resposta}`;
    }).join('\n\n');

    const systemPrompt = `Você é um Analista de Negócios e Mentor experiente.
Sua FUNÇÃO ÚNICA é analisar pares de 'Pergunta do Cliente' e 'Resposta do Especialista' e categorizá-los com base no SENTIDO SEMÂNTICO predominante da dúvida.

CATEGORIAS PERMITIDAS EXATAMENTE COM ESTA GRAFIA:
- Marketing (tráfego, anúncios, audiência, persona, campanhas, captação)
- Comercial (vendas, preços, fechamentos, objeções, tickets, propostas, comissionamento)
- Sucesso do Cliente (suporte a problemas práticos do cliente, feedback, retenção, pós-venda)
- Mentalidade (mindset, pensamentos, sentimentos, travas paralisantes, insegurança, foco, desânimo)
- Identidade Visual (logotipos, paleta de cores, tipografia/fontes, elementos gráficos, harmonia de feed, biografia, escolha de fotos, organização visual, posicionamento de marca)
- Produção de Conteúdo (vídeos, reels, roteiros, gravar, criar conteúdo, gravação, linha editorial)
- Contratação (aumentar equipe, delegar atividades, recrutamento, vagas, perfis comportamentais)
- Acesso (acessar plataformas, dificuldades com links, login, apps, senhas, "onde acho", "como entro", baixar ferramentas)
- Gestão (organização de processos da empresa, fluxogramas, organização financeira interna, planilhas gerenciais)
- Dúvidas Gerais (se for uma dúvida de negócios que não se encaixa nas demais)

REGRA DE SMALL TALK / IRRELEVANTE:
Se a conversa for puramente "oi, tudo bem", ou se não tiver NENHUMA dúvida de negócios (ex: "muito obrigado", "amém", "ótimo final de semana", "agradeço"), a categoria OBRIGATORIAMENTE DEVE SER "Irrelevante".

SAÍDA DESEJADA:
Retorne estritamente um objeto JSON onde as chaves são os IDs enviados e os valores são a categoria final avaliada em texto exato. Não inclua Markdown em torno do JSON. Não inclua explicações.

Exemplo de Saída:
{
  "0": "Comercial",
  "1": "Acesso",
  "2": "Irrelevante",
  "3": "Gestão"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise e categorize as seguintes interações:\n\n${promptData}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || response.statusText);
    }

    const data = await response.json();
    const resultJson = JSON.parse(data.choices[0].message.content);

    return res.status(200).json({ categories: resultJson });
  } catch (error) {
    console.error('Erro na API agent3-categorize:', error);
    return res.status(500).json({ error: error.message });
  }
}
