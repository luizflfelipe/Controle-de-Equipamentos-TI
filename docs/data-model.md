# Modelo de Dados

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno |
| Proprietário | Equipe de TI |
| Aprovador | Gestão de TI |
| Revisão | A cada mudança de planilha, tabela ou retenção |
| Fontes | Apps Script, `src/types/motoboy.ts` e `server.ts` |

## Desligamentos

O Apps Script de Desligados trabalha com abas mensais. A busca por colaborador é global e normalizada; quando encontra uma linha existente, atualiza a própria aba. Para novo registro, usa a data de desligamento quando disponível.

| Coluna | Origem | Observação |
| --- | --- | --- |
| Colaborador | Portal ou importação | Chave de busca lógica, não identificador único técnico. |
| Cargo | Importação ou payload | Opcional. |
| Desligamento | Importação ou payload | Direciona a aba mensal para novos registros. |
| Recebido | Portal | Data atual somente para devolução. |
| Filial | Importação ou payload | Barra Funda é a filial considerada nos indicadores. |
| E-mail | Importação ou payload | Portal não substitui e-mail existente. |
| Equip. Devolvido | Portal | `Devolvido` ou `Desligamento`. |
| Controle Maju | Portal | Normalmente `Entregue`. |
| Equipamento(s) e Quantidade | Portal | Texto consolidado, por exemplo `1x Notebook`. |

## Solicitação Motoboy

O tipo canônico está em `src/types/motoboy.ts`. Em Supabase os nomes são snake_case; no frontend e na resposta HTTP são camelCase.

| Campo | Obrigatório na criação | Descrição |
| --- | --- | --- |
| `id` | Gerado pelo backend | `MOTO-<timestamp>-<aleatório>`. |
| `nomeSolicitante` | Sim | Pessoa que solicitou a operação. |
| `dataSolicitacao` | Sim | Data informada na solicitação. |
| `equipamento` | Sim | Itens envolvidos. |
| `funcionario` | Sim | Destinatário ou responsável pelo ativo. |
| `email` | Sim | E-mail de contato. |
| `centroCusto` | Não | Valor vazio por padrão. |
| `telefone`, `endereco` | Sim | Dados logísticos. |
| `tipoServico` | Sim | `ENTREGA` ou `Retirada`. |
| `possuiRetorno` | Sim | `Sim` ou `Não`. |
| `prioridade` | Sim | Baixa, Normal, Alta ou Urgente. |
| `maquinaRetirada`, `enviado`, `recebido` | Não | Preenchidos na operação de Recepção. |
| `dataEnvioRecebimento`, `codigoRastreio`, `observacoes` | Não | Rastreamento e contexto. |
| `status` | Calculado | Estado do fluxo. |
| `justificativaExclusao`, `excluidoPor`, `excluidoEm` | Exclusão | Auditoria da exclusão lógica. |
| `criadoEm`, `atualizadoEm` | Persistência | Datas técnicas. |

## Persistência Motoboy

### Apps Script

A aba padrão é `Motoboy`; pode ser trocada por `MOTOBOY_SHEET_NAME`. O script requer 24 cabeçalhos, mantém `ID` oculto e rejeita uma planilha que já tenha cabeçalhos incompatíveis.

### Supabase

O backend espera as tabelas externas abaixo, não incluídas neste repositório:

- `motoboy_requests`: todos os campos da solicitação em snake_case.
- `motoboy_request_events`: `request_id`, `event_type`, `actor`, `payload` e `created_at`.

A credencial é service role no backend. As políticas, índices, constraints e migrations devem ser mantidos no projeto Supabase que hospeda essas tabelas.

## Retenção

- A interface exibe exclusões por até sete dias.
- Com Supabase, uma listagem inicia remoção assíncrona de exclusões com mais de sete dias e `excluido_em` anterior ao limite.
- Apps Script não executa limpeza automática; o histórico permanece na aba.
