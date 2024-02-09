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
const { v4: uuidv4 } = require('uuid');
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

setInterval(async () => {
  const currentClipText = clipboard.readText();
  if (currentClipText !== previousClipText) {
    previousClipText = currentClipText;
    const fileLinks = await extractFileLinksFromText(currentClipText);
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
                client.send(JSON.stringify({ fileLinks: fileLinks }));
              }
            });
          }
        });
    }
  }
}, 1000);

cancelTokens = {};

wss.on("connection", async function connection(ws) {
  ws.on("message", async function incoming(message) {
    try {
      const msg = JSON.parse(message);
      if (Object.keys(msg)[0] === "download") {
        const downloadPromises = msg.download.map((file, index) => {
          return new Promise((resolve, reject) => {
            // Start time for download speed calculation
            const startTime = Date.now();
            let receivedBytes = 0;
            let lastUpdateTime = Date.now();
            const requestId = uuidv4(); // Generate a unique ID for the request
            const source = axios.CancelToken.source();
            cancelTokens[requestId] = source.cancel;

            axios({
              method: "get",
              url: file.url,
              cancelToken: source.token,
              responseType: "stream",
            }).then(response => {
              const totalBytes = parseInt(response.headers["content-length"], 10);
              const hoster = new URL(file.url).hostname; // Extract hoster information from URL

              response.data.on('data', chunk => {
                receivedBytes += chunk.length;
                const now = Date.now();
                const durationInSeconds = (now - lastUpdateTime) / 1000;
                if (durationInSeconds >= 1) { // Update every second
                  let speed = (receivedBytes / durationInSeconds).toFixed(2); // bytes per second
                  // calculate kb/s or mb/s
                  if (speed < 1024) {
                    speed = speed + " B/s";
                  } else if (speed < 1048576) {
                    speed = (speed / 1024).toFixed(2) + " KB/s";
                  } else {
                    speed = (speed / 1048576).toFixed(2) + " MB/s";
                  }
                  const progress = ((receivedBytes / totalBytes) * 100).toFixed(2);
                  console.log(`Progress: ${progress}% - Speed: ${speed}`)
                  ws.send(JSON.stringify({
                    type: "downloadProgress",
                    file: file.id,
                    progress: progress,
                    speed: speed,
                    hoster: hoster,
                    cancelToken: requestId
                  }));
                  lastUpdateTime = now;
                }
              });

              const fileName = file.url.split("/").pop();
              const filePath = path.join(
                file.customPath ? file.customPath : file.path ? file.path : app.getPath("downloads"),
                fileName
              );
              const writer = fs.createWriteStream(filePath);

              response.data.pipe(writer);

              writer.on("finish", () => {
                ws.send(JSON.stringify({ type: "downloadComplete", file: file.id, hoster: hoster }));
                delete cancelTokens[requestId];
                resolve();
              });
              writer.on("error", (error) => {
                ws.send(JSON.stringify({
                  type: "downloadError",
                  file: file.id,
                  message: error.message,
                  hoster: hoster
                }));
                reject(error);
              });
            }).catch(error => {
              ws.send(JSON.stringify({
                type: "downloadError",
                file: file.id,
                message: error.message,
                hoster: 'Unknown' // Use 'Unknown' or attempt to parse hoster from URL
              }));
              delete cancelTokens[requestId];
              reject(error);
            });
          });
        });

        // Wait for all downloads to complete
        Promise.allSettled(downloadPromises).then((results) => {
          results.forEach((result, index) => {
            if (result.status === "fulfilled") {
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
    if (msg.scrapeUrls?.length > 0) {
      console.log("Scraping urls")
      const urls = extractUrlsFromText(msg.scrapeUrls);
      urls.forEach((url) => {
        axios
          .get(url)
          .then(async (response) => {
            const fileLinks = await extractFileLinksFromText(response?.data);
            ws.send(JSON.stringify({ fileLinks: fileLinks }));
          })
          .catch((error) => {
            ws.send(
              JSON.stringify({
                type: "scrapeUrlsError",
                message: error.message,
              })
            );
          });
      });
    }
    if (msg.checkLinks?.length > 0) {
      console.log("Checking links")
      const fileLinks = await extractFileLinksFromText(msg.checkLinks);
      ws.send(JSON.stringify({ fileLinks: fileLinks }));
    }
    if(msg.cancelToken){
      console.log("Cancelling token")
      cancelTokens[msg.cancelToken]();
    }
  }catch(e){
    console.log(e);
  }
  });
});

async function extractFileLinksFromText(text) {
  const urlsAndBase64Strings = extractUrlsFromText(text);
  let fileLinks = [];

  // Process each item and check if it's a downloadable URL or a base64 string
  for (const item of urlsAndBase64Strings) {
    console.log(`Processing item: ${item}`);
    let linkInfo = { url: item, type: "unknown" }; // Default link info

    // Check for base64 encoded images
    if (/^data:image\/[a-zA-Z]+;base64,/.test(item)) {
      console.log(`${item} is a base64 encoded image.`);
      const base64TypeMatch = item.match(/^data:(image\/[a-zA-Z]+);base64,/);
      if (base64TypeMatch && base64TypeMatch.length > 1) {
        // Extract MIME type from base64 data URI and consider it as the type
        linkInfo.type = base64TypeMatch[1].split('/')[1]; // Extract 'png', 'jpeg', etc.
        fileLinks.push(linkInfo);
        console.log(`Added base64 image to file links.`);
      }
    }
    // Check for regular URLs
    else if (/\bhttps?:\/\/\S+\b/gi.test(item)) {
      console.log(`${item} passed the regex test. Checking if it's downloadable...`);
      try {
        const fileInfo = await checkIfDownloadable(item);
        if (fileInfo.isDownloadable) {
          console.log(`${item} is downloadable. Adding to file links...`);
          linkInfo.type = fileInfo.fileType.split('/').pop(); // Simplistic type extraction
          if (fileInfo.fileName) {
            linkInfo.fileName = fileInfo.fileName;
          }
          fileLinks.push(linkInfo);
          console.log(`Added ${item} to file links`);
        }
      } catch (error) {
        // Log or handle errors for individual URLs
        console.log(`Error processing ${item}: ${error}`);
      }
    }
  }
  console.log(`Extracted ${fileLinks.length} file links from the text`);
  return fileLinks;
}

function extractUrlsFromText(text) {
  let cleanUrls = extractUrlsFromHtml(text); // Attempt to extract from HTML first
  if (cleanUrls.length > 0) {
    cleanUrls = cleanUrls.map(cleanUrl);
  }
  return cleanUrls;
}

function checkIfDownloadable(url) {
  return new Promise(resolve => {
    axios.head(url)
      .then(response => {
        console.log(`Received HEAD response for ${url}`)
        const contentDisposition = response.headers["content-disposition"];
        const contentType = response.headers["content-type"];

        let fileInfo = {
          isDownloadable: false,
          fileType: "unknown",
          fileName: "unknown",
          error: null // Indicate no error initially
        };

        if (contentDisposition && contentDisposition.includes("attachment")) {
          console.log(`${url} is downloadable based on Content-Disposition`)
          fileInfo.isDownloadable = true;
          // Attempt to extract filename from Content-Disposition
          const filenameMatch = contentDisposition.match(/filename="?(.+?)"?($|;)/i);
          if (filenameMatch) {
            console.log(`Extracted filename from Content-Disposition: ${filenameMatch[1]}`)
            fileInfo.fileName = filenameMatch[1];
          }
        }

        if (contentType) {
          fileInfo.fileType = contentType;
          // Consider any non-html/text content type as downloadable
          if (!contentType.startsWith("text/html") && !contentType.startsWith("text/plain")) {
            fileInfo.isDownloadable = true;
          }
        }

        resolve(fileInfo); // Resolve with fileInfo regardless of the result
      })
      .catch(error => {
        // Resolve with error information instead of rejecting
        resolve({
          isDownloadable: false,
          fileType: "unknown",
          fileName: "unknown",
          error: error.message // Provide error message
        });
      });
  });
}

function cleanUrl(url) {
  // Find the index of the first occurrence of '?' or '&'
  const indexOfQueryStart = url.indexOf('?');
  const indexOfAmpStart = url.indexOf('&');

  // Determine the earliest relevant character for trimming
  let trimIndex = -1;
  if (indexOfQueryStart > -1 && indexOfAmpStart > -1) {
    // Both '?' and '&' are found, choose the earliest
    trimIndex = Math.min(indexOfQueryStart, indexOfAmpStart);
  } else if (indexOfQueryStart > -1) {
    // Only '?' found
    trimIndex = indexOfQueryStart;
  } else if (indexOfAmpStart > -1) {
    // Only '&' found
    trimIndex = indexOfAmpStart;
  }

  // Trim the URL if a '?' or '&' was found
  if (trimIndex > -1) {
    return url.substring(0, trimIndex);
  }
  return url; // Return the original URL if no '?' or '&' was found
}

function extractUrlsFromHtml(html) {
  const srcRegex = /src="([^"]+)"/gi;
  const normRegex = /\bhttps?:\/\/\S+\b/gi;
  const srcMatches = html?.match(srcRegex) || [];
  console.log("SRC MATCHES", srcMatches);
  const normMatches = html?.match(normRegex) || [];
  console.log("NORM MATCHES", normMatches);
    return [...srcMatches, ...normMatches]
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
