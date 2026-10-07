import type { DadosIniciais } from "./dados.js";
import { somarDias } from "./datas.js";

/**
 * Acervo de demonstração, carregado quando o banco está vazio. As datas são relativas a `hoje`
 * para que sempre existam Empréstimos no prazo, atrasados e encerrados:
 * - Ana (U001) está no limite de 3 Empréstimos, um deles atrasado;
 * - "Grande Sertão: Veredas" (L003) está totalmente indisponível;
 * - Bruno (U002) tem um Empréstimo atrasado e um no prazo;
 * - Carla (U003) não tem Empréstimos ativos, só histórico.
 */
export function dadosDeDemonstracao(hoje: string): DadosIniciais {
  const diasAtras = (dias: number) => somarDias(hoje, -dias);
  return {
    bibliotecarios: [{ login: "beatriz", nome: "Beatriz Rocha", senha: "biblioteca" }],
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
    emprestimos: [
      // Encerrados (histórico)
      { usuario: "U001", exemplar: "L007-1", dataEmprestimo: diasAtras(40), dataDevolucao: diasAtras(33) },
      { usuario: "U003", exemplar: "L001-2", dataEmprestimo: diasAtras(30), dataDevolucao: diasAtras(25) },
      { usuario: "U002", exemplar: "L010-1", dataEmprestimo: diasAtras(20), dataDevolucao: diasAtras(15) },
      { usuario: "U003", exemplar: "L003-1", dataEmprestimo: diasAtras(18), dataDevolucao: diasAtras(13) },
      // Ativos
      { usuario: "U001", exemplar: "L003-1", dataEmprestimo: diasAtras(12) }, // atrasado
      { usuario: "U001", exemplar: "L008-1", dataEmprestimo: diasAtras(5) },
      { usuario: "U001", exemplar: "L001-1", dataEmprestimo: diasAtras(2) },
      { usuario: "U002", exemplar: "L002-1", dataEmprestimo: diasAtras(10) }, // atrasado
      { usuario: "U002", exemplar: "L004-1", dataEmprestimo: diasAtras(1) },
    ],
  };
}
