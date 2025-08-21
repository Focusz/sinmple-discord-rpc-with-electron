const RPC = require("discord-rpc")
const DEBUG = true

function createRpcClient() {
  const client = new RPC.Client({ transport: "ipc" })
  client.on("ready", () => DEBUG && console.log("[RPC] ready"))
  client.on("connected", () => DEBUG && console.log("[RPC] connected"))
  client.on("disconnected", () => DEBUG && console.log("[RPC] disconnected"))
  return client
}

async function loginRpc(client, clientId) {
  RPC.register(clientId)
  let attempt = 0
  while (true) {
    try {
      DEBUG && console.log("[RPC] login attempt", ++attempt)
      await client.login({ clientId })
      DEBUG && console.log("[RPC] login success")
      return
    } catch (e) {
      DEBUG && console.log("[RPC] login failed:", e?.message || e)

      await new Promise((r) => setTimeout(r, 1000))
    }

    throw new Error(
      "Cannot connect to Discord. Make sure Discord desktop is open."
    )
  }
}

async function setActivity(client, opts) {
  return client.setActivity({
    details: opts.details,
    state: opts.state,
    startTimestamp: opts.startTimestamp
      ? Math.floor(opts.startTimestamp / 1000)
      : undefined,
    endTimestamp: opts.endTimestamp
      ? Math.floor(opts.endTimestamp / 1000)
      : undefined,
    largeImageKey: opts.largeImageKey,
    largeImageText: opts.largeImageText,
    smallImageKey: opts.smallImageKey,
    smallImageText: opts.smallImageText,
    instance: false,
  })
}

async function clearActivity(client) {
  DEBUG && console.log("[RPC] clearActivity")
  try {
    await client.clearActivity()
  } catch (_) {}
}

function destroyRpc(client) {
  DEBUG && console.log("[RPC] destroy")
  try {
    if (client && typeof client.destroy === "function") client.destroy()
  } catch (_) {}
}

module.exports = {
  createRpcClient,
  loginRpc,
  setActivity,
  clearActivity,
  destroyRpc,
}
