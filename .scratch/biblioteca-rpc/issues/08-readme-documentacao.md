# 08: README e documentação final

**What to build:** a documentação que o enunciado exige, permitindo ao professor clonar o repositório público e rodar tudo sozinho: instalação, como rodar servidor/cliente/testes/reset, descrição de cada RPC (parâmetros, retorno, erros), exemplos de uso reais do CLI e justificativas das escolhas de implementação.

**Blocked by:** 05 (`ConsultarEmprestimosUsuario`), 06 (`ConsultarEmprestimosLivro`), 07 (Dados de demonstração e reset)

**Status:** ready-for-agent

- [ ] README em português: visão geral, requisitos, instalação, comandos, configuração (`BIBLIOTECA_HOST`, `BIBLIOTECA_PORTA`, `BIBLIOTECA_HOJE`, caminho do banco)
- [ ] Descrição de cada RPC com parâmetros, retorno e tabela de erros (status gRPC + mensagem); RPCs extras sinalizadas como além do enunciado
- [ ] Exemplos de uso com saídas reais do CLI
- [ ] Justificativas (gRPC + ts-proto, Livro com Exemplares, erros como status, SQLite/better-sqlite3, transações e concorrência, CLI) com links para as ADRs e o glossário
- [ ] `.proto` revisado e comentado
- [ ] Seguindo só o README, um clone limpo instala, roda servidor + cliente e passa nos testes
