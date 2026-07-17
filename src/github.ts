import { Octokit } from '@octokit/rest';

// Limites de tamanho de diff para controle de custo de tokens
const MAX_DIFF_CHARS_PER_FILE = 3000;
const MAX_TOTAL_DIFF_CHARS_PER_COMMIT = 8000;

// Arquivos sem valor analítico (locks, minificados, binários, mapas)
const SKIP_DIFF_FILENAMES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'Gemfile.lock', 'poetry.lock']);
const SKIP_DIFF_EXTENSIONS = ['.min.js', '.min.css', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip'];

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
      let repos: any[] = [];
      
      console.log(`Buscando repositórios...`);
      if (orgName) {
        repos = await this.octokit.paginate(this.octokit.repos.listForOrg, {
          org: orgName,
          type: 'all',
        });
      } else {
        repos = await this.octokit.paginate(this.octokit.repos.listForAuthenticatedUser, {
          affiliation: 'owner,collaborator,organization_member',
        });
      }

      console.log(`Foram encontrados ${repos.length} repositórios. Buscando eventos...`);
      
      let pushEvents: any[] = [];
      
      for (const repo of repos) {
        try {
          const events = await this.octokit.paginate(this.octokit.activity.listRepoEvents, {
            owner: repo.owner.login,
            repo: repo.name,
            per_page: 100,
          });

          const repoPushEvents = events.filter((e: any) => {
            if (e.type !== 'PushEvent' || !e.created_at) return false;
            const eventDate = new Date(e.created_at);
            return eventDate >= yesterday && eventDate <= yesterdayEnd;
          });

          pushEvents.push(...repoPushEvents);
        } catch (error) {
          console.error(`Erro ao buscar eventos do repositório ${repo.full_name}:`, error);
        }
      }

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
        const [repoFullName = '', branch = ''] = repoBranch.split(':');
        const [owner = '', repo = ''] = repoFullName.split('/');

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
                  // Pula arquivos sem valor analítico
                  const filename = file.filename;
                  const basename = filename.split('/').pop() || '';
                  const isSkipFile = SKIP_DIFF_FILENAMES.has(basename);
                  const isSkipExt = SKIP_DIFF_EXTENSIONS.some(ext => filename.endsWith(ext));
                  if (isSkipFile || isSkipExt || !file.patch) continue;

                  // Trunca patch muito grande por arquivo
                  const patch = file.patch.length > MAX_DIFF_CHARS_PER_FILE
                    ? file.patch.substring(0, MAX_DIFF_CHARS_PER_FILE) + '\n... [diff truncado]'
                    : file.patch;

                  diff += `--- ${filename}\n${patch}\n\n`;

                  // Trunca diff total do commit
                  if (diff.length > MAX_TOTAL_DIFF_CHARS_PER_COMMIT) {
                    diff = diff.substring(0, MAX_TOTAL_DIFF_CHARS_PER_COMMIT) + '\n... [demais arquivos omitidos por limite de tamanho]';
                    break;
                  }
                }
              }
              if (!diff) diff = 'Nenhum diff textual disponível (apenas arquivos binários ou sem mudanças relevantes).';

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
