import { desktopInvites } from "./invites.mjs";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { product, userDataPath } from "./product.mjs";

app.setName(product.productName);
const userData = userDataPath(app.getPath("appData"));
mkdirSync(userData, { recursive: true });
app.setPath("userData", userData);
if (process.platform === "win32") app.setAppUserModelId(product.appId);

// GNOME groups the window with its desktop entry only when both identities match; set before ready.
if (process.platform === "linux") app.setDesktopName(product.desktopName);

desktopInvites.capture({ app, reveal: () => {
  if (!app.isReady()) return;
  void import("electron").then(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed()); if (win) { win.show(); win.focus(); } });
} });
