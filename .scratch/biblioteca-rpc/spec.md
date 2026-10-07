Status: ready-for-agent

# Spec: Biblioteca via RPC (gRPC + TypeScript)

## Problem Statement

Preciso entregar, como trabalho individual da disciplina de Sistemas Distribuídos, uma aplicação cliente/servidor baseada em RPC. Escolhi o tema "Sistema de Empréstimo de Livros em Biblioteca" do enunciado (`docs/trabalho_2026_2.pdf`). O servidor deve guardar os dados de forma simples e expor uma API RPC; o cliente deve permitir executar cada função da API. Além do código, preciso entregar documentação (descrição da API, exemplos de uso e justificativas das escolhas) e fazer uma apresentação de até 15 minutos com demonstração ao vivo, rodando localmente na sala.

Hoje o repositório contém apenas o enunciado, o glossário (`CONTEXT.md`) e as ADRs; não há código.

## Solution

Um servidor gRPC em TypeScript que mantém o acervo da biblioteca (Livros, Exemplares, Usuários e Empréstimos) em um arquivo SQLite e expõe as cinco funções do enunciado, mais duas listagens auxiliares. Um cliente de linha de comando, pensado como o **balcão do bibliotecário**, oferece um menu interativo com uma opção por função da API, usando listas de seleção para escolher Livros e Usuários. O servidor carrega dados de exemplo quando o banco está vazio (incluindo empréstimos atrasados), para que a demonstração seja interessante desde o primeiro minuto e reproduzível com um comando de reset.

O modelo segue o glossário em `CONTEXT.md`: um **Livro** é uma obra com vários **Exemplares**; o Empréstimo é sempre de um Exemplar, mas a API trabalha no nível do Livro e o servidor escolhe o Exemplar (ADR 0002).

## User Stories

### Empréstimo

1. Como bibliotecário, quero emprestar um Livro a um Usuário informando a data do empréstimo, para registrar que ele levou um Exemplar.
2. Como bibliotecário, quero que o servidor escolha automaticamente o Exemplar disponível de menor código, para não precisar saber qual cópia está na prateleira.
3. Como bibliotecário, quero ver na confirmação qual Exemplar foi emprestado e qual é a data limite, para informar ao Usuário.
4. Como bibliotecário, quero receber "Livro indisponível" quando todos os Exemplares do Livro estiverem emprestados, para orientar o Usuário.
5. Como bibliotecário, quero receber "Livro não encontrado" quando o código do Livro não existir, para corrigir a digitação.
6. Como bibliotecário, quero receber "Usuário não encontrado" quando o código do Usuário não existir.
7. Como bibliotecário, quero receber "Usuário com limite de empréstimos atingido" quando o Usuário já tiver 3 Empréstimos ativos.
8. Como bibliotecário, quero receber "Usuário já possui um exemplar deste livro" quando o Usuário tentar pegar um segundo Exemplar do mesmo Livro, para que a Devolução nunca seja ambígua.
9. Como bibliotecário, quero poder registrar um Empréstimo com data no passado, para lançar empréstimos feitos antes de o sistema estar no ar.
10. Como bibliotecário, quero receber "Data inválida" quando a data estiver no futuro ou mal formatada (fora de `AAAA-MM-DD`).
11. Como bibliotecário, quero que um Usuário com Empréstimo atrasado ainda possa pegar novos Livros (respeitado o limite), porque a biblioteca não aplica bloqueio por atraso.

### Devolução

12. Como bibliotecário, quero registrar a Devolução de um Livro por um Usuário, para liberar o Exemplar.
13. Como bibliotecário, quero que a data da Devolução seja o "hoje" do servidor, sem precisar digitá-la.
14. Como bibliotecário, quero receber "Empréstimo não encontrado" quando esse Usuário nunca pegou esse Livro, ou quando o Livro está emprestado para outra pessoa.
15. Como bibliotecário, quero receber "Livro já devolvido" quando o último Empréstimo desse Livro para esse Usuário já estiver encerrado.
16. Como bibliotecário, quero receber "Livro não encontrado" / "Usuário não encontrado" para códigos inexistentes também na Devolução.
17. Como bibliotecário, quero que, após a Devolução, o Exemplar volte a ficar disponível para novos Empréstimos.

