# 03: `RealizarEmprestimo`

**What to build:** o bibliotecário empresta um Livro a um Usuário numa data. O servidor escolhe o Exemplar disponível de menor código, registra o Empréstimo e responde com o Exemplar e a data limite (data + 7 dias). Todas as regras do enunciado e das decisões da spec são aplicadas, e `ConsultarLivro` passa a mostrar "Emprestado para [Usuário] desde [data]". Ver spec (tabela de erros e ordem de verificação), ADRs 0002 e 0003 e `CONTEXT.md`.

**Blocked by:** 02 (Acervo: `ListarLivros` e `ConsultarLivro`)

**Status:** done

- [x] `RealizarEmprestimo` no `.proto`, com código regerado
- [x] Escolhe o Exemplar disponível de menor código; resposta traz Exemplar, data do Empréstimo e data limite
- [x] Erros, nesta ordem de verificação: Usuário inexistente (`NOT_FOUND`), Livro inexistente (`NOT_FOUND`), data mal formatada ou futura (`INVALID_ARGUMENT` "Data inválida"), Usuário já possui Exemplar do Livro (`FAILED_PRECONDITION`), limite de 3 atingido (`FAILED_PRECONDITION`), Livro indisponível (`FAILED_PRECONDITION`); mensagens exatamente como na spec
- [x] Data no passado é aceita
- [x] Escrita executada em transação
- [x] "Hoje" do servidor pode ser fixado por `BIBLIOTECA_HOJE=AAAA-MM-DD`
- [x] `ConsultarLivro` e `ListarLivros` refletem os Exemplares emprestados
- [x] CLI ganha "Realizar empréstimo": seleção de Usuário e Livro em listas, data pré-preenchida com hoje e editável; erros exibidos em português e retorno ao menu
- [x] Testes de integração via gRPC: sucesso, escolha do menor código, cada erro, data passada aceita
