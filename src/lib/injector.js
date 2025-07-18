const CDP = require('chrome-remote-interface');
const fs = require('fs').promises;
const atob = require('atob');
const btoa = require('btoa');

class CheatInjector {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.isConnected = false;
  }

  async connect(wsUrl) {
    try {
      const options = {
        tab: wsUrl,
        port: this.config.cdp_port || 32123
      };

      this.client = await CDP(options);
      const { DOM, Page, Network, Runtime } = this.client;

      await Promise.all([
        Runtime.enable(),
        Page.enable(),
        Network.enable(),
        DOM.enable()
      ]);

      this.isConnected = true;
      return this.client;
    } catch (error) {
      throw new Error(`Failed to connect to game: ${error.message}`);
    }
  }

  async setupInterception(cheatConfig, startupCheats) {
    if (!this.isConnected) {
      throw new Error('Not connected to game');
    }

    const { Network, Page, Runtime } = this.client;

    // Load and prepare cheat code
    let cheats = await fs.readFile('cheats.js', 'utf8');
    cheats = `let startupCheats = ${JSON.stringify(startupCheats)};\nlet cheatConfig = ${this.objToString(cheatConfig)};\n${cheats}`;

    // Setup interception
    await Network.setRequestInterception({
      patterns: [{
        urlPattern: this.config.interceptPattern,
        resourceType: 'Script',
        interceptionStage: 'HeadersReceived',
      }],
    });

    await Page.setBypassCSP({ enabled: true });

    // Optional console forwarding
    if (this.config.showConsoleLog) {
      Runtime.consoleAPICalled((entry) => {
        console.log(entry.args.map(arg => arg.value).join(" "));
      });
    }

    // Load cheats into context
    await Runtime.evaluate({ expression: cheats });

    // Setup request interception handler
    Network.requestIntercepted(async ({ interceptionId, request }) => {
      await this.handleInterceptedRequest(interceptionId, request);
    });

    return this.client;
  }

  async handleInterceptedRequest(interceptionId, request) {
    try {
      console.log(`Intercepted: ${request.url}`);
      
      const response = await this.client.Network.getResponseBodyForInterception({ interceptionId });
      const originalBody = atob(response.body);

      const modifiedBody = await this.injectCheats(originalBody);
      
      if (modifiedBody) {
        const newHeaders = [
          `Date: ${(new Date()).toUTCString()}`,
          `Connection: closed`,
          `Content-Length: ${modifiedBody.length}`,
          `Content-Type: text/javascript`,
        ];

        const newResponse = btoa(
          "HTTP/1.1 200 OK\r\n" +
          newHeaders.join('\r\n') +
          "\r\n\r\n" +
          modifiedBody
        );

        await this.client.Network.continueInterceptedRequest({
          interceptionId,
          rawResponse: newResponse,
        });

        console.log('Cheat injection successful!');
      } else {
        await this.client.Network.continueInterceptedRequest({ interceptionId });
      }
    } catch (error) {
      console.error("Error during request interception:", error);
      try {
        await this.client.Network.continueInterceptedRequest({ interceptionId });
      } catch (continueError) {
        console.error("Error continuing request after failure:", continueError);
      }
    }
  }

  async injectCheats(originalBody) {
    const InjReg = new RegExp(this.config.injreg);
    const InjRegG = new RegExp(this.config.injreg, "g");
    const VarName = new RegExp("^\\w+");

    const AppMain = InjRegG.exec(originalBody);
    if (!AppMain) {
      console.error(`Injection regex '${this.config.injreg}' did not match script content`);
      return null;
    }

    const AppVar = Array(AppMain.length).fill("");
    for (let i = 0; i < AppMain.length; i++) {
      AppVar[i] = VarName.exec(AppMain[i])[0];
    }

    let newBody = originalBody;

    // Try to get manipulator function from game context
    try {
      let manipulatorResult = await this.client.Runtime.evaluate({ 
        expression: 'getZJSManipulator()', 
        awaitPromise: true 
      });

      if (manipulatorResult.result && manipulatorResult.result.type === 'string') {
        let manipulator = new Function("return " + manipulatorResult.result.value)();
        newBody = manipulator(originalBody);
      }
    } catch (error) {
      console.warn('Could not get manipulator function, using basic injection');
    }

    // Core injection
    const replacementRegex = new RegExp(this.config.injreg);
    newBody = newBody.replace(replacementRegex, `window.__idleon_cheats__=${AppVar[0]};$&`);

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