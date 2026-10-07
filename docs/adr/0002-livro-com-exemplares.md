# Livro como obra com vários Exemplares

A API sugerida no enunciado assume implicitamente uma cópia por livro ("Emprestado para [usuário] desde [data]"). Decidimos modelar o Livro como uma obra com vários Exemplares (cópias físicas), porque é assim que uma biblioteca real funciona, mantendo as assinaturas da API no nível do Livro: o servidor escolhe o Exemplar disponível de menor número ao emprestar (`L001-2` antes de `L001-10`), e um Usuário não pode ter dois Exemplares do mesmo Livro ao mesmo tempo, o que mantém `devolver_livro(usuario, livro)` sem ambiguidade.

## Consequências

- "Livro indisponível" significa que todos os Exemplares estão emprestados.
- `consultar_livro` retorna um resumo ("2 de 3 disponíveis") e a situação de cada Exemplar.
- O histórico de `consultar_emprestimos_livro` abrange todos os Exemplares do Livro.
