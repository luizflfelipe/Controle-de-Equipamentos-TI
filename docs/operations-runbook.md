# Runbook Operacional

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno — operação restrita |
| Proprietário | Equipe de TI responsável pela aplicação |
| Aprovador | Gestão de TI |
| Revisão | Semestral, antes de publicação ou após incidente relevante |
| Fontes | `.env.example`, `package.json` e `apps-script/` |

## Configuração

Crie `.env` com base em `.env.example` e defina:

| Variável | Obrigatória quando | Finalidade |
| --- | --- | --- |
| `TI_PASSWORD`, `RECEPTION_PASSWORD`, `MARIA_PASSWORD` | Sempre | Credenciais dos três perfis atuais. |
| `SESSION_SECRET` | Sempre | Assinatura do cookie de sessão. |
| `GOOGLE_SCRIPT_URL` | Desligamentos e dashboard | URL publicada do Apps Script de Desligados. |
| `MOTOBOY_GOOGLE_SCRIPT_URL` | Motoboy por Apps Script | URL dedicada; se ausente, usa `GOOGLE_SCRIPT_URL`. |
| `MOTOBOY_STORAGE=supabase` | Motoboy por Supabase | Seleciona persistência Supabase. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Conexão exclusiva do backend. |
| `AUTH_DEBUG=true` | Diagnóstico temporário | Habilita logs extras de autenticação. |

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, senhas ou URLs internas ao frontend.

## Publicação dos Apps Scripts

Os scripts devem permanecer separados:

| Fluxo | Arquivo local | Configuração externa |
| --- | --- | --- |
| Desligados | `apps-script/Desligados-prod.gs` | ID de planilha em `CFG.SPREADSHEET_ID`. |
| Motoboy | `apps-script/Controle-Motoboy-homologacao.gs` | `MOTOBOY_SPREADSHEET_ID` e, opcionalmente, `MOTOBOY_SHEET_NAME`. |

Para publicar uma alteração:

1. Copie o arquivo correto para o projeto Apps Script correspondente.
2. Crie uma nova versão em `Implantar` > `Gerenciar implantações`.
3. Garanta que o Web App esteja acessível ao backend configurado.
4. Atualize a URL no ambiente caso o deployment tenha mudado.
5. Reinicie o processo Node para carregar as variáveis de ambiente.

O script de Desligados usa Gmail, Drive e serviço avançado do Drive para ler anexos. As permissões dessas APIs precisam ser concedidas à conta do script.

## Build e inicialização

```bash
bun install
bun run lint
bun run build
bun run start
```

Para desenvolvimento, use `bun run dev`. Antes de publicar, confirme que a plataforma fornece HTTPS e revise a opção `secure` do cookie de sessão.

## Verificação

```bash
bun run lint
for file in scripts/verify-*.mjs; do node "$file"; done
node scripts/validate-live-desligados-dashboard.mjs
```

O último comando exige `.env` com `GOOGLE_SCRIPT_URL` e acesso de rede ao Web App. Ele não deve ser executado contra produção sem autorização operacional.

## Diagnóstico

| Sintoma | Verificação | Ação |
| --- | --- | --- |
| Resposta HTML em vez de JSON | A URL do Apps Script pode apontar para página de autorização. | Reimplante o Web App e revise acesso e URL. |
| Dashboard desatualizado | Cache do backend dura até dois minutos. | Aguarde o TTL ou reinicie o backend em manutenção. |
| Motoboy retorna dados de Desligados | A URL de Motoboy está apontando para script incorreto. | Configure `MOTOBOY_GOOGLE_SCRIPT_URL` e publique o script dedicado. |
| Exclusão Motoboy falha com script desatualizado | Deployment não possui `deleteMotoboyRequest`. | Atualize `Controle-Motoboy-homologacao.gs`, publique nova versão e reinicie Node. |
| Erro Supabase | Variáveis ou tabelas ausentes. | Confirme `MOTOBOY_STORAGE`, URL, service role e schema externo. |
| Login não persiste | Cookie bloqueado por proxy/HTTPS. | Revise proxy, domínio, SameSite, Secure e `SESSION_SECRET`. |