### Consulta de Livro

18. Como bibliotecário, quero consultar um Livro e ver um resumo da disponibilidade (ex.: "2 de 3 disponíveis").
19. Como bibliotecário, quero ver, para cada Exemplar, se está "Disponível" ou "Emprestado para [Usuário] desde [data]".
20. Como bibliotecário, quero receber "Livro não encontrado" para um código inexistente.

### Consulta de Empréstimos do Usuário

21. Como bibliotecário, quero listar os Empréstimos **ativos** de um Usuário, com Livro (código e título), Exemplar, data do Empréstimo, data limite e situação (no prazo / atrasado).
22. Como bibliotecário, quero ver a mensagem "Nenhum empréstimo encontrado para o usuário" quando ele não tiver Empréstimos ativos.
23. Como bibliotecário, quero que a situação de Atraso seja calculada em relação ao "hoje" do servidor, para que esteja sempre correta.

### Histórico do Livro

24. Como bibliotecário, quero ver o histórico completo de Empréstimos de um Livro, de todos os seus Exemplares, com Usuário, Exemplar, data do Empréstimo e data de Devolução.
25. Como bibliotecário, quero que Empréstimos ainda ativos apareçam no histórico sem data de Devolução.
26. Como bibliotecário, quero o histórico ordenado do mais recente para o mais antigo.
27. Como bibliotecário, quero ver a mensagem "Nenhum histórico de empréstimos encontrado para o livro" quando o Livro nunca foi emprestado.

### Listagens auxiliares

28. Como bibliotecário, quero listar os Livros do acervo (código, título, autor, disponibilidade), para escolher em vez de decorar códigos.
29. Como bibliotecário, quero listar os Usuários (código e nome), para escolher em vez de decorar códigos.

### Cliente (CLI)

30. Como bibliotecário, quero um menu interativo navegável pelas setas com uma opção para cada função da API e uma opção de sair.
31. Como bibliotecário, quero escolher Livros e Usuários em listas de seleção que mostram código e título/nome.
32. Como bibliotecário, quero que a data do Empréstimo venha preenchida com a data de hoje, podendo alterá-la.
33. Como bibliotecário, quero ver os erros do servidor como mensagens claras em português, sem stack trace, e voltar ao menu.
34. Como bibliotecário, quero ver resultados de listagens formatados como tabela legível.
35. Como bibliotecário, quero uma mensagem clara caso o servidor esteja fora do ar, em vez de o cliente travar.
36. Como apresentador, quero abrir dois clientes ao mesmo tempo contra o mesmo servidor e ver as mudanças de um refletidas no outro, para demonstrar que o estado está no servidor.

### Operação do servidor

37. Como apresentador, quero subir o servidor com um único comando e ver em qual endereço ele está escutando.
38. Como apresentador, quero configurar host e porta do servidor e do cliente (padrão `localhost:50051`), para poder rodar em máquinas diferentes se necessário.
39. Como apresentador, quero que os dados persistam entre reinícios do servidor.
40. Como apresentador, quero que, com o banco vazio, o servidor carregue automaticamente um acervo de exemplo (~10 Livros com 1 a 3 Exemplares, 3 Usuários, alguns Empréstimos no prazo, atrasados e encerrados).
41. Como apresentador, quero um comando de reset que recria o banco com os dados de exemplo, para deixar a demonstração reproduzível.
42. Como apresentador, quero fixar o "hoje" do servidor por variável de ambiente (`BIBLIOTECA_HOJE=AAAA-MM-DD`), para demonstrar Atrasos de forma previsível.
43. Como apresentador, quero que o servidor registre no console cada chamada recebida (função e resultado), para mostrar a comunicação RPC acontecendo.

### Documentação e entrega

44. Como aluno, quero um README em português com instalação, como rodar, descrição de cada RPC (parâmetros, retorno, erros) e exemplos de uso, para cumprir o que o enunciado exige.
45. Como aluno, quero que o README traga as justificativas das escolhas e aponte para as ADRs.
46. Como professor, quero clonar o repositório público e rodar servidor e cliente seguindo só o README.
47. Como aluno, quero que o arquivo `.proto` seja a fonte da verdade da API e esteja legível e comentado, para apresentá-lo.

