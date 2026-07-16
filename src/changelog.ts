import dotenv from 'dotenv';
dotenv.config({ override: true });
import { TrelloService } from './trello';
import { AIService } from './ai';
import { EmailService } from './email';

async function main() {
  console.log('Iniciando geração do Changelog Semanal...');

  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não definido.');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Credenciais SMTP não definidas.');
  
  const aiService = new AIService(process.env.GEMINI_API_KEY);
  const emailService = new EmailService();
  
  const defaultRecipients = process.env.DEFAULT_RECIPIENTS 
    ? process.env.DEFAULT_RECIPIENTS.split(',').map(e => e.trim()) 
    : [];

  if (process.env.TRELLO_BOARDS) {
    try {
      const trelloConfigs = JSON.parse(process.env.TRELLO_BOARDS);

      for (const config of trelloConfigs) {
        if (!config.key || !config.token || !config.boardId || !config.name) continue;
        
        const doneListName = process.env.TRELLO_DONE_LIST_NAME || 'Done';
        const trelloService = new TrelloService(config.key, config.token, config.boardId, config.name);
        
        console.log(`Buscando entregas da semana no quadro ${config.name} (Lista: ${doneListName})...`);
        const doneCards = await trelloService.getWeeklyDoneCards(doneListName);

        if (doneCards.length > 0) {
          console.log(`Encontradas ${doneCards.length} entregas! Gerando texto do changelog com IA...`);
          const changelogHtml = await aiService.generateWeeklyChangelog(config.name, doneCards);
          
          console.log(`Enviando Changelog Semanal para o quadro ${config.name}...`);
          const customRecipients = config.recipients ? config.recipients.split(',').map((e: string) => e.trim()) : [];
          const allRecipients = Array.from(new Set([...defaultRecipients, ...customRecipients]));
          const title = `Changelog Semanal - ${config.name}`;
          
          await emailService.sendChangelogReport(changelogHtml, title, allRecipients);
        } else {
          console.log(`Nenhuma entrega encontrada no Trello (quadro ${config.name}, lista ${doneListName}) na última semana.`);
        }
      }
    } catch (err) {
      console.error('Erro ao processar configurações do Trello para Changelog:', err);
    }
  } else {
    console.warn('Aviso: Variável TRELLO_BOARDS não definida. Changelog depende do Trello.');
  }

  console.log('Geração de Changelog finalizada com sucesso!');
}

main().catch(error => {
  console.error('Erro na execução do Changelog:', error);
  process.exit(1);
});
