# Novas tentativas no cliente, com chave de idempotência nas escritas

Uma queda momentânea do servidor ou da rede fazia a operação falhar de imediato. Decidimos usar a política de novas tentativas nativa do gRPC no cliente (até 5 tentativas com espera crescente, só para `UNAVAILABLE`, dentro do tempo limite de 5 s). Repetir uma escrita só é seguro se ela não for aplicada duas vezes, então `RealizarEmprestimo` e `DevolverLivro` levam uma chave de idempotência (UUID por operação, no metadado `chave-idempotencia`): o servidor guarda a resposta de cada chave por 24 horas, na mesma transação da operação, e devolve a resposta guardada a uma repetição.

## Opções consideradas

- **Sem novas tentativas**: o operador repete à mão, sem saber se a primeira tentativa foi aplicada.
- **Depender das regras de negócio para barrar duplicatas** (ex.: "Usuário já possui um exemplar deste livro"): funciona por acaso no empréstimo, mas a repetição de uma devolução bem-sucedida responderia "Livro já devolvido", um erro falso.
- **Laço de novas tentativas escrito à mão**: reimplementa o que o gRPC já oferece.

## Consequências

- Uma operação que falha por regra de negócio não é guardada (a transação é desfeita), então a repetição recebe o mesmo erro.
- Reaproveitar uma chave em outra operação é recusado com `INVALID_ARGUMENT`.
