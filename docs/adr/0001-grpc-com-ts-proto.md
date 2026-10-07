# gRPC com ts-proto como mecanismo de RPC

O trabalho exige cliente/servidor com RPC, sem prescrever tecnologia, e a implementação é em TypeScript. Escolhemos gRPC (`@grpc/grpc-js`) com a interface definida em um arquivo `.proto` e tipos gerados por `ts-proto`, porque o `.proto` funciona como contrato explícito (IDL) compartilhado por cliente e servidor e como a própria descrição da API exigida na documentação, além de tornar visíveis na apresentação os conceitos de IDL, stub e serialização.

## Opções consideradas

- **JSON-RPC 2.0 sobre HTTP**: mais simples, mas a interface fica implícita, sem IDL.
- **tRPC**: popular em TypeScript, mas é essencialmente HTTP com tipos compartilhados; é questionável como "RPC" no sentido da disciplina e prende cliente e servidor ao mesmo código TS.
- **XML-RPC**: tipagem fraca e pouco suporte atual no ecossistema Node.
- **`@grpc/proto-loader`** (carregamento dinâmico): evita geração de código, mas perde a tipagem estática.

## Consequências

O código gerado é versionado no repositório (com script para regerar), para que rodar o projeto não dependa do compilador `protoc`.
