# TLS ligado por padrão, com certificado autoassinado gerado localmente

Sem criptografia, a senha de `Entrar` e o token de Sessão trafegariam em texto puro. Decidimos usar TLS em toda conexão, com um certificado autoassinado gerado por `npm run certificados` (pacote `selfsigned`, sem depender do OpenSSL) e mantido fora do git, porque a chave privada não pode ir para um repositório público. O cliente confia no servidor por ter uma cópia do certificado. `BIBLIOTECA_TLS=desligado` existe só para depuração.

## Opções consideradas

- **Certificado versionado no repositório**: mais prático, mas publica a chave privada.
- **Certificado de uma autoridade pública (ex.: Let's Encrypt)**: exige domínio e servidor exposto na internet, fora do escopo de uma demonstração local.
- **TLS opcional, desligado por padrão**: na prática, ninguém liga.

## Consequências

- Para clientes em outras máquinas, o certificado precisa listar o IP ou nome usado na conexão (`npm run certificados -- 192.168.0.10`) e ser copiado para essas máquinas.
- Os testes automatizados rodam todos sobre TLS.
