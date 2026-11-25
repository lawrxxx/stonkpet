// Compiles contracts/*.sol with solc-js and writes ABIs + bytecode to contracts/out.json.
// Usage: node scripts/compile-contracts.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import solc from "solc";

const dir = new URL("../contracts/", import.meta.url);
const sources = Object.fromEntries(
  readdirSync(dir).filter((f) => f.endsWith(".sol")).map((f) => [f, { content: readFileSync(new URL(f, dir), "utf8") }]),
);
const input = {
  language: "Solidity",
  sources,
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
for (const e of out.errors ?? []) console.error(e.formattedMessage);
if (errors.length) process.exit(1);

const artifacts = {};
for (const file of Object.keys(out.contracts)) for (const [name, c] of Object.entries(out.contracts[file]))
  artifacts[name] = { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
writeFileSync(new URL("out.json", dir), JSON.stringify({ compiler: solc.version(), artifacts }, null, 0) + "\n");
console.log("compiled:", Object.keys(artifacts).join(", "), "with", solc.version());
