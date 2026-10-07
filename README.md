# Biblioteca RPC

Sistema de empréstimo de livros no paradigma **cliente/servidor com RPC**, feito para o trabalho de Sistemas Distribuídos (tema 5 do [enunciado](docs/trabalho_2026_2.pdf), "Sistema de Empréstimo de Livros em Biblioteca").

- **Servidor:** expõe a API via **gRPC** e guarda os dados em **SQLite**.
- **Cliente:** um programa de linha de comando que funciona como o balcão do bibliotecário. Tem um menu com uma opção para cada função da API.
- **Linguagem:** tudo em **TypeScript**, rodando em Node.js.

```
┌──────────────┐   gRPC (HTTP/2 + Protocol Buffers)   ┌────────────────────┐     ┌─────────────┐
│ Cliente CLI  │ ───────────────────────────────────▶ │ Servidor Biblioteca│ ──▶ │ SQLite      │
│ (bibliotecá- │ ◀─────────────────────────────────── │ regras de negócio  │     │ biblioteca. │
│  rio)        │      respostas ou status de erro     └────────────────────┘     │ db          │
└──────────────┘                                                                 └─────────────┘
```

## Sumário

- [Requisitos e instalação](#requisitos-e-instalação)
- [Como rodar](#como-rodar)
- [Modelo do domínio](#modelo-do-domínio)
- [API](#api)
- [Exemplos de uso](#exemplos-de-uso)
- [Justificativas das escolhas](#justificativas-das-escolhas)
- [Estrutura do projeto](#estrutura-do-projeto)

## Requisitos e instalação

- Node.js **22** ou mais recente
- npm

```bash
git clone https://github.com/NathanMarts/biblioteca-rpc.git
cd biblioteca-rpc
npm install
```

O `protoc` não precisa estar instalado: o código gerado a partir do `.proto` já está no repositório.

## Como rodar

Use dois terminais (ou mais, para ver vários clientes acessando o mesmo servidor).

```bash
# Terminal 1: servidor
npm run servidor

# Terminal 2: cliente
npm run cliente
```

| Comando | O que faz |
|---|---|
| `npm run servidor` | Sobe o servidor gRPC. Na primeira execução, cria o banco com os dados de demonstração. |
| `npm run cliente` | Abre o menu interativo do cliente. Navegue com as setas, confirme com Enter e use Esc (ou Backspace, nas listas) para voltar ao menu. |
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

Para rodar em máquinas diferentes, suba o servidor com `BIBLIOTECA_HOST=0.0.0.0` e aponte o cliente para o IP da máquina do servidor:

```bash
# PowerShell
$env:BIBLIOTECA_HOST="192.168.0.10"; npm run cliente
# bash
BIBLIOTECA_HOST=192.168.0.10 npm run cliente
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

As cinco funções do enunciado foram mantidas, com os nomes no padrão PascalCase do protobuf. As três RPCs no fim da seção são extras, além do que o enunciado pede: as listagens permitem que o cliente ofereça listas de seleção em vez de pedir que o operador digite códigos, e `ObterHoje` fornece a data padrão do empréstimo.

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

### Extras: `ListarLivros()`, `ListarUsuarios()` e `ObterHoje()`

- `ListarLivros` retorna código, título, autor, `disponiveis` e `total` de cada Livro.
- `ListarUsuarios` retorna código e nome de cada Usuário.
- `ObterHoje` retorna a data de hoje do servidor (`data`). O cliente usa essa data para pré-preencher o empréstimo, então a data padrão sempre segue o relógio do servidor, mesmo com `BIBLIOTECA_HOJE` definida só no servidor.

## Exemplos de uso

As saídas abaixo foram geradas com os dados de demonstração e `BIBLIOTECA_HOJE=2026-10-20`.

### Menu do cliente

```
Biblioteca — balcão do bibliotecário (servidor: localhost:50051)

? O que deseja fazer? (Use arrow keys)
❯ Realizar empréstimo
  Devolver livro
  Empréstimos do usuário
  Histórico do livro
  Listar livros
  Consultar livro
  Listar usuários
  Sair
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
Servidor da Biblioteca escutando em localhost:50051
Banco: biblioteca.db | Hoje: 2026-10-20
[RPC] ListarLivros {} → ok
[RPC] RealizarEmprestimo {"codigoUsuario":"U003","codigoLivro":"L001","dataEmprestimo":"2026-10-20"} → ok
[RPC] RealizarEmprestimo {"codigoUsuario":"U001","codigoLivro":"L005","dataEmprestimo":"2026-10-20"} → FAILED_PRECONDITION "Usuário com limite de empréstimos atingido"
[RPC] DevolverLivro {"codigoUsuario":"U003","codigoLivro":"L009"} → NOT_FOUND "Empréstimo não encontrado"
```

### Chamando a API direto do código

O cliente tipado em [src/client/cliente.ts](src/client/cliente.ts) pode ser usado por qualquer programa TypeScript:

```ts
import { criarCliente } from "./src/client/cliente.js";

const biblioteca = criarCliente("localhost:50051");
const { codigoExemplar, dataLimite } = await biblioteca.realizarEmprestimo("U003", "L001", "2026-10-20");
console.log(`Emprestado ${codigoExemplar}, devolver até ${dataLimite}`);
biblioteca.fechar();
```

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
  - Cada operação de escrita (empréstimo e devolução) roda dentro de uma **transação**. Como o driver é síncrono e o Node executa um handler por vez, a verificação "há Exemplar disponível?" e a gravação do Empréstimo são atômicas.
  - Por isso, dois clientes nunca conseguem pegar o último Exemplar ao mesmo tempo.
- **"Hoje" controlado pelo servidor.**
  - A situação de atraso, a data de devolução e a data padrão do empréstimo (via `ObterHoje`) usam a data do servidor, não a do cliente. Isso evita que relógios diferentes entre máquinas gerem resultados inconsistentes.
  - A variável `BIBLIOTECA_HOJE` permite fixar essa data para demonstrações.
- **Cliente de linha de comando** com `@inquirer/prompts`.
  - O enunciado aceita interface texto, e os menus navegáveis e as listas de seleção evitam erros de digitação de códigos.
  - Cada chamada tem um tempo limite de 5 segundos, para o cliente não travar se o servidor não responder.
- **Testes.**
  - Os testes automatizados (`vitest`) sobem um **servidor gRPC real** numa porta aleatória, com banco em memória e data fixa, e chamam a API pelo mesmo cliente que o CLI usa.
  - Assim, toda regra de negócio é verificada de ponta a ponta, pela fronteira RPC.

## Estrutura do projeto

```
proto/biblioteca.proto   Contrato da API (IDL)
src/generated/           Código gerado pelo ts-proto (não editar)
src/server/              Servidor: regras (biblioteca.ts), gRPC (servidor.ts), banco, seed, relógio
src/client/              Cliente: wrapper tipado (cliente.ts) e CLI (main.ts)
test/                    Testes de integração via gRPC
docs/adr/                Registros de decisões de arquitetura
CONTEXT.md               Glossário do domínio
```
