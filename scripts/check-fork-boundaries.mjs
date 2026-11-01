import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DELETED_WORKFLOWS = [
  "contributors", "npm-package", "docker", "connector-release",
  "sync-published-release", "prepare-release", "docs",
];
const HISTORICAL_FILES = new Set(["LICENSE", "NOTICE", "LICENSING.md", "MODIFICATIONS.md"]);
const HISTORICAL_DIRECTORIES = ["docs/plans/", "docs/superpowers/", "docs/sealbridge/"];
const BOUNDARY_TESTS = new Set([
  "scripts/check-fork-boundaries.test.mjs", "server/workspace-policy.test.ts", "server/edition.test.ts", "server/hosted-access.test.ts",
]);
const LOADER = /enterpriseLayerDirs|loadEnterpriseLayer|(?:import|export)\s*(?:\([\s\S]*?|[^;\n]*?from\s*)["'][^"'\n]*enterprise(?:\/|\.ts|\.js)|\brequire\s*\(\s*["'][^"'\n]*enterprise(?:\/|\.ts|\.js)/;
const OLD_DISTRIBUTION = /\b(?:milind-soni|SupaMaus|legacy[-_ ]?mirror|OPENMAUSBOT_RELEASE_TOKEN|RELEASE_PAT|GH_PAT|GH_TOKEN_PAT)\b|secrets(?:\s*\.\s*[\w]*(?:PAT|PERSONAL_ACCESS_TOKEN)[\w]*|\s*\[[^\]]*(?:PAT|PERSONAL_ACCESS_TOKEN)[^\]]*\])/i;

function historical(file) {
  return HISTORICAL_FILES.has(file) || (/\.(?:md|mdx|txt)$/i.test(file) && HISTORICAL_DIRECTORIES.some(prefix => file.startsWith(prefix)))
    || /(?:^|\/)CHANGELOG[^/]*\.(?:md|txt)$/i.test(file);
}

export function checkSourceFiles(root, files) {
  const errors = [];
  for (const file of files) {
    const full = join(root, file);
    if (!existsSync(full)) continue;
    if (file === "enterprise" || file.startsWith("enterprise/")) errors.push(`${file}: excluded layer file`);
    if (file === "CLA.md" || DELETED_WORKFLOWS.some(name => file === `.github/workflows/${name}.yml` || file === `.github/workflows/${name}.yaml`)) {
      errors.push(`${file}: deleted contribution or publishing file`);
    }
    if (!lstatSync(full).isFile()) continue;
    const source = /\.(?:[cm]?[jt]sx?|ya?ml|json)$/.test(file);
    const packaging = /^(?:scripts\/.*(?:bundle|packag|build|prepare)[^/]*\.[cm]?[jt]s|tsconfig[^/]*\.json|vite\.config\.ts|Dockerfile|electron-builder\.yml)$/i.test(file);
    const workflow = /^\.github\/workflows\/.*\.ya?ml$/.test(file);
    if (!source && !packaging && !workflow) continue;
    if (historical(file) || file === "scripts/check-fork-boundaries.mjs" || BOUNDARY_TESTS.has(file)) continue;
    const content = readFileSync(full, "utf8");
    if (LOADER.test(content)) errors.push(`${file}: excluded layer import or loader`);
    if (content.includes("OMB_ENTERPRISE_DIR")) {
      const noticeOnly = file === "server/edition.ts"
        && !content.replace('"OMB_ENTERPRISE_DIR"', "").includes("OMB_ENTERPRISE_DIR");
      if (!noticeOnly) errors.push(`${file}: external layer configuration outside notice boundary`);
    }
    if (packaging && /enterprise/i.test(content)) errors.push(`${file}: excluded layer in build inputs`);
    const distributionContent = file === ".github/workflows/package-win.yml"
      ? content.replace("app-update.yml does not point at milind-soni/OpenMausBot", "app-update.yml feed assertion")
      : content;
    if (workflow && OLD_DISTRIBUTION.test(distributionContent)) errors.push(`${file}: upstream distribution target or personal access token`);
  }
  return errors;
}

export function checkArtifactDirectory(directory) {
  if (!existsSync(directory)) return [`${directory}: artifact directory does not exist`];
  if (!lstatSync(directory).isDirectory()) return [`${directory}: expected an unpacked artifact directory`];
  const errors = [];
  const visit = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const file = relative(directory, full);
      if (/enterprise/i.test(entry.name)) errors.push(`${file}: excluded layer artifact`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && (/(?:license|notice|\.(?:[cm]?[jt]sx?|json|md|txt|html|ya?ml|map)$)/i.test(entry.name) || lstatSync(full).size <= 65536)) {
        const content = readFileSync(full, "utf8");
        if (/OpenMausBot Enterprise License|enterpriseLayerDirs|loadEnterpriseLayer/.test(content)) {
          errors.push(`${file}: excluded layer code or license`);
        }
      }
    }
  };
  visit(directory);
  return errors;
}

export function assertArtifactBoundary(directory) {
  const errors = checkArtifactDirectory(directory);
  if (errors.length) throw new Error(errors.join("\n"));
}

function main() {
  const artifact = process.argv[2];
  const errors = artifact ? checkArtifactDirectory(resolve(artifact)) : checkSourceFiles(ROOT,
    execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log(`Fork boundaries passed${artifact ? `: ${artifact}` : ""}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    console.error(`Fork boundary check could not finish: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}`);
    process.exitCode = 1;
  }
}
