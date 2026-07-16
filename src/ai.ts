import { GoogleGenAI } from '@google/genai';
import { CommitData } from './github';
import { TrelloActionData } from './trello';

export interface UserEvaluation {
  author: string;
  commitsAnalyzed: number;
  suspiciousFindings: string;
  implementedFeatures: string;
  productivityAssessment: string;
  managerDecisions: string;
}

export interface TrelloEvaluation {
  author: string;
  actionsAnalyzed: number;
  deliveredDemands: string;
  startedDemands: string;
  generalPanorama: string;
  managerDecisions: string;
}


export class AIService {
  private ai: GoogleGenAI;
  private model = 'gemini-flash-latest'; // Recommended model for complex coding analysis

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async evaluateUserCommits(author: string, commits: CommitData[]): Promise<UserEvaluation> {
    const commitContext = commits.map(c => `
Repository: ${c.repository}
Commit Message: ${c.message}
URL: ${c.url}
Diff:
${c.diff}
---
`).join('\n');

    const prompt = `
Você é um Tech Lead sênior focado em qualidade de código, segurança e produtividade.
Por favor, analise os seguintes commits feitos pelo desenvolvedor "${author}" nas últimas 24 horas.

Aqui estão os dados dos commits (Mensagem e Diff):
${commitContext}

Com base nesses dados, forneça um relatório estruturado avaliando os seguintes 4 pontos:

1. **Suspeitas e Segurança**: Há algo suspeito no código? (ex: vazamento de senhas/chaves, vulnerabilidades óbvias, lógicas maliciosas, ou gambiarras perigosas). Se não houver, diga claramente que não encontrou nada suspeito.
2. **Implementações**: O que exatamente foi implementado ou resolvido? Resuma as funcionalidades, correções de bugs ou refatorações de forma clara para um gestor técnico entender.
3. **Produtividade**: Avalie a produtividade do usuário baseado na complexidade das mudanças (não apenas quantidade de linhas, mas impacto arquitetural e esforço aparente).
4. **Decisões para o Gestor**: Liste problemas críticos, falhas, subidas para produção, novos módulos estruturais ou dúvidas implícitas que requerem crivo/tomada de decisão do gestor. Formate como uma lista pontuada, e inclua os links (URLs) relevantes para o gestor acessar diretamente. Se não houver pontos de atenção, retorne apenas "Nenhuma decisão pendente identificada."

Formate sua resposta estritamente usando o seguinte modelo, sem texto extra:

**Suspeitas e Segurança:**
[Sua análise aqui]

**Implementações:**
[Sua análise aqui]

**Produtividade:**
[Sua análise aqui]

**Decisões para o Gestor:**
[Sua análise aqui]
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const text = response.text || '';
      
      const suspiciousMatch = text.match(/\*\*Suspeitas e Segurança:\*\*\s*([\s\S]*?)(?=\*\*Implementações:\*\*)/i);
      const implementedMatch = text.match(/\*\*Implementações:\*\*\s*([\s\S]*?)(?=\*\*Produtividade:\*\*)/i);
      const productivityMatch = text.match(/\*\*Produtividade:\*\*\s*([\s\S]*?)(?=\*\*Decisões para o Gestor:\*\*)/i);
      const managerDecisionsMatch = text.match(/\*\*Decisões para o Gestor:\*\*\s*([\s\S]*)$/i);

      return {
        author,
        commitsAnalyzed: commits.length,
        suspiciousFindings: suspiciousMatch ? suspiciousMatch[1].trim() : 'Não foi possível extrair.',
        implementedFeatures: implementedMatch ? implementedMatch[1].trim() : 'Não foi possível extrair.',
        productivityAssessment: productivityMatch ? productivityMatch[1].trim() : 'Não foi possível extrair.',
        managerDecisions: managerDecisionsMatch ? managerDecisionsMatch[1].trim() : 'Não foi possível extrair.',
      };
    } catch (error) {
      console.error(`Error analyzing commits for author ${author}:`, error);
      return {
        author,
        commitsAnalyzed: commits.length,
        suspiciousFindings: 'Erro ao processar análise na IA.',
        implementedFeatures: 'Erro ao processar análise na IA.',
        productivityAssessment: 'Erro ao processar análise na IA.',
        managerDecisions: 'Erro ao processar análise na IA.',
      };
    }
  }

  async evaluateTrelloActivities(author: string, actions: TrelloActionData[]): Promise<TrelloEvaluation> {
    const actionContext = actions.map(a => `
Card: ${a.cardName} (${a.cardUrl})
Data: ${a.date}
Ação: ${a.type}
Detalhes: ${a.details}
---
`).join('\n');

    const prompt = `
Você é um Gestor de Projetos focado em acompanhar o fluxo de valor das entregas.
Por favor, analise as seguintes atividades realizadas no Trello pelo colaborador "${author}" nas últimas 24 horas.

Aqui estão os dados das ações (focando nos nomes dos cartões, comentários e movimentações):
${actionContext}

Sua tarefa é ler essas ações cruas e transformar em um resumo focado no panorama de negócio/produto, SEM ser robótico (não diga "movimentou 2 cartões"). Concentre-se em "o que" está sendo feito, citando o nome das demandas e os comentários relevantes.

Com base nesses dados, forneça um relatório estruturado avaliando os seguintes 4 pontos:

1. **Entregas Realizadas**: Quais demandas (nome do cartão) foram entregues, finalizadas ou marcadas como concluídas? Detalhe o que foi finalizado.
2. **Iniciados e Em Andamento**: O que começou a ser desenvolvido agora ou teve progresso (mudou de fase, teve checklist avançando)?
3. **Panorama Geral e Comentários**: Um resumo geral sobre as interações nas demandas. Cite informações importantes discutidas nos comentários e eventuais bloqueios ou destaques relevantes sobre a atuação da pessoa.
4. **Decisões para o Gestor**: Liste problemas pendentes, falhas relatadas, decisões críticas, subidas para produção, novos módulos criados, ou bloqueios severos que exijam validação/tomada de decisão do gestor. Formate como uma lista pontuada, incluindo NOME DO CARTÃO e o LINK (URL) para o gestor acessar diretamente. Se não houver nada crítico, retorne apenas "Nenhuma decisão pendente identificada."

Formate sua resposta estritamente usando o seguinte modelo, sem texto extra:

**Entregas Realizadas:**
[Sua análise aqui]

**Iniciados e Em Andamento:**
[Sua análise aqui]

**Panorama Geral e Comentários:**
[Sua análise aqui]

**Decisões para o Gestor:**
[Sua análise aqui]
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const text = response.text || '';
      
      const deliveredMatch = text.match(/\*\*Entregas Realizadas:\*\*\s*([\s\S]*?)(?=\*\*Iniciados e Em Andamento:\*\*)/i);
      const startedMatch = text.match(/\*\*Iniciados e Em Andamento:\*\*\s*([\s\S]*?)(?=\*\*Panorama Geral e Comentários:\*\*)/i);
      const panoramaMatch = text.match(/\*\*Panorama Geral e Comentários:\*\*\s*([\s\S]*?)(?=\*\*Decisões para o Gestor:\*\*)/i);
      const managerDecisionsMatch = text.match(/\*\*Decisões para o Gestor:\*\*\s*([\s\S]*)$/i);

      return {
        author,
        actionsAnalyzed: actions.length,
        deliveredDemands: deliveredMatch ? deliveredMatch[1].trim() : 'Não foi possível extrair.',
        startedDemands: startedMatch ? startedMatch[1].trim() : 'Não foi possível extrair.',
        generalPanorama: panoramaMatch ? panoramaMatch[1].trim() : 'Não foi possível extrair.',
        managerDecisions: managerDecisionsMatch ? managerDecisionsMatch[1].trim() : 'Não foi possível extrair.',
      };
    } catch (error) {
      console.error(`Error analyzing Trello activities for author ${author}:`, error);
      return {
        author,
        actionsAnalyzed: actions.length,
        deliveredDemands: 'Erro ao processar análise na IA.',
        startedDemands: 'Erro ao processar análise na IA.',
        generalPanorama: 'Erro ao processar análise na IA.',
        managerDecisions: 'Erro ao processar análise na IA.',
      };
    }
  }

  async generateWeeklyChangelog(boardName: string, cards: any[]): Promise<string> {
    const cardsContext = cards.map(c => `
Card: ${c.name}
URL: ${c.url}
Descrição: ${c.desc ? c.desc.substring(0, 200) + '...' : 'Sem descrição'}
---
`).join('\n');

    const prompt = `
Você é um Product Manager comunicando os lançamentos da semana para a empresa e clientes.
Abaixo está a lista de entregas (cartões) que foram concluídas na última semana no quadro "${boardName}".

${cardsContext}

Escreva um Changelog Semanal focado no valor gerado para o negócio. Evite jargão técnico excessivo (ex: não fale de refatoração de classes, fale de melhorias internas).
Categorize as entregas de forma amigável e bonita, usando emojis. As categorias sugeridas são (use apenas as que tiverem itens):
- ✨ **Novas Funcionalidades**
- 🐛 **Correções de Bugs**
- ⚡ **Melhorias e Otimizações**
- 🛠️ **Manutenção**

Traga um tom de comemoração pela semana concluída. Escreva em formato HTML (usando tags como <h3>, <ul>, <li>, <strong>, <p>, e <a> para links dos cartões) para que possa ser inserido diretamente no corpo de um e-mail com boa formatação visual. Não inclua a tag <html> ou <body>, nem coloque formatação markdown como \`\`\`html, retorne APENAS o HTML puro dos elementos.
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      let text = response.text || '';
      // Limpar blocos de código se a IA retornar com ```html
      text = text.replace(/^\`\`\`html\s*/i, '').replace(/\s*\`\`\`$/i, '');
      return text;
    } catch (error) {
      console.error('Error generating changelog:', error);
      return '<p>Erro ao gerar o changelog na IA.</p>';
    }
  }

  async evaluateSupportTickets(tickets: any[]): Promise<string> {
    const ticketsContext = tickets.map(t => `
ID: ${t.id}
Título: ${t.title}
Descrição: ${t.description}
Fase Atual: ${t.stage}
Responsável: ${t.assignedTo}
Data de Criação: ${t.createdAt}
---
`).join('\n');

    const prompt = `
Você é um Coordenador de Suporte / Tech Lead analisando a fila de chamados (tickets) do Bitrix24.
Abaixo estão os chamados de suporte abertos no momento.

${ticketsContext}

Crie um relatório gerencial em HTML (sem tags <html> ou <body>, apenas o conteúdo interno para um e-mail) focado nos seguintes pontos:

1. **Resumo da Operação**: Total de chamados abertos e um overview rápido de como está a fila.
2. **Atenção e Gargalos**: Destaque chamados bloqueados, e especialmente os que estão "guardando poeira" (abertos há muito tempo sem resolução).
3. **Fila por Responsável**: Liste rapidamente quantos chamados cada pessoa tem.
4. **Problemas Recorrentes e Causa Raiz**: Analise o contexto geral dos chamados. Se notar problemas semelhantes, sugira uma ação definitiva no fornecedor ou nos processos operacionais, ao invés de apenas remediar cada chamado isoladamente.
5. **Top 5 Chamados Críticos**: Uma lista ou tabela dos chamados que precisam de atenção imediata.

Formatação: Use <h3>, <ul>, <li>, <strong> e <p>. Use emojis para deixar o relatório com cara de dashboard moderno e agradável de ler.
Não inclua \`\`\`html no retorno, apenas as tags reais.
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      let text = response.text || '';
      text = text.replace(/^\`\`\`html\s*/i, '').replace(/\s*\`\`\`$/i, '');
      return text;
    } catch (error) {
      console.error('Error generating support evaluation:', error);
      return '<p>Erro ao gerar a análise de suporte na IA.</p>';
    }
  }
}
