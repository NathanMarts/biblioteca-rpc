# Erros de negócio como status codes do gRPC

As funções do enunciado retornam "sucesso ou mensagem de erro". Decidimos sinalizar erros pelos status codes nativos do gRPC (`NOT_FOUND`, `FAILED_PRECONDITION`, `INVALID_ARGUMENT`) acompanhados da mensagem em português do enunciado (ex.: "Livro indisponível"), em vez de um campo `oneof { sucesso, erro }` em cada resposta, porque é o mecanismo idiomático do protocolo e mantém as mensagens de resposta focadas no caso de sucesso.

## Consequências

Consultas que não encontram nada (ex.: usuário sem empréstimos) não são erro: retornam lista vazia, e o cliente exibe a mensagem correspondente. `NOT_FOUND` fica reservado para quando a coisa que a requisição aponta não existe: um código de Livro ou Usuário inexistente, ou, em `DevolverLivro`, um Empréstimo inexistente para aquele par Usuário + Livro. Quando o Empréstimo existiu mas já foi encerrado, o erro é `FAILED_PRECONDITION` ("Livro já devolvido").
