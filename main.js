
const spawn = require('child_process').spawn;
const _ = require('lodash');
const CDP = require('chrome-remote-interface');
const fs = require('fs').promises;
const atob = require('atob');
const btoa = require('btoa');
const Enquirer = require('enquirer');

const objToString = (obj) => {
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
      v = objToString(v);
    } else {
      v = `"${v}"`;
    }

    ret += `\n  ${k}: ${v},`;
  }

  ret += "\n}";

  return ret;
};


// Tool initialization messages
console.log('------------------------------------------------------------------------------------------');
console.log("Updated version of InjectCheats by valleymon: originally by iBelg, continued by Creater0822");
console.log('InjectCheatF5 v1.2');
console.log('------------------------------------------------------------------------------------------');
console.log('');

const port = 32123;
const config = require(process.cwd() + '/config.js');
try {
  const customConfig = require(process.cwd() + '/config.custom.js');
  config.injectorConfig = _.merge(config.injectorConfig, customConfig.injectorConfig);
  config.startupCheats = _.union(config.startupCheats, customConfig.startupCheats);
  config.cheatConfig = _.merge(config.cheatConfig, customConfig.cheatConfig);
} catch (e) {
  console.log('****** No custom config found, using default config ******');
  console.log('****** To create a custom config, copy config.custom.example.js to config.custom.js and edit to your liking ******');
  console.log('');
}
const injectorConfig = config.injectorConfig;
const startupCheats = config.startupCheats;
const cheatConfig = config.cheatConfig;

console.log('Options:');
console.log(`Regex: ${injectorConfig.injreg}`);
console.log(`Show idleon window console logs: ${injectorConfig.showConsoleLog}`);
console.log(`Chrome location: ${injectorConfig.chrome}`);
console.log('');

function attach(name) {
  return new Promise((resolve, reject) => {
    const idleon = spawn(name, [`--remote-debugging-port=${port}`]);

    //get the web socket url
    idleon.stderr.on('data', (data) => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/.*)/);
      if (match) {
        resolve(match[1]);
      }
    });
  });
}

async function setupIntercept(hook) {
  const options = {
    tab: hook,
    port: port
  };

  const client = await CDP(options);

  const { DOM, Page, Network, Runtime } = client;
  console.log('Injecting cheats...');

  let cheats = await fs.readFile('cheats.js', 'utf8');
  cheats = `let startupCheats = ${JSON.stringify(startupCheats)};\nlet cheatConfig = ${objToString(cheatConfig)};\n${cheats}`;

  await Network.setRequestInterception(
    {
      patterns: [
        {
          urlPattern: injectorConfig.interceptPattern,
          resourceType: 'Script',
          interceptionStage: 'HeadersReceived',
        },
      ],
    }
  );
  await Page.setBypassCSP({ enabled: true });
  if (injectorConfig.showConsoleLog) {
    Runtime.consoleAPICalled((entry) => {
      console.log(entry.args.map(arg => arg.value).join(" "));
    });
  }

  await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), DOM.enable()]);

  const eval = await Runtime.evaluate({ expression: cheats });
  console.log('Loaded cheats...');

  // Set up the interceptor callback *before* resolving the setup promise
  Network.requestIntercepted(async ({ interceptionId, request }) => {
    try { // Add try-catch for robustness within the callback
      console.log(`Intercepted: ${request.url}`); // Add logging
      const response = await Network.getResponseBodyForInterception({ interceptionId });
      const originalBody = atob(response.body);
      // Regex definitions
      const InjReg = new RegExp(injectorConfig.injreg);
      const InjRegG = new RegExp(injectorConfig.injreg, "g");
      const VarName = new RegExp("^\\w+");

      const AppMain = InjRegG.exec(originalBody);
      if (!AppMain) {
        console.error(`Injection regex '${injectorConfig.injreg}' did not match the script content.`);
        // Continue with original response or handle error appropriately
        Network.continueInterceptedRequest({ interceptionId });
        return;
      }
      const AppVar = Array(AppMain.length).fill("");
      for (let i = 0; i < AppMain.length; i++) AppVar[i] = VarName.exec(AppMain[i])[0];

      let manipulatorResult = await Runtime.evaluate({ expression: 'getZJSManipulator()', awaitPromise: true });
      let newBody;

      // Check if manipulator exists and is a function string
      if (manipulatorResult.result && manipulatorResult.result.type === 'string') {
        let manipulator = new Function("return " + manipulatorResult.result.value)();
        newBody = manipulator(originalBody); // Apply manipulator if exists
      } else {
        console.warn('getZJSManipulator() did not return a valid function string. Applying basic injection only.');
        newBody = originalBody; // Fallback to original body if manipulator fails
      }


      // Ensure the replacement happens correctly
      // Use a non-global regex for replacement to avoid state issues if InjReg has global flag
      const replacementRegex = new RegExp(injectorConfig.injreg);
      newBody = newBody.replace(replacementRegex, `window.__idleon_cheats__=${AppVar[0]};$&`);


      console.log('Updated game code...');
      const newHeaders = [
        `Date: ${(new Date()).toUTCString()}`,
        `Connection: closed`,
        `Content-Length: ${newBody.length}`,
        `Content-Type: text/javascript`,
      ];
      const newResponse = btoa(
        "HTTP/1.1 200 OK\r\n" +
        newHeaders.join('\r\n') +
        "\r\n\r\n" +
        newBody
      );

      await Network.continueInterceptedRequest({ // Make sure to await this
        interceptionId,
        rawResponse: newResponse,
      });
      console.log('Sent to game...');
      console.log('Cheat injected!');
    } catch (error) {
      console.error("Error during request interception:", error);
      // Attempt to continue the request without modification to prevent hanging
      try {
        await Network.continueInterceptedRequest({ interceptionId });
      } catch (continueError) {
        console.error("Error trying to continue request after interception error:", continueError);
      }
    }
  });

  // Resolve the promise *after* setting up the listener
  // This indicates that setup is complete and ready to intercept
  console.log("Interception listener setup complete."); // New log
  // No explicit promise needed here anymore if we just await the setup steps.
  // The function will return the client implicitly after all awaits complete.

  return client; // Return the client directly
}

