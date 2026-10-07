# 01: Esqueleto ponta a ponta com `ListarUsuarios`

**What to build:** o caminho mínimo completo do sistema funcionando: o bibliotecário sobe o servidor, abre o CLI, escolhe "Listar usuários" no menu e vê os Usuários cadastrados, vindos do SQLite através de uma chamada gRPC. Este ticket monta a base (projeto, contrato, persistência, servidor, cliente, testes) sobre a qual todos os outros apenas acrescentam RPCs. Ver `.scratch/biblioteca-rpc/spec.md`, ADR 0001 e `CONTEXT.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Repositório git inicializado e publicado como repositório **público** `NathanMarts/biblioteca-rpc` no GitHub, com `.gitignore` adequado (node_modules, arquivo do banco)
- [x] Projeto TypeScript (Node 22, pacote único) com scripts `servidor`, `cliente`, `proto` e `test`, executando via `tsx`
- [x] `.proto` com `service Biblioteca` contendo `ListarUsuarios`; código gerado por `ts-proto` (grpc-js) versionado e regerável com `npm run proto`
- [x] SQLite (`better-sqlite3`) com o schema completo do domínio (Livro, Exemplar, Usuário, Empréstimo) criado se não existir; caminho do banco configurável, aceitando `:memory:`
- [x] Seed mínimo de 3 Usuários (`U001`…) carregado quando o banco está vazio
- [x] Módulo de relógio que fornece o "hoje" (`AAAA-MM-DD`), injetável
- [x] Servidor iniciado por função que recebe configuração (banco, host, porta, sendo `0` = aleatória, relógio) e retorna o endereço efetivo e um meio de encerrar; host/porta via `BIBLIOTECA_HOST`/`BIBLIOTECA_PORTA`, padrão `localhost:50051`; exibe o endereço ao subir
- [x] Servidor registra no console cada chamada RPC recebida e seu resultado
- [x] Fábrica de cliente gRPC tipado a partir de um endereço, usada pelo CLI e pelos testes
- [x] CLI com menu (`@inquirer/prompts`) contendo "Listar usuários" e "Sair"; resultado exibido em tabela; mensagem clara (sem stack trace) se o servidor estiver fora do ar
- [x] Teste de integração com `vitest` que sobe o servidor em porta aleatória com `:memory:` e "hoje" fixo, e verifica `ListarUsuarios` pelo cliente gerado; estrutura reutilizável pelos próximos tickets
