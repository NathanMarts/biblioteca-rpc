# 06: `ConsultarEmprestimosLivro` (histórico)

**What to build:** o bibliotecário consulta o histórico de Empréstimos de um Livro, abrangendo todos os seus Exemplares, com Usuário, Exemplar, data do Empréstimo e data de Devolução (vazia se ainda ativo), do mais recente para o mais antigo. Ver spec e ADR 0002.

**Blocked by:** 04 (`DevolverLivro`)

**Status:** ready-for-agent

- [ ] `ConsultarEmprestimosLivro` no `.proto`, com código regerado
- [ ] Inclui Empréstimos ativos (sem data de Devolução) e encerrados, de todos os Exemplares
- [ ] Ordenado do mais recente para o mais antigo
- [ ] Livro inexistente → `NOT_FOUND`; nunca emprestado → lista vazia
- [ ] CLI ganha "Histórico do livro": tabela, ou "Nenhum histórico de empréstimos encontrado para o livro"
- [ ] Testes de integração via gRPC: histórico misto ativo/encerrado em Exemplares diferentes, ordenação, lista vazia, erro
