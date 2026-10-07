# Biblioteca RPC

Sistema de empréstimo de livros no paradigma **cliente/servidor com RPC**, feito para o trabalho de Sistemas Distribuídos (tema 5 do [enunciado](docs/trabalho_2026_2.pdf), "Sistema de Empréstimo de Livros em Biblioteca").

- **Servidor:** expõe a API via **gRPC** e guarda os dados em **SQLite**.
- **Cliente:** um programa de linha de comando que funciona como o balcão do bibliotecário. Tem um menu com uma opção para cada função da API.
- **Segurança:** conexão criptografada com **TLS** e login do bibliotecário, verificado por um **interceptador** (middleware) do gRPC.
- **Linguagem:** tudo em **TypeScript**, rodando em Node.js.

```
Cliente CLI      token de sessão + chave de idempotência + novas tentativas
    │
    │  gRPC sobre TLS (HTTP/2 + Protocol Buffers)
    ▼
Servidor         interceptadores: log → autenticação
    │            handler: idempotência → regras de negócio
    ▼
SQLite           transações IMMEDIATE, um arquivo
```

## Sumário

- [Requisitos e instalação](#requisitos-e-instalação)
- [Como rodar](#como-rodar)
- [Modelo do domínio](#modelo-do-domínio)
- [API](#api)
- [Exemplos de uso](#exemplos-de-uso)
- [Conceitos de Sistemas Distribuídos no projeto](#conceitos-de-sistemas-distribuídos-no-projeto)
- [Justificativas das escolhas](#justificativas-das-escolhas)
- [Estrutura do projeto](#estrutura-do-projeto)

## Requisitos e instalação

- Node.js **22** ou mais recente
- npm

```bash
git clone https://github.com/NathanMarts/biblioteca-rpc.git
cd biblioteca-rpc
npm install
npm run certificados
```

- O `protoc` não precisa estar instalado: o código gerado a partir do `.proto` já está no repositório.
- `npm run certificados` gera o certificado TLS autoassinado em `certs/`. Ele fica fora do git, porque a chave privada não pode ir para um repositório público.

## Como rodar

Use dois terminais (ou mais, para ver vários clientes acessando o mesmo servidor).

```bash
# Terminal 1: servidor
npm run servidor

# Terminal 2: cliente
npm run cliente
```

Ao abrir, o cliente pede o login do bibliotecário. Nos dados de demonstração, use **login `beatriz`** e **senha `biblioteca`**. Deixar o login vazio segue sem sessão: nesse modo só as consultas públicas funcionam.

| Comando | O que faz |
|---|---|
| `npm run servidor` | Sobe o servidor gRPC com TLS. Na primeira execução, cria o banco com os dados de demonstração. |
| `npm run cliente` | Abre o menu interativo do cliente. Navegue com as setas, confirme com Enter e use Esc (ou Backspace, nas listas) para voltar ao menu. |
| `npm run certificados` | Gera o certificado TLS do servidor em `certs/`. Aceita hosts ou IPs extras (veja abaixo). |
| `npm run reset` | Apaga o banco e o recria com os dados de demonstração. Rode com o servidor parado. |
| `npm test` | Roda os testes automatizados. |
| `npm run typecheck` | Verifica os tipos do TypeScript. |
| `npm run proto` | Regera `src/generated/` a partir de `proto/biblioteca.proto`. |

### Configuração

Tudo é configurado por variáveis de ambiente, todas opcionais:

| Variável | Padrão | Uso |
|---|---|---|
| `BIBLIOTECA_HOST` | `localhost` | Endereço em que o servidor escuta e ao qual o cliente se conecta. |
| `BIBLIOTECA_PORTA` | `50051` | Porta do servidor. |
| `BIBLIOTECA_BANCO` | `biblioteca.db` | Arquivo SQLite usado pelo servidor e pelo `reset`. |
| `BIBLIOTECA_HOJE` | data do sistema | Fixa a data de "hoje" do servidor (`AAAA-MM-DD`), útil para demonstrar atrasos. Um valor inválido impede o servidor de subir. |
| `BIBLIOTECA_TLS` | ligado | `desligado` desativa o TLS (só para depuração). |
| `BIBLIOTECA_CERTIFICADO` | `certs/servidor.crt` | Certificado do servidor, usado pelo servidor e pelo cliente. |
| `BIBLIOTECA_CHAVE` | `certs/servidor.key` | Chave privada do servidor (só o servidor usa). |

Para rodar em máquinas diferentes:
1. Gere o certificado incluindo o IP da máquina do servidor.
2. Copie `certs/servidor.crt` para a máquina do cliente. A chave privada fica só no servidor.
3. Suba o servidor com `BIBLIOTECA_HOST=0.0.0.0` e aponte o cliente para esse IP:

```bash
# Na máquina do servidor
npm run certificados -- 192.168.0.10
# PowerShell
$env:BIBLIOTECA_HOST="0.0.0.0"; npm run servidor
# Na máquina do cliente (com certs/servidor.crt copiado)
$env:BIBLIOTECA_HOST="192.168.0.10"; npm run cliente
```

## Modelo do domínio

O glossário completo está em [CONTEXT.md](CONTEXT.md).

- **Livro:** uma obra do acervo (`L001`). Um Livro tem um ou mais **Exemplares**, que são as cópias físicas (`L001-1`, `L001-2`, …).
- **Usuário:** quem pega livros emprestados (`U001`).
- **Empréstimo:** um Exemplar entregue a um Usuário numa data. Fica **ativo** até a **Devolução**.
- **Prazo:** 7 dias. A **data limite** é a data do empréstimo mais 7 dias. Depois dela, o Empréstimo está **atrasado**.
- **Limite:** cada Usuário pode ter no máximo **3** Empréstimos ativos.
- Um Usuário não pode ter **dois Exemplares do mesmo Livro** ao mesmo tempo.
- No empréstimo, o servidor escolhe o **Exemplar disponível de menor número** (`L001-2` antes de `L001-10`).

## API

O contrato completo, com comentários, está em [proto/biblioteca.proto](proto/biblioteca.proto). Convenções:

- **Datas:** strings no formato `AAAA-MM-DD`.
- **Erros:** são sinalizados pelo **status code do gRPC**, com a mensagem em português no campo `details`.
- **Consultas sem resultado:** retornam **lista vazia**, não erro. O cliente exibe a mensagem correspondente.
- **Autenticação:** as funções protegidas exigem o metadado `authorization: Bearer <token>`, com o token devolvido por `Entrar`.
- **Idempotência:** `RealizarEmprestimo` e `DevolverLivro` aceitam o metadado `chave-idempotencia`. Uma repetição com a mesma chave recebe a mesma resposta, sem aplicar a operação de novo. O cliente envia um UUID novo por operação.

As cinco funções do enunciado foram mantidas, com os nomes no padrão PascalCase do protobuf. As RPCs no fim da seção são extras, além do que o enunciado pede:
- `Entrar` autentica o bibliotecário.
- As listagens permitem que o cliente ofereça listas de seleção em vez de pedir que o operador digite códigos.
- `ObterHoje` fornece a data padrão do empréstimo.

### Funções públicas e protegidas

Um interceptador do servidor exige sessão em **todas** as funções, exceto as públicas. Ele nega por padrão: uma função nova já nasce protegida.

| Função | Acesso |
|---|---|
| `Entrar`, `ObterHoje`, `ListarLivros` | Pública |
| `ConsultarLivro` | Pública, mas sem sessão não mostra quem está com cada Exemplar |
| `RealizarEmprestimo`, `DevolverLivro`, `ListarUsuarios`, `ConsultarEmprestimosUsuario`, `ConsultarEmprestimosLivro` | Exige sessão |

| Situação | Status gRPC | Mensagem |
|---|---|---|
| Função protegida sem token, ou com token que o servidor não emitiu | `UNAUTHENTICATED` | Não autenticado |
| Sessão com mais de 8 horas | `UNAUTHENTICATED` | Sessão expirada |
| Login ou senha errados em `Entrar` | `UNAUTHENTICATED` | Login ou senha inválidos |
| Chave de idempotência já usada em outra operação | `INVALID_ARGUMENT` | Chave de idempotência já usada em outra operação |

### `RealizarEmprestimo(codigo_usuario, codigo_livro, data_emprestimo)`

Verifica se o Livro tem algum Exemplar disponível. Se tiver, empresta ao Usuário o Exemplar disponível de menor número. A data pode estar no passado, mas não no futuro.

**Retorno:** `codigo_exemplar`, `data_emprestimo` e `data_limite`.

As verificações acontecem nesta ordem:

| Situação | Status gRPC | Mensagem |
|---|---|---|
| Código de Usuário inexistente | `NOT_FOUND` | Usuário não encontrado |
| Código de Livro inexistente | `NOT_FOUND` | Livro não encontrado |
| Data mal formatada, inexistente ou futura | `INVALID_ARGUMENT` | Data inválida |
| O Usuário já tem um Exemplar desse Livro | `FAILED_PRECONDITION` | Usuário já possui um exemplar deste livro |
| O Usuário já tem 3 Empréstimos ativos | `FAILED_PRECONDITION` | Usuário com limite de empréstimos atingido |
| Todos os Exemplares estão emprestados | `FAILED_PRECONDITION` | Livro indisponível |

### `DevolverLivro(codigo_usuario, codigo_livro)`

Encerra o Empréstimo ativo do Usuário para o Livro. A data da devolução é o "hoje" do servidor.

**Retorno:** `codigo_exemplar` e `data_devolucao`.

| Situação | Status gRPC | Mensagem |
|---|---|---|
| Código de Usuário ou Livro inexistente | `NOT_FOUND` | Usuário não encontrado / Livro não encontrado |
| O Usuário já devolveu esse Livro e não tem outro Empréstimo ativo dele | `FAILED_PRECONDITION` | Livro já devolvido |
| O Usuário nunca pegou esse Livro, ou o Livro está com outra pessoa | `NOT_FOUND` | Empréstimo não encontrado |

### `ConsultarLivro(codigo_livro)`

Informa a disponibilidade do Livro e a situação de cada Exemplar.

**Retorno:**
- `livro`: código, título, autor, `disponiveis` e `total`.
- `exemplares`: código e `disponivel` de cada Exemplar. Quando o Exemplar está emprestado, traz também `codigo_usuario`, `nome_usuario` e `data_emprestimo`.

**Erro:** `NOT_FOUND` "Livro não encontrado".

### `ConsultarEmprestimosUsuario(codigo_usuario)`

Lista os Empréstimos **ativos** do Usuário, do mais antigo para o mais recente.

**Retorno:** `emprestimos`. Cada item traz `codigo_livro`, `titulo`, `codigo_exemplar`, `data_emprestimo`, `data_limite` e `situacao`.
- `situacao` vale `NO_PRAZO` até a data limite (inclusive) e `ATRASADO` a partir do dia seguinte.
- A lista vem vazia quando o Usuário não tem Empréstimos ativos.

**Erro:** `NOT_FOUND` "Usuário não encontrado".

### `ConsultarEmprestimosLivro(codigo_livro)`

Mostra o histórico de Empréstimos de **todos os Exemplares** do Livro, do mais recente para o mais antigo.

**Retorno:** `emprestimos`. Cada item traz `codigo_usuario`, `nome_usuario`, `codigo_exemplar`, `data_emprestimo` e `data_devolucao`.
- `data_devolucao` fica vazia enquanto o Empréstimo está ativo.
- A lista vem vazia quando o Livro nunca foi emprestado.

**Erro:** `NOT_FOUND` "Livro não encontrado".

### Extras: `Entrar()`, `ListarLivros()`, `ListarUsuarios()` e `ObterHoje()`

- `Entrar(login, senha)` retorna `token`, `nome` e `expira_em` (data e hora ISO 8601). A sessão dura 8 horas.
- `ListarLivros` retorna código, título, autor, `disponiveis` e `total` de cada Livro.
- `ListarUsuarios` retorna código e nome de cada Usuário.
- `ObterHoje` retorna a data de hoje do servidor (`data`). O cliente usa essa data para pré-preencher o empréstimo, então a data padrão sempre segue o relógio do servidor, mesmo com `BIBLIOTECA_HOJE` definida só no servidor.

## Exemplos de uso

As saídas abaixo foram geradas com os dados de demonstração e `BIBLIOTECA_HOJE=2026-10-20`.

### Login e menu do cliente

```
Biblioteca — balcão do bibliotecário (servidor: localhost:50051)

✔ Login do bibliotecário (vazio para seguir sem login): beatriz
✔ Senha: **********
✔ Bem-vindo(a), Beatriz Rocha.

? O que deseja fazer, Beatriz Rocha? (Use arrow keys)
❯ Realizar empréstimo
  Devolver livro
  Empréstimos do usuário
  Histórico do livro
  Listar livros
  Consultar livro
  Listar usuários
  Sair da sessão (Beatriz Rocha)
  Sair
```

Sem login, as funções protegidas respondem:

```
✖ Não autenticado. Escolha "Entrar" no menu para fazer login.
```

### Listar livros

```
Código  Título                  Autor                Disponíveis
──────  ──────────────────────  ───────────────────  ───────────
L001    Dom Casmurro            Machado de Assis     2 de 3
L002    Vidas Secas             Graciliano Ramos     1 de 2
L003    Grande Sertão: Veredas  João Guimarães Rosa  0 de 1
L004    A Hora da Estrela       Clarice Lispector    1 de 2
...
```

### Consultar livro (L001)

```
Dom Casmurro — Machado de Assis
2 de 3 exemplares disponíveis

Exemplar  Situação
────────  ─────────────────────────────────────────────────
L001-1    Emprestado para Ana Souza (U001) desde 2026-10-18
L001-2    Disponível
L001-3    Disponível
```

### Empréstimos do usuário (U001)

```
Livro  Título                                      Exemplar  Emprestado em  Devolver até  Situação
─────  ──────────────────────────────────────────  ────────  ─────────────  ────────────  ────────
L003   Grande Sertão: Veredas                      L003-1    2026-10-08     2026-10-15    Atrasado
L008   Sistemas Distribuídos: Conceitos e Projeto  L008-1    2026-10-15     2026-10-22    No prazo
L001   Dom Casmurro                                L001-1    2026-10-18     2026-10-25    No prazo
```

### Histórico do livro (L003)

```
Usuário  Nome          Exemplar  Emprestado em  Devolvido em
───────  ────────────  ────────  ─────────────  ────────────
U001     Ana Souza     L003-1    2026-10-08     (ativo)
U003     Carla Mendes  L003-1    2026-10-02     2026-10-07
```

### Empréstimo e devolução, com e sem erro

```
Realizar empréstimo  (U003, L001, 2026-10-20)  ✔ Exemplar L001-2 emprestado em 2026-10-20. Devolver até 2026-10-27.
Realizar empréstimo  (U001, L005, 2026-10-20)  ✖ Usuário com limite de empréstimos atingido
Realizar empréstimo  (U003, L003, 2026-10-20)  ✖ Livro indisponível
Realizar empréstimo  (U003, L002, 2026-10-25)  ✖ Data inválida
Devolver livro       (U002, L002)              ✔ Exemplar L002-1 devolvido em 2026-10-20.
Devolver livro       (U002, L002)              ✖ Livro já devolvido
Devolver livro       (U003, L009)              ✖ Empréstimo não encontrado
```

### Log do servidor

O servidor registra cada chamada recebida, o que ajuda a ver a comunicação RPC acontecendo:

```
Servidor da Biblioteca escutando em localhost:50051 (TLS)
Banco: biblioteca.db | Hoje: 2026-10-20
[RPC] ListarLivros {} → ok
[RPC] ListarUsuarios {} → UNAUTHENTICATED "Não autenticado"
[RPC] Entrar {"login":"beatriz","senha":"***"} → ok
[RPC] RealizarEmprestimo {"codigoUsuario":"U003","codigoLivro":"L001","dataEmprestimo":"2026-10-20"} → ok
[RPC] RealizarEmprestimo {"codigoUsuario":"U001","codigoLivro":"L005","dataEmprestimo":"2026-10-20"} → FAILED_PRECONDITION "Usuário com limite de empréstimos atingido"
[RPC] DevolverLivro {"codigoUsuario":"U003","codigoLivro":"L009"} → NOT_FOUND "Empréstimo não encontrado"
```

### Chamando a API direto do código

O cliente tipado em [src/client/cliente.ts](src/client/cliente.ts) pode ser usado por qualquer programa TypeScript:

```ts
import { readFileSync } from "node:fs";
import { criarCliente } from "./src/client/cliente.js";

const biblioteca = criarCliente("localhost:50051", {
  certificado: readFileSync("certs/servidor.crt", "utf8"),
});
await biblioteca.entrar("beatriz", "biblioteca");
const { codigoExemplar, dataLimite } = await biblioteca.realizarEmprestimo("U003", "L001", "2026-10-20");
console.log(`Emprestado ${codigoExemplar}, devolver até ${dataLimite}`);
biblioteca.fechar();
```

## Conceitos de Sistemas Distribuídos no projeto

| Tema | Como aparece no projeto | O que ficou de fora, e por quê |
|---|---|---|
| **Comunicação** | RPC com gRPC. A interface é descrita numa IDL (`.proto`), os stubs são gerados, a serialização é em Protocol Buffers sobre HTTP/2, e as chamadas são de requisição e resposta síncronas, com tempo limite. O gRPC é o middleware que dá **transparência de acesso**: as chamadas remotas parecem locais. | Comunicação orientada a mensagens (filas). Toda operação espera a resposta na hora, então requisição e resposta síncronas são o modelo adequado. |
| **Nomeação** | Identificadores únicos e planos para as entidades (`L001`, `L001-1`, `U001`). O servidor é localizado por um endereço configurável (`host:porta`), e o certificado TLS vincula esse nome à identidade do servidor. | Um serviço de nomes ou de descoberta. Com um servidor só, um endereço configurado basta. |
| **Sincronização** | O servidor é a **referência de tempo única**. `ObterHoje` é próximo do algoritmo de Cristian: o cliente consulta o relógio do servidor, sem compensar a latência, o que não importa porque a resolução é de um dia. **Exclusão mútua centralizada:** transações `IMMEDIATE` no SQLite e um índice único garantem que um exemplar nunca seja emprestado duas vezes, mesmo com dois processos servidores no mesmo banco. | Relógios lógicos (Lamport, vetoriais), porque não há eventos entre vários processos para ordenar. |
| **Replicação e consistência** | Consistência forte por ser centralizado: uma cópia dos dados, e toda escrita é validada no servidor. Exemplo de dado desatualizado no cliente: uma lista carregada antes de outro cliente devolver o livro. O servidor revalida e responde "Livro já devolvido". | Réplicas do servidor ou do banco. Exigiriam um protocolo de consistência (primário e cópia, quórum) que vai além do foco em RPC. |
| **Tolerância a falhas** | Transações atômicas, então uma queda no meio não corrompe nada. Persistência em disco. Tempo limite nas chamadas. **Novas tentativas automáticas** quando o servidor está indisponível, com **chave de idempotência** nas escritas para que uma repetição nunca aplique a operação duas vezes (o efeito é parecido com a semântica de "no máximo uma vez"). | Redundância. O servidor continua sendo um ponto único de falha, e sem réplicas não há para onde redirecionar. |
| **Segurança** | Canal confidencial e autenticado com **TLS**. **Autenticação** do bibliotecário com senha em hash (scrypt) e sessão de 8 horas. **Controle de acesso** por um interceptador que nega por padrão, mais autorização mais fina em `ConsultarLivro`. Validação de toda entrada no servidor. | Certificado de uma autoridade pública e níveis diferentes de permissão entre bibliotecários. |

## Justificativas das escolhas

As decisões que têm alternativas relevantes estão registradas como ADRs em [docs/adr/](docs/adr/).

- **gRPC + Protocol Buffers com `ts-proto`** ([ADR 0001](docs/adr/0001-grpc-com-ts-proto.md)).
  - O arquivo `.proto` funciona como uma IDL: é o contrato formal da API, compartilhado por cliente e servidor.
  - A partir dele são gerados os stubs e os tipos TypeScript, então o cliente e o servidor não podem divergir sobre o formato das mensagens.
  - A serialização binária (protobuf) e o transporte HTTP/2 são os de uma tecnologia de RPC usada em produção.
  - Alternativas consideradas: JSON-RPC (sem IDL), tRPC (é HTTP com tipos compartilhados, mais ligado a TypeScript do que a RPC) e XML-RPC (tipagem fraca).
- **Livro com vários Exemplares** ([ADR 0002](docs/adr/0002-livro-com-exemplares.md)).
  - Uma biblioteca real tem várias cópias da mesma obra.
  - As assinaturas do enunciado foram mantidas, no nível do Livro. O servidor escolhe o Exemplar.
  - A regra "um Exemplar do mesmo Livro por Usuário" garante que `DevolverLivro(usuario, livro)` nunca fique ambíguo.
- **Erros como status codes do gRPC** ([ADR 0003](docs/adr/0003-erros-como-status-grpc.md)).
  - É o mecanismo nativo do protocolo, então as mensagens de resposta descrevem apenas o caso de sucesso.
  - Os códigos (`NOT_FOUND`, `FAILED_PRECONDITION`, `INVALID_ARGUMENT`) já dizem a categoria do erro, e o `details` traz a mensagem do enunciado.
- **SQLite com `better-sqlite3`.**
  - Atende ao "armazenar os dados de forma simples": é um único arquivo e não exige servidor de banco.
  - Mesmo assim, é transacional e os dados persistem entre reinícios.
- **Concorrência.**
  - Vários clientes podem acessar o servidor ao mesmo tempo.
  - Cada operação de escrita (empréstimo e devolução) roda dentro de uma **transação `IMMEDIATE`**, que pega o lock de escrita antes de ler a disponibilidade. Além disso, um **índice único** no banco impede dois Empréstimos ativos do mesmo Exemplar.
  - Por isso, dois clientes nunca conseguem pegar o último Exemplar ao mesmo tempo, mesmo com dois processos servidores usando o mesmo arquivo de banco. Um teste de estresse com 1000 disputas simultâneas confirmou isso.
- **Autenticação por interceptador** ([ADR 0004](docs/adr/0004-autenticacao-por-interceptador.md)).
  - A regra "precisa estar logado" vale para quase todas as funções, então fica num único interceptador do gRPC (o middleware dele), não espalhada pelos handlers.
  - Ele nega por padrão, para que uma função nova não nasça aberta por esquecimento.
- **TLS com certificado autoassinado** ([ADR 0005](docs/adr/0005-tls-com-certificado-autoassinado.md)).
  - Sem TLS, a senha e o token trafegariam em texto puro.
  - O certificado é gerado localmente e fica fora do git, porque a chave privada não pode ir para um repositório público.
- **Novas tentativas com idempotência** ([ADR 0006](docs/adr/0006-novas-tentativas-com-idempotencia.md)).
  - O cliente usa a política de retry nativa do gRPC.
  - A chave de idempotência torna seguro repetir empréstimos e devoluções. Sem ela, a repetição de uma devolução bem-sucedida responderia "Livro já devolvido", um erro falso.
- **"Hoje" controlado pelo servidor.**
  - A situação de atraso, a data de devolução e a data padrão do empréstimo (via `ObterHoje`) usam a data do servidor, não a do cliente. Isso evita que relógios diferentes entre máquinas gerem resultados inconsistentes.
  - A variável `BIBLIOTECA_HOJE` permite fixar essa data para demonstrações.
- **Cliente de linha de comando** com `@inquirer/prompts`.
  - O enunciado aceita interface texto, e os menus navegáveis e as listas de seleção evitam erros de digitação de códigos.
  - Cada chamada tem um tempo limite de 5 segundos, para o cliente não travar se o servidor não responder.
- **Testes.**
  - Os testes automatizados (`vitest`) sobem um **servidor gRPC real com TLS** numa porta aleatória, com banco em memória e data fixa, e chamam a API pelo mesmo cliente que o CLI usa.
  - Assim, toda regra de negócio é verificada de ponta a ponta, pela fronteira RPC.

## Estrutura do projeto

```
proto/biblioteca.proto   Contrato da API (IDL)
src/generated/           Código gerado pelo ts-proto (não editar)
src/server/              Servidor: regras (biblioteca.ts), gRPC (servidor.ts), interceptadores,
                         autenticação, idempotência, banco, seed, relógio
src/client/              Cliente: wrapper tipado com token e retry (cliente.ts) e CLI (main.ts)
src/certificados.ts      Geração do certificado TLS (usado por npm run certificados e testes)
test/                    Testes de integração via gRPC
docs/adr/                Registros de decisões de arquitetura
CONTEXT.md               Glossário do domínio
```
