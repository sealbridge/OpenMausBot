import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { product } from "./product.mjs";

app.setName(product.productName);
const userData = join(app.getPath("appData"), product.dataDirName);
mkdirSync(userData, { recursive: true });
app.setPath("userData", userData);
if (process.platform === "win32") app.setAppUserModelId(product.appId);

// GNOME groups the window with its desktop entry only when both identities match; set before ready.
if (process.platform === "linux") app.setDesktopName(product.desktopName);
