const CDP = require('chrome-remote-interface');
const fs = require('fs').promises;
const atob = require('atob');
const btoa = require('btoa');
const Logger = require('./logger');
const DebugSession = require('./debugger');

class CheatInjector {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.isConnected = false;
    this.logger = new Logger({ 
      context: 'INJECTOR',
      level: config.debugLevel || 'info',
      enableFile: config.enableFileLogging || false
    });
    this.debugSession = new DebugSession({ logger: this.logger });
  }

  async connect(wsUrl) {
    const step = this.debugSession.startStep('CDP_CONNECT', { wsUrl });
    
    try {
      step.info('Preparing CDP connection options');
      const options = {
        tab: wsUrl,
        port: this.config.cdp_port || 32123
      };
      
      step.info('Establishing CDP connection', options);
      this.debugSession.incrementMetric('cdpCommands');

      this.client = await CDP(options);
      step.info('CDP client created successfully');
      
      const { DOM, Page, Network, Runtime } = this.client;
      step.info('Extracted CDP domains');

      step.info('Enabling CDP domains');
      await Promise.all([
        Runtime.enable(),
        Page.enable(),
        Network.enable(),
        DOM.enable()
      ]);
      
      step.info('All CDP domains enabled successfully');

      this.isConnected = true;
      step.success('CDP connection established');
      return this.client;
    } catch (error) {
      step.error(error);
      this.logger.error('CDP connection failed', {
        wsUrl,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to connect to game: ${error.message}`);
    }
  }

  async setupInterception(cheatConfig, startupCheats) {
    const step = this.debugSession.startStep('SETUP_INTERCEPTION', {
      cheatConfigKeys: cheatConfig ? Object.keys(cheatConfig) : [],
      startupCheatsCount: startupCheats ? startupCheats.length : 0
    });
    
    if (!this.isConnected) {
      const error = new Error('Not connected to game');
      step.error(error);
      throw new Error('Not connected to game');
    }

    // Ensure we have valid config objects
    const safeCheatConfig = cheatConfig || {};
    const safeStartupCheats = startupCheats || [];
    
    step.info('Configuration validation', {
      hasCheatConfig: !!cheatConfig,
      hasStartupCheats: !!startupCheats,
      cheatConfigKeys: Object.keys(safeCheatConfig),
      startupCheatsCount: safeStartupCheats.length
    });
    step.info('Extracting CDP domains');
    const { Network, Page, Runtime } = this.client;

    // Load and prepare cheat code
    step.info('Loading cheat code from file');
    let cheats = await fs.readFile('cheats.js', 'utf8');
    step.info('Cheat file loaded', { size: cheats.length });
    
    step.info('Preparing cheat configuration');
    cheats = `let startupCheats = ${JSON.stringify(safeStartupCheats)};\nlet cheatConfig = ${this.objToString(safeCheatConfig)};\n${cheats}`;
    step.info('Cheat configuration prepared', { totalSize: cheats.length });

    // Setup interception
    step.info('Setting up request interception');
    this.debugSession.incrementMetric('cdpCommands');
    await Network.setRequestInterception({
      patterns: [{
        urlPattern: this.config.interceptPattern,
        resourceType: 'Script',
        interceptionStage: 'HeadersReceived',
      }],
    });
    step.info('Request interception configured', { pattern: this.config.interceptPattern });

    step.info('Bypassing Content Security Policy');
    this.debugSession.incrementMetric('cdpCommands');
    await Page.setBypassCSP({ enabled: true });
    step.info('CSP bypass enabled');

    // Optional console forwarding
    if (this.config.showConsoleLog) {
      step.info('Setting up console log forwarding');
      Runtime.consoleAPICalled((entry) => {
        const message = entry.args.map(arg => arg.value).join(" ");
        this.logger.info(`[GAME CONSOLE] ${message}`);
      });
      step.info('Console forwarding enabled');
    }

    // Load cheats into context
    step.info('Evaluating cheat code in game context');
    this.debugSession.incrementMetric('cdpCommands');
    await Runtime.evaluate({ expression: cheats });
    step.info('Cheat code evaluation completed');

    // Setup request interception handler
    step.info('Setting up interception handler');
    Network.requestIntercepted(async ({ interceptionId, request }) => {
      await this.handleInterceptedRequest(interceptionId, request);
    });
    step.info('Interception handler registered');

    step.success('Interception setup completed');
    return this.client;
  }

  async handleInterceptedRequest(interceptionId, request) {
    const requestLogger = this.logger.createChild('REQUEST');
    const step = this.debugSession.startStep('HANDLE_INTERCEPT', {
      interceptionId,
      url: request.url,
      method: request.method
    });
    
    this.debugSession.incrementMetric('injectionAttempts');
    
    try {
      step.info('Request intercepted', { url: request.url });
      this.logger.injectionAttempt(request.url, this.config.interceptPattern);
      
      step.info('Fetching response body');
      this.debugSession.incrementMetric('cdpCommands');
      const response = await this.client.Network.getResponseBodyForInterception({ interceptionId });
      step.info('Response body retrieved', { 
        bodySize: response.body ? response.body.length : 0,
        isBase64: !!response.base64Encoded 
      });
      
      step.info('Decoding response body');
      const originalBody = atob(response.body);
      step.info('Body decoded', { decodedSize: originalBody.length });

      step.info('Attempting cheat injection');
      const modifiedBody = await this.injectCheats(originalBody);
      
      if (modifiedBody) {
        step.info('Injection successful, preparing response');
        this.debugSession.incrementMetric('injectionSuccesses');
        
        const newHeaders = [
          `Date: ${(new Date()).toUTCString()}`,
          `Connection: closed`,
          `Content-Length: ${modifiedBody.length}`,
          `Content-Type: text/javascript`,
        ];
        step.info('Response headers prepared', { headerCount: newHeaders.length });

        step.info('Encoding modified response');
        const newResponse = btoa(
          "HTTP/1.1 200 OK\r\n" +
          newHeaders.join('\r\n') +
          "\r\n\r\n" +
          modifiedBody
        );
        step.info('Response encoded', { encodedSize: newResponse.length });

        step.info('Sending modified response to game');
        this.debugSession.incrementMetric('cdpCommands');
        await this.client.Network.continueInterceptedRequest({
          interceptionId,
          rawResponse: newResponse,
        });

        step.success('Modified response sent successfully');
        this.logger.injectionSuccess(request.url, {
          originalSize: originalBody.length,
          modifiedSize: modifiedBody.length,
          sizeDiff: modifiedBody.length - originalBody.length
        });
      } else {
        step.info('No injection needed, continuing with original response');
        this.debugSession.incrementMetric('cdpCommands');
        await this.client.Network.continueInterceptedRequest({ interceptionId });
        step.success('Original response forwarded');
        this.logger.injectionSkipped(request.url, 'Regex pattern did not match');
      }
    } catch (error) {
      step.error(error);
      this.logger.error('Request interception failed', {
        interceptionId,
        url: request.url,
        error: error.message,
        stack: error.stack
      });
      
      try {
        step.info('Attempting to continue with original request after error');
        this.debugSession.incrementMetric('cdpCommands');
        await this.client.Network.continueInterceptedRequest({ interceptionId });
        step.info('Original request continued after error');
      } catch (continueError) {
        this.logger.error('Failed to continue request after interception error', {
          interceptionId,
          originalError: error.message,
          continueError: continueError.message
        });
      }
    }
  }

  async injectCheats(originalBody) {
    const step = this.debugSession.startStep('INJECT_CHEATS', {
      bodySize: originalBody.length,
      regex: this.config.injreg
    });
    
    step.info('Compiling injection regex patterns');
    const InjReg = new RegExp(this.config.injreg);
    const InjRegG = new RegExp(this.config.injreg, "g");
    const VarName = new RegExp("^\\w+");
    step.info('Regex patterns compiled');

    step.info('Searching for injection points in script');
    const AppMain = InjRegG.exec(originalBody);
    if (!AppMain) {
      const error = new Error(`Injection regex did not match script content`);
      step.error(error);
      this.logger.warn('Injection regex pattern not found', {
        regex: this.config.injreg,
        bodyPreview: originalBody.substring(0, 200) + '...'
      });
      return null;
    }
    step.info('Injection points found', { matchCount: AppMain.length });

    step.info('Extracting variable names from matches');
    const AppVar = Array(AppMain.length).fill("");
    for (let i = 0; i < AppMain.length; i++) {
      AppVar[i] = VarName.exec(AppMain[i])[0];
    }
    step.info('Variable names extracted', { variables: AppVar });

    let newBody = originalBody;

    // Try to get manipulator function from game context
    step.info('Attempting to get ZJS manipulator function');
    try {
      this.debugSession.incrementMetric('cdpCommands');
      let manipulatorResult = await this.client.Runtime.evaluate({ 
        expression: 'getZJSManipulator()', 
        awaitPromise: true 
      });

      if (manipulatorResult.result && manipulatorResult.result.type === 'string') {
        step.info('ZJS manipulator function found, applying');
        let manipulator = new Function("return " + manipulatorResult.result.value)();
        newBody = manipulator(originalBody);
        step.info('ZJS manipulator applied', { 
          originalSize: originalBody.length,
          manipulatedSize: newBody.length 
        });
      } else {
        step.info('No valid ZJS manipulator found, using original body');
      }
    } catch (error) {
      step.warn('ZJS manipulator evaluation failed', { error: error.message });
    }

    // Core injection
    step.info('Performing core cheat injection');
    const replacementRegex = new RegExp(this.config.injreg);
    const beforeInjection = newBody.length;
    newBody = newBody.replace(replacementRegex, `window.__idleon_cheats__=${AppVar[0]};$&`);
    const afterInjection = newBody.length;
    
    step.success('Core injection completed', {
      injectedVariable: AppVar[0],
      sizeBefore: beforeInjection,
      sizeAfter: afterInjection,
      injectedBytes: afterInjection - beforeInjection
    });

    return newBody;
  }

  objToString(obj) {
    let ret = "{";
    for (let k in obj) {
      let v = obj[k];
      if (typeof v === "function") {
        v = v.toString();
      } else if (typeof v === 'boolean') {
        v = v;
      } else if (Array.isArray(v)) {
        v = JSON.stringify(v);
      } else if (typeof v === "object") {
        v = this.objToString(v);
      } else {
        v = `"${v}"`;
      }
      ret += `\n  ${k}: ${v},`;
    }
    ret += "\n}";
    return ret;
  }

  disconnect() {
    if (this.client) {
      this.client.close();
      this.isConnected = false;
    }
  }
}

module.exports = CheatInjector;