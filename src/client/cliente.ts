import * as grpc from "@grpc/grpc-js";
import { randomUUID } from "node:crypto";
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

/**
 * Novas tentativas automáticas do gRPC: se o servidor estiver indisponível (queda, reinício,
 * rede), a chamada é repetida com espera crescente, dentro do tempo limite. Só é seguro
 * repetir porque as operações que alteram dados levam uma chave de idempotência.
 */
const CONFIGURACAO_DO_SERVICO = JSON.stringify({
  methodConfig: [
    {
      name: [{ service: "biblioteca.Biblioteca" }],
      retryPolicy: {
        maxAttempts: 5,
        initialBackoff: "0.3s",
        maxBackoff: "2s",
        backoffMultiplier: 2,
        retryableStatusCodes: ["UNAVAILABLE"],
      },
    },
  ],
});

/** Metadado com a chave de idempotência (ver src/server/idempotencia.ts). */
const METADADO_CHAVE_IDEMPOTENCIA = "chave-idempotencia";

export interface OpcoesOperacao {
  /** Chave de idempotência; por padrão, uma nova a cada operação. */
  chaveIdempotencia?: string;
}

function comChave(opcoes: OpcoesOperacao = {}): grpc.Metadata {
  const metadados = new grpc.Metadata();
  metadados.set(METADADO_CHAVE_IDEMPOTENCIA, opcoes.chaveIdempotencia ?? randomUUID());
  return metadados;
}

function chamar<Req, Res>(metodo: Metodo<Req, Res>, requisicao: Req, metadados = new grpc.Metadata()) {
  return new Promise<Res>((resolve, reject) =>
    metodo(
      requisicao,
      metadados,
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
    opcoes?: OpcoesOperacao,
  ): Promise<RealizarEmprestimoResponse>;
  devolverLivro(codigoUsuario: string, codigoLivro: string, opcoes?: OpcoesOperacao): Promise<DevolverLivroResponse>;
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
    "grpc.service_config": CONFIGURACAO_DO_SERVICO,
    // Reconectar rápido depois de uma falha, para as novas tentativas encontrarem o servidor.
    "grpc.initial_reconnect_backoff_ms": 300,
    "grpc.max_reconnect_backoff_ms": 2000,
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
    realizarEmprestimo: (codigoUsuario, codigoLivro, dataEmprestimo, opcoes) =>
      chamar(stub.realizarEmprestimo.bind(stub), { codigoUsuario, codigoLivro, dataEmprestimo }, comChave(opcoes)),
    devolverLivro: (codigoUsuario, codigoLivro, opcoes) =>
      chamar(stub.devolverLivro.bind(stub), { codigoUsuario, codigoLivro }, comChave(opcoes)),
    consultarEmprestimosUsuario: (codigoUsuario) =>
      chamar(stub.consultarEmprestimosUsuario.bind(stub), { codigoUsuario }),
    consultarEmprestimosLivro: (codigoLivro) =>
      chamar(stub.consultarEmprestimosLivro.bind(stub), { codigoLivro }),
    fechar: () => stub.close(),
  };
}
