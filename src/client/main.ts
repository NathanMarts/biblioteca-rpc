import { status, type ServiceError } from "@grpc/grpc-js";
import { input, password, select } from "@inquirer/prompts";
import { ARQUIVO_CERTIFICADO, ENDERECO, lerArquivoTls, TLS_LIGADO } from "../config.js";
import { Situacao, type Exemplar } from "../generated/biblioteca.js";
import { criarCliente, type ClienteBiblioteca } from "./cliente.js";
import { perguntar, selecionar, VOLTAR } from "./prompts.js";
import { tabela } from "./tabela.js";

type Acao = (cliente: ClienteBiblioteca) => Promise<void>;

/** Sinaliza que o operador desistiu da ação e quer voltar ao menu principal. */
class VoltarAoMenu extends Error {}

/** Lista de seleção; Esc ou Backspace voltam ao menu. */
async function escolher(message: string, choices: { name: string; value: string }[]): Promise<string> {
  const escolha = await selecionar({ message, choices });
  if (escolha === VOLTAR) throw new VoltarAoMenu();
  return escolha;
}

async function escolherLivro(cliente: ClienteBiblioteca): Promise<string> {
  const { livros } = await cliente.listarLivros();
  return escolher(
    "Livro:",
    livros.map((l) => ({ name: `${l.codigo}  ${l.titulo} (${l.disponiveis}/${l.total})`, value: l.codigo })),
  );
}

async function escolherUsuario(cliente: ClienteBiblioteca): Promise<string> {
  const { usuarios } = await cliente.listarUsuarios();
  return escolher(
    "Usuário:",
    usuarios.map((u) => ({ name: `${u.codigo}  ${u.nome}`, value: u.codigo })),
  );
}

function situacaoDoExemplar(e: Exemplar): string {
  if (e.disponivel) return "Disponível";
  // Sem login, o servidor não revela quem está com o Exemplar.
  if (!e.codigoUsuario) return `Emprestado desde ${e.dataEmprestimo}`;
  return `Emprestado para ${e.nomeUsuario} (${e.codigoUsuario}) desde ${e.dataEmprestimo}`;
}

const acoes: Record<string, Acao> = {
  "Realizar empréstimo": async (cliente) => {
    const usuario = await escolherUsuario(cliente);
    const livro = await escolherLivro(cliente);
    const { data: hoje } = await cliente.obterHoje();
    const data = await perguntar({ message: "Data do empréstimo (AAAA-MM-DD):", default: hoje });
    if (data === VOLTAR) throw new VoltarAoMenu();
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
    const livro = await escolher(
      "Livro a devolver:",
      emprestimos.map((e) => ({
        name: `${e.codigoLivro}  ${e.titulo} (exemplar ${e.codigoExemplar}, ${
          e.situacao === Situacao.ATRASADO ? `atrasado, prazo até ${e.dataLimite}` : `devolver até ${e.dataLimite}`
        })`,
        value: e.codigoLivro,
      })),
    );
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

/** Pede login e senha até dar certo; login vazio segue sem Sessão. Devolve o nome de quem entrou. */
async function entrar(cliente: ClienteBiblioteca): Promise<string | undefined> {
  while (true) {
    const login = (await input({ message: "Login do bibliotecário (vazio para seguir sem login):" })).trim();
    if (!login) return undefined;
    const senha = await password({ message: "Senha:", mask: "*" });
    try {
      const { nome } = await cliente.entrar(login, senha);
      console.log(`✔ Bem-vindo(a), ${nome}.`);
      return nome;
    } catch (erro) {
      console.log(`✖ ${mensagemDeErro(erro)}`);
      if ((erro as Partial<ServiceError>).code !== status.UNAUTHENTICATED) return undefined;
    }
  }
}

const ENTRAR = "Entrar";
const SAIR_DA_SESSAO = "Sair da sessão";
const SAIR = "Sair";

async function main() {
  let certificado: string | undefined;
  try {
    certificado = TLS_LIGADO ? lerArquivoTls(ARQUIVO_CERTIFICADO) : undefined;
  } catch (erro) {
    console.error(`✖ ${erro instanceof Error ? erro.message : erro}`);
    process.exit(1);
  }
  const cliente = criarCliente(ENDERECO, { certificado });
  console.log(`Biblioteca — balcão do bibliotecário (servidor: ${ENDERECO})\n`);
  try {
    let bibliotecario = await entrar(cliente);
    console.log();
    while (true) {
      const sessao = bibliotecario ? `${SAIR_DA_SESSAO} (${bibliotecario})` : ENTRAR;
      const escolha = await select({
        message: bibliotecario ? `O que deseja fazer, ${bibliotecario}?` : "O que deseja fazer? (sem login)",
        choices: [...Object.keys(acoes), sessao, SAIR].map((nome) => ({ name: nome, value: nome })),
        pageSize: 12,
      });
      if (escolha === SAIR) break;
      if (escolha === ENTRAR) {
        bibliotecario = await entrar(cliente);
      } else if (escolha === sessao) {
        cliente.sair();
        bibliotecario = undefined;
        console.log("✔ Sessão encerrada.");
      } else {
        try {
          await acoes[escolha](cliente);
        } catch (erro) {
          if (estaSaindo(erro)) throw erro;
          if ((erro as Partial<ServiceError>).code === status.UNAUTHENTICATED) {
            cliente.sair();
            bibliotecario = undefined;
            console.log(`✖ ${mensagemDeErro(erro)}. Escolha "${ENTRAR}" no menu para fazer login.`);
          } else if (!(erro instanceof VoltarAoMenu)) {
            console.log(`✖ ${mensagemDeErro(erro)}`);
          }
        }
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
