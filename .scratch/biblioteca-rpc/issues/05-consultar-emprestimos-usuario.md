# 05: `ConsultarEmprestimosUsuario`

**What to build:** o bibliotecário consulta os Empréstimos ativos de um Usuário e vê, para cada um, Livro (código e título), Exemplar, data do Empréstimo, data limite e situação (no prazo / atrasado), calculada em relação ao "hoje" do servidor. Ver spec e `CONTEXT.md` (Prazo, Atraso).

**Blocked by:** 03 (`RealizarEmprestimo`)

**Status:** ready-for-agent

- [ ] `ConsultarEmprestimosUsuario` no `.proto`, com situação como enum (`NO_PRAZO` / `ATRASADO`), código regerado
- [ ] Retorna apenas Empréstimos ativos
- [ ] No prazo até a data limite inclusive; atrasado a partir do dia seguinte
- [ ] Usuário inexistente → `NOT_FOUND`; sem Empréstimos ativos → lista vazia (não é erro)
- [ ] CLI ganha "Empréstimos do usuário": tabela com os campos acima, ou "Nenhum empréstimo encontrado para o usuário"
- [ ] Testes de integração via gRPC: no prazo, exatamente na data limite, um dia depois, lista vazia, Usuário inexistente