## Implementation Decisions

### Tecnologia (ADR 0001)

- TypeScript em Node 22, um único pacote npm; execução via `tsx` com scripts `servidor`, `cliente`, `reset`, `proto` e `test`.
- gRPC com `@grpc/grpc-js`; tipos e stubs gerados por `ts-proto` (modo grpc-js). O código gerado é versionado no repositório; `npm run proto` regera.
- SQLite via `better-sqlite3` (API síncrona). Como o Node é single-thread e o driver é síncrono, cada handler executa sua leitura+escrita de forma atômica; ainda assim, operações de escrita devem rodar dentro de uma transação. Isso resolve a corrida "dois clientes pegando o último Exemplar" e deve ser mencionado no README.
- CLI com `@inquirer/prompts`.
- Identificadores: conceitos do domínio em português (seguindo `CONTEXT.md` e o `.proto`); termos técnicos em inglês.

### Contrato da API (`.proto`)

- `service Biblioteca`, RPCs em PascalCase correspondendo às funções do enunciado: `RealizarEmprestimo`, `DevolverLivro`, `ConsultarLivro`, `ConsultarEmprestimosUsuario`, `ConsultarEmprestimosLivro`, mais os extras `ListarLivros` e `ListarUsuarios`.
- Campos em snake_case português (`codigo_usuario`, `codigo_livro`, `data_emprestimo`, …).
- Datas são strings `AAAA-MM-DD`; o servidor valida o formato e que seja uma data real.
- Respostas de sucesso:
  - `RealizarEmprestimo` → Exemplar emprestado, data do Empréstimo e data limite.
  - `DevolverLivro` → Exemplar devolvido e data da Devolução.
  - `ConsultarLivro` → dados do Livro, quantidade de Exemplares disponíveis/total, e lista de Exemplares com situação (disponível, ou Usuário + data do Empréstimo).
  - `ConsultarEmprestimosUsuario` → lista de Empréstimos ativos (Livro, título, Exemplar, data do Empréstimo, data limite, situação `NO_PRAZO`/`ATRASADO` como enum).
  - `ConsultarEmprestimosLivro` → lista de Empréstimos (Usuário, Exemplar, data do Empréstimo, data de Devolução opcional/vazia se ativo), do mais recente para o mais antigo.
  - `ListarLivros` → código, título, autor, disponíveis/total. `ListarUsuarios` → código e nome.

### Erros (ADR 0003)

Erros de negócio são status codes do gRPC com a mensagem em português no `details`:

| Situação | Status | Mensagem |
|---|---|---|
| Código de Livro inexistente | `NOT_FOUND` | Livro não encontrado |
| Código de Usuário inexistente | `NOT_FOUND` | Usuário não encontrado |
| Data mal formatada ou no futuro | `INVALID_ARGUMENT` | Data inválida |
| Todos os Exemplares emprestados | `FAILED_PRECONDITION` | Livro indisponível |
| 3 Empréstimos ativos | `FAILED_PRECONDITION` | Usuário com limite de empréstimos atingido |
| Já tem Exemplar desse Livro | `FAILED_PRECONDITION` | Usuário já possui um exemplar deste livro |
| Devolução sem Empréstimo correspondente | `NOT_FOUND` | Empréstimo não encontrado |
| Último Empréstimo desse par já encerrado | `FAILED_PRECONDITION` | Livro já devolvido |

- Consultas sem resultado retornam lista vazia (não é erro); o CLI exibe a mensagem do enunciado.
- Validação de existência de Livro/Usuário acontece em todas as RPCs que os recebem, antes das demais regras.
- Ordem de verificação em `RealizarEmprestimo`: Usuário existe → Livro existe → data válida → já possui Exemplar do Livro → limite atingido → Livro disponível.
- Ordem em `DevolverLivro`: Usuário existe → Livro existe → há Empréstimo ativo do Usuário para algum Exemplar do Livro (sucesso) → senão, há Empréstimo encerrado desse par ("Livro já devolvido") → senão "Empréstimo não encontrado".

