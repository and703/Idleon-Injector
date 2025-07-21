const fs = require('fs').promises;
const path = require('path');
const _ = require('lodash');
const Logger = require('./logger');
const DebugSession = require('./debugger');

class CheatManager {
  constructor(injector, config) {
    this.injector = injector;
    this.config = config;
    this.startupCheats = config.startupCheats || [];
    this.cheatConfig = config.cheatConfig || {};
    this.context = null;
    this.logger = new Logger({ 
      context: 'CHEAT_MGR',
      level: config.debugLevel || 'info',
      enableFile: config.enableFileLogging || false
    });
    this.debugSession = new DebugSession({ logger: this.logger });
  }

  async initialize() {
    const step = this.debugSession.startStep('INITIALIZE_CHEAT_MANAGER');
    
    if (!this.injector.isConnected) {
      const error = new Error('Injector not connected');
      step.error(error);
      throw error;
    }

    step.info('Extracting CDP client components');
    const { Runtime, Page } = this.injector.client;
    this.context = `window.document.querySelector('iframe').contentWindow.__idleon_cheats__`;
    step.info('Context path defined', { context: this.context });

    // Wait for page load
    step.info('Setting up page load event listener');
    return new Promise((resolve, reject) => {
      // Set a timeout for page load
      const pageLoadTimeout = setTimeout(() => {
        const error = new Error('Timeout waiting for page load event');
        step.error(error);
        reject(error);
      }, 60000); // 60 second timeout

      Page.loadEventFired(async () => {
        clearTimeout(pageLoadTimeout); // Clear timeout on successful load
        const loadStep = this.debugSession.startStep('PAGE_LOAD_HANDLER');
        
        try {
          loadStep.info('Page load event fired, starting cheat initialization');
          
          // Wait a bit for iframe to be ready
          loadStep.info('Waiting for iframe to be ready');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify context exists
          loadStep.info('Verifying cheat context exists');
          const contextExists = await Runtime.evaluate({ expression: `!!${this.context}` });
          loadStep.info('Context check result', { exists: contextExists.result.value });
          
          if (!contextExists.result.value) {
            // Try alternative context paths
            loadStep.info('Primary context not found, trying alternatives');
            const alternatives = [
              `window.__idleon_cheats__`,
              `window.frames[0].__idleon_cheats__`,
              `document.querySelector('iframe').contentWindow.__idleon_cheats__`
            ];
            
            let foundContext = null;
            for (const altContext of alternatives) {
              try {
                const altExists = await Runtime.evaluate({ expression: `!!${altContext}` });
                if (altExists.result.value) {
                  foundContext = altContext;
                  loadStep.info('Found alternative context', { context: altContext });
                  break;
                }
              } catch (e) {
                loadStep.info('Alternative context failed', { context: altContext, error: e.message });
              }
            }
            
            if (foundContext) {
              this.context = foundContext;
            } else {
              const error = new Error("Cheat context not found in iframe or any alternatives");
              loadStep.error(error);
              throw error;
            }
          }
            loadStep.error(error);
            throw error;
          }

          // Initialize cheats
          loadStep.info('Calling cheat setup function');
          let init;
          try {
            init = await Runtime.evaluate({ 
              expression: `setup.call(${this.context})`, 
              awaitPromise: true, 
              allowUnsafeEvalBlockedByCSP: true 
            });
          } catch (setupError) {
            loadStep.warn('Setup function failed, trying direct call', { error: setupError.message });
            init = await Runtime.evaluate({ 
              expression: `setup()`, 
              awaitPromise: true, 
              allowUnsafeEvalBlockedByCSP: true 
            });
          }
          loadStep.info('Cheat setup completed', { result: init.result.value });

          // Mark as initialized
          this.isInitialized = true;
          
          loadStep.success('Cheat initialization completed successfully');
          step.success('Cheat manager initialized');
          resolve();
        } catch (error) {
          loadStep.error(error);
          step.error(error);
          this.logger.error('Cheat initialization failed', {
            error: error.message,
            stack: error.stack,
            context: this.context
          });
          reject(error);
        }
      });
      step.info('Page load event listener registered');
    });
  }

  async executeCheat(action) {
    const step = this.debugSession.startStep('EXECUTE_CHEAT', { action });
    
    if (!this.isInitialized || !this.context) {
      const error = new Error('Cheat manager not initialized or context not available');
      step.error(error);
      throw error;
    }

    step.info('Executing cheat in game context');
    const { Runtime } = this.injector.client;
    
    let response;
    try {
      response = await Runtime.evaluate({ 
        expression: `cheat.call(${this.context}, '${action}')`, 
        awaitPromise: true, 
        allowUnsafeEvalBlockedByCSP: true 
      });
    } catch (evalError) {
      step.warn('Cheat call failed, trying direct execution', { error: evalError.message });
      response = await Runtime.evaluate({ 
        expression: `cheat('${action}')`, 
        awaitPromise: true, 
        allowUnsafeEvalBlockedByCSP: true 
      });
    }
    
    step.info('Cheat execution response received', { 
      hasException: !!response.exceptionDetails,
      resultType: response.result?.type
    });

    if (response.exceptionDetails) {
      const error = new Error(response.exceptionDetails.text);
      step.error(error);
      this.logger.error('Cheat execution failed', {
        action,
        exception: response.exceptionDetails
      });
      throw error;
    }

    step.success('Cheat executed successfully', { result: response.result.value });
    return response.result.value;
  }

  async getAutoCompleteSuggestions() {
    const step = this.debugSession.startStep('GET_AUTOCOMPLETE_SUGGESTIONS');
    
    if (!this.isInitialized || !this.context) {
      const error = new Error('Cheat manager not initialized or context not available');
      step.error(error);
      throw error;
    }

    step.info('Fetching autocomplete suggestions from game');
    const { Runtime } = this.injector.client;
    
    let result;
    try {
      result = await Runtime.evaluate({ 
        expression: `getAutoCompleteSuggestions.call(${this.context})`, 
        awaitPromise: true, 
        returnByValue: true 
      });
    } catch (evalError) {
      step.warn('Autocomplete call failed, trying direct call', { error: evalError.message });
      result = await Runtime.evaluate({ 
        expression: `getAutoCompleteSuggestions()`, 
        awaitPromise: true, 
        returnByValue: true 
      });
    }
    
    step.info('Autocomplete response received', {
      hasException: !!result.exceptionDetails,
      resultType: result.result?.type
    });

    if (result.exceptionDetails) {
      const error = new Error(result.exceptionDetails.text);
      step.error(error);
      throw error;
    }

    const suggestions = result.result.value || [];
    step.success('Autocomplete suggestions retrieved', { count: suggestions.length });
    return suggestions;
  }

  async getChoicesNeedingConfirmation() {
    if (!this.isInitialized || !this.context) {
      throw new Error('Cheat manager not initialized or context not available');
    }

    const { Runtime } = this.injector.client;
    
    let result;
    try {
      result = await Runtime.evaluate({ 
        expression: `getChoicesNeedingConfirmation.call(${this.context})`, 
        awaitPromise: true, 
        returnByValue: true 
      });
    } catch (evalError) {
      result = await Runtime.evaluate({ 
        expression: `getChoicesNeedingConfirmation()`, 
        awaitPromise: true, 
        returnByValue: true 
      });
    }

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