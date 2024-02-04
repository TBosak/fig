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
    if (Object.keys(msg)[0] === "download") {
      // Map each file URL to a Promise of its download process
      const downloadPromises = msg.download.map((file, index) => {
        return axios({
          method: 'get',
          url: file.url,
          responseType: 'stream',
          onDownloadProgress: progressEvent => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // Send progress update via WebSocket
            ws.send(JSON.stringify({ type: 'downloadProgress', file: file.id, progress: percentCompleted }));
          }
        }).then((response) => {
          const fileName = file.url.split("/").pop();
          const filePath = path.join(__dirname, fileName);
          const writer = fs.createWriteStream(filePath);

          let downloaded = 0;
          const totalLength = response.headers['content-length'];

          response.data.on('data', (chunk) => {
            downloaded += chunk.length;
            const progress = (downloaded / totalLength * 100).toFixed(2);
            // Send progress update for each chunk received
            console.log(`File:${fileName}, Downloaded ${progress}%`);
            ws.send(JSON.stringify({ type: 'downloadProgress', file: file.id, progress: progress }));
          });

          response.data.pipe(writer);

          return new Promise((resolve, reject) => {
            writer.on('finish', () => {
              ws.send(JSON.stringify({ type: 'downloadComplete', file: file.id }));
              resolve();
            });
            writer.on('error', (error) => {
              ws.send(JSON.stringify({ type: 'downloadError', file: file.id, message: error.message }));
              reject(error);
            });
          });
        });
      });

      // Wait for all downloads to complete
      Promise.allSettled(downloadPromises).then((results) => {
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(`File download successful`);
          } else {
            console.error(`Failed to download file: ${result.reason}`);
          }
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
