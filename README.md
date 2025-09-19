<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

Esta aplicação React captura a imagem da webcam do usuário, envia para o backend e utiliza um provedor LLM configurável (por padrão, Google Gemini) para sugerir penteados ou gerar uma prévia com um novo estilo.

## Pré-requisitos
- [Node.js](https://nodejs.org/) 18 ou superior
- Uma chave válida do provedor LLM configurado (por padrão, Gemini)

## Configuração do ambiente
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```
2. Copie o arquivo `.env.example` para `.env` e informe as credenciais do provedor escolhido (por padrão, defina `GEMINI_API_KEY` para o Gemini):
   ```bash
   cp .env.example .env
   # Edite o arquivo e defina as variáveis necessárias (ex.: GEMINI_API_KEY)
   ```
3. Opcionalmente ajuste as variáveis de ambiente:
   - `PORT`: porta do servidor backend (padrão: `3001`).
   - `CORS_ORIGIN`: origem permitida para chamadas diretas ao backend.
   - `GEMINI_IMAGE_MODEL` e `GEMINI_SUGGESTION_MODEL`: modelos padrão usados pelo backend quando o provedor é o Gemini.
   - `VITE_API_BASE_URL`: URL utilizada pelo front-end para chegar ao backend (padrão: `/api`, que é atendido via proxy do Vite).
   - `VITE_LLM_PROVIDERS`: lista de provedores exibidos no seletor do front-end (separados por vírgula). Se omitido, apenas o provedor padrão é mostrado.
   - `VITE_LLM_PROVIDER`, `VITE_LLM_MODEL` e `VITE_LLM_SUGGESTION_MODEL`: valores padrão para exibição e envio ao backend.

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

- `POST /api/llm/suggestions`
  - **Body**: `{ base64Data: string, mimeType: string, provider?: string, model?: string }`
  - **Resposta**: `{ suggestions: string }`
  - Retorna uma lista textual com sugestões de penteado para a imagem enviada.

- `POST /api/llm/edit`
  - **Body**: `{ base64Data: string, mimeType: string, prompt: string, provider?: string, model?: string, referenceImage?: { base64Data: string, mimeType: string } }`
  - **Resposta**: `{ image?: string, text?: string }` (data URL contendo a imagem gerada e/ou uma resposta textual).
  - Gera uma nova imagem aplicando o estilo descrito (opcionalmente guiado por uma imagem de referência). Caso o provedor devolva somente texto, a mensagem é encaminhada ao front-end.

- Rotas legadas `/api/gemini/suggestions` e `/api/gemini/edit` continuam disponíveis e encaminham para os mesmos fluxos acima, garantindo compatibilidade com integrações existentes.

- `GET /health`
  - Retorna `{"status":"ok"}` e pode ser usado para checagens simples de disponibilidade.

Todas as rotas dependem de uma credencial válida (`GEMINI_API_KEY` quando o provedor ativo é o Gemini) e respondem em JSON. Erros são devolvidos com a propriedade `message` no corpo da resposta para facilitar o tratamento no front-end.

## Deploy
Para implantar, disponibilize o backend como um serviço Node.js (executando `node --loader tsx server/index.ts` ou compilando para JavaScript) com as credenciais do provedor configuradas (ex.: `GEMINI_API_KEY`) e sirva os arquivos do build do front-end gerados por `npm run build`. Ajuste `VITE_API_BASE_URL` e as variáveis `VITE_LLM_*` conforme necessário para apontar para a URL pública do backend e selecionar o provedor/modelo desejado.
