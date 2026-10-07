import type { DadosIniciais } from "./dados.js";

/** Acervo de demonstração, carregado quando o banco está vazio. */
export function dadosDeDemonstracao(): DadosIniciais {
  return {
    usuarios: [
      { codigo: "U001", nome: "Ana Souza" },
      { codigo: "U002", nome: "Bruno Lima" },
      { codigo: "U003", nome: "Carla Mendes" },
    ],
    livros: [
      { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 3 },
      { codigo: "L002", titulo: "Vidas Secas", autor: "Graciliano Ramos", exemplares: 2 },
      { codigo: "L003", titulo: "Grande Sertão: Veredas", autor: "João Guimarães Rosa", exemplares: 1 },
      { codigo: "L004", titulo: "A Hora da Estrela", autor: "Clarice Lispector", exemplares: 2 },
      { codigo: "L005", titulo: "O Cortiço", autor: "Aluísio Azevedo", exemplares: 1 },
      { codigo: "L006", titulo: "Capitães da Areia", autor: "Jorge Amado", exemplares: 2 },
      { codigo: "L007", titulo: "Memórias Póstumas de Brás Cubas", autor: "Machado de Assis", exemplares: 2 },
      { codigo: "L008", titulo: "Sistemas Distribuídos: Conceitos e Projeto", autor: "George Coulouris", exemplares: 3 },
      { codigo: "L009", titulo: "Redes de Computadores", autor: "Andrew S. Tanenbaum", exemplares: 1 },
      { codigo: "L010", titulo: "O Alienista", autor: "Machado de Assis", exemplares: 1 },
    ],
    emprestimos: [],
  };
}
