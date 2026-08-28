# Visão Geral Corporativa

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno |
| Proprietário | Equipe de TI |
| Aprovador | Gestão de TI |
| Revisão | Trimestral ou após alteração relevante de escopo |
| Status | Ativo |

## Propósito

O Controle de Equipamentos de TI apoia o processo de desligamento de colaboradores e a logística de coleta e entrega de equipamentos. A aplicação centraliza o registro de devoluções, a consulta de indicadores de ativos e a operação de solicitações de Motoboy.

## Escopo corporativo

| Processo | Resultado esperado | Áreas envolvidas |
| --- | --- | --- |
| Desligamento e devolução | Registro consistente de ativos devolvidos e pendências visíveis. | TI e Recepção |
| Dashboard | Indicadores consolidados para acompanhamento operacional. | TI e gestão |
| Motoboy | Solicitações rastreáveis de coleta e entrega. | Suporte TI e Recepção |

O sistema não substitui o controle corporativo de identidade, a gestão de segredos nem o processo formal de inventário patrimonial.

## Integrações e dados

O frontend React se comunica com um backend Express. O backend mantém a sessão, aplica autorização e integra com Apps Script e Google Sheets. Para Motoboy, a persistência pode usar Apps Script ou Supabase, conforme configuração do ambiente. Consulte a [arquitetura](architecture.md) e o [modelo de dados](data-model.md) para detalhes.

## Riscos e controles relevantes

| Tema | Risco | Controle atual ou ação necessária |
| --- | --- | --- |
| Segredos | Exposição de senhas, chaves ou URLs internas. | Variáveis de ambiente; nunca registrar valores reais nesta documentação. |
| Acesso | Papéis incorretos concederem operações de Motoboy. | Autorização pelo papel armazenado na sessão; revisão periódica dos e-mails autorizados. |
| Integrações | Falha ou implantação desatualizada de Apps Script. | Publicação versionada e verificações do runbook. |
| Qualidade | Regressões não identificadas antes do release. | Checagem de tipos, validadores estáticos e validação autorizada do dashboard; lacunas registradas na estratégia de testes. |

## Decisões operacionais

- Apps Script de Desligados e Motoboy devem permanecer como implantações separadas.
- A chave de serviço Supabase é exclusiva do backend.
- Exclusões de Motoboy são lógicas e exigem justificativa.
- Toda mudança de contrato, fluxo ou integração deve atualizar a documentação correspondente antes da publicação.
