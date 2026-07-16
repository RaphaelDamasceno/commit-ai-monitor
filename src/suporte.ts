import dotenv from 'dotenv';
dotenv.config({ override: true });
import { BitrixService } from './bitrix';
import { AIService } from './ai';
import { EmailService } from './email';

async function main() {
  console.log('Iniciando Geração do Relatório de Suporte Diário...');

  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não definido.');
  if (!process.env.BITRIX24_WEBHOOK_URL) throw new Error('BITRIX24_WEBHOOK_URL não definido. Verifique seu .env.');

  const bitrixService = new BitrixService(process.env.BITRIX24_WEBHOOK_URL);
  const aiService = new AIService(process.env.GEMINI_API_KEY);
  const emailService = new EmailService();

  const defaultRecipients = process.env.DEFAULT_RECIPIENTS 
    ? process.env.DEFAULT_RECIPIENTS.split(',').map(e => e.trim()) 
    : [];

  if (defaultRecipients.length === 0) {
    console.warn('Nenhum destinatário configurado em DEFAULT_RECIPIENTS.');
  }

  try {
    const tickets = await bitrixService.getOpenSupportTickets();
    
    if (tickets.length > 0) {
      console.log(`Foram encontrados ${tickets.length} chamados em aberto. Analisando via IA...`);
      const supportHtml = await aiService.evaluateSupportTickets(tickets);

      console.log('Enviando relatório de suporte por e-mail...');
      await emailService.sendSupportReport(supportHtml, 'Relatório Diário de Suporte | Bitrix24', defaultRecipients);
      console.log('Processo de Suporte finalizado com sucesso!');
    } else {
      console.log('Nenhum chamado de suporte em aberto no momento. E-mail não enviado.');
    }
  } catch (err) {
    console.error('Erro na geração do relatório de suporte:', err);
  }
}

main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
