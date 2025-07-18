const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

class GameDetector {
  constructor(config) {
    this.config = config;
    this.cdpPort = config.cdp_port || 32123;
    this.appId = 1476970; // Legends of Idleon Steam App ID
  }

  async findAndLaunchGame() {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        return await this.handleWindows();
      case 'linux':
        return await this.handleLinux();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async handleWindows() {
    // Try to find game executable
    const exePath = this.findIdleonExe();
    
    if (exePath) {
      try {
        return await this.launchExecutable(exePath);
      } catch (error) {
        console.warn(`Failed to launch executable at ${exePath}: ${error.message}`);
      }
    }

    // Fallback to Steam protocol
    console.log('Launching via Steam protocol...');
    this.launchViaSteamProtocol();
    return await this.waitForDebugger(30000);
  }

  async handleLinux() {
    try {
      return await this.autoLaunchLinuxSteam(30000);
    } catch (error) {
      console.error('Auto-launch failed:', error.message);
      console.log('Please launch the game manually with: PROTON_LOG=1 PROTON_NO_ESYNC=1 WINEDBG=fixme %command% --remote-debugging-port=' + this.cdpPort);
      return await this.waitForDebugger(30000);
    }
  }

  findIdleonExe() {
    const defaultPaths = [
      path.join(process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)", "Steam/steamapps/common/Legends of Idleon/LegendsOfIdleon.exe"),
      path.join(process.env["ProgramFiles"] || "C:/Program Files", "Steam/steamapps/common/Legends of Idleon/LegendsOfIdleon.exe"),
      path.join(process.env["ProgramW6432"] || "C:/Program Files", "Steam/steamapps/common/Legends of Idleon/LegendsOfIdleon.exe"),
      path.join(process.cwd(), "LegendsOfIdleon.exe"),
    ];

    if (this.config.gameExePath && existsSync(this.config.gameExePath)) {
      return this.config.gameExePath;
    }

    for (const p of defaultPaths) {
      if (existsSync(p)) return p;
    }

    return null;
  }

  async launchExecutable(exePath) {
    return new Promise((resolve, reject) => {
      const process = spawn(exePath, [`--remote-debugging-port=${this.cdpPort}`]);

      process.stderr.on('data', (data) => {
        const match = data.toString().match(/DevTools listening on (ws:\/\/.*)/);
        if (match) {
          resolve(match[1]);
        }
      });

      process.on('error', (err) => {
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Timeout waiting for game to start'));
      }, 30000);
    });
  }

  launchViaSteamProtocol() {
    const steamUrl = `steam://run/${this.appId}//--remote-debugging-port=${this.cdpPort}`;
    spawn('cmd', ['/c', 'start', '', steamUrl], { detached: true, stdio: 'ignore' });
  }

  async autoLaunchLinuxSteam(timeout = 30000) {
    const steamPaths = [
      "/usr/bin/steam",
      "/usr/local/bin/steam",
      `${process.env.HOME}/.steam/steam/steam.sh`,
      `${process.env.HOME}/.local/share/Steam/steam.sh`,
    ];

    let steamCmd = "steam";
    for (const p of steamPaths) {
      if (existsSync(p)) {
        steamCmd = p;
        break;
      }
    }

    const args = [
      "-applaunch",
      this.appId.toString(),
      `--remote-debugging-port=${this.cdpPort}`
    ];

    const child = spawn(steamCmd, args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    return await this.waitForDebugger(timeout);
  }

  async waitForDebugger(timeout = 10000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const check = () => {
        const req = http.get(`http://localhost:${this.cdpPort}/json/version`, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.webSocketDebuggerUrl) {
                return resolve(json.webSocketDebuggerUrl);
              }
              retry();
            } catch (err) {
              retry();
            }
          });
        });

        req.on('error', retry);
      };

      const retry = () => {
        if (Date.now() - startTime > timeout) {
          return reject(new Error('Timeout waiting for debugger WebSocket URL'));
        }
        setTimeout(check, 500);
      };

      check();
    });
  }
}

module.exports = GameDetector;