// Adjust the main async block accordingly
(async () => {
  try { // Add top-level try-catch
    const hook = await attach('LegendsOfIdleon.exe');
    console.log("Attached to game process."); // Added log

    // setupIntercept now returns the client directly after setup is done
    const client = await setupIntercept(hook);
    console.log("Interceptor setup finished."); // Added log

    const { Runtime, Page } = client;

    Page.loadEventFired(async () => {
      try { // Add try-catch for loadEventFired
        console.log("Page load event fired."); // Added log
        const context = `window.document.querySelector('iframe').contentWindow.__idleon_cheats__`;

        console.log('Inititalizing cheats ingame...');
        // Add error checking for context existence
        const contextExists = await Runtime.evaluate({ expression: `!!${context}` });
        if (!contextExists.result.value) {
          console.error("Cheat context not found in iframe. Injection might have failed.");
          return; // Stop if context is missing
        }

        const init = await Runtime.evaluate({ expression: `setup.call(${context})`, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true });
        console.log(init.result.value);

        let choicesResult = await Runtime.evaluate({ expression: `getAutoCompleteSuggestions.call(${context})`, awaitPromise: true, returnByValue: true });
        // Check for errors or undefined result
        if (choicesResult.exceptionDetails) {
          console.error("Error getting autocomplete suggestions:", choicesResult.exceptionDetails.text);
          return;
        }
        let choices = choicesResult.result.value || []; // Default to empty array

        let cheatsNeedingConfirmationResult = await Runtime.evaluate({ expression: `getChoicesNeedingConfirmation.call(${context})`, awaitPromise: true, returnByValue: true });
        if (cheatsNeedingConfirmationResult.exceptionDetails) {
          console.error("Error getting confirmation choices:", cheatsNeedingConfirmationResult.exceptionDetails.text);
          return;
        }
        let cheatsNeedingConfirmation = cheatsNeedingConfirmationResult.result.value || []; // Default to empty array


        async function promptUser() {
          // ... (rest of promptUser remains the same, but add try-catch inside)
          try {
            let valueChosen = false;
            let enquirer = new Enquirer;
            let { action } = await enquirer.prompt({
              name: 'action',
              message: 'Action',
              type: 'autocomplete',
              initial: 0,
              limit: 15,
              choices: choices,
              suggest: function (input, choices) {
                if (input.length == 0) return [choices[0]];
                let str = input.toLowerCase();
                let mustInclude = str.split(" ");
                return choices.filter(ch => {
                  for (word of mustInclude) {
                    if (!ch.message.toLowerCase().includes(word)) return false;
                  }
                  return true
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
                  return new Promise(function (resolve) { });
                } else {
                  this.addChoice({ name: value, value: value }, this.choices.length + 1);
                  return true;
                }
              },
              onRun: async function () {
                await this.complete();
              },
              cancel: function () { },
            });
            if (action === 'chromedebug') {
              const response = await client.Target.getTargetInfo();
              const url = `http://localhost:${port}/devtools/inspector.html?experiment=true&ws=localhost:${port}/devtools/page/${response.targetInfo.targetId}`;
              spawn(injectorConfig.chrome, ["--new-window", url])
              console.log('Opened idleon chrome debugger');
            } else {
              const cheatResponse = await Runtime.evaluate({ expression: `cheat.call(${context}, '${action}')`, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true });
              if (cheatResponse.exceptionDetails) {
                console.error(`Error executing cheat '${action}':`, cheatResponse.exceptionDetails.text);
              } else {
                console.log(`${cheatResponse.result.value}`);
              }
            }
            // Recursive call needs careful handling, maybe add a delay or condition to exit
            await promptUser();
          } catch (promptError) {
            console.error("Error in promptUser:", promptError);
            // Decide how to handle prompt errors, maybe retry or exit
            // Consider adding a small delay before retrying
            await new Promise(res => setTimeout(res, 1000));
            await promptUser(); // Be cautious with recursion on error
          }
        }
        await promptUser();
      } catch (loadEventError) {
        console.error("Error during Page.loadEventFired handler:", loadEventError);
      }
    });

    console.log("Page load event listener attached."); // Added log

  } catch (error) {
    console.error("An error occurred in the main execution block:", error);
  }
})();
