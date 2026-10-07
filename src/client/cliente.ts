import * as grpc from "@grpc/grpc-js";
import {
  BibliotecaClient,
  type ConsultarLivroResponse,
  type ListarLivrosResponse,
  type ListarUsuariosResponse,
  type RealizarEmprestimoResponse,
} from "../generated/biblioteca.js";

type Callback<Res> = (erro: grpc.ServiceError | null, resposta: Res) => void;

function chamar<Req, Res>(metodo: (req: Req, cb: Callback<Res>) => unknown, requisicao: Req) {
  return new Promise<Res>((resolve, reject) =>
    metodo(requisicao, (erro, resposta) => (erro ? reject(erro) : resolve(resposta))),
  );
}

/** Cliente gRPC tipado da Biblioteca, com chamadas baseadas em Promise. */
export interface ClienteBiblioteca {
  listarUsuarios(): Promise<ListarUsuariosResponse>;
  listarLivros(): Promise<ListarLivrosResponse>;
  consultarLivro(codigoLivro: string): Promise<ConsultarLivroResponse>;
  realizarEmprestimo(
    codigoUsuario: string,
    codigoLivro: string,
    dataEmprestimo: string,
  ): Promise<RealizarEmprestimoResponse>;
  fechar(): void;
}

export function criarCliente(endereco: string): ClienteBiblioteca {
  const stub = new BibliotecaClient(endereco, grpc.credentials.createInsecure());
  return {
    listarUsuarios: () => chamar(stub.listarUsuarios.bind(stub), {}),
    listarLivros: () => chamar(stub.listarLivros.bind(stub), {}),
    consultarLivro: (codigoLivro) => chamar(stub.consultarLivro.bind(stub), { codigoLivro }),
    realizarEmprestimo: (codigoUsuario, codigoLivro, dataEmprestimo) =>
      chamar(stub.realizarEmprestimo.bind(stub), { codigoUsuario, codigoLivro, dataEmprestimo }),
    fechar: () => stub.close(),
  };
}
