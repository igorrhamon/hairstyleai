<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

Esta aplicação React captura a imagem da webcam do usuário, envia para o backend e utiliza a API Gemini para sugerir penteados ou gerar uma prévia com um novo estilo.

## Pré-requisitos
- [Node.js](https://nodejs.org/) 18 ou superior
- Uma chave válida da API Gemini

## Configuração do ambiente
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```
2. Copie o arquivo `.env.example` para `.env` e informe sua chave da API Gemini:
   ```bash
   cp .env.example .env
   # Edite o arquivo e defina GEMINI_API_KEY
   ```
3. Opcionalmente ajuste as variáveis de ambiente:
   - `PORT`: porta do servidor backend (padrão: `3001`).
   - `CORS_ORIGIN`: origem permitida para chamadas diretas ao backend.
   - `VITE_API_BASE_URL`: URL utilizada pelo front-end para chegar ao backend (padrão: `/api`, que é atendido via proxy do Vite).

O backend lê automaticamente as variáveis definidas em `.env` através do pacote `dotenv`.

## Como executar em desenvolvimento
O script `npm run dev` executa simultaneamente o backend (em `http://localhost:3001`) e o front-end Vite (em `http://localhost:5173`) usando um proxy para as rotas `/api`.

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173` e repassará as chamadas para o backend automaticamente.

### Scripts auxiliares
- `npm run server`: executa apenas o backend em modo watch (`server/index.ts`).
- `npm run client`: executa somente o front-end Vite.
- `npm run build`: gera o build de produção do front-end.
- `npm run preview`: pré-visualiza o build gerado.

## Endpoints do backend
O servidor exposto em `server/index.ts` oferece as seguintes rotas HTTP:

- `POST /api/gemini/suggestions`
  - **Body**: `{ base64Data: string, mimeType: string }`
  - **Resposta**: `{ suggestions: string }`
  - Retorna uma lista textual com sugestões de penteado para a imagem enviada.

- `POST /api/gemini/edit`
  - **Body**: `{ base64Data: string, mimeType: string, prompt: string, referenceImage?: { base64Data: string, mimeType: string } }`
  - **Resposta**: `{ image: string }` (data URL contendo a imagem gerada).
  - Gera uma nova imagem aplicando o estilo descrito (opcionalmente guiado por uma imagem de referência).

- `GET /health`
  - Retorna `{"status":"ok"}` e pode ser usado para checagens simples de disponibilidade.

Todas as rotas dependem da variável `GEMINI_API_KEY` e respondem em JSON. Erros são devolvidos com a propriedade `message` no corpo da resposta para facilitar o tratamento no front-end.

## Deploy
Para implantar, disponibilize o backend como um serviço Node.js (executando `node --loader tsx server/index.ts` ou compilando para JavaScript) com a variável `GEMINI_API_KEY` configurada e sirva os arquivos do build do front-end gerados por `npm run build`. Ajuste `VITE_API_BASE_URL` conforme necessário para apontar para a URL pública do backend.
