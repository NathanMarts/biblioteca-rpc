# 07: Dados de demonstração e `npm run reset`

**What to build:** ao subir com o banco vazio, o servidor já traz um acervo realista para a apresentação (cerca de 10 Livros com 1 a 3 Exemplares, 3 Usuários e Empréstimos no prazo, atrasados e encerrados), e o apresentador pode restaurar esse estado a qualquer momento com `npm run reset`. Os dados persistem entre reinícios.

**Blocked by:** 04 (`DevolverLivro`)

**Status:** done

- [x] Seed completo e determinístico, com datas relativas ao "hoje" para que sempre existam Empréstimos no prazo e atrasados
- [x] Inclui pelo menos um Livro totalmente indisponível, um Usuário no limite de 3 Empréstimos e Empréstimos encerrados (histórico)
- [x] Seed carregado apenas quando o banco está vazio; dados persistem entre reinícios
- [x] `npm run reset` apaga e recria o banco com o seed
- [x] Testes existentes continuam independentes do seed de demonstração
