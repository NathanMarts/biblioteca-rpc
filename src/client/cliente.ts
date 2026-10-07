import * as grpc from "@grpc/grpc-js";
import { BibliotecaClient, type ListarUsuariosResponse } from "../generated/biblioteca.js";

type Callback<Res> = (erro: grpc.ServiceError | null, resposta: Res) => void;

function chamar<Req, Res>(metodo: (req: Req, cb: Callback<Res>) => unknown, requisicao: Req) {
  return new Promise<Res>((resolve, reject) =>
    metodo(requisicao, (erro, resposta) => (erro ? reject(erro) : resolve(resposta))),
  );
}

/** Cliente gRPC tipado da Biblioteca, com chamadas baseadas em Promise. */
export interface ClienteBiblioteca {
  listarUsuarios(): Promise<ListarUsuariosResponse>;
  fechar(): void;
}

export function criarCliente(endereco: string): ClienteBiblioteca {
  const stub = new BibliotecaClient(endereco, grpc.credentials.createInsecure());
  return {
    listarUsuarios: () => chamar(stub.listarUsuarios.bind(stub), {}),
    fechar: () => stub.close(),
  };
}
