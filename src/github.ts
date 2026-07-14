import { Octokit } from '@octokit/rest';

export interface CommitData {
  repository: string;
  author: string;
  message: string;
  url: string;
  diff: string;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getRecentCommits(orgName?: string): Promise<CommitData[]> {
    const commitsMap = new Map<string, CommitData>();
    
    // Calcula o dia anterior (00:00:00 até 23:59:59)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const since = yesterday.toISOString();

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    const until = yesterdayEnd.toISOString();

    console.log(`Buscando eventos de ${since} até ${until}...`);

    try {
      const authUser = await this.octokit.users.getAuthenticated();
      const username = authUser.data.login;
      
      let events: any[] = [];
      
      // Busca a timeline de eventos (PushEvents) do usuário na organização ou global
      if (orgName) {
        const response = await this.octokit.activity.listOrgEventsForAuthenticatedUser({
          username,
          org: orgName,
          per_page: 100,
        });
        events = response.data;
      } else {
        const response = await this.octokit.activity.listEventsForAuthenticatedUser({
          username,
          per_page: 100,
        });
        events = response.data;
      }

      // Filtra apenas eventos de Push ocorridos no dia anterior
      const pushEvents = events.filter(e => {
        if (e.type !== 'PushEvent' || !e.created_at) return false;
        const eventDate = new Date(e.created_at);
        return eventDate >= yesterday && eventDate <= yesterdayEnd;
      });

      // Agrupa os repositórios e branches que receberam push
      const branchesToCheck = new Set<string>();
      
      for (const event of pushEvents) {
        const repoFullName = event.repo.name; // Ex: "Hub-On-Tecnologia/dashboard-comercial-focus"
        const payload = event.payload as any;
        
        if (payload && payload.ref) {
          // Extrai o nome da branch (ex: "refs/heads/dev" -> "dev")
          const branch = payload.ref.replace('refs/heads/', '');
          branchesToCheck.add(`${repoFullName}:${branch}`);
        }
      }

      console.log(`Foram encontrados pushes em ${branchesToCheck.size} branch(es) diferentes.`);

      // Para cada branch que recebeu push, buscamos os commits
      for (const repoBranch of branchesToCheck) {
        const [repoFullName, branch] = repoBranch.split(':');
        const [owner, repo] = repoFullName.split('/');

        try {
          const commitsResponse = await this.octokit.repos.listCommits({
            owner,
            repo,
            sha: branch,
            since,
            until,
          });

          for (const commit of commitsResponse.data) {
            // Evita duplicatas caso a mesma branch tenha tido múltiplos PushEvents agrupados
            if (commitsMap.has(commit.sha)) continue;

            // Busca os arquivos modificados para montar o diff
            try {
              const commitDetail = await this.octokit.repos.getCommit({
                owner,
                repo,
                ref: commit.sha,
              });

              let diff = '';
              if (commitDetail.data.files) {
                for (const file of commitDetail.data.files) {
                  if (file.patch) {
                    diff += `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}\n\n`;
                  }
                }
              }

              commitsMap.set(commit.sha, {
                repository: repo,
                author: commit.commit.author?.name || commit.author?.login || 'Unknown',
                message: commit.commit.message,
                url: commit.html_url,
                diff: diff || 'No diff available or binary files changed',
              });

            } catch (diffError) {
              console.error(`Error fetching diff for commit ${commit.sha}:`, diffError);
            }
          }
        } catch (branchError) {
          console.error(`Error fetching commits for branch ${branch} in ${repoFullName}:`, branchError);
        }
      }
    } catch (error) {
      console.error('Error in getRecentCommits:', error);
    }

    return Array.from(commitsMap.values());
  }
}
