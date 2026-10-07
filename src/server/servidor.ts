import * as grpc from "@grpc/grpc-js";
import { BibliotecaService, type BibliotecaServer } from "../generated/biblioteca.js";
import { Biblioteca } from "./biblioteca.js";
import type { DadosIniciais } from "./dados.js";
import { abrirBanco } from "./db.js";
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

/** Converte uma função síncrona em handler gRPC unário, registrando a chamada. */
function criarAdaptador(log: boolean) {
  return <Req, Res>(nome: string, executar: (requisicao: Req) => Res): grpc.handleUnaryCall<Req, Res> =>
    (call, callback) => {
      try {
        const resposta = executar(call.request);
        if (log) console.log(`[RPC] ${nome} ${JSON.stringify(call.request)} → ok`);
        callback(null, resposta);
      } catch (erro) {
        if (log) console.log(`[RPC] ${nome} ${JSON.stringify(call.request)} → erro: ${String(erro)}`);
        callback({ code: grpc.status.INTERNAL, details: String(erro) });
      }
    };
}
