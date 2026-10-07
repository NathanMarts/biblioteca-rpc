# Biblioteca

Sistema de empréstimo de livros de uma biblioteca, acessado remotamente por clientes via RPC.

## Linguagem

### Acervo

**Livro**:
Uma obra do acervo (título, autor), identificada por um código curto (ex.: `L001`). Pode ter vários Exemplares.
_Evitar_: Obra, título (como identificador)

**Exemplar**:
Uma cópia física de um Livro. É o Exemplar, e não o Livro, que fica emprestado a um Usuário. Um Usuário nunca tem dois Exemplares do mesmo Livro ao mesmo tempo.
_Evitar_: Cópia, unidade, item

**Disponível / Indisponível**:
Um Exemplar está disponível quando não tem Empréstimo ativo. Um Livro está disponível quando pelo menos um de seus Exemplares está; indisponível quando todos estão emprestados.

**Usuário**:
Pessoa cadastrada na biblioteca que pode pegar Exemplares emprestados, identificada por um código curto (ex.: `U001`).
_Evitar_: Leitor, cliente, membro

### Empréstimos

**Empréstimo**:
O registro de que um Exemplar foi entregue a um Usuário em uma data. Fica **ativo** até a Devolução e **encerrado** depois dela.
_Evitar_: Retirada, locação

**Devolução**:
O encerramento de um Empréstimo, datado pelo dia em que o servidor a registra.
_Evitar_: Baixa, retorno

**Prazo**:
O número de dias, a partir da data do Empréstimo, em que o Exemplar pode ficar com o Usuário sem Atraso (7 dias). O último dia do Prazo é a **data limite**.

**Atraso**:
Situação de um Empréstimo ativo cujo Prazo já passou. Um Empréstimo ativo está **no prazo** ou **atrasado**.
_Evitar_: Vencido, pendente

**Situação**:
Se um Empréstimo ativo está **no prazo** ou **atrasado**.
_Evitar_: Status

**Histórico**:
Todos os Empréstimos, ativos e encerrados, de todos os Exemplares de um Livro.

**Limite de empréstimos**:
O número máximo de Empréstimos ativos que um Usuário pode ter ao mesmo tempo (3).
