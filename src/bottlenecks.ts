import dotenv from 'dotenv';
dotenv.config();
import { TrelloService } from './trello';
import { EmailService } from './email';

async function main() {
  console.log('Iniciando verificação de gargalos no Trello...');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Credenciais SMTP não definidas.');
  
  const emailService = new EmailService();
  
  const defaultRecipients = process.env.DEFAULT_RECIPIENTS 
    ? process.env.DEFAULT_RECIPIENTS.split(',').map(e => e.trim()) 
    : [];

  const staleListsStr = process.env.TRELLO_STALE_LISTS || 'Doing,Em Andamento,Code Review';
  const staleLists = staleListsStr.split(',').map(s => s.trim());
  const daysStale = parseInt(process.env.TRELLO_STALE_DAYS || '5', 10);

  if (process.env.TRELLO_BOARDS) {
    try {
      const trelloConfigs = JSON.parse(process.env.TRELLO_BOARDS);

      for (const config of trelloConfigs) {
        if (!config.key || !config.token || !config.boardId || !config.name) continue;
        
        const trelloService = new TrelloService(config.key, config.token, config.boardId, config.name);
        
        console.log(`Buscando cartões parados há mais de ${daysStale} dias no quadro ${config.name}...`);
        console.log(`Listas monitoradas: ${staleLists.join(', ')}`);
        
        const staleCards = await trelloService.getStaleCards(staleLists, daysStale);

        if (staleCards.length > 0) {
          console.log(`Encontrados ${staleCards.length} possíveis gargalos! Enviando alerta...`);
          
          const customRecipients = config.recipients ? config.recipients.split(',').map((e: string) => e.trim()) : [];
          const allRecipients = Array.from(new Set([...defaultRecipients, ...customRecipients]));
          const title = `Alerta de Gargalos - ${config.name}`;
          
          await emailService.sendBottleneckAlert(staleCards, config.name, title, allRecipients);
        } else {
          console.log(`Nenhum gargalo detectado no quadro ${config.name}. O time está fluindo bem!`);
        }
      }
    } catch (err) {
      console.error('Erro ao processar configurações do Trello para Gargalos:', err);
    }
  } else {
    console.warn('Aviso: Variável TRELLO_BOARDS não definida.');
  }

  console.log('Verificação de gargalos finalizada com sucesso!');
}

main().catch(error => {
  console.error('Erro na execução da verificação de gargalos:', error);
  process.exit(1);
});
