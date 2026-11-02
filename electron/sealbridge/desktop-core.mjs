import path from "node:path";
import { createCoreService, registerCoreIpc } from "./service.mjs";

export function startDesktopCore({ app, ipcMain, localOnly }) {
  const service = createCoreService({
    dataDir: path.join(app.getPath("userData"), "sealbridge-core"),
    resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  });
  registerCoreIpc({ ipcMain, localOnly, service });
  void service.start();
  return service;
}