### Regras de domínio

- Prazo de 7 dias: data limite = data do Empréstimo + 7 dias. Atrasado quando "hoje" > data limite.
- Limite de 3 Empréstimos ativos por Usuário.
- Ao emprestar, escolhe-se o Exemplar disponível de menor código.
- Códigos: Livro `L001`, Exemplar `L001-1`, Usuário `U001`.
- Data do Empréstimo pode ser passada, nunca futura em relação ao "hoje".
- Os limites (prazo, limite) são constantes do domínio, não configuráveis em tempo de execução.

### Módulos

- **Contrato**: o `.proto` e o código gerado.
- **Persistência**: abre o SQLite (arquivo ou `:memory:`), cria o schema (tabelas de Livro, Exemplar, Usuário, Empréstimo) se não existir, e oferece as consultas/escritas necessárias.
- **Dados iniciais**: popula o banco quando está vazio; usado também pelo reset.
- **Relógio**: fornece o "hoje" como data `AAAA-MM-DD`; padrão é a data real, sobrescrito por `BIBLIOTECA_HOJE` ou injetado em testes.
- **Serviço Biblioteca**: as regras de domínio, recebendo persistência e relógio; lança erros de domínio tipados.
- **Servidor**: uma função de inicialização que recebe configuração (caminho do banco, porta — `0` para aleatória —, host, relógio) e retorna o endereço efetivo e um meio de encerrar; traduz erros de domínio para status gRPC e registra cada chamada no console.
- **Cliente**: uma fábrica de cliente gRPC tipado a partir de um endereço (usada pelo CLI e pelos testes) e o CLI com o menu.

### Configuração

- Host/porta via variáveis de ambiente (ex.: `BIBLIOTECA_HOST`, `BIBLIOTECA_PORTA`), padrão `localhost:50051`. Caminho do banco configurável, com padrão em um arquivo local ignorado pelo git.

## Testing Decisions

- **Seam único: a API gRPC.** Cada teste sobe o servidor real em porta aleatória, com SQLite `:memory:` e "hoje" fixo injetado, e o exercita pelo cliente gerado. Todas as regras de negócio são verificadas por fora, via RPC — nada é testado chamando módulos internos.
- Um bom teste verifica comportamento externo: resposta de sucesso ou status code + mensagem do erro. Testes não inspecionam tabelas nem chamam funções internas; o estado é montado por chamadas RPC (ou pelos dados iniciais conhecidos) e verificado por outras chamadas RPC.
- Cada teste parte de um estado conhecido (banco novo com dados de teste próprios, independentes do seed da demonstração, ou seed determinístico).
- Cobertura mínima: cada RPC com caso de sucesso e cada linha da tabela de erros; prazo/atraso nos limites (exatamente na data limite = no prazo; um dia depois = atrasado); escolha do Exemplar de menor código; Exemplar volta a ficar disponível após Devolução; ordem do histórico; listas vazias.
- Ferramenta: `vitest`.
- O CLI não tem testes automatizados; é verificado manualmente.
- Não há prior art no repositório (projeto novo).

## Out of Scope

- Cadastro, edição ou remoção de Livros, Exemplares e Usuários via API (o acervo vem dos dados iniciais).
- Renovação de Empréstimos, reservas, multas e bloqueio de Usuários em atraso.
- Autenticação, autorização e TLS.
- Interface gráfica.
- Paginação das listagens.
- Implantação em nuvem ou containers.
- Os slides da apresentação (tarefa separada, depois do código).

## Further Notes

- Trabalho individual, autorizado pelo professor (o enunciado pede de 2 a 3 integrantes).
- Repositório público no GitHub: `NathanMarts/biblioteca-rpc`.
- Glossário em `CONTEXT.md`; decisões em `docs/adr/0001` (gRPC + ts-proto), `0002` (Livro com Exemplares), `0003` (erros como status gRPC).
- A demonstração será local, na sala, com servidor e um ou dois clientes no mesmo computador.
