import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { product } from "../electron/sealbridge/product.mjs";

const check = process.argv.includes("--check");
function output(file, data) {
  const url = new URL(`../${file}`, import.meta.url);
  const bytes = Buffer.from(data);
  if (check) {
    if (!readFileSync(url).equals(bytes)) throw new Error(`Branding needs regeneration: ${file}`);
  } else {
    mkdirSync(new URL(".", url), { recursive: true });
    writeFileSync(url, bytes);
  }
}

const pixels = ["111101110", "100001001", "100001001", "111101110", "000101001", "000101001", "111101110"];
const foreground = (x, y, size) => {
  const column = Math.floor(x * 12 / size) - 1;
  const row = Math.floor(y * 12 / size) - 2;
  return row >= 0 && row < 7 && column >= 0 && column < 9 && pixels[row][column] === "1";
};
const rectangles = pixels.flatMap((row, y) => [...row].flatMap((value, x) => value === "1" ? [`<rect x="${x + 1}" y="${y + 2}" width="1" height="1"/>`] : [])).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><title>SB — temporary placeholder</title><path fill="#334155" d="M0 0h12v12H0z"/><g fill="#ffffff">${rectangles}</g></svg>\n`;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, checksum]);
}
function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const data = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = y * (1 + size * 4) + 1 + x * 4;
    const color = foreground(x, y, size) ? [255, 255, 255, 255] : [51, 65, 85, 255];
    data.set(color, offset);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(data)), chunk("IEND", Buffer.alloc(0))]);
}
output("branding/icons/icon.svg", svg);
output("branding/icons/icon.png", png(1024));
const windows = png(256);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(windows.length, 14);
ico.writeUInt32LE(22, 18);
output("branding/icons/icon.ico", Buffer.concat([ico, windows]));
const mac = [ ["ic07", 128], ["ic08", 256], ["ic09", 512], ["ic10", 1024] ].map(([type, size]) => {
  const image = png(size);
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32BE(image.length + 8, 4);
  return Buffer.concat([header, image]);
});
const icns = Buffer.alloc(8);
icns.write("icns");
icns.writeUInt32BE(8 + mac.reduce((sum, bytes) => sum + bytes.length, 0), 4);
output("branding/icons/icon.icns", Buffer.concat([icns, ...mac]));
for (const file of ["public/app-icon.svg", "build/icon.svg"]) output(file, svg);
for (const [file, size] of [["public/app-icon-192.png", 192], ["public/app-icon-512.png", 512], ["public/apple-touch-icon.png", 180], ["electron/resources/app-icon.png", 256], ["build/icon-1024.png", 1024]]) output(file, png(size));
for (const [file, type] of [["build/icon.ico", "ico"], ["build/icon.icns", "icns"]]) output(file, readFileSync(new URL(`../branding/icons/icon.${type}`, import.meta.url)));

let builder = readFileSync(new URL("../electron-builder.yml", import.meta.url), "utf8");
builder = builder.replace(/^appId:.*$/m, `appId: ${product.appId}`).replace(/^productName:.*$/m, `productName: ${product.productName}`)
  .replace(/schemes: \[.*\]/, `schemes: [${product.urlScheme}]`)
  .replace(/^  executableName:.*$/m, `  executableName: ${product.executableName}`)
  .replace(/^      Name:.*$/m, `      Name: ${product.productName}`)
  .replace(/artifactName: [^\n]+/g, match => match.replace(/: .*?-\$\{version\}/, `: ${product.productName.replaceAll(" ", "-")}-\u0024{version}`));
output("electron-builder.yml", builder);

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
pkg.productName = product.productName;
pkg.desktopName = product.desktopName;
output("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
manifest.name = product.productName;
manifest.short_name = product.shortName;
output("public/manifest.webmanifest", `${JSON.stringify(manifest, null, 2)}\n`);
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  .replace(/<title>[^<]*<\/title>/, `<title>${product.productName}</title>`)
  .replace(/name="apple-mobile-web-app-title" content="[^"]*"/, `name="apple-mobile-web-app-title" content="${product.productName}"`);
output("index.html", html);
const speechInfo = readFileSync(new URL("../electron/resources/speech-helper-Info.plist", import.meta.url), "utf8")
  .replace(/(<key>CFBundleIdentifier<\/key>\s*<string>)[^<]*/, `$1${product.appId}.speech-helper`)
  .replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*/, `$1${product.productName}`)
  .replace(/(<key>CFBundleName<\/key>\s*<string>)[^<]*/, `$1${product.productName} Speech`);
output("electron/resources/speech-helper-Info.plist", speechInfo);

console.log(`Branding ${check ? "verified" : "generated"}.`);
