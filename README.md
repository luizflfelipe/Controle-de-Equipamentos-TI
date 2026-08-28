# Controle de Equipamentos de TI

Aplicação para registrar devoluções no processo de desligamento, acompanhar indicadores de ativos e operar solicitações de coleta e entrega por motoboy.

## Início rápido

1. Instale as dependências com `bun install`.
2. Crie `.env` a partir de `.env.example` e preencha as variáveis obrigatórias.
3. Execute `bun run dev`.
4. Abra `http://localhost:3000`.

O servidor Express integra o frontend Vite no desenvolvimento e serve os arquivos compilados em produção. O processo local sempre escuta a porta 3000.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `bun run dev` | Inicia Express e Vite em modo de desenvolvimento. |
| `bun run build` | Gera `dist/` para frontend e backend. |
| `bun run start` | Inicia `dist/server.cjs`. |
| `bun run lint` | Executa a checagem de tipos TypeScript. |

## Documentação

- [Portal da documentação](docs/README.md): ponto de entrada corporativo, públicos e governança.
- [Visão geral corporativa](docs/overview.md): objetivo, escopo, integrações e riscos para gestão.
- [Arquitetura](docs/architecture.md): componentes, limites e integrações.
- [Arquitetura de informação](docs/information-architecture.md): atores, permissões e fluxos de negócio.
- [Referência de API](docs/api-reference.md): contratos HTTP do backend.
- [Modelo de dados](docs/data-model.md): planilhas, entidades e estados.
- [Telas da plataforma](docs/platform-screens.md): registros visuais dos fluxos principais.
- [Runbook operacional](docs/operations-runbook.md): configuração, publicação e diagnóstico.
- [Estratégia de testes](docs/testing.md): verificações existentes e lacunas.
- [Governança da documentação](docs/governance.md): responsáveis, revisões e controle de mudanças.
- [Apps Script](apps-script/README.md): separação e publicação dos scripts.

## Limites conhecidos

- O repositório não contém migrations nem políticas RLS do Supabase; a opção `MOTOBOY_STORAGE=supabase` depende de tabelas externas já provisionadas.
- Os Apps Scripts são implantados fora deste repositório. Alterar um arquivo `.gs` local não publica automaticamente uma nova versão.
- As credenciais e URLs reais não devem ser versionadas. Use apenas `.env` no ambiente de execução.
