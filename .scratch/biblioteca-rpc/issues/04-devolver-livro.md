# 04: `DevolverLivro`

**What to build:** o bibliotecário registra a Devolução de um Livro por um Usuário. O servidor encerra o Empréstimo ativo desse Usuário para algum Exemplar do Livro, datando-o com o "hoje" do servidor, e o Exemplar volta a ficar disponível. Ver spec (ordem de verificação em `DevolverLivro`) e ADR 0003.

**Blocked by:** 03 (`RealizarEmprestimo`)

**Status:** done

- [x] `DevolverLivro` no `.proto`, com código regerado
- [x] Sucesso retorna o Exemplar devolvido e a data da Devolução (= "hoje" do servidor)
- [x] Exemplar devolvido volta a aparecer como disponível em `ConsultarLivro` e pode ser emprestado novamente
- [x] Erros: Usuário/Livro inexistente (`NOT_FOUND`); "Livro já devolvido" (`FAILED_PRECONDITION`) quando o último Empréstimo desse par está encerrado; "Empréstimo não encontrado" (`NOT_FOUND`) quando o Usuário nunca pegou o Livro ou o Livro está com outra pessoa
- [x] Escrita executada em transação
- [x] CLI ganha "Devolver livro" com seleção de Usuário e Livro
- [x] Testes de integração via gRPC cobrindo sucesso, novo empréstimo após a Devolução e cada erro
