export interface TrelloActionData {
  author: string;
  type: string;
  date: string;
  cardName: string;
  cardUrl: string;
  details: string;
}

export class TrelloService {
  private apiKey: string;
  private apiToken: string;
  private boardId: string;
  private boardName: string;

  constructor(apiKey: string, apiToken: string, boardId: string, boardName: string) {
    this.apiKey = apiKey;
    this.apiToken = apiToken;
    this.boardId = boardId;
    this.boardName = boardName;
  }

  async getRecentActivities(): Promise<TrelloActionData[]> {
    // Calcula o dia anterior (00:00:00 até 23:59:59)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const since = yesterday.toISOString();

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    const before = yesterdayEnd.toISOString();

    console.log(`Buscando eventos no Trello de ${since} até ${before}...`);

    try {
      // Usando fetch nativo do Node.js
      const url = new URL(`https://api.trello.com/1/boards/${this.boardId}/actions`);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('token', this.apiToken);
      url.searchParams.append('since', since);
      url.searchParams.append('before', before);
      url.searchParams.append('limit', '1000');
      // Filtros das ações mais relevantes de trabalho
      url.searchParams.append('filter', 'createCard,updateCard,commentCard,updateCheckItemStateOnCard,addAttachmentToCard,addMemberToCard');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Erro na API do Trello: ${response.status} ${response.statusText}`);
      }

      const actions: any[] = await response.json();
      
      const parsedActions: TrelloActionData[] = [];

      for (const action of actions) {
        const author = action.memberCreator?.fullName || 'Unknown';
        const type = action.type;
        const date = action.date;
        const cardName = `[${this.boardName}] ${action.data?.card?.name || 'Unknown Card'}`;
        const cardId = action.data?.card?.shortLink || '';
        const cardUrl = cardId ? `https://trello.com/c/${cardId}` : 'No URL';
        
        let details = '';

        if (type === 'updateCard' && action.data?.listBefore && action.data?.listAfter) {
          details = `Moveu o cartão de "${action.data.listBefore.name}" para "${action.data.listAfter.name}"`;
        } else if (type === 'commentCard') {
          details = `Comentou: "${action.data?.text || ''}"`;
        } else if (type === 'updateCheckItemStateOnCard') {
          const state = action.data?.checkItem?.state === 'complete' ? 'Concluiu' : 'Desmarcou';
          details = `${state} o item "${action.data?.checkItem?.name || ''}" do checklist`;
        } else if (type === 'createCard') {
          details = `Criou o cartão na lista "${action.data?.list?.name || ''}"`;
        } else if (type === 'addAttachmentToCard') {
          details = `Adicionou um anexo: ${action.data?.attachment?.name || ''}`;
        } else if (type === 'addMemberToCard') {
          details = `Adicionou o membro ${action.data?.member?.name || ''} ao cartão`;
        } else if (type === 'updateCard' && action.data?.old?.desc !== undefined) {
           details = `Atualizou a descrição do cartão`;
        } else {
          // Ignorar outras atualizações menores do updateCard que não mapeamos detalhadamente
          if (type === 'updateCard') continue; 
          details = `Ação do tipo: ${type}`;
        }

        const actionDate = new Date(date);
        if (actionDate < yesterday || actionDate > yesterdayEnd) continue;

        parsedActions.push({
          author,
          type,
          date,
          cardName,
          cardUrl,
          details
        });
      }

      console.log(`Foram encontradas ${parsedActions.length} ações relevantes no Trello.`);
      return parsedActions;

    } catch (error) {
      console.error('Error in getRecentActivities (Trello):', error);
      return [];
    }
  }
}
