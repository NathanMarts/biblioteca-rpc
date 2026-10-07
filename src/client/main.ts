import { status, type ServiceError } from "@grpc/grpc-js";
import { select } from "@inquirer/prompts";
import { ENDERECO } from "../config.js";
import { criarCliente, type ClienteBiblioteca } from "./cliente.js";
import { tabela } from "./tabela.js";

type Acao = (cliente: ClienteBiblioteca) => Promise<void>;

const acoes: Record<string, Acao> = {
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
