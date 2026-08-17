import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const libs = [
  {
    dir: path.join(root, "lib", "openzeppelin-contracts"),
    url: "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
    extra: ["--branch", "v5.2.0"],
  },
  {
    dir: path.join(root, "lib", "forge-std"),
    url: "https://github.com/foundry-rs/forge-std.git",
    extra: ["--branch", "v1.9.6"],
  },
];

for (const lib of libs) {
  if (fs.existsSync(lib.dir)) {
    console.log(`skip ${path.relative(root, lib.dir)} (already present)`);
    continue;
  }
  fs.mkdirSync(path.dirname(lib.dir), { recursive: true });
  const cmd = `git clone --depth 1 ${lib.extra.join(" ")} ${lib.url} "${lib.dir}"`;
  console.log(cmd);
  execSync(cmd, { stdio: "inherit" });
}
