/** Formata linhas como uma tabela de texto alinhada. */
export function tabela(cabecalho: string[], linhas: string[][]): string {
  const larguras = cabecalho.map((titulo, i) =>
    Math.max(titulo.length, ...linhas.map((linha) => linha[i].length)),
  );
  const formatar = (linha: string[]) =>
    linha.map((celula, i) => celula.padEnd(larguras[i])).join("  ").trimEnd();
  const separador = larguras.map((l) => "─".repeat(l)).join("  ");
  return [formatar(cabecalho), separador, ...linhas.map(formatar)].join("\n");
}
