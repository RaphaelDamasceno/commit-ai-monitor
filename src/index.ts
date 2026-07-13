import 'dotenv/config';
import { GitHubService, CommitData } from './github';
import { AIService, UserEvaluation } from './ai';
import { EmailService } from './email';

async function main() {
  console.log('Iniciando avaliação diária de commits...');

  // Validação de variáveis de ambiente
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN não definido.');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não definido.');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Credenciais SMTP não definidas.');

  const githubService = new GitHubService(process.env.GITHUB_TOKEN);
  const aiService = new AIService(process.env.GEMINI_API_KEY);
  const emailService = new EmailService();
  
  const orgName = process.env.GITHUB_ORG_NAME; // Opcional
  const targetEmail = 'raphaelferdam@gmail.com'; // Hardcoded as requested

  console.log('Buscando commits das últimas 24h...');
  const commits = await githubService.getRecentCommits(orgName);

  if (commits.length === 0) {
    console.log('Nenhum commit encontrado nas últimas 24h.');
    return;
  }

  // Agrupar commits por autor
  const commitsByAuthor = commits.reduce((acc, commit) => {
    if (!acc[commit.author]) acc[commit.author] = [];
    acc[commit.author].push(commit);
    return acc;
  }, {} as Record<string, CommitData[]>);

  const evaluations: UserEvaluation[] = [];

  for (const [author, authorCommits] of Object.entries(commitsByAuthor)) {
    console.log(\`Avaliando \${authorCommits.length} commits do usuário \${author}...\`);
    const evaluation = await aiService.evaluateUserCommits(author, authorCommits);
    evaluations.push(evaluation);
  }

  console.log('Enviando relatório por e-mail...');
  await emailService.sendDailyReport(evaluations, targetEmail);
  
  console.log('Processo finalizado com sucesso!');
}

main().catch(error => {
  console.error('Erro na execução principal:', error);
  process.exit(1);
});
