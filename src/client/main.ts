import { status, type ServiceError } from "@grpc/grpc-js";
import { input, select } from "@inquirer/prompts";
import { ENDERECO } from "../config.js";
import { Situacao, type Exemplar } from "../generated/biblioteca.js";
import { criarCliente, type ClienteBiblioteca } from "./cliente.js";
import { tabela } from "./tabela.js";

type Acao = (cliente: ClienteBiblioteca) => Promise<void>;

async function escolherLivro(cliente: ClienteBiblioteca): Promise<string> {
  const { livros } = await cliente.listarLivros();
  return select({
    message: "Livro:",
    choices: livros.map((l) => ({ name: `${l.codigo}  ${l.titulo} (${l.disponiveis}/${l.total})`, value: l.codigo })),
    pageSize: 12,
  });
}

async function escolherUsuario(cliente: ClienteBiblioteca): Promise<string> {
  const { usuarios } = await cliente.listarUsuarios();
  return select({
    message: "Usuário:",
    choices: usuarios.map((u) => ({ name: `${u.codigo}  ${u.nome}`, value: u.codigo })),
    pageSize: 12,
  });
}

function situacaoDoExemplar(e: Exemplar): string {
  return e.disponivel
    ? "Disponível"
    : `Emprestado para ${e.nomeUsuario} (${e.codigoUsuario}) desde ${e.dataEmprestimo}`;
}

const acoes: Record<string, Acao> = {
  "Realizar empréstimo": async (cliente) => {
    const usuario = await escolherUsuario(cliente);
    const livro = await escolherLivro(cliente);
    const { data: hoje } = await cliente.obterHoje();
    const data = await input({ message: "Data do empréstimo (AAAA-MM-DD):", default: hoje });
    const resposta = await cliente.realizarEmprestimo(usuario, livro, data.trim());
    console.log(
      `✔ Exemplar ${resposta.codigoExemplar} emprestado em ${resposta.dataEmprestimo}. Devolver até ${resposta.dataLimite}.`,
    );
  },
  "Devolver livro": async (cliente) => {
    const usuario = await escolherUsuario(cliente);
    // Oferece só os Livros que estão com o Usuário.
    const { emprestimos } = await cliente.consultarEmprestimosUsuario(usuario);
    if (emprestimos.length === 0) {
      console.log("Nenhum empréstimo encontrado para o usuário");
      return;
    }
    const livro = await select({
      message: "Livro a devolver:",
      choices: emprestimos.map((e) => ({
        name: `${e.codigoLivro}  ${e.titulo} (exemplar ${e.codigoExemplar}, ${
          e.situacao === Situacao.ATRASADO ? `atrasado, prazo até ${e.dataLimite}` : `devolver até ${e.dataLimite}`
        })`,
        value: e.codigoLivro,
      })),
      pageSize: 12,
    });
    const resposta = await cliente.devolverLivro(usuario, livro);
    console.log(`✔ Exemplar ${resposta.codigoExemplar} devolvido em ${resposta.dataDevolucao}.`);
  },
  "Empréstimos do usuário": async (cliente) => {
    const { emprestimos } = await cliente.consultarEmprestimosUsuario(await escolherUsuario(cliente));
    if (emprestimos.length === 0) {
      console.log("Nenhum empréstimo encontrado para o usuário");
      return;
    }
    console.log(
      tabela(
        ["Livro", "Título", "Exemplar", "Emprestado em", "Devolver até", "Situação"],
        emprestimos.map((e) => [
          e.codigoLivro,
          e.titulo,
          e.codigoExemplar,
          e.dataEmprestimo,
          e.dataLimite,
          e.situacao === Situacao.ATRASADO ? "Atrasado" : "No prazo",
        ]),
      ),
    );
  },
  "Histórico do livro": async (cliente) => {
    const { emprestimos } = await cliente.consultarEmprestimosLivro(await escolherLivro(cliente));
    if (emprestimos.length === 0) {
      console.log("Nenhum histórico de empréstimos encontrado para o livro");
      return;
    }
    console.log(
      tabela(
        ["Usuário", "Nome", "Exemplar", "Emprestado em", "Devolvido em"],
        emprestimos.map((e) => [
          e.codigoUsuario,
          e.nomeUsuario,
          e.codigoExemplar,
          e.dataEmprestimo,
          e.dataDevolucao || "(ativo)",
        ]),
      ),
    );
  },
  "Listar livros": async (cliente) => {
    const { livros } = await cliente.listarLivros();
    console.log(
      tabela(
        ["Código", "Título", "Autor", "Disponíveis"],
        livros.map((l) => [l.codigo, l.titulo, l.autor, `${l.disponiveis} de ${l.total}`]),
      ),
    );
  },
  "Consultar livro": async (cliente) => {
    const { livro, exemplares } = await cliente.consultarLivro(await escolherLivro(cliente));
    console.log(`\n${livro!.titulo} — ${livro!.autor}`);
    console.log(`${livro!.disponiveis} de ${livro!.total} exemplares disponíveis\n`);
    console.log(tabela(["Exemplar", "Situação"], exemplares.map((e) => [e.codigo, situacaoDoExemplar(e)])));
  },
  "Listar usuários": async (cliente) => {
    const { usuarios } = await cliente.listarUsuarios();
    console.log(tabela(["Código", "Nome"], usuarios.map((u) => [u.codigo, u.nome])));
  },
};

function mensagemDeErro(erro: unknown): string {
  const e = erro as Partial<ServiceError>;
  if (e.code === status.UNAVAILABLE) {
    return `Servidor indisponível em ${ENDERECO}. Verifique se ele está rodando (npm run servidor).`;
  }
  if (e.code === status.DEADLINE_EXCEEDED) {
    return `O servidor em ${ENDERECO} não respondeu a tempo.`;
  }
  return e.details ?? String(erro);
}

async function main() {
  const cliente = criarCliente(ENDERECO);
  console.log(`Biblioteca — balcão do bibliotecário (servidor: ${ENDERECO})\n`);
  try {
    while (true) {
      const escolha = await select({
        message: "O que deseja fazer?",
        choices: [...Object.keys(acoes), "Sair"].map((nome) => ({ name: nome, value: nome })),
        pageSize: 12,
      });
      if (escolha === "Sair") break;
      try {
        await acoes[escolha](cliente);
      } catch (erro) {
        if (estaSaindo(erro)) throw erro;
        console.log(`✖ ${mensagemDeErro(erro)}`);
      }
      console.log();
    }
  } catch (erro) {
    if (!estaSaindo(erro)) throw erro;
  } finally {
    cliente.fechar();
  }
}

/** Ctrl+C dentro de um prompt do inquirer. */
function estaSaindo(erro: unknown): boolean {
  return erro instanceof Error && erro.name === "ExitPromptError";
}

await main();
