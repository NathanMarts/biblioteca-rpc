import * as grpc from "@grpc/grpc-js";
import {
  BibliotecaClient,
  type ConsultarEmprestimosLivroResponse,
  type ConsultarEmprestimosUsuarioResponse,
  type ConsultarLivroResponse,
  type DevolverLivroResponse,
  type EntrarResponse,
  type ListarLivrosResponse,
  type ListarUsuariosResponse,
  type ObterHojeResponse,
  type RealizarEmprestimoResponse,
} from "../generated/biblioteca.js";

type Callback<Res> = (erro: grpc.ServiceError | null, resposta: Res) => void;
type Metodo<Req, Res> = (
  req: Req,
  metadata: grpc.Metadata,
  opcoes: Partial<grpc.CallOptions>,
  cb: Callback<Res>,
) => unknown;

/** Tempo máximo de espera por uma resposta; evita que o cliente trave se o servidor não responder. */
const TEMPO_LIMITE_MS = 5000;

function chamar<Req, Res>(metodo: Metodo<Req, Res>, requisicao: Req) {
  return new Promise<Res>((resolve, reject) =>
    metodo(
      requisicao,
      new grpc.Metadata(),
      { deadline: Date.now() + TEMPO_LIMITE_MS },
      (erro, resposta) => (erro ? reject(erro) : resolve(resposta)),
    ),
  );
}

/** Interceptador (middleware) do cliente: anexa o token da Sessão a toda chamada. */
function anexarToken(obterToken: () => string | undefined): grpc.Interceptor {
  return (opcoes, proximaChamada) =>
    new grpc.InterceptingCall(proximaChamada(opcoes), {
      start: (metadados, listener, next) => {
        const token = obterToken();
        if (token) metadados.set("authorization", `Bearer ${token}`);
        next(metadados, listener);
      },
    });
}

/** Cliente gRPC tipado da Biblioteca, com chamadas baseadas em Promise. */
export interface ClienteBiblioteca {
  /** Autentica e passa a enviar o token da Sessão nas chamadas seguintes. */
  entrar(login: string, senha: string): Promise<EntrarResponse>;
  /** Usa um token obtido por outro meio (ex.: guardado de uma Sessão anterior). */
  usarToken(token: string): void;
  /** Esquece o token: as chamadas seguintes são anônimas. */
  sair(): void;
  listarUsuarios(): Promise<ListarUsuariosResponse>;
  listarLivros(): Promise<ListarLivrosResponse>;
  obterHoje(): Promise<ObterHojeResponse>;
  consultarLivro(codigoLivro: string): Promise<ConsultarLivroResponse>;
  realizarEmprestimo(
    codigoUsuario: string,
    codigoLivro: string,
    dataEmprestimo: string,
  ): Promise<RealizarEmprestimoResponse>;
  devolverLivro(codigoUsuario: string, codigoLivro: string): Promise<DevolverLivroResponse>;
  consultarEmprestimosUsuario(codigoUsuario: string): Promise<ConsultarEmprestimosUsuarioResponse>;
  consultarEmprestimosLivro(codigoLivro: string): Promise<ConsultarEmprestimosLivroResponse>;
  fechar(): void;
}

export interface OpcoesCliente {
  /** Certificado (PEM) do servidor em que o cliente confia; sem ele, a conexão não é criptografada. */
  certificado?: string;
}

export function criarCliente(endereco: string, opcoes: OpcoesCliente = {}): ClienteBiblioteca {
  let token: string | undefined;
  const credenciais = opcoes.certificado
    ? grpc.credentials.createSsl(Buffer.from(opcoes.certificado))
    : grpc.credentials.createInsecure();
  const stub = new BibliotecaClient(endereco, credenciais, {
    interceptors: [anexarToken(() => token)],
  });
  return {
    entrar: async (login, senha) => {
      const resposta = await chamar(stub.entrar.bind(stub), { login, senha });
      token = resposta.token;
      return resposta;
    },
    usarToken: (novo) => {
      token = novo;
    },
    sair: () => {
      token = undefined;
    },
    listarUsuarios: () => chamar(stub.listarUsuarios.bind(stub), {}),
    listarLivros: () => chamar(stub.listarLivros.bind(stub), {}),
    obterHoje: () => chamar(stub.obterHoje.bind(stub), {}),
    consultarLivro: (codigoLivro) => chamar(stub.consultarLivro.bind(stub), { codigoLivro }),
    realizarEmprestimo: (codigoUsuario, codigoLivro, dataEmprestimo) =>
      chamar(stub.realizarEmprestimo.bind(stub), { codigoUsuario, codigoLivro, dataEmprestimo }),
    devolverLivro: (codigoUsuario, codigoLivro) =>
      chamar(stub.devolverLivro.bind(stub), { codigoUsuario, codigoLivro }),
    consultarEmprestimosUsuario: (codigoUsuario) =>
      chamar(stub.consultarEmprestimosUsuario.bind(stub), { codigoUsuario }),
    consultarEmprestimosLivro: (codigoLivro) =>
      chamar(stub.consultarEmprestimosLivro.bind(stub), { codigoLivro }),
    fechar: () => stub.close(),
  };
}
