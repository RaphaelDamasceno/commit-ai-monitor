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
  private model = 'gemini-flash-latest';           // Análises complexas (commits, Trello, suporte)
  private modelLight = 'gemini-flash-lite-latest';  // Tarefas simples (changelog) — ~50% mais barato

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async evaluateUserCommits(author: string, commits: CommitData[]): Promise<UserEvaluation> {
    const commitContext = commits.map(c =>
      `[${c.repository}] ${c.message}\n${c.url}\nDiff:\n${c.diff}`
    ).join('\n---\n');

    const prompt = `Você é um Tech Lead sênior. Analise os commits abaixo do desenvolvedor "${author}" das últimas 24h e preencha os 4 campos do relatório. Seja direto e objetivo.

${commitContext}

Responda estritamente no formato abaixo, sem texto extra:

**Suspeitas e Segurança:**
[Vulnerabilidades, senhas expostas, gambiarras perigosas. Se não houver: "Nada suspeito identificado."]

**Implementações:**
[O que foi implementado, corrigido ou refatorado.]

**Produtividade:**
[Avaliação do esforço e impacto das mudanças.]

**Decisões para o Gestor:**
[Problemas críticos que exigem decisão, com URLs. Se não houver: "Nenhuma decisão pendente identificada."]`;

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
        suspiciousFindings: suspiciousMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
        implementedFeatures: implementedMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
        productivityAssessment: productivityMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
        managerDecisions: managerDecisionsMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
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
    const actionContext = actions.map(a =>
      `${a.cardName} (${a.cardUrl}) [${a.date.substring(0, 10)}]: ${a.type} \u2014 ${a.details}`
    ).join('\n');

    const prompt = `Você é um Gestor de Projetos. Analise as atividades do Trello abaixo do colaborador "${author}" das últimas 24h. Foque no valor de negócio — cite nomes das demandas e comentários relevantes, sem ser robótico.

${actionContext}

Responda estritamente no formato abaixo, sem texto extra:

**Entregas Realizadas:**
[Demandas finalizadas ou marcadas como concluídas.]

**Iniciados e Em Andamento:**
[O que começou ou teve progresso.]

**Panorama Geral e Comentários:**
[Resumo geral, destaques e eventuais bloqueios.]

**Decisões para o Gestor:**
[Problemas, decisões críticas ou bloqueios que exijam validação. Inclua nome do cartão e URL. Se não houver: "Nenhuma decisão pendente identificada."]`;

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
        deliveredDemands: deliveredMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
        startedDemands: startedMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
        generalPanorama: panoramaMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
        managerDecisions: managerDecisionsMatch?.[1]?.trim() ?? 'Não foi possível extrair.',
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
    const cardsContext = cards.map(c =>
      `- ${c.name} (${c.url})${c.desc ? ': ' + c.desc.substring(0, 150) : ''}`
    ).join('\n');

    const prompt = `Você é um Product Manager. Escreva um Changelog Semanal em HTML para o quadro "${boardName}" com as entregas abaixo. Foque no valor gerado para o negócio (evite jargao técnico). Use emojis e categorize com as que tiverem itens:
- ✨ **Novas Funcionalidades**
- 🐛 **Correções de Bugs**
- ⚡ **Melhorias e Otimizações**
- 🛠️ **Manutenção**

Tom celebrativo. Tags: <h3>, <ul>, <li>, <strong>, <p>, <a>. Retorne APENAS o HTML puro (sem <html>/<body>, sem blocos \`\`\`html).

${cardsContext}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelLight, // Changelog: tarefa de formatação, usa modelo mais leve
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
    const ticketsContext = tickets.map(t =>
      `ID: ${t.id} | ${t.title} | Fase: ${t.stage} | Resp: ${t.assignedTo} | Criado: ${t.createdAt.substring(0, 10)}\nDescrição: ${(t.description || '').substring(0, 300)}`
    ).join('\n---\n');

    const prompt = `Você é um Coordenador de Suporte. Crie um relatório gerencial em HTML (sem <html>/<body>, sem \`\`\`html) sobre os chamados abertos do Bitrix24 abaixo.

Aborde:
1. Resumo da operação (total e overview da fila)
2. Atenção e gargalos (bloqueados ou sem resolução há muito tempo)
3. Fila por responsável
4. Problemas recorrentes e sugestão de causa raiz
5. Top 5 chamados críticos

Use <h3>, <ul>, <li>, <strong>, <p> e emojis. Retorne APENAS o HTML puro.

${ticketsContext}`;

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
