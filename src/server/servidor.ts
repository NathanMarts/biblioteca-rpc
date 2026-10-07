import * as grpc from "@grpc/grpc-js";
import { BibliotecaService, type BibliotecaServer } from "../generated/biblioteca.js";
import { Biblioteca } from "./biblioteca.js";
import type { DadosIniciais } from "./dados.js";
import { abrirBanco } from "./db.js";
import { ErroBiblioteca, type TipoErro } from "./erros.js";
import type { Relogio } from "./relogio.js";

export interface ConfiguracaoServidor {
  /** Caminho do arquivo SQLite, ou ":memory:". */
  banco: string;
  host: string;
  /** 0 escolhe uma porta livre. */
  porta: number;
  relogio: Relogio;
  dadosIniciais: DadosIniciais;
  /** Registrar cada chamada no console. */
  log: boolean;
}

export interface ServidorEmExecucao {
  endereco: string;
  encerrar(): Promise<void>;
}

export async function iniciarServidor(config: ConfiguracaoServidor): Promise<ServidorEmExecucao> {
  const db = abrirBanco(config.banco, config.dadosIniciais);
  const biblioteca = new Biblioteca(db, config.relogio);
  const unario = criarAdaptador(config.log);

  const implementacao: BibliotecaServer = {
    listarUsuarios: unario("ListarUsuarios", () => ({ usuarios: biblioteca.listarUsuarios() })),
    listarLivros: unario("ListarLivros", () => ({ livros: biblioteca.listarLivros() })),
    consultarLivro: unario("ConsultarLivro", (req) => biblioteca.consultarLivro(req.codigoLivro)),
    realizarEmprestimo: unario("RealizarEmprestimo", (req) =>
      biblioteca.realizarEmprestimo(req.codigoUsuario, req.codigoLivro, req.dataEmprestimo),
    ),
    devolverLivro: unario("DevolverLivro", (req) =>
      biblioteca.devolverLivro(req.codigoUsuario, req.codigoLivro),
    ),
    consultarEmprestimosUsuario: unario("ConsultarEmprestimosUsuario", (req) => ({
      emprestimos: biblioteca.consultarEmprestimosUsuario(req.codigoUsuario),
    })),
  };

  const server = new grpc.Server();
  server.addService(BibliotecaService, implementacao);
  const porta = await new Promise<number>((resolve, reject) =>
    server.bindAsync(
      `${config.host}:${config.porta}`,
      grpc.ServerCredentials.createInsecure(),
      (erro, porta) => (erro ? reject(erro) : resolve(porta)),
    ),
  );

  return {
    endereco: `${config.host}:${porta}`,
    encerrar: () =>
      new Promise<void>((resolve) =>
        server.tryShutdown(() => {
          db.close();
          resolve();
        }),
      ),
  };
}

const STATUS_POR_TIPO: Record<TipoErro, grpc.status> = {
  NAO_ENCONTRADO: grpc.status.NOT_FOUND,
  ARGUMENTO_INVALIDO: grpc.status.INVALID_ARGUMENT,
  PRECONDICAO: grpc.status.FAILED_PRECONDITION,
};

/**
 * Converte uma função síncrona em handler gRPC unário: registra a chamada e traduz
 * ErroBiblioteca para o status code correspondente, com a mensagem em português.
 */
function criarAdaptador(log: boolean) {
  return <Req, Res>(nome: string, executar: (requisicao: Req) => Res): grpc.handleUnaryCall<Req, Res> =>
    (call, callback) => {
      const registrar = (resultado: string) => {
        if (log) console.log(`[RPC] ${nome} ${JSON.stringify(call.request)} → ${resultado}`);
      };
      try {
        const resposta = executar(call.request);
        registrar("ok");
        callback(null, resposta);
      } catch (erro) {
        if (erro instanceof ErroBiblioteca) {
          registrar(`${grpc.status[STATUS_POR_TIPO[erro.tipo]]} "${erro.message}"`);
          callback({ code: STATUS_POR_TIPO[erro.tipo], details: erro.message });
        } else {
          registrar(`INTERNAL ${String(erro)}`);
          callback({ code: grpc.status.INTERNAL, details: "Erro interno do servidor" });
        }
      }
    };
}
