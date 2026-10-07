# Autenticação por sessão, aplicada por um interceptador que nega por padrão

O enunciado não pede autenticação, mas qualquer um que alcançasse o servidor podia emprestar, devolver e ler dados pessoais. Decidimos que o Bibliotecário entra com login e senha (RPC `Entrar`, senha guardada como hash scrypt) e recebe um token de Sessão de 8 horas, enviado no metadado `authorization: Bearer <token>`. A verificação fica em um interceptador do servidor gRPC (o "middleware" do gRPC), não em cada handler, e nega por padrão: só `Entrar`, `ObterHoje`, `ListarLivros` e `ConsultarLivro` são públicos, então um método novo nasce protegido.

## Opções consideradas

- **Token compartilhado em variável de ambiente**: mais simples, mas sem identidade de quem opera nem expiração.
- **Lista de métodos protegidos** (em vez de lista de públicos): falha de forma insegura quando alguém esquece de incluir um método novo.
- **Verificação dentro de cada handler**: espalha a mesma regra por todas as funções.

## Consequências

- `ConsultarLivro` continua público, mas sem Sessão omite quem está com cada Exemplar: o mesmo método responde de acordo com quem chama.
- O interceptador repassa o login ao handler num metadado que ele mesmo preenche (e apaga se vier do cliente), para que ninguém se declare Bibliotecário.
- Sessões ficam no banco e sobrevivem a reinícios do servidor.
