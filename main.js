const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron")
const path = require("path")
const fs = require("fs")
const {
  createRpcClient,
  setActivity,
  clearActivity,
  loginRpc,
  destroyRpc,
} = require("./rpc")

let win,
  tray,
  rpcClient,
  currentConfig = {}
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json")
const DEBUG = true

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      currentConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {}
      DEBUG &&
        console.log("[RPCUI] loaded config from", CONFIG_PATH, currentConfig)
    } else {
      currentConfig = {
        clientId: "",
        details: "Listening ...",
        state: "chill vibes 🎧",
        largeImageKey: "",
        largeImageText: "",
        smallImageKey: "",
        smallImageText: "",
        showTimer: true,
        runAtLogin: false,
      }
      DEBUG && console.log("[RPCUI] using default config")
    }
  } catch (e) {
    console.error("Failed to read config:", e)
    currentConfig = {}
  }
  return currentConfig
}

function writeConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
    currentConfig = cfg
  } catch (e) {
    console.error("Failed to write config:", e)
  }
}

const isPackaged = app.isPackaged
const preloadPath = isPackaged
  ? path.join(process.resourcesPath, "preload.js")
  : path.join(__dirname, "preload.js")

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenuBarVisibility(false)
  win.loadFile("renderer.html")
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, "icon.png")
    const trayIcon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty()
    tray = new Tray(trayIcon)
    tray.setToolTip("Discord RPC UI")
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open", click: () => win?.show() },
        {
          label: "Set Presence",
          click: () => handleSetPresence(currentConfig),
        },
        { label: "Clear Presence", click: () => handleClearPresence() },
        { type: "separator" },
        {
          label: "Show Console Tip",
          click: () => {
            win?.show()
            win?.webContents.send("status", {
              ok: true,
              msg: "Open the terminal where you ran `npm start` to see logs.",
            })
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            destroyRpc()
            app.quit()
          },
        },
      ])
    )
    tray.on("click", () => win?.show())
  } catch (e) {
    console.error("Tray error:", e)
  }
}

function parseList(input) {
  if (!input) return []
  return String(input)
    .split(/[\n|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

let _rotateTimer = null

async function handleSetPresence(cfg) {
  if (!cfg?.clientId || String(cfg.clientId).trim() === "") {
    win?.webContents.send("status", { ok: false, msg: "Client ID is required" })
    return
  }
  try {
    if (!rpcClient) rpcClient = createRpcClient()
    await loginRpc(rpcClient, cfg.clientId)

    const detailsList = parseList(cfg.details)
    const stateList = parseList(cfg.state)

    if (detailsList.length === 0) detailsList.push("Listening ...")
    if (stateList.length === 0) stateList.push("🎧")

    const now = Date.now()
    const durSec = Number(cfg.durationSec || 0)
    const baseStart = cfg.showTimer ? now : undefined
    const baseEnd =
      cfg.showTimer && durSec > 0 ? now + durSec * 1000 : undefined

    let idx = 0
    const apply = async () => {
      const d = detailsList[idx % detailsList.length]
      const s = stateList[idx % stateList.length]
      await setActivity(rpcClient, {
        details: d,
        state: s,
        largeImageKey: cfg.largeImageKey || undefined,
        largeImageText: cfg.largeImageText || undefined,
        smallImageKey: cfg.smallImageKey || undefined,
        smallImageText: cfg.smallImageText || undefined,
        startTimestamp: baseStart,
        endTimestamp: baseEnd,
      })
      idx++
    }

    if (_rotateTimer) clearInterval(_rotateTimer)

    await apply()

    const ROTATE_SEC = Math.max(15, Number(cfg.rotateSec || 15))
    _rotateTimer = setInterval(() => {
      apply().catch(() => {})
    }, ROTATE_SEC * 1000)

    win?.webContents.send("status", {
      ok: true,
      msg: `Presence rotating every ${ROTATE_SEC}s`,
    })
  } catch (e) {
    console.error(e)
    win?.webContents.send("status", { ok: false, msg: String(e?.message || e) })
  }
}

app.whenReady().then(() => {
  readConfig()

  ipcMain.handle("load-config", () => currentConfig)
  ipcMain.handle("save-config", (_e, cfg) => {
    writeConfig(cfg)
    try {
      app.setLoginItemSettings({ openAtLogin: !!cfg.runAtLogin })
    } catch (_) {}
    DEBUG && console.log("[RPCUI] saved config", cfg)
    return { ok: true }
  })
  ipcMain.handle("set-presence", (_e, cfg) => handleSetPresence(cfg))
  ipcMain.handle("clear-presence", () => handleClearPresence())

  createWindow()
  createTray()

  if (currentConfig?.clientId) {
    DEBUG && console.log("[RPCUI] auto set presence on launch")
    handleSetPresence(currentConfig)
  } else {
    DEBUG && console.log("[RPCUI] skip auto presence; empty clientId")
  }
})

app.on("window-all-closed", (e) => {
  e.preventDefault()
})

app.on("before-quit", () => {
  destroyRpc()
})
