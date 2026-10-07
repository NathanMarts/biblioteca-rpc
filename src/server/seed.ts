import type { DadosIniciais } from "./dados.js";

/** Acervo de demonstração, carregado quando o banco está vazio. */
export function dadosDeDemonstracao(): DadosIniciais {
  return {
    usuarios: [
      { codigo: "U001", nome: "Ana Souza" },
      { codigo: "U002", nome: "Bruno Lima" },
      { codigo: "U003", nome: "Carla Mendes" },
    ],
    livros: [],
    emprestimos: [],
  };
}
