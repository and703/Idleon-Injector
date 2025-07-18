const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const Logger = require('./logger');
const DebugSession = require('./debugger');

class GameDetector {
  constructor(config) {
    this.config = config;
    this.cdpPort = config.cdp_port || 32123;
    this.appId = 1476970; // Legends of Idleon Steam App ID
    this.logger = new Logger({ 
      context: 'DETECTOR',
      level: config.debugLevel || 'info',
      enableFile: config.enableFileLogging || false
    });
    this.debugSession = new DebugSession({ logger: this.logger });
  }

  async findAndLaunchGame() {
    const step = this.debugSession.startStep('FIND_AND_LAUNCH_GAME');
    
    const platform = os.platform();
    step.info('Detected platform', { platform });
    
    switch (platform) {
      case 'win32':
        step.info('Using Windows game detection strategy');
        return await this.handleWindows();
      case 'linux':
        step.info('Using Linux game detection strategy');
        return await this.handleLinux();
      default:
        const error = new Error(`Unsupported platform: ${platform}`);
        step.error(error);
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async handleWindows() {
    const step = this.debugSession.startStep('HANDLE_WINDOWS');
    
    // Try to find game executable
    step.info('Searching for game executable');
    const exePath = this.findIdleonExe();
    
    if (exePath) {
      step.info('Game executable found', { path: exePath });
      try {
        return await this.launchExecutable(exePath);
      } catch (error) {
        step.warn('Executable launch failed, trying fallback', { 
          path: exePath, 
          error: error.message 
        });
      }
    } else {
      step.info('No game executable found in default locations');
    }

    // Fallback to Steam protocol
    step.info('Attempting Steam protocol launch');
    this.launchViaSteamProtocol();
    step.info('Steam protocol launch initiated');
    
    step.info('Waiting for debugger connection');
    return await this.waitForDebugger(30000);
  }

  async handleLinux() {
    const step = this.debugSession.startStep('HANDLE_LINUX');
    
    try {
      step.info('Attempting automatic Linux Steam launch');
      return await this.autoLaunchLinuxSteam(30000);
    } catch (error) {
      step.error(error);
      step.info('Falling back to manual launch instructions');
      this.logger.warn('Auto-launch failed, manual launch required', {
        error: error.message,
        manualCommand: `PROTON_LOG=1 PROTON_NO_ESYNC=1 WINEDBG=fixme %command% --remote-debugging-port=${this.cdpPort}`
      });
      return await this.waitForDebugger(30000);
    }
  }

  findIdleonExe() {
    const step = this.debugSession.startStep('FIND_IDLEON_EXE');
    
    const defaultPaths = [
      path.join(process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)", "Steam/steamapps/common/Legends of Idleon/LegendsOfIdleon.exe"),
      path.join(process.env["ProgramFiles"] || "C:/Program Files", "Steam/steamapps/common/Legends of Idleon/LegendsOfIdleon.exe"),
      path.join(process.env["ProgramW6432"] || "C:/Program Files", "Steam/steamapps/common/Legends of Idleon/LegendsOfIdleon.exe"),
      path.join(process.cwd(), "LegendsOfIdleon.exe"),
    ];
    
    step.info('Checking paths for game executable', { 
      totalPaths: defaultPaths.length,
      customPath: this.config.gameExePath 
    });

    if (this.config.gameExePath && existsSync(this.config.gameExePath)) {
      step.success('Custom game path found', { path: this.config.gameExePath });
      return this.config.gameExePath;
    }

    for (let i = 0; i < defaultPaths.length; i++) {
      const p = defaultPaths[i];
      step.info(`Checking path ${i + 1}/${defaultPaths.length}`, { path: p });
      if (existsSync(p)) {
        step.success('Game executable found in default location', { path: p });
        return p;
      }
    }

    step.info('No game executable found in any location');
    return null;
  }

  async launchExecutable(exePath) {
    const step = this.debugSession.startStep('LAUNCH_EXECUTABLE', { path: exePath });
    
    return new Promise((resolve, reject) => {
      step.info('Spawning game process');
      const process = spawn(exePath, [`--remote-debugging-port=${this.cdpPort}`]);
      step.info('Game process spawned', { pid: process.pid });

      process.stderr.on('data', (data) => {
        const dataStr = data.toString();
        step.info('Game process stderr output', { output: dataStr.trim() });
        
        const match = data.toString().match(/DevTools listening on (ws:\/\/.*)/);
        if (match) {
          step.success('DevTools WebSocket URL found', { url: match[1] });
          resolve(match[1]);
        }
      });

      process.stdout.on('data', (data) => {
        step.info('Game process stdout output', { output: data.toString().trim() });
      });

      process.on('error', (err) => {
        step.error(err);
        reject(err);
      });

      process.on('exit', (code, signal) => {
        step.info('Game process exited', { code, signal });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        step.error(new Error('Timeout waiting for game to start'));
        reject(new Error('Timeout waiting for game to start'));
      }, 30000);
    });
  }

  launchViaSteamProtocol() {
    const step = this.debugSession.startStep('LAUNCH_VIA_STEAM_PROTOCOL');
    
    const steamUrl = `steam://run/${this.appId}//--remote-debugging-port=${this.cdpPort}`;
    step.info('Launching Steam protocol URL', { url: steamUrl });
    
    spawn('cmd', ['/c', 'start', '', steamUrl], { detached: true, stdio: 'ignore' });
    step.success('Steam protocol launch command executed');
  }

  async autoLaunchLinuxSteam(timeout = 30000) {
    const step = this.debugSession.startStep('AUTO_LAUNCH_LINUX_STEAM', { timeout });
    
    const steamPaths = [
      "/usr/bin/steam",
      "/usr/local/bin/steam",
      `${process.env.HOME}/.steam/steam/steam.sh`,
      `${process.env.HOME}/.local/share/Steam/steam.sh`,
    ];
    
    step.info('Searching for Steam executable', { paths: steamPaths });

    let steamCmd = "steam";
    for (let i = 0; i < steamPaths.length; i++) {
      const p = steamPaths[i];
      step.info(`Checking Steam path ${i + 1}/${steamPaths.length}`, { path: p });
      if (existsSync(p)) {
        steamCmd = p;
        step.info('Steam executable found', { path: p });
        break;
      }
    }

    step.info('Preparing Steam launch arguments');
    const args = [
      "-applaunch",
      this.appId.toString(),
      `--remote-debugging-port=${this.cdpPort}`
    ];
    step.info('Steam arguments prepared', { command: steamCmd, args });

    step.info('Spawning Steam process');
    const child = spawn(steamCmd, args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    step.info('Steam process spawned', { pid: child.pid });

    step.info('Waiting for debugger connection');
    return await this.waitForDebugger(timeout);
  }

  async waitForDebugger(timeout = 10000) {
    const step = this.debugSession.startStep('WAIT_FOR_DEBUGGER', { timeout });
    
    const startTime = Date.now();
    let attemptCount = 0;
    
    return new Promise((resolve, reject) => {
      const check = () => {
        attemptCount++;
        const elapsed = Date.now() - startTime;
        step.info(`Debugger check attempt ${attemptCount}`, { elapsed, timeout });
        
        const req = http.get(`http://localhost:${this.cdpPort}/json/version`, (res) => {
          let data = '';
          
          res.on('data', (chunk) => { data += chunk; });
          
          res.on('end', () => {
            try {
              step.info('Received debugger response', { data: data.substring(0, 200) });
              const json = JSON.parse(data);
              if (json.webSocketDebuggerUrl) {
                step.success('Debugger WebSocket URL found', { 
                  url: json.webSocketDebuggerUrl,
                  attempts: attemptCount,
                  elapsed: Date.now() - startTime
                });
                return resolve(json.webSocketDebuggerUrl);
              }
              step.info('Response received but no WebSocket URL found');
              retry();
            } catch (err) {
              step.warn('Failed to parse debugger response', { 
                error: err.message, 
                data: data.substring(0, 100) 
              });
              retry();
            }
          });
        });

        req.on('error', (err) => {
          step.info('Debugger connection attempt failed', { 
            error: err.message,
            attempt: attemptCount 
          });
          retry();
        });
      };

      const retry = () => {
        const elapsed = Date.now() - startTime;
        if (Date.now() - startTime > timeout) {
          step.error(new Error('Timeout waiting for debugger WebSocket URL'));
          return reject(new Error('Timeout waiting for debugger WebSocket URL'));
        }
        step.info('Retrying debugger check in 500ms', { nextAttempt: attemptCount + 1 });
        setTimeout(check, 500);
      };

      check();
    });
  }
}

module.exports = GameDetector;