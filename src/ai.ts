import { GoogleGenAI } from '@google/genai';
import { CommitData } from './github';

export interface UserEvaluation {
  author: string;
  commitsAnalyzed: number;
  suspiciousFindings: string;
  implementedFeatures: string;
  productivityAssessment: string;
}

export class AIService {
  private ai: GoogleGenAI;
  private model = 'gemini-2.5-pro'; // Recommended model for complex coding analysis

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

Com base nesses dados, forneça um relatório estruturado avaliando os seguintes 3 pontos:

1. **Suspeitas e Segurança**: Há algo suspeito no código? (ex: vazamento de senhas/chaves, vulnerabilidades óbvias, lógicas maliciosas, ou gambiarras perigosas). Se não houver, diga claramente que não encontrou nada suspeito.
2. **Implementações**: O que exatamente foi implementado ou resolvido? Resuma as funcionalidades, correções de bugs ou refatorações de forma clara para um gestor técnico entender.
3. **Produtividade**: Avalie a produtividade do usuário baseado na complexidade das mudanças (não apenas quantidade de linhas, mas impacto arquitetural e esforço aparente).

Formate sua resposta estritamente usando o seguinte modelo, sem texto extra:

**Suspeitas e Segurança:**
[Sua análise aqui]

**Implementações:**
[Sua análise aqui]

**Produtividade:**
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
      const productivityMatch = text.match(/\*\*Produtividade:\*\*\s*([\s\S]*)$/i);

      return {
        author,
        commitsAnalyzed: commits.length,
        suspiciousFindings: suspiciousMatch ? suspiciousMatch[1].trim() : 'Não foi possível extrair.',
        implementedFeatures: implementedMatch ? implementedMatch[1].trim() : 'Não foi possível extrair.',
        productivityAssessment: productivityMatch ? productivityMatch[1].trim() : 'Não foi possível extrair.',
      };
    } catch (error) {
      console.error(`Error analyzing commits for author ${author}:`, error);
      return {
        author,
        commitsAnalyzed: commits.length,
        suspiciousFindings: 'Erro ao processar análise na IA.',
        implementedFeatures: 'Erro ao processar análise na IA.',
        productivityAssessment: 'Erro ao processar análise na IA.',
      };
    }
  }
}
