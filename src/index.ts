import dotenv from 'dotenv';
dotenv.config({ override: true });
import { GitHubService, CommitData } from './github';
import { TrelloService, TrelloActionData } from './trello';
import { AIService, UserEvaluation, TrelloEvaluation } from './ai';
import { EmailService } from './email';

async function main() {
  console.log('Iniciando avaliação diária de commits...');

  // Validação de variáveis de ambiente
  if (!process.env.GITHUB_TOKEN) console.warn('Aviso: GITHUB_TOKEN não definido. Ignorando GitHub.');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não definido.');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Credenciais SMTP não definidas.');
  
  const githubService = new GitHubService(process.env.GITHUB_TOKEN || '');
  const aiService = new AIService(process.env.GEMINI_API_KEY);
  const emailService = new EmailService();
  
  const defaultRecipients = process.env.DEFAULT_RECIPIENTS 
    ? process.env.DEFAULT_RECIPIENTS.split(',').map(e => e.trim()) 
    : [];

  // 1. GITHUB FLOW
  if (process.env.GITHUB_TOKEN) {
    try {
      console.log('Buscando commits das últimas 24h...');
      const commits = await githubService.getRecentCommits();

      if (commits.length > 0) {
        const commitsByAuthor = commits.reduce((acc, commit) => {
          if (!acc[commit.author]) acc[commit.author] = [];
          acc[commit.author].push(commit);
          return acc;
        }, {} as Record<string, CommitData[]>);

        const githubEvaluations: UserEvaluation[] = [];
        for (const [author, authorCommits] of Object.entries(commitsByAuthor)) {
          console.log(`Avaliando ${authorCommits.length} commits do usuário ${author}...`);
          const evaluation = await aiService.evaluateUserCommits(author, authorCommits);
          githubEvaluations.push(evaluation);
        }

        console.log('Enviando relatório do GitHub por e-mail...');
        const githubRecipients = [...defaultRecipients];
        await emailService.sendGitHubReport(githubEvaluations, 'Resumo Diário | Depto. de Desenvolvimento', githubRecipients);
      } else {
        console.log('Nenhum commit encontrado nas últimas 24h.');
      }
    } catch (err) {
      console.error('Erro no fluxo do GitHub:', err);
    }
  }

  // 2. TRELLO FLOW
  if (process.env.TRELLO_BOARDS) {
    try {
      let trelloConfigs = [];
      try {
        trelloConfigs = JSON.parse(process.env.TRELLO_BOARDS);
      } catch (parseError) {
        console.error('Aviso: Formato inválido em TRELLO_BOARDS no .env. Ignorando Trello.');
        trelloConfigs = [];
      }
      for (const config of trelloConfigs) {
        if (!config.key || !config.token || !config.boardId || !config.name) continue;
        
        const trelloService = new TrelloService(config.key, config.token, config.boardId, config.name);
        console.log(`Buscando atividades do Trello no quadro ${config.name} nas últimas 24h...`);
        const activities = await trelloService.getRecentActivities();

        if (activities.length > 0) {
          const activitiesByAuthor = activities.reduce((acc, action) => {
            if (!acc[action.author]) acc[action.author] = [];
            acc[action.author].push(action);
            return acc;
          }, {} as Record<string, TrelloActionData[]>);

          const trelloEvaluations: TrelloEvaluation[] = [];
          for (const [author, authorActions] of Object.entries(activitiesByAuthor)) {
            console.log(`Avaliando ${authorActions.length} ações do Trello do quadro ${config.name} (usuário ${author})...`);
            const evaluation = await aiService.evaluateTrelloActivities(author, authorActions);
            trelloEvaluations.push(evaluation);
          }
          
          console.log(`Enviando relatório do Trello para o quadro ${config.name}...`);
          const customRecipients = config.recipients ? config.recipients.split(',').map((e: string) => e.trim()) : [];
          const allRecipients = Array.from(new Set([...defaultRecipients, ...customRecipients]));
          const title = config.emailTitle || `Resumo Diário | ${config.name}`;
          
          await emailService.sendTrelloReport(trelloEvaluations, title, allRecipients);
        } else {
          console.log(`Nenhuma atividade no Trello (quadro ${config.name}) encontrada nas últimas 24h.`);
        }
      }
    } catch (err) {
      console.error('Erro ao processar configurações do Trello:', err);
    }
  }

  console.log('Processo finalizado com sucesso!');
}

main().catch(error => {
  console.error('Erro na execução principal:', error);
  process.exit(1);
});
