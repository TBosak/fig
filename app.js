const { app, BrowserWindow, Tray, Menu } = require('electron');
    const url = require("url");
    const path = require("path");

    let mainWindow
    let tray = null; // Global reference
    let appIcon = path.join(__dirname, 'fig.png');

    function createWindow () {
      mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: true
        },
        icon: path.join(appIcon)
      })

      mainWindow.loadURL(
        url.format({
          pathname: path.join(__dirname, `/dist/fig/browser/index.html`),
          protocol: "file:",
          slashes: true
        })
      );

      mainWindow.on('close', function (event) {
        if (!app.isQuiting){
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
    }

    app.on('ready', () => {
      createWindow();
      createTray();
      if (process.platform === 'linux') {
        app.setIcon(appIcon);
      }
    });

    app.on('activate', function () {
      if (mainWindow === null) {
        createWindow();
      } else {
        mainWindow.show();
      }
    });


function createTray() {
  tray = new Tray(appIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click:  function(){
        mainWindow.show();
    } },
    { label: 'Quit', click:  function(){
        app.isQuiting = true;
        app.quit();
    } }
  ]);
  tray.setToolTip('Fig');
  tray.setContextMenu(contextMenu);
}
