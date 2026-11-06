import { createContextSender, registerContextSendIpc } from "./context-send.mjs";
import { registerContextPoolingIpc, createContextPreparation, loadContextSdk } from "./context-pooling.mjs";
import { clipboard } from "electron";
import { desktopInvites, registerInviteIpc } from "./invites.mjs";
import { createInviteProcess } from "./invite-process.mjs";
import { developmentRuntimeDir } from "./runtime.mjs";
import path from "node:path";
import { createCoreService, registerCoreIpc } from "./service.mjs";

export function startDesktopCore({ app, ipcMain, localOnly }) {
  const service = createCoreService({
    dataDir: path.join(app.getPath("userData"), "sealbridge-core"),
    resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  });
  registerCoreIpc({ ipcMain, localOnly, service: { ...service, retry: async () => prepareInvites(await service.retry()) } });
  registerContextPoolingIpc({ ipcMain, localOnly, prepare: createContextPreparation({ loadSdk: () => loadContextSdk(
    app.isPackaged ? path.join(process.resourcesPath, "sealbridge-runtime") : developmentRuntimeDir) }) });
  const sender = createContextSender({ service, dataDir: path.join(app.getPath("userData"), "sealbridge-core"),
    runtimeDir: app.isPackaged ? path.join(process.resourcesPath, "sealbridge-runtime") : developmentRuntimeDir });
  registerContextSendIpc({ ipcMain, localOnly, sender });
  app.on("before-quit", () => sender.cancel(true));
  registerInviteIpc({ ipcMain, localOnly, clipboard });
  const operate = createInviteProcess({ dataDir: path.join(app.getPath("userData"), "sealbridge-core"),
    runtimeDir: app.isPackaged ? path.join(process.resourcesPath, "sealbridge-runtime") : developmentRuntimeDir });
  const prepareInvites = status => { if (status.state === "ready") void desktopInvites.ready(operate); return status; };
  void service.start().then(prepareInvites);
  return service;
}
