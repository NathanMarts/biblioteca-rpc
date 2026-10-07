/** Categorias de erro de negócio; o servidor as traduz para status codes do gRPC (ADR 0003). */
export type TipoErro = "NAO_ENCONTRADO" | "ARGUMENTO_INVALIDO" | "PRECONDICAO";

export class ErroBiblioteca extends Error {
  constructor(
    readonly tipo: TipoErro,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroBiblioteca";
  }
}

export const naoEncontrado = (mensagem: string) => new ErroBiblioteca("NAO_ENCONTRADO", mensagem);
export const argumentoInvalido = (mensagem: string) =>
  new ErroBiblioteca("ARGUMENTO_INVALIDO", mensagem);
export const precondicao = (mensagem: string) => new ErroBiblioteca("PRECONDICAO", mensagem);
