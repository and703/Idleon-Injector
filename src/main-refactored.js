const _ = require('lodash');
const Enquirer = require('enquirer');
const os = require('os');

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

console.log('Options:');
console.log(`Regex: ${injectorConfig.injreg}`);
console.log(`Show console logs: ${injectorConfig.showConsoleLog}`);
console.log(`Chrome location: ${injectorConfig.chrome}`);
console.log(`Detected OS: ${os.platform()}`);
console.log('');

class Application {
  constructor() {
    this.gameDetector = new GameDetector({ ...injectorConfig, cdp_port: cdpPort });
    this.injector = new CheatInjector({ ...injectorConfig, cdp_port: cdpPort });
    this.cheatManager = null;
    this.webServer = null;
  }

  async initialize() {
    try {
      // Find and launch game
      console.log('Detecting and launching game...');
      const wsUrl = await this.gameDetector.findAndLaunchGame();
      console.log('Game launched successfully');

      // Connect injector
      console.log('Connecting to game...');
      await this.injector.connect(wsUrl);
      console.log('Connected to game');

      // Setup interception
      console.log('Setting up cheat injection...');
      await this.injector.setupInterception(cheatConfig, startupCheats);
      console.log('Cheat injection setup complete');

      // Initialize cheat manager
      this.cheatManager = new CheatManager(this.injector, {
        startupCheats,
        cheatConfig,
        injectorConfig
      });

      await this.cheatManager.initialize();
      console.log('Cheat manager initialized');

      // Start web server if enabled
      if (injectorConfig.enableUI) {
        this.webServer = new WebServer(
          { ...injectorConfig, web_port: 8080 }, 
          this.cheatManager
        );
        await this.webServer.start();
      }

      // Start CLI interface
      await this.startCLI();

    } catch (error) {
      await this.handleError(error);
    }
  }

  async startCLI() {
    const choices = await this.cheatManager.getAutoCompleteSuggestions();
    const cheatsNeedingConfirmation = await this.cheatManager.getChoicesNeedingConfirmation();

    const promptUser = async () => {
      try {
        let valueChosen = false;
        const enquirer = new Enquirer();
        
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

        if (action === 'chromedebug') {
          const url = await this.cheatManager.getDevToolsUrl();
          const { spawn } = require('child_process');
          spawn(injectorConfig.chrome, ["--new-window", url]);
          console.log('Opened Chrome debugger');
        } else {
          const result = await this.cheatManager.executeCheat(action);
          console.log(result);
        }

        await promptUser();
      } catch (error) {
        console.error("Error in CLI:", error);
        await new Promise(res => setTimeout(res, 1000));
        await promptUser();
      }
    };

    await promptUser();
  }

  async handleError(error) {
    console.error("Application error:", error.message);

    if (error.code === 'ENOENT' && error.syscall === 'spawn LegendsOfIdleon.exe') {
      console.log(`\n>>> Could not find 'LegendsOfIdleon.exe'.`);
      console.log(`>>> Please ensure the injector can find the game!`);
    } else if (error.message.includes('No inspectable targets')) {
      console.log("\n>>> Is Steam running?");
    }

    console.log("\nPress Enter to exit...");
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    readline.question('', () => {
      readline.close();
      this.cleanup();
      process.exit(1);
    });
  }

  cleanup() {
    if (this.webServer) {
      this.webServer.stop();
    }
    if (this.injector) {
      this.injector.disconnect();
    }
  }
}

// Start the application
const app = new Application();
app.initialize().catch(console.error);