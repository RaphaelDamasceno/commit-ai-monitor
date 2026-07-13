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
    const commitsData: CommitData[] = [];
    // Calculate the date 24 hours ago
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 1);
    const since = sinceDate.toISOString();

    let repos: { name: string; owner: { login: string } }[] = [];

    if (orgName) {
      const response = await this.octokit.repos.listForOrg({
        org: orgName,
        sort: 'pushed',
        per_page: 50,
      });
      repos = response.data;
    } else {
      const response = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'pushed',
        per_page: 50,
      });
      repos = response.data;
    }

    for (const repo of repos) {
      try {
        const commits = await this.octokit.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          since,
        });

        for (const commit of commits.data) {
          // Get the full diff for the commit
          try {
            const commitDetail = await this.octokit.repos.getCommit({
              owner: repo.owner.login,
              repo: repo.name,
              ref: commit.sha,
            });

            // The files array contains the patch (diff) for each modified file
            let diff = '';
            if (commitDetail.data.files) {
              for (const file of commitDetail.data.files) {
                if (file.patch) {
                  diff += `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}\n\n`;
                }
              }
            }

            commitsData.push({
              repository: repo.name,
              author: commit.commit.author?.name || commit.author?.login || 'Unknown',
              message: commit.commit.message,
              url: commit.html_url,
              diff: diff || 'No diff available or binary files changed',
            });
          } catch (diffError) {
            console.error(`Error fetching diff for commit ${commit.sha}:`, diffError);
          }
        }
      } catch (repoError) {
        console.error(`Error fetching commits for repo ${repo.name}:`, repoError);
      }
    }

    return commitsData;
  }
}
