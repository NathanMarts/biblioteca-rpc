import * as grpc from "@grpc/grpc-js";
import type { Autenticacao } from "./autenticacao.js";

/**
 * Interceptadores (middleware) do servidor gRPC. Cuidam de preocupações que valem para todas
 * as funções, antes de a chamada chegar ao handler. O primeiro da lista passada ao servidor é
 * o mais próximo da rede.
 */

/** Metadado em que a autenticação informa ao handler quem é o Bibliotecário da chamada. */
export const METADADO_BIBLIOTECARIO = "x-bibliotecario";

const nomeDoMetodo = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Nunca registra senhas no log. */
function semSenha(requisicao: unknown): unknown {
  if (requisicao && typeof requisicao === "object" && "senha" in requisicao) {
    return { ...requisicao, senha: "***" };
  }
  return requisicao;
}

/** Registra no console cada chamada, inclusive as recusadas pelos interceptadores seguintes. */
export function registrarChamadas(): grpc.ServerInterceptor {
  return (metodo, call) => {
    let requisicao: unknown = {};
    return new grpc.ServerInterceptingCall(call, {
      start: (next) =>
        next({
          onReceiveMessage: (mensagem, proximo) => {
            requisicao = mensagem;
            proximo(mensagem);
          },
        }),
      sendStatus: (situacao, next) => {
        const resultado =
          situacao.code === grpc.status.OK ? "ok" : `${grpc.status[situacao.code ?? 0]} "${situacao.details}"`;
        console.log(`[RPC] ${nomeDoMetodo(metodo.path)} ${JSON.stringify(semSenha(requisicao))} → ${resultado}`);
        next(situacao);
      },
    });
  };
}

/**
 * Exige uma Sessão válida em todos os métodos, exceto os `publicos` (nega por padrão: um
 * método novo nasce protegido). Com Sessão válida, repassa o login no METADADO_BIBLIOTECARIO.
 */
export function exigirAutenticacao(
  autenticacao: Autenticacao,
  publicos: ReadonlySet<string>,
): grpc.ServerInterceptor {
  return (metodo, call) =>
    new grpc.ServerInterceptingCall(call, {
      start: (next) =>
        next({
          onReceiveMetadata: (metadados, proximo) => {
            // O cliente não pode se declarar Bibliotecário: só a autenticação preenche isto.
            metadados.remove(METADADO_BIBLIOTECARIO);
            const token = /^Bearer (.+)$/.exec(String(metadados.get("authorization")[0] ?? ""))?.[1];
            const sessao = token ? autenticacao.validar(token) : { situacao: "inexistente" as const };
            if (sessao.situacao === "valida") {
              metadados.set(METADADO_BIBLIOTECARIO, sessao.login);
            } else if (!publicos.has(metodo.path)) {
              call.sendStatus({
                code: grpc.status.UNAUTHENTICATED,
                details: sessao.situacao === "expirada" ? "Sessão expirada" : "Não autenticado",
              });
              return;
            }
            proximo(metadados);
          },
        }),
    });
}
