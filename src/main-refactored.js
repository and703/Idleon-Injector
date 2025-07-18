const _ = require('lodash');
const Enquirer = require('enquirer');
const os = require('os');
const Logger = require('./lib/logger');
const DebugSession = require('./lib/debugger');

// Import our new modules
const CheatInjector = require('./lib/injector');
const GameDetector = require('./lib/gameDetector');
const WebServer = require('./lib/webServer');
const CheatManager = require('./lib/cheatManager');

console.log('------------------------------------------------------------------------------------------');
console.log('InjectCheatUI v1.2.0 (Refactored)');
console.log('------------------------------------------------------------------------------------------');
console.log('');

// Load configuration
const config = require(process.cwd() + '/config.js');
try {
  const customConfig = require(process.cwd() + '/config.custom.js');
  config.injectorConfig = _.merge(config.injectorConfig, customConfig.injectorConfig);
  config.startupCheats = _.union(config.startupCheats, customConfig.startupCheats);
  config.cheatConfig = _.merge(config.cheatConfig, customConfig.cheatConfig);
} catch (e) {
  console.log('****** No custom config found, using default config ******');
  console.log('****** To create a custom config, copy config.custom.example.js to config.custom.js ******');
  console.log('');
}

const injectorConfig = config.injectorConfig;
const startupCheats = config.startupCheats;
const cheatConfig = config.cheatConfig;
const cdpPort = 32123;

// Initialize main logger
const mainLogger = new Logger({ 
  context: 'MAIN',
  level: injectorConfig.debugLevel || 'info',
  enableFile: injectorConfig.enableFileLogging || false
});

const debugSession = new DebugSession({ logger: mainLogger });

console.log('Options:');
console.log(`Regex: ${injectorConfig.injreg}`);
console.log(`Show console logs: ${injectorConfig.showConsoleLog}`);
console.log(`Chrome location: ${injectorConfig.chrome}`);
console.log(`Detected OS: ${os.platform()}`);
console.log(`Debug Level: ${injectorConfig.debugLevel || 'info'}`);
console.log(`File Logging: ${injectorConfig.enableFileLogging || false}`);
console.log('');

class Application {
  constructor() {
    const detectorConfig = { ...injectorConfig, cdp_port: cdpPort };
    const injectorConfig2 = { ...injectorConfig, cdp_port: cdpPort };
    
    this.gameDetector = new GameDetector(detectorConfig);
    this.injector = new CheatInjector(injectorConfig2);
    this.cheatManager = null;
    this.webServer = null;
    this.logger = mainLogger.createChild('APP');
  }

  async initialize() {
    const step = debugSession.startStep('APPLICATION_INITIALIZE');
    
    try {
      // Find and launch game
      step.info('Starting game detection and launch');
      const wsUrl = await this.gameDetector.findAndLaunchGame();
      step.info('Game launched successfully', { wsUrl });

      // Connect injector
      step.info('Connecting injector to game');
      await this.injector.connect(wsUrl);
      step.info('Injector connected successfully');

      // Setup interception
      step.info('Setting up cheat interception');
      await this.injector.setupInterception(cheatConfig, startupCheats);
      step.info('Cheat interception setup completed');

      // Initialize cheat manager
      step.info('Initializing cheat manager');
      this.cheatManager = new CheatManager(this.injector, {
        startupCheats,
        cheatConfig,
        injectorConfig,
        debugLevel: injectorConfig.debugLevel,
        enableFileLogging: injectorConfig.enableFileLogging
      });

      await this.cheatManager.initialize();
      step.info('Cheat manager initialized successfully');

      // Start web server if enabled
      if (injectorConfig.enableUI) {
        step.info('Starting web server');
        this.webServer = new WebServer(
          { ...injectorConfig, web_port: 8080 }, 
          this.cheatManager
        );
        await this.webServer.start();
        step.info('Web server started successfully');
      } else {
        step.info('Web UI disabled, skipping server start');
      }

      // Start CLI interface
      step.info('Starting CLI interface');
      step.success('Application initialization completed');
      await this.startCLI();

    } catch (error) {
      step.error(error);
      await this.handleError(error);
    }
  }

