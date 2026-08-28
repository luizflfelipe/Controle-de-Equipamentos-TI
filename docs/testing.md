# Estratégia de Testes e Cobertura

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno |
| Proprietário | Equipe de TI |
| Aprovador | Gestão de TI |
| Revisão | A cada mudança de fluxo crítico ou gate de release |
| Fontes | `package.json` e `scripts/` |

## Estado atual

O projeto possui verificações estáticas baseadas em scripts Node e checagem de tipos TypeScript. Não há framework de testes unitários de runtime nem testes end-to-end configurados no `package.json`.

| Camada | Cobertura atual | Evidência |
| --- | --- | --- |
| Tipos | TypeScript sem emissão, quando as dependências estão instaladas. | `npm run lint` ou `bun run lint`. |
| Contratos de código | Scripts verificam tokens e estruturas esperadas. | `scripts/verify-*.mjs`. |
| Integração externa | Validação do dashboard publicado. | `validate-live-desligados-dashboard.mjs`. |
| UI e comportamento | Sem execução em navegador automatizada. | Lacuna. |
| Apps Script real | Sem harness local ou deployment temporário. | Lacuna. |

## Como executar

```bash
bun run lint
for file in scripts/verify-*.mjs; do node "$file"; done
```

Para validar a implantação real de Desligados:

```bash
node scripts/validate-live-desligados-dashboard.mjs
```

Esse comando lê `.env`. Sem `GOOGLE_SCRIPT_URL`, ele falha antes de consultar a rede, o que é esperado em uma cópia do repositório sem credenciais.

## Evidência da última verificação local

Em 28/08/2026, neste checkout sem `node_modules`, `bun run lint` não pôde ser iniciado porque `bun` não está instalado e `npm run lint` não pôde localizar `tsc`. A instalação das dependências é pré-requisito para a checagem de tipos.

Os scripts estáticos foram executados individualmente. A maior parte passou, mas os itens abaixo falharam por expectativas textuais que não coincidem com o código atual:

| Script | Motivo observado |
| --- | --- |
| `verify-motoboy-cache.mjs` | Procura `motoboyCache[role]`; o backend usa `cacheKey = role + includeAll`. |
| `verify-motoboy-reception-requester-info.mjs` | Procura textos e uma variável de uma versão anterior do painel de Recepção. |
| `verify-motoboy-rejects-empty-id.mjs` | Procura uma expressão específica; a UI filtra IDs vazios por outra expressão. |
| `verify-motoboy-ui.mjs` | Procura rótulos textuais que não aparecem na UI atual. |

Essas falhas não foram corrigidas nesta entrega, pois o escopo é documentação. Antes de usar a suíte como gate de release, alinhe os validadores ao comportamento intencional do produto ou restaure os contratos esperados.

## Principais contratos cobertos

- Schemas, papéis, endpoints e ações Apps Script do Motoboy.
- Mapeamento fixo de colunas e atualização parcial do Motoboy.
- Preservação de colunas existentes e validações de formulário.
- Separação entre scripts de Desligados e Motoboy.
- Payload HTTP `application/x-www-form-urlencoded` para Apps Script.
- Formato e consistência esperada do dashboard publicado.

## Lacunas prioritárias

1. **Autorização executável:** testar `401` e `403` com sessão real para cada rota, pois os scripts atuais inspecionam principalmente código-fonte.
2. **Persistência Supabase:** adicionar migrations versionadas, constraints, políticas RLS e testes contra ambiente efêmero.
3. **Apps Script:** isolar funções puras (normalização, transição de estado, transformação de linhas) e testar com fixtures de planilhas.
4. **Fluxos críticos de UI:** automatizar login, registro de devolução, criação Motoboy, atualização pela Recepção e exclusão justificada.
5. **Erros de integração:** simular timeout, HTTP 429/5xx e resposta não JSON para comprovar o comportamento de retry e as mensagens ao usuário.

## Critério mínimo antes de release

1. `bun run lint` passa.
2. Todos os `scripts/verify-*.mjs` passam.
3. O Apps Script correto foi publicado como nova versão.
4. A validação ao vivo do dashboard passa em ambiente autorizado.
5. Um usuário de Suporte e um de Recepção concluem o fluxo que lhes cabe.
6. Segredos, URLs e `.env` não aparecem no artefato de frontend nem no controle de versão.
