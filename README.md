<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

Esta aplicação React captura a imagem da webcam do usuário, envia para o backend e consulta um provedor de LLM (Gemini ou OpenAI) para sugerir penteados ou gerar uma prévia com um novo estilo.

## Provedores suportados
- **Google Gemini**: fluxo multimodal completo com suporte a sugestões de texto e geração/edição de imagem.
- **OpenAI**: integra-se aos modelos GPT para sugestões e ao `gpt-image-1` para estilizar a foto.

## Pré-requisitos
- [Node.js](https://nodejs.org/) 18 ou superior
- Credenciais do provedor LLM que você pretende usar (`GEMINI_API_KEY` ou `OPENAI_API_KEY`)

## Configuração do ambiente
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```
2. Copie o arquivo `.env.example` para `.env` e configure as variáveis:
   ```bash
   cp .env.example .env
   ```
3. Escolha o provedor principal ajustando `LLM_PROVIDER` (`gemini` é o padrão) e preencha as credenciais correspondentes.

### Configuração do Gemini
- `GEMINI_API_KEY`: chave obrigatória para autenticar as chamadas.
- `GEMINI_SUGGESTION_MODEL`: modelo usado para gerar descrições (ex.: `gemini-2.5-flash`).
- `GEMINI_IMAGE_MODEL`: modelo que cria/edita imagens (ex.: `gemini-2.5-flash-image-preview`).

### Configuração da OpenAI
- `OPENAI_API_KEY`: chave obrigatória ao definir `LLM_PROVIDER=openai`.
- `OPENAI_SUGGESTION_MODEL`: modelo multimodal responsável por analisar a foto e sugerir penteados (ex.: `gpt-4o-mini`).
- `OPENAI_IMAGE_MODEL`: modelo de geração de imagem (ex.: `gpt-image-1`).

### Variáveis adicionais
- `PORT`: porta do servidor backend (padrão: `3001`).
- `CORS_ORIGIN`: origem permitida para chamadas diretas ao backend.
- `VITE_API_BASE_URL`: URL utilizada pelo front-end para chegar ao backend (padrão: `/api`, via proxy do Vite).

O backend lê automaticamente as variáveis definidas em `.env` através do pacote `dotenv`.

## Guia rápido para escolher modelos

| Provedor | Sugestões (`*_SUGGESTION_MODEL`) | Geração/Edição (`*_IMAGE_MODEL`) | Observações |
| --- | --- | --- | --- |
| Gemini | `gemini-2.5-flash` | `gemini-2.5-flash-image-preview` | Equilibra custo e qualidade para fluxos multimodais. Use outros modelos (`gemini-2.0-flash-lite`, `gemini-1.5-pro`) se precisar otimizar latência ou qualidade. |
| OpenAI | `gpt-4o-mini` | `gpt-image-1` | Certifique-se de habilitar acesso Vision/Image na conta. Modelos como `gpt-4.1-mini` ou `o4-mini` também funcionam para texto/visão. |

Defina as variáveis `GEMINI_*` ou `OPENAI_*` conforme o provedor escolhido em `LLM_PROVIDER`.

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
O servidor exposto em `server/index.ts` fornece rotas neutras que escolhem automaticamente o provedor configurado via `LLM_PROVIDER`:

- `POST /api/llm/suggestions`
  - **Body**: `{ base64Data: string, mimeType: string }`
  - **Resposta**: `{ suggestions: string }`
  - Analisa a foto enviada e retorna sugestões textuais de penteado.

- `POST /api/llm/edit`
  - **Body**: `{ base64Data: string, mimeType: string, prompt: string, referenceImage?: { base64Data: string, mimeType: string } }`
  - **Resposta**: `{ image: string }` (data URL contendo a imagem gerada).
  - Aplica o estilo descrito (ou da imagem de referência) sobre a foto informada.

- `GET /health`
  - Retorna `{ "status": "ok" }` e pode ser usado para checagens simples de disponibilidade.

### Rotas específicas por provedor
As rotas legadas do Gemini continuam disponíveis para compatibilidade e apontam para os mesmos handlers quando `LLM_PROVIDER=gemini`:

- `POST /api/gemini/suggestions`
- `POST /api/gemini/edit`

Se necessário, rotas equivalentes podem ser expostas para OpenAI seguindo o padrão `/api/openai/*`.

Todas as rotas respondem em JSON e exigem as credenciais do provedor correspondente. Em caso de erro, o servidor retorna a propriedade `message` no corpo da resposta.

## Deploy
Para implantar, disponibilize o backend como um serviço Node.js (executando `node --loader tsx server/index.ts` ou compilando para JavaScript) com `LLM_PROVIDER` e as credenciais do provedor configurados. Sirva os arquivos do build do front-end gerados por `npm run build` e ajuste `VITE_API_BASE_URL` para apontar para a URL pública do backend.
