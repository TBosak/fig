const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  clipboard,
  ipcMain,
  dialog,
} = require("electron");
const url = require("url");
const path = require("path");
const WebSocket = require("ws");
const axios = require("axios");
const fs = require("fs");
const wss = new WebSocket.Server({ port: 8080 });

let mainWindow;
let tray = null; // Global reference
let appIcon = path.join(__dirname, "fig.png");
let previousClipText = clipboard.readText();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
    icon: path.join(appIcon),
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, `/dist/fig/browser/index.html`),
      protocol: "file:",
      slashes: true,
    })
  );

  mainWindow.on("close", function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

app.on("ready", () => {
  createWindow();
  createTray();
  if (process.platform === "linux") {
    app.setIcon(appIcon);
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

function createTray() {
  tray = new Tray(appIcon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: function () {
        mainWindow.show();
      },
    },
    {
      label: "Quit",
      click: function () {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip("Fig");
  tray.setContextMenu(contextMenu);
}

setInterval(() => {
  const currentClipText = clipboard.readText();
  if (currentClipText !== previousClipText) {
    previousClipText = currentClipText;
    const fileLinks = extractFileLinksFromText(currentClipText);
    if (fileLinks.length > 0) {
      dialog
        .showMessageBox({
          type: "info",
          title: "File Links Found",
          message: `We found ${fileLinks.length} file links in your clipboard. Do you want to add them to files to download?`,
          buttons: ["Yes", "No"],
        })
        .then(({ response }) => {
          if (response === 0) {
            wss.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "fileLinks", fileLinks }));
              }
            });
          }
        });
    }
  }
}, 1000);

wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    const msg = JSON.parse(message);
    if (Object.keys(msg)[0] === "download"){
      msg.download.forEach((file) => {
        axios.get(file, {responseType: 'stream'}).then((response) => {
          const fileName = file.split("/").pop();
          const filePath = path.join(__dirname, "downloads", fileName);
          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);
        });
      });
    }
  });
});

function extractFileLinksFromText(text) {
  return (
    text.match(
      /\bhttps?:\/\/\S+\.(pdf|zip|tar|gz|docx|xlsx|pptx|mp3|mp4|jpg|jpeg|png|gif|csv)\b/gi
    ) || []
  );
}
