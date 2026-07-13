# 🤖 Commit AI Monitor

Um sistema automatizado que monitora diariamente os repositórios da sua organização no GitHub, avalia o código submetido usando Inteligência Artificial (Google Gemini) e envia um relatório completo por e-mail sobre produtividade, implementações e segurança.

## 🚀 O que este projeto faz?

- **Busca Automática**: Conecta-se à API do GitHub e extrai todos os commits feitos nas últimas 24 horas por qualquer colaborador.
- **Análise Inteligente**: Envia os *diffs* de código (o que mudou) para o Google Gemini AI atuando como um "Tech Lead Sênior", que avalia:
  - 🚨 **Segurança**: Vazamento de senhas, chaves de API, más práticas e vulnerabilidades.
  - 🛠️ **Implementações**: Resumo amigável sobre o que foi construído ou corrigido.
  - ⚡ **Produtividade**: Avaliação qualitativa baseada na complexidade e impacto da entrega.
- **Relatório por E-mail**: Consolida tudo em um e-mail com design elegante, agrupado por usuário, e envia para o gestor.
- **Execução Serverless**: Roda de forma gratuita através do GitHub Actions todos os dias, sem necessidade de alugar servidores.

---

## ⚙️ Arquitetura e Tecnologias

- **Node.js + TypeScript**: Base do script de automação.
- **@octokit/rest**: SDK oficial para interagir com a API do GitHub.
- **@google/genai**: Integração com os modelos de IA Generativa do Google (Gemini 2.5 Pro).
- **Nodemailer**: Envio do e-mail consolidado via SMTP.
- **GitHub Actions**: Motor de CRON job.

---

## 🛠️ Como implantar (Setup)

Este projeto foi projetado para rodar no **GitHub Actions**. Siga os passos abaixo para configurá-lo no seu repositório.

### 1. Variáveis de Ambiente (Secrets)

Para que a ação do GitHub consiga se comunicar de forma segura com as APIs, você precisará adicionar alguns **Secrets** no repositório.
Vá em `Settings` > `Secrets and variables` > `Actions` > `New repository secret` e crie:

| Secret | Descrição |
|--------|-------------|
| `GH_PAT_TOKEN` | *Personal Access Token* (Clássico ou Fine-Grained) com permissões de leitura (repo, read:org) na organização alvo. |
| `GEMINI_API_KEY` | Chave de API gerada no Google AI Studio. |
| `SMTP_HOST` | Host do seu serviço de e-mail (Ex: `smtp.gmail.com`). |
| `SMTP_PORT` | Porta TLS/SSL (Ex: `465`). |
| `SMTP_USER` | E-mail de remetente. |
| `SMTP_PASS` | Senha de aplicativo do seu e-mail de remetente (nunca use a senha real da conta). |
| `GITHUB_ORG_NAME` | *(Opcional)* Nome da Organização para buscar os repositórios. Se vazio, buscará os repositórios do dono do token. |

### 2. Rodando pela primeira vez

A automação está configurada para rodar diariamente às **02:00 UTC** (o que equivale às 23:00 no fuso de Brasília).

Se quiser testar imediatamente:
1. Vá na aba **Actions** do repositório.
2. Clique em **Daily Commit Evaluation**.
3. Clique em **Run workflow**.

---

## 💻 Rodando Localmente (Para desenvolvimento)

Se você quiser testar ou modificar o código na sua máquina:

1. Clone o repositório:
   \`\`\`bash
   git clone https://github.com/SEU_USUARIO/commit-ai-monitor.git
   cd commit-ai-monitor
   \`\`\`

2. Instale as dependências:
   \`\`\`bash
   npm install
   \`\`\`

3. Crie um arquivo \`.env\` na raiz baseado no \`.env.example\` e preencha com suas chaves.

4. Execute o script:
   \`\`\`bash
   npx tsx src/index.ts
   \`\`\`

---

## 📝 Licença

Desenvolvido para monitoramento e gestão ágil de equipes de desenvolvimento. Uso livre para modificações.
