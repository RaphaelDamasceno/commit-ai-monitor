import nodemailer from 'nodemailer';
import { UserEvaluation } from './ai';

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

  async sendDailyReport(evaluations: UserEvaluation[], to: string) {
    if (evaluations.length === 0) {
      console.log('No evaluations to send.');
      return;
    }

    const dateStr = new Date().toLocaleDateString('pt-BR');
    let html = \`
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
          Relatório de Produtividade e Segurança (GitHub) - \${dateStr}
        </h2>
        <p>Aqui está o resumo das atividades dos desenvolvedores nas últimas 24 horas.</p>
    \`;

    for (const evalResult of evaluations) {
      html += \`
        <div style="background-color: #f9f9f9; border-left: 4px solid #3498db; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #2980b9;">👤 Usuário: \${evalResult.author}</h3>
          <p><strong>Commits analisados:</strong> \${evalResult.commitsAnalyzed}</p>
          
          <h4 style="color: #c0392b;">🚨 Segurança e Suspeitas</h4>
          <p style="white-space: pre-wrap;">\${evalResult.suspiciousFindings}</p>
          
          <h4 style="color: #27ae60;">🛠️ Implementações</h4>
          <p style="white-space: pre-wrap;">\${evalResult.implementedFeatures}</p>
          
          <h4 style="color: #8e44ad;">⚡ Produtividade</h4>
          <p style="white-space: pre-wrap;">\${evalResult.productivityAssessment}</p>
        </div>
      \`;
    }

    html += \`
        <p style="font-size: 12px; color: #7f8c8d; text-align: center; margin-top: 30px;">
          Relatório gerado automaticamente por IA.
        </p>
      </div>
    \`;

    try {
      const info = await this.transporter.sendMail({
        from: \`"GitHub AI Monitor" <\${process.env.SMTP_USER}>\`,
        to,
        subject: \`[IA] Resumo de Commits e Avaliação - \${dateStr}\`,
        html,
      });
      console.log(\`Relatório enviado com sucesso para \${to}. MessageId: \${info.messageId}\`);
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error);
    }
  }
}
