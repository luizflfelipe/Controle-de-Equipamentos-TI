# Referência de API

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno |
| Proprietário | Equipe de TI |
| Aprovador | Gestão de TI |
| Revisão | A cada alteração de contrato HTTP |
| Fontes | `server.ts` e `src/types/motoboy.ts` |

Base local: `http://localhost:3000`. Rotas protegidas exigem o cookie de sessão emitido por `POST /api/auth/login`. O header `x-user-email` é enviado pelo frontend, mas não substitui a sessão para autorização.

## Autenticação

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `POST /api/auth/login` | `{ "password": "..." }` | `200` e usuário; `401` para senha inválida; limitado a 10 tentativas/15 min. |
| `GET /api/auth/status` | Nenhum | `{ "authenticated": boolean, "user"?: object }`. |
| `POST /api/auth/logout` | Nenhum | Remove a sessão e retorna `{ "success": true }`. |

## Desligamentos e dashboard

| Método e rota | Autorização | Contrato |
| --- | --- | --- |
| `GET /api/dashboard-data` | Sessão válida | Retorna dados agregados do dashboard. |
| `POST /api/register` | Sessão válida | Registra ou atualiza uma devolução. |
| `GET /api/fetch-external-data?url=` | Sessão válida | Encaminha a URL para a ação `fetchExternal` do Apps Script. |

### `POST /api/register`

```json
{
  "colaborador": "Nome da pessoa",
  "desligamento": "2026-08-28",
  "equipamentoQuantidade": "1x Notebook, 1x Mouse",
  "equipDevolvido": "Devolvido",
  "controleMaju": "Entregue"
}
```

`colaborador` é obrigatório. `equipDevolvido`, quando informado, aceita apenas `Devolvido` ou `Desligamento`. Campos fora do schema são descartados antes do encaminhamento ao Apps Script.

### Resposta de dashboard

```json
{
  "totalDesligamentos": 0,
  "desligamentosMesAtual": 0,
  "mensalData": [{ "month": "Agosto 2026", "count": 0 }],
  "equipamentosMensal": [{ "month": "Agosto 2026", "count": 0 }],
  "equipamentosRanking": [{ "name": "Notebook", "count": 0 }],
  "pendencias": [],
  "recentReturns": [],
  "lastUpdate": "12:00:00"
}
```

## Motoboy

| Método e rota | Papel exigido | Finalidade |
| --- | --- | --- |
| `POST /api/motoboy/requests` | `suporte` | Cria solicitação. |
| `GET /api/motoboy/requests?includeAll=true` | `suporte` ou `recepcao` | Lista solicitações. |
| `GET /api/motoboy/requests/:id/events` | `suporte` ou `recepcao` | Retorna histórico somente com Supabase. |
| `PATCH /api/motoboy/requests/:id` | `recepcao` | Atualiza rastreio e situação. |
| `DELETE /api/motoboy/requests/:id` | `suporte` ou `recepcao` | Executa exclusão lógica com justificativa. |

### Criação

```json
{
  "nomeSolicitante": "Nome",
  "dataSolicitacao": "2026-08-28",
  "equipamento": "Notebook",
  "funcionario": "Nome do destinatário",
  "email": "pessoa@empresa.com",
  "centroCusto": "123",
  "telefone": "11999999999",
  "endereco": "Endereço completo",
  "tipoServico": "ENTREGA",
  "possuiRetorno": "Não",
  "prioridade": "Normal"
}
```

### Atualização

```json
{
  "maquinaRetirada": "ABC123",
  "enviado": "Sim",
  "recebido": "Não",
  "dataEnvioRecebimento": "Envio: 2026-08-28",
  "codigoRastreio": "BR123",
  "observacoes": "Coleta agendada"
}
```

A atualização calcula o estado final: recebido `Sim` conclui; enviado `Sim` e recebido `Não` gera pendência de recebimento; rastreio ou máquina retirada gera andamento.

### Exclusão

```json
{ "justificativa": "Solicitação duplicada" }
```

O backend responde `400` para schema inválido, `401` sem sessão, `403` para papel sem acesso e `500` para falhas de integração ou configuração.
