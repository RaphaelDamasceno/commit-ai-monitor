import { subDays, isAfter } from 'date-fns';

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

      const actions: any[] = await response.json() as any[];
      
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

  async getBoardLists(): Promise<{ id: string, name: string }[]> {
    try {
      const url = new URL(`https://api.trello.com/1/boards/${this.boardId}/lists`);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('token', this.apiToken);
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Erro na API do Trello: ${response.statusText}`);
      
      const lists = await response.json() as any[];
      return lists.map((l: any) => ({ id: l.id, name: l.name }));
    } catch (error) {
      console.error('Error in getBoardLists:', error);
      return [];
    }
  }

  async getStaleCards(listNames: string[], daysStale: number): Promise<any[]> {
    try {
      const lists = await this.getBoardLists();
      const targetLists = lists.filter(l => listNames.some(name => l.name.toLowerCase().includes(name.toLowerCase())));
      const targetListIds = targetLists.map(l => l.id);

      if (targetListIds.length === 0) return [];

      const url = new URL(`https://api.trello.com/1/boards/${this.boardId}/cards`);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('token', this.apiToken);
      url.searchParams.append('fields', 'id,name,dateLastActivity,shortUrl,idList,desc');
      url.searchParams.append('members', 'true');
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Erro na API do Trello: ${response.statusText}`);
      
      const cards = await response.json() as any[];
      
      const cutoffDate = subDays(new Date(), daysStale);
      
      const staleCards = cards.filter((card: any) => {
        if (!targetListIds.includes(card.idList)) return false;
        const lastActivity = new Date(card.dateLastActivity);
        return lastActivity < cutoffDate;
      }).map((card: any) => {
        const listName = lists.find(l => l.id === card.idList)?.name || 'Unknown';
        const members = card.members ? card.members.map((m: any) => m.fullName).join(', ') : 'Nenhum membro';
        const daysSinceActivity = Math.floor((new Date().getTime() - new Date(card.dateLastActivity).getTime()) / (1000 * 3600 * 24));
        return {
          id: card.id,
          name: card.name,
          url: card.shortUrl,
          listName,
          members,
          daysSinceActivity,
          dateLastActivity: card.dateLastActivity
        };
      });

      return staleCards;
    } catch (error) {
      console.error('Error in getStaleCards:', error);
      return [];
    }
  }

  async getWeeklyDoneCards(doneListName: string): Promise<any[]> {
    try {
      const lists = await this.getBoardLists();
      const doneList = lists.find(l => l.name.toLowerCase().includes(doneListName.toLowerCase()));
      
      if (!doneList) {
        console.warn(`Lista "${doneListName}" não encontrada no quadro ${this.boardName}`);
        return [];
      }

      const url = new URL(`https://api.trello.com/1/lists/${doneList.id}/cards`);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('token', this.apiToken);
      url.searchParams.append('fields', 'id,name,dateLastActivity,shortUrl,desc');
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Erro na API do Trello: ${response.statusText}`);
      
      const cards = await response.json() as any[];
      const cutoffDate = subDays(new Date(), 7);
      
      const weeklyCards = cards.filter((card: any) => {
        const lastActivity = new Date(card.dateLastActivity);
        return isAfter(lastActivity, cutoffDate);
      }).map((card: any) => ({
        id: card.id,
        name: card.name,
        url: card.shortUrl,
        desc: card.desc
      }));

      return weeklyCards;
    } catch (error) {
      console.error('Error in getWeeklyDoneCards:', error);
      return [];
    }
  }
}
