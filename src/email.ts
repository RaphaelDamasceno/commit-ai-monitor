import nodemailer from 'nodemailer';
import { UserEvaluation, TrelloEvaluation } from './ai';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendGitHubReport(githubEvaluations: UserEvaluation[], title: string, to: string[]) {
    if (githubEvaluations.length === 0) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toLocaleDateString('pt-BR');
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
          ${title} - ${dateStr}
        </h2>
        <p>Aqui está o resumo das atividades dos desenvolvedores no GitHub nas últimas 24 horas.</p>
        <h3 style="background-color: #ecf0f1; padding: 10px; border-radius: 5px;">
          <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" width="20" style="vertical-align: middle;"> GitHub - Commits
        </h3>
    `;

    for (const evalResult of githubEvaluations) {
      html += `
        <div style="background-color: #f9f9f9; border-left: 4px solid #3498db; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #2980b9;">👤 Usuário: ${evalResult.author}</h3>
          <p><strong>Commits analisados:</strong> ${evalResult.commitsAnalyzed}</p>
          
          <h4 style="color: #c0392b;">🚨 Segurança e Suspeitas</h4>
          <p style="white-space: pre-wrap;">${evalResult.suspiciousFindings}</p>
          
          <h4 style="color: #27ae60;">🛠️ Implementações</h4>
          <p style="white-space: pre-wrap;">${evalResult.implementedFeatures}</p>
          
          <h4 style="color: #8e44ad;">⚡ Produtividade</h4>
          <p style="white-space: pre-wrap;">${evalResult.productivityAssessment}</p>
        </div>
      `;
    }

    const allDecisions: { source: string, author: string, decision: string }[] = [];
    githubEvaluations.forEach(e => {
      if (e.managerDecisions && !e.managerDecisions.toLowerCase().includes('nenhuma decisão pendente identificada') && e.managerDecisions.length > 20) {
        allDecisions.push({ source: 'GitHub', author: e.author, decision: e.managerDecisions });
      }
    });

    html += this.generateDecisionsHtml(allDecisions);
    html += this.generateFooterHtml();

    await this.sendHtmlEmail(to.join(','), `[IA] ${title} - ${dateStr}`, html);
  }

  async sendTrelloReport(trelloEvaluations: TrelloEvaluation[], title: string, to: string[]) {
    if (trelloEvaluations.length === 0) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toLocaleDateString('pt-BR');
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #0052cc; padding-bottom: 10px;">
          ${title} - ${dateStr}
        </h2>
        <p>Aqui está o resumo do acompanhamento de tarefas no Trello nas últimas 24 horas.</p>
        <h3 style="background-color: #ecf0f1; padding: 10px; border-radius: 5px; margin-top: 20px;">
          <img src="https://a.trellocdn.com/prgb/assets/27702bf92911b3e9dcad.png" width="20" style="vertical-align: middle;"> Trello - Atividades
        </h3>
    `;

    for (const trelloEval of trelloEvaluations) {
      html += `
        <div style="background-color: #f9f9f9; border-left: 4px solid #0052cc; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #0052cc;">👤 Colaborador: ${trelloEval.author}</h3>
          <p><strong>Ações analisadas:</strong> ${trelloEval.actionsAnalyzed}</p>
          
          <h4 style="color: #27ae60;">✅ Entregas Realizadas</h4>
          <p style="white-space: pre-wrap;">${trelloEval.deliveredDemands}</p>
          
          <h4 style="color: #d35400;">🚧 Iniciados e Em Andamento</h4>
          <p style="white-space: pre-wrap;">${trelloEval.startedDemands}</p>
          
          <h4 style="color: #8e44ad;">📊 Panorama Geral e Comentários</h4>
          <p style="white-space: pre-wrap;">${trelloEval.generalPanorama}</p>
        </div>
      `;
    }

    const allDecisions: { source: string, author: string, decision: string }[] = [];
    trelloEvaluations.forEach(e => {
      if (e.managerDecisions && !e.managerDecisions.toLowerCase().includes('nenhuma decisão pendente identificada') && e.managerDecisions.length > 20) {
        allDecisions.push({ source: 'Trello', author: e.author, decision: e.managerDecisions });
      }
    });

    html += this.generateDecisionsHtml(allDecisions);
    html += this.generateFooterHtml();

    await this.sendHtmlEmail(to.join(','), `[IA] ${title} - ${dateStr}`, html);
  }

  async sendChangelogReport(changelogHtml: string, title: string, to: string[]) {
    if (!changelogHtml || to.length === 0) return;

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h2 style="color: #27ae60; border-bottom: 2px solid #2ecc71; padding-bottom: 10px; text-align: center;">
          🎉 ${title} 🎉
        </h2>
        <div style="margin-top: 20px; line-height: 1.6;">
          ${changelogHtml}
        </div>
        ${this.generateFooterHtml()}
    `;

    await this.sendHtmlEmail(to.join(','), title, html);
  }

  async sendBottleneckAlert(staleCards: any[], boardName: string, title: string, to: string[]) {
    if (staleCards.length === 0 || to.length === 0) return;

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h2 style="color: #c0392b; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
          ⚠️ ${title}
        </h2>
        <p>Os seguintes cartões no quadro <strong>${boardName}</strong> não têm atividade há vários dias e podem ser um gargalo:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Cartão</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Lista Atual</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Membros</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Dias Parado</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const card of staleCards) {
      html += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">
            <a href="${card.url}" style="color: #3498db; text-decoration: none;">${card.name}</a>
          </td>
          <td style="padding: 10px; border: 1px solid #ddd;">${card.listName}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${card.members}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #c0392b; font-weight: bold;">
            ${card.daysSinceActivity} dias
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
        ${this.generateFooterHtml()}
    `;

    await this.sendHtmlEmail(to.join(','), title, html);
  }

  async sendSupportReport(supportHtml: string, title: string, to: string[]) {
    if (!supportHtml || to.length === 0) return;

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h2 style="color: #8e44ad; border-bottom: 2px solid #9b59b6; padding-bottom: 10px; text-align: center;">
          🎧 ${title} 🎧
        </h2>
        <div style="margin-top: 20px; line-height: 1.6;">
          ${supportHtml}
        </div>
        ${this.generateFooterHtml()}
    `;

    await this.sendHtmlEmail(to.join(','), title, html);
  }

  private generateDecisionsHtml(decisions: { source: string, author: string, decision: string }[]): string {
    if (decisions.length === 0) return '';
    
    let html = `
      <div style="margin-top: 40px; padding: 20px; background-color: #fff3cd; border: 2px solid #ffeeba; border-radius: 8px;">
        <h2 style="color: #856404; margin-top: 0; border-bottom: 2px solid #ffeeba; padding-bottom: 10px;">
          ⚠️ Atenção: Tomadas de Decisão Pendentes
        </h2>
        <p style="color: #856404; font-size: 14px;">Os seguintes itens exigem revisão gerencial:</p>
    `;

    for (const d of decisions) {
      html += `
        <div style="background-color: #ffffff; padding: 15px; margin-top: 15px; border-left: 4px solid #f39c12; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <strong style="color: #f39c12;">[${d.source}] ${d.author}:</strong>
          <div style="margin-top: 10px; color: #333; white-space: pre-wrap;">${d.decision}</div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  private generateFooterHtml(): string {
    return `
        <p style="font-size: 12px; color: #7f8c8d; text-align: center; margin-top: 40px;">
          Relatório gerado automaticamente por IA.
        </p>
      </div>
    `;
  }

  private async sendHtmlEmail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Produtividade IA" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`Relatório '${subject}' enviado com sucesso para ${to}. MessageId: ${info.messageId}`);
    } catch (error) {
      console.error(`Erro ao enviar e-mail '${subject}':`, error);
    }
  }
}
