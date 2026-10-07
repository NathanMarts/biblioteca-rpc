// Gera os tipos e stubs TypeScript a partir de proto/biblioteca.proto usando ts-proto.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const windows = process.platform === "win32";
const bin = join("node_modules", ".bin");
const protoc = join("node_modules", "grpc-tools", "bin", windows ? "protoc.exe" : "protoc");
const plugin = join(bin, windows ? "protoc-gen-ts_proto.cmd" : "protoc-gen-ts_proto");

execFileSync(
  protoc,
  [
    `--plugin=protoc-gen-ts_proto=${plugin}`,
    "--ts_proto_out=src/generated",
    "--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true,importSuffix=.js,useDate=false",
    "--proto_path=proto",
    "biblioteca.proto",
  ],
  { stdio: "inherit", shell: windows },
);
console.log("Código gerado em src/generated/");
