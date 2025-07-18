const fs = require('fs').promises;
const path = require('path');
const _ = require('lodash');

class CheatManager {
  constructor(injector, config) {
    this.injector = injector;
    this.config = config;
    this.startupCheats = config.startupCheats || [];
    this.cheatConfig = config.cheatConfig || {};
    this.context = null;
  }

  async initialize() {
    if (!this.injector.isConnected) {
      throw new Error('Injector not connected');
    }

    const { Runtime, Page } = this.injector.client;
    this.context = `window.document.querySelector('iframe').contentWindow.__idleon_cheats__`;

    // Wait for page load
    return new Promise((resolve, reject) => {
      Page.loadEventFired(async () => {
        try {
          console.log("Page load event fired, initializing cheats...");
          
          // Verify context exists
          const contextExists = await Runtime.evaluate({ expression: `!!${this.context}` });
          if (!contextExists.result.value) {
            throw new Error("Cheat context not found in iframe");
          }

          // Initialize cheats
          const init = await Runtime.evaluate({ 
            expression: `setup.call(${this.context})`, 
            awaitPromise: true, 
            allowUnsafeEvalBlockedByCSP: true 
          });

          console.log("Cheats initialized successfully");
          resolve();
        } catch (error) {
          console.error("Error initializing cheats:", error);
          reject(error);
        }
      });
    });
  }

  async executeCheat(action) {
    if (!this.context) {
      throw new Error('Cheat manager not initialized');
    }

    const { Runtime } = this.injector.client;
    const response = await Runtime.evaluate({ 
      expression: `cheat.call(${this.context}, '${action}')`, 
      awaitPromise: true, 
      allowUnsafeEvalBlockedByCSP: true 
    });

    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text);
    }

    return response.result.value;
  }

  async getAutoCompleteSuggestions() {
    if (!this.context) {
      throw new Error('Cheat manager not initialized');
    }

    const { Runtime } = this.injector.client;
    const result = await Runtime.evaluate({ 
      expression: `getAutoCompleteSuggestions.call(${this.context})`, 
      awaitPromise: true, 
      returnByValue: true 
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result.value || [];
  }

  async getChoicesNeedingConfirmation() {
    if (!this.context) {
      throw new Error('Cheat manager not initialized');
    }

    const { Runtime } = this.injector.client;
    const result = await Runtime.evaluate({ 
      expression: `getChoicesNeedingConfirmation.call(${this.context})`, 
      awaitPromise: true, 
      returnByValue: true 
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result.value || [];
  }

  async getDevToolsUrl() {
    if (!this.injector.client) {
      throw new Error('No CDP client available');
    }

    const response = await this.injector.client.Target.getTargetInfo();
    if (!response?.targetInfo?.targetId) {
      throw new Error('Could not get target info');
    }

    const targetId = response.targetInfo.targetId;
    const cdpPort = this.config.cdp_port || 32123;
    return `http://localhost:${cdpPort}/devtools/inspector.html?ws=localhost:${cdpPort}/devtools/page/${targetId}`;
  }

  getFullConfig() {
    return {
      startupCheats: this.startupCheats,
      cheatConfig: this.prepareConfigForJson(this.cheatConfig)
    };
  }

  async updateConfig(newConfig) {
    if (!newConfig || !newConfig.cheatConfig) {
      throw new Error('Invalid configuration data');
    }

    // Update in-memory config
    const parsedCheatConfig = this.parseConfigFromJson(newConfig.cheatConfig);
    _.merge(this.cheatConfig, parsedCheatConfig);

    if (Array.isArray(newConfig.startupCheats)) {
      this.startupCheats.length = 0;
      this.startupCheats.push(...newConfig.startupCheats);
    }

    // Update game context if available
    if (this.context) {
      const { Runtime } = this.injector.client;
      const configString = this.injector.objToString(parsedCheatConfig);
      
      const updateExpression = `
        if (typeof updateCheatConfig === 'function') {
          updateCheatConfig(${configString});
          'Config updated in game.';
        } else {
          'Error: updateCheatConfig function not found.';
        }
      `;

      const result = await Runtime.evaluate({
        expression: updateExpression,
        awaitPromise: true,
        allowUnsafeEvalBlockedByCSP: true
      });

      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text);
      }

      return result.result.value;
    }

    return 'Config updated in memory only (game not connected)';
  }

  async saveConfig(configToSave) {
    if (!configToSave?.cheatConfig || !Array.isArray(configToSave.startupCheats)) {
      throw new Error('Invalid configuration data for saving');
    }

    const parsedCheatConfig = this.parseConfigFromJson(configToSave.cheatConfig);
    const injectorConfigString = this.injector.objToString(this.config.injectorConfig || {});

    const fileContent = `
/****************************************************************************************************
 * This file is generated by the Idleon Cheat Injector UI.
 * Manual edits might be overwritten when saving from the UI.
 ****************************************************************************************************/

exports.startupCheats = ${JSON.stringify(configToSave.startupCheats, null, '\t')};

exports.cheatConfig = ${this.injector.objToString(parsedCheatConfig)};

exports.injectorConfig = ${injectorConfigString};
`;

    const savePath = path.join(process.cwd(), 'config.custom.js');
    await fs.writeFile(savePath, fileContent.trim());

    // Update in-memory config
    this.startupCheats.length = 0;
    this.startupCheats.push(...configToSave.startupCheats);
    _.merge(this.cheatConfig, parsedCheatConfig);
  }

  prepareConfigForJson(obj) {
    const result = {};
    for (const key in obj) {
      if (Object.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'function') {
          result[key] = value.toString();
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = this.prepareConfigForJson(value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }

  parseConfigFromJson(obj) {
    const result = {};
    for (const key in obj) {
      if (Object.hasOwnProperty.call(obj, key)) {
        let value = obj[key];
        if (typeof value === 'string') {
          const trimmedValue = value.trim();
          if (trimmedValue.startsWith('function') || 
              /^\w+\s*\(.*\)\s*=>/.test(trimmedValue) ||
              /^\(.*\)\s*=>/.test(trimmedValue) || 
              /^\w+\s*=>/.test(trimmedValue)) {
            try {
              if (/^\w+\s*\(.*\)\s*=>/.test(trimmedValue)) {
                const arrowFuncBody = trimmedValue.substring(trimmedValue.indexOf('('));
                value = new Function(`return (${arrowFuncBody})`)();
              } else {
                value = new Function(`return (${trimmedValue})`)();
              }
            } catch (e) {
              console.warn(`Failed to convert function string for key '${key}': ${e}`);
            }
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          value = this.parseConfigFromJson(value);
        }
        result[key] = value;
      }
    }
    return result;
  }
}

module.exports = CheatManager;