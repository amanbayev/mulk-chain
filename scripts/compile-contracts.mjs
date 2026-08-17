import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const srcRoot = path.join(root, "packages", "contracts", "src");

const remappings = [
  ["@openzeppelin/contracts/", "lib/openzeppelin-contracts/contracts/"],
  ["forge-std/", "lib/forge-std/src/"],
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".sol")) acc.push(full);
  }
  return acc;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function findImports(importPath) {
  for (const [prefix, target] of remappings) {
    if (importPath.startsWith(prefix)) {
      const resolved = path.join(root, target, importPath.slice(prefix.length));
      if (fs.existsSync(resolved)) {
        return { contents: fs.readFileSync(resolved, "utf8") };
      }
    }
  }
  const direct = path.isAbsolute(importPath) ? importPath : path.join(root, importPath);
  if (fs.existsSync(direct)) {
    return { contents: fs.readFileSync(direct, "utf8") };
  }
  return { error: `File not found: ${importPath}` };
}

const sources = {};
for (const file of walk(srcRoot)) {
  sources[toPosix(path.relative(root, file))] = { content: fs.readFileSync(file, "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    remappings: remappings.map(([from, to]) => `${from}=${to}`),
  },
};

const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImports }),
);

if (output.errors) {
  const fatal = output.errors.filter((err) => err.severity === "error");
  for (const err of output.errors) {
    console.log(err.formattedMessage || err.message);
  }
  if (fatal.length > 0) {
    process.exit(1);
  }
}

const contracts = output.contracts ?? {};
let count = 0;
for (const file of Object.keys(contracts)) {
  for (const name of Object.keys(contracts[file])) {
    const bytecode = contracts[file][name].evm?.bytecode?.object ?? "";
    if (bytecode.length > 0) {
      count += 1;
      console.log(`compiled ${name} (${bytecode.length / 2} bytes)`);
    }
  }
}
console.log(`OK: ${count} contracts compiled with solc 0.8.24 via_ir`);
