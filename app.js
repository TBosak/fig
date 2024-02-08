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
      const downloadPromises = msg.download.map((file) => {
        // Check if the URL is a base64 encoded image
        if (file.url.startsWith('data:image/')) {
          return new Promise((resolve, reject) => {
            // Extract the MIME type and the base64 data
            const matches = file.url.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
              ws.send(JSON.stringify({ type: 'downloadError', file: file.id, message: 'Invalid base64 image data' }));
              return reject(new Error('Invalid base64 image data'));
            }

            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Determine the file extension based on the MIME type
            const extension = mimeType.split('/')[1];
            const fileName = `image_${Date.now()}_${index}.${extension}`;
            const filePath = path.join(file.customPath ? file.customPath : (file.path ? file.path : app.getPath('downloads')), fileName);

            fs.writeFile(filePath, buffer, (err) => {
              if (err) {
                ws.send(JSON.stringify({ type: 'downloadError', file: file.id, message: err.message }));
                reject(err);
              } else {
                ws.send(JSON.stringify({ type: 'downloadComplete', file: file.id }));
                resolve();
              }
            });
          });
        } else {
          // Handle regular file URLs with Axios
          return axios({
            method: 'get',
            url: file.url,
            responseType: 'stream',
          }).then(response => {
            const fileName = file.url.split("/").pop();
            const filePath = path.join(file.customPath ? file.customPath : (file.path ? file.path : app.getPath('downloads')), fileName);
            const writer = fs.createWriteStream(filePath);

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
        }
      });

      // Wait for all downloads to complete
      Promise.allSettled(downloadPromises).then(results => {
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(`File download successful`);
          } else {
            console.error(`Failed to download file: ${result.reason}`);
          }
        });
      });
    }
    if (msg.setDefaultPath === true) {
      dialog
        .showOpenDialog({
          properties: ["openDirectory"],
        })
        .then((result) => {
          if (result.canceled === false) {
            ws.send(
              JSON.stringify({
                defaultPath: result.filePaths[0],
              })
            );
          }
        });
    }
      if(msg.scrapeUrls !== null){
        const urls = extractUrlsFromText(msg.scrapeUrls);
        urls.forEach((url) => {
          axios.get(url).then((response) => {
            const fileLinks = extractFileLinksFromText(response.data);
            ws.send(JSON.stringify({ type: 'fileLinks', fileLinks }));
          }).catch((error) => {
            ws.send(JSON.stringify({ type: 'scrapeUrlsError', message: error.message }));
          });
        });
      }
  });
});

function extractFileLinksFromText(text) {
  // Matches both: URLs ending with specified file extensions and base64 encoded images
  const urlRegex = /\bhttps?:\/\/\S+\.(pdf|zip|rar|7z|tar|gz|bz2|docx|xlsx|pptx|mp3|mp4|ogg|wav|webm|jpg|jpeg|png|gif|csv)\b/gi;
  const base64ImageRegex = /data:image\/[a-zA-Z]+;base64,[^\s]+/gi;

  const fileLinks = text.match(urlRegex) || [];
  const base64Images = text.match(base64ImageRegex) || [];

  // Combine both arrays
  return [...fileLinks, ...base64Images];
}

function extractUrlsFromText(text) {
  return (
    text?.match(
      /\bhttps?:\/\/\S+\b/gi
    ) || []
  );
}