  async startCLI() {
    const step = debugSession.startStep('START_CLI');
    
    step.info('Fetching cheat suggestions and confirmation list');
    const choices = await this.cheatManager.getAutoCompleteSuggestions();
    const cheatsNeedingConfirmation = await this.cheatManager.getChoicesNeedingConfirmation();
    step.info('CLI data loaded', { 
      choiceCount: choices.length, 
      confirmationCount: cheatsNeedingConfirmation.length 
    });

    const promptUser = async () => {
      const promptStep = debugSession.startStep('CLI_PROMPT');
      
      try {
        let valueChosen = false;
        const enquirer = new Enquirer();
        
        promptStep.info('Displaying cheat selection prompt');
        const { action } = await enquirer.prompt({
          name: 'action',
          message: 'Action',
          type: 'autocomplete',
          initial: 0,
          limit: 15,
          choices: choices,
          suggest: function (input, choices) {
            if (input.length === 0) return [choices[0]];
            const str = input.toLowerCase();
            const mustInclude = str.split(" ");
            return choices.filter(ch => {
              for (const word of mustInclude) {
                if (!ch.message.toLowerCase().includes(word)) return false;
              }
              return true;
            });
          },
          onSubmit: function (name, value, prompt) {
            value = this.focused ? this.focused.value : value;
            let choiceNeedsConfirmation = false;
            
            cheatsNeedingConfirmation.forEach((e) => {
              if (value.indexOf(e) === 0) choiceNeedsConfirmation = true;
            });
            
            if (choiceNeedsConfirmation && !valueChosen && this.focused) {
              prompt.input = value;
              prompt.state.cursor = value.length;
              prompt.render();
              valueChosen = true;
              return new Promise(() => {});
            } else {
              this.addChoice({ name: value, value: value }, this.choices.length + 1);
              return true;
            }
          },
          onRun: async function () {
            await this.complete();
          },
          cancel: function () {},
        });
        promptStep.info('User selected action', { action });

        if (action === 'chromedebug') {
          promptStep.info('Opening Chrome debugger');
          const url = await this.cheatManager.getDevToolsUrl();
          const { spawn } = require('child_process');
          spawn(injectorConfig.chrome, ["--new-window", url]);
          promptStep.info('Chrome debugger opened', { url });
        } else {
          promptStep.info('Executing cheat action');
          const result = await this.cheatManager.executeCheat(action);
          promptStep.info('Cheat executed', { action, result });
          this.logger.info(`[CHEAT RESULT] ${result}`);
        }

        promptStep.success('Prompt completed, restarting');
        await promptUser();
      } catch (error) {
        promptStep.error(error);
        this.logger.error('CLI error occurred', {
          error: error.message,
          stack: error.stack
        });
        await new Promise(res => setTimeout(res, 1000));
        await promptUser();
      }
    };

    step.info('Starting CLI prompt loop');
    await promptUser();
  }

  async handleError(error) {
    const step = debugSession.startStep('HANDLE_ERROR', { error: error.message });
    
    this.logger.error('Application error occurred', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      syscall: error.syscall
    });
    
    // Dump debug state for troubleshooting
    debugSession.dumpState('Error State Dump');

    if (error.code === 'ENOENT' && error.syscall === 'spawn LegendsOfIdleon.exe') {
      step.info('Detected missing executable error');
      this.logger.error('Game executable not found', {
        suggestion: 'Please ensure the injector can find the game executable'
      });
    } else if (error.message.includes('No inspectable targets')) {
      step.info('Detected Steam connection error');
      this.logger.error('Steam connection issue detected', {
        suggestion: 'Please ensure Steam is running'
      });
    }

    step.info('Waiting for user input before exit');
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    readline.question('', () => {
      readline.close();
      step.info('User confirmed exit, cleaning up');
      this.cleanup();
      debugSession.end();
      process.exit(1);
    });
  }

  cleanup() {
    const step = debugSession.startStep('CLEANUP');
    
    step.info('Starting application cleanup');
    if (this.webServer) {
      step.info('Stopping web server');
      this.webServer.stop();
      step.info('Web server stopped');
    }
    if (this.injector) {
      step.info('Disconnecting injector');
      this.injector.disconnect();
      step.info('Injector disconnected');
    }
    step.success('Application cleanup completed');
  }
}

// Start the application
mainLogger.info('🚀 Starting Idleon Cheat Injector');
const app = new Application();
app.initialize().catch((error) => {
  mainLogger.error('Fatal application error', {
    error: error.message,
    stack: error.stack
  });
  debugSession.end();
  console.error(error);
});