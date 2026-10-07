import * as grpc from "@grpc/grpc-js";
import type { CertificadoTls } from "../certificados.js";
import { BibliotecaService, Situacao, type BibliotecaServer } from "../generated/biblioteca.js";
import { Autenticacao } from "./autenticacao.js";
import { Biblioteca } from "./biblioteca.js";
import type { DadosIniciais } from "./dados.js";
import { ehDataValida } from "./datas.js";
import { abrirBanco } from "./db.js";
import { ErroBiblioteca, type TipoErro } from "./erros.js";
import { exigirAutenticacao, METADADO_BIBLIOTECARIO, registrarChamadas } from "./interceptadores.js";
import type { Relogio } from "./relogio.js";

export interface ConfiguracaoServidor {
  /** Caminho do arquivo SQLite, ou ":memory:". */
  banco: string;
  host: string;
  /** 0 escolhe uma porta livre. */
  porta: number;
  relogio: Relogio;
  /** Instante atual em ms, para a validade das Sessões; padrão Date.now. */
  agora?: () => number;
  dadosIniciais: DadosIniciais;
  /** Registrar cada chamada no console. */
  log: boolean;
  /** Certificado e chave do servidor; sem eles, a conexão não é criptografada. */
  tls?: CertificadoTls;
}

export interface ServidorEmExecucao {
  endereco: string;
  encerrar(): Promise<void>;
}

export async function iniciarServidor(config: ConfiguracaoServidor): Promise<ServidorEmExecucao> {
  const hoje = config.relogio();
  if (!ehDataValida(hoje)) {
    throw new Error(`Data de hoje inválida: "${hoje}". Use o formato AAAA-MM-DD (ex.: BIBLIOTECA_HOJE=2026-10-20).`);
  }
  const db = abrirBanco(config.banco, config.dadosIniciais);
  const biblioteca = new Biblioteca(db, config.relogio);
  const autenticacao = new Autenticacao(db, config.agora ?? Date.now);

  const implementacao: BibliotecaServer = {
    entrar: unario("Entrar", (req) => autenticacao.entrar(req.login, req.senha)),
    listarUsuarios: unario("ListarUsuarios", () => ({ usuarios: biblioteca.listarUsuarios() })),
    listarLivros: unario("ListarLivros", () => ({ livros: biblioteca.listarLivros() })),
    obterHoje: unario("ObterHoje", () => ({ data: config.relogio() })),
    consultarLivro: unario("ConsultarLivro", (req, { bibliotecario }) => {
      const { livro, exemplares } = biblioteca.consultarLivro(req.codigoLivro);
      // Sem login, a consulta é pública: mostra a disponibilidade, mas não quem está com o livro.
      if (bibliotecario) return { livro, exemplares };
      return { livro, exemplares: exemplares.map((e) => ({ ...e, codigoUsuario: "", nomeUsuario: "" })) };
    }),
    realizarEmprestimo: unario("RealizarEmprestimo", (req) =>
      biblioteca.realizarEmprestimo(req.codigoUsuario, req.codigoLivro, req.dataEmprestimo),
    ),
    devolverLivro: unario("DevolverLivro", (req) =>
      biblioteca.devolverLivro(req.codigoUsuario, req.codigoLivro),
    ),
    consultarEmprestimosUsuario: unario("ConsultarEmprestimosUsuario", (req) => ({
      emprestimos: biblioteca
        .consultarEmprestimosUsuario(req.codigoUsuario)
        .map(({ atrasado, ...emprestimo }) => ({
          ...emprestimo,
          situacao: atrasado ? Situacao.ATRASADO : Situacao.NO_PRAZO,
        })),
    })),
    consultarEmprestimosLivro: unario("ConsultarEmprestimosLivro", (req) => ({
      emprestimos: biblioteca.consultarEmprestimosLivro(req.codigoLivro),
    })),
  };

  const publicos = new Set(
    [BibliotecaService.entrar, BibliotecaService.obterHoje, BibliotecaService.listarLivros, BibliotecaService.consultarLivro]
      .map((metodo) => metodo.path),
  );
  const server = new grpc.Server({
    interceptors: [
      ...(config.log ? [registrarChamadas()] : []),
      exigirAutenticacao(autenticacao, publicos),
    ],
  });
  server.addService(BibliotecaService, implementacao);
  const porta = await new Promise<number>((resolve, reject) =>
    server.bindAsync(
      `${config.host}:${config.porta}`,
      config.tls
        ? grpc.ServerCredentials.createSsl(
            null,
            [{ cert_chain: Buffer.from(config.tls.certificado), private_key: Buffer.from(config.tls.chave) }],
            false,
          )
        : grpc.ServerCredentials.createInsecure(),
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
  NAO_AUTENTICADO: grpc.status.UNAUTHENTICATED,
};

/** O que os interceptadores apuraram sobre a chamada. */
interface Contexto {
  /** Login do Bibliotecário autenticado, se houver. */
  bibliotecario?: string;
}

/**
 * Converte uma função síncrona em handler gRPC unário, traduzindo ErroBiblioteca para o
 * status code correspondente, com a mensagem em português.
 */
function unario<Req, Res>(
  nome: string,
  executar: (requisicao: Req, contexto: Contexto) => Res,
): grpc.handleUnaryCall<Req, Res> {
  return (call, callback) => {
    try {
      const bibliotecario = call.metadata.get(METADADO_BIBLIOTECARIO)[0]?.toString();
      callback(null, executar(call.request, { bibliotecario }));
    } catch (erro) {
      if (erro instanceof ErroBiblioteca) {
        callback({ code: STATUS_POR_TIPO[erro.tipo], details: erro.message });
      } else {
        console.error(`[${nome}] erro inesperado:`, erro);
        callback({ code: grpc.status.INTERNAL, details: "Erro interno do servidor" });
      }
    }
  };
}
