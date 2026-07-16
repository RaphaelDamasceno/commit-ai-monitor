import dotenv from 'dotenv';
dotenv.config({ override: true });

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  stage: string;
  assignedTo: string;
  createdAt: string;
}

export class BitrixService {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    // Remove trailing slash if present
    this.webhookUrl = webhookUrl.endsWith('/') ? webhookUrl.slice(0, -1) : webhookUrl;
    
    // If the user pasted a URL with a method (e.g. crm.deal.list.json), we strip it to get the base webhook URL
    if (this.webhookUrl.includes('.json')) {
      const parts = this.webhookUrl.split('/');
      parts.pop();
      this.webhookUrl = parts.join('/');
    }
  }

  async getOpenSupportTickets(): Promise<SupportTicket[]> {
    console.log('Buscando chamados de suporte abertos no Bitrix24...');
    
    // CATEGORY_ID = 54 é o Pipeline de "Suporte" mapeado
    const url = `${this.webhookUrl}/crm.deal.list.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          CATEGORY_ID: 54,
          CLOSED: 'N'
        },
        select: ['*', 'UF_*']
      })
    });

    const data = await response.json();
    if (!data.result) {
      console.log('Nenhum chamado retornado ou erro na API.');
      return [];
    }
    
    const deals = data.result;

    // Fetch users to map IDs to Names
    console.log('Buscando mapeamento de usuários...');
    const usersResponse = await fetch(`${this.webhookUrl}/user.get.json`);
    const usersData = await usersResponse.json();
    const usersMap: Record<string, string> = {};
    if (usersData.result) {
      usersData.result.forEach((u: any) => {
        usersMap[u.ID] = `${u.NAME} ${u.LAST_NAME || ''}`.trim();
      });
    }

    const manualUsersMap: Record<string, string> = {
      '382': 'Raphael Damasceno',
      '3400': 'João Valentim',
      '5105': 'Rafael Arcanjo',
      '1326': 'Pedro Leal'
    };

    // Fetch stages to map STAGE_ID to Names
    console.log('Buscando mapeamento de fases (stages)...');
    const stagesResponse = await fetch(`${this.webhookUrl}/crm.dealcategory.stage.list.json?id=54`);
    const stagesData = await stagesResponse.json();
    const stagesMap: Record<string, string> = {};
    if (stagesData.result) {
      stagesData.result.forEach((s: any) => {
        stagesMap[s.STATUS_ID] = s.NAME;
      });
    }

    // Map raw deals to SupportTicket interface and filter out ID 4955
    const supportTickets: SupportTicket[] = [];
    for (const d of deals) {
      if (d.ASSIGNED_BY_ID === '4955') continue;
      
      supportTickets.push({
        id: d.ID,
        title: d.TITLE,
        description: d.UF_CRM_1749565478 || 'Sem descrição detalhada',
        stage: stagesMap[d.STAGE_ID] || d.STAGE_ID,
        assignedTo: manualUsersMap[d.ASSIGNED_BY_ID] || usersMap[d.ASSIGNED_BY_ID] || d.ASSIGNED_BY_ID,
        createdAt: d.DATE_CREATE
      });
    }

    return supportTickets;
  }
}
