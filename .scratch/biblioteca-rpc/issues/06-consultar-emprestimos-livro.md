# 06: `ConsultarEmprestimosLivro` (histórico)

**What to build:** o bibliotecário consulta o histórico de Empréstimos de um Livro, abrangendo todos os seus Exemplares, com Usuário, Exemplar, data do Empréstimo e data de Devolução (vazia se ainda ativo), do mais recente para o mais antigo. Ver spec e ADR 0002.

**Blocked by:** 04 (`DevolverLivro`)

**Status:** done

- [x] `ConsultarEmprestimosLivro` no `.proto`, com código regerado
- [x] Inclui Empréstimos ativos (sem data de Devolução) e encerrados, de todos os Exemplares
- [x] Ordenado do mais recente para o mais antigo
- [x] Livro inexistente → `NOT_FOUND`; nunca emprestado → lista vazia
- [x] CLI ganha "Histórico do livro": tabela, ou "Nenhum histórico de empréstimos encontrado para o livro"
- [x] Testes de integração via gRPC: histórico misto ativo/encerrado em Exemplares diferentes, ordenação, lista vazia, erro
