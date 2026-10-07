# 02: Acervo: `ListarLivros` e `ConsultarLivro`

**What to build:** o bibliotecário consegue ver o acervo: listar os Livros (código, título, autor, Exemplares disponíveis/total) e consultar um Livro específico, vendo um resumo ("3 de 3 disponíveis") e a situação de cada Exemplar. Nesta etapa ainda não há Empréstimos, então todos os Exemplares aparecem disponíveis. Ver spec e ADR 0002.

**Blocked by:** 01 (Esqueleto ponta a ponta com `ListarUsuarios`)

**Status:** ready-for-agent

- [ ] `ListarLivros` e `ConsultarLivro` no `.proto`, com código regerado
- [ ] Seed de Livros com 1 a 3 Exemplares cada; códigos de Exemplar no formato `L001-1`
- [ ] `ConsultarLivro` retorna dados do Livro, disponíveis/total e a lista de Exemplares com situação
- [ ] Código de Livro inexistente → `NOT_FOUND` "Livro não encontrado"
- [ ] CLI ganha "Listar livros" e "Consultar livro", com o Livro escolhido em uma lista de seleção (código + título)
- [ ] Testes de integração via gRPC para as duas RPCs, incluindo o erro
