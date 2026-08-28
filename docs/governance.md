# Governança da Documentação

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno |
| Proprietário | Equipe de TI |
| Aprovador | Gestão de TI |
| Revisão | Trimestral |
| Status | Ativo |

## Papéis e responsabilidades

| Papel | Responsabilidade |
| --- | --- |
| Equipe de TI | Mantém a documentação alinhada ao código, às integrações e ao ambiente de execução. |
| Gestão de TI | Aprova mudanças relevantes de arquitetura, acesso, dados e operação. |
| Recepção | Valida mudanças que afetem o fluxo operacional de Motoboy ou devoluções. |
| Segurança da Informação | Avalia mudanças que afetem segredos, exposição externa, permissões ou dados pessoais. |

## Ciclo de revisão

1. Revise esta documentação trimestralmente.
2. Revise imediatamente quando houver alteração de arquitetura, endpoint, permissão, modelo de dados, integração externa ou procedimento de publicação.
3. Registre no pull request ou solicitação de mudança quais páginas foram revisadas.
4. Obtenha aprovação da Gestão de TI para mudanças de alto impacto.

## Critérios de qualidade

Antes de publicar uma atualização, confirme que:

- Os links internos funcionam e não há conteúdo incompleto.
- O texto descreve o comportamento atual da aplicação, não apenas o comportamento pretendido.
- Nenhum segredo, URL interna, dado pessoal real ou dado operacional sensível foi incluído.
- As evidências de teste e as limitações conhecidas foram atualizadas.
- A documentação técnica e a visão corporativa não se contradizem.

## Controle de mudanças

Use o histórico do repositório como registro de versão. Cada alteração relevante deve indicar no título ou descrição da mudança:

- motivo da alteração;
- sistemas ou processos afetados;
- risco operacional;
- validações executadas;
- necessidade de comunicação ou treinamento.

## Estrutura para Confluence

Ao migrar para o Confluence, crie uma página raiz com o conteúdo de [Portal de Documentação](README.md) e use os demais documentos como páginas-filhas, na ordem apresentada. A classificação e os responsáveis de cada cabeçalho devem ser mantidos como propriedades da página ou painel de metadados.
