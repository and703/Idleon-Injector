
const spawn = require('child_process').spawn;
const _ = require('lodash');
const CDP = require('chrome-remote-interface');
const fs = require('fs').promises;
const atob = require('atob');
const btoa = require('btoa');
const Enquirer = require('enquirer');

// Converts a JavaScript object (potentially with functions) into a string representation
// suitable for injection into the target environment. Functions are converted to their string form.
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
console.log("Updated version of InjectCheats by Disputate: originally by iBelg, continued by Creater0822, updated by valleymon ");
console.log('InjectCheatF5 v1.2.1');
console.log('------------------------------------------------------------------------------------------');
console.log('');

const cdp_port = 32123;
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
    const idleon = spawn(name, [`--remote-debugging-port=${cdp_port}`]);

    // Chrome/Electron outputs the DevTools WebSocket URL to stderr on startup.
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
    port: cdp_port
  };

  const client = await CDP(options);

  const { DOM, Page, Network, Runtime } = client;
  console.log('Injecting cheats...');

  let cheats = await fs.readFile('cheats.js', 'utf8');
  cheats = `let startupCheats = ${JSON.stringify(startupCheats)};\nlet cheatConfig = ${objToString(cheatConfig)};\n${cheats}`;

  // Intercept specific script requests to modify their content before execution.
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
  // Disable Content Security Policy to allow injecting and executing modified/external scripts.
  await Page.setBypassCSP({ enabled: true });
  // Optionally forward console messages from the game window to this script's console.
  if (injectorConfig.showConsoleLog) {
    Runtime.consoleAPICalled((entry) => {
      console.log(entry.args.map(arg => arg.value).join(" "));
    });
  }

  await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), DOM.enable()]);

  const eval = await Runtime.evaluate({ expression: cheats });
  console.log('Loaded cheats...');

  // Define the handler for intercepted requests. This runs for each matched script.
  Network.requestIntercepted(async ({ interceptionId, request }) => {
    // Wrap in try-catch to prevent unhandled errors in the interception callback from crashing the injector.
    try {
      console.log(`Intercepted: ${request.url}`);
      const response = await Network.getResponseBodyForInterception({ interceptionId });
      const originalBody = atob(response.body);

      // Regex to find the main application variable assignment in the game's code.
      // This is crucial for hooking the cheats into the game's context.
      const InjReg = new RegExp(injectorConfig.injreg);
      const InjRegG = new RegExp(injectorConfig.injreg, "g");
      const VarName = new RegExp("^\\w+"); // Extracts the variable name itself.

      const AppMain = InjRegG.exec(originalBody);
      if (!AppMain) {
        console.error(`Injection regex '${injectorConfig.injreg}' did not match the script content. Cannot inject.`);
        // Allow the original script to load if injection point isn't found.
        Network.continueInterceptedRequest({ interceptionId });
        return;
      }
      // Extract the variable name found by the regex.
      const AppVar = Array(AppMain.length).fill("");
      for (let i = 0; i < AppMain.length; i++) AppVar[i] = VarName.exec(AppMain[i])[0];

      let manipulatorResult = await Runtime.evaluate({ expression: 'getZJSManipulator()', awaitPromise: true });
      let newBody;

      if (manipulatorResult.result && manipulatorResult.result.type === 'string') {
        // Execute the manipulator function fetched from the target context.
        let manipulator = new Function("return " + manipulatorResult.result.value)();
        newBody = manipulator(originalBody);
      } else {
        // If no manipulator is defined or it's invalid, use the original script body.
        console.warn('getZJSManipulator() did not return a valid function string. Applying basic injection only.');
        newBody = originalBody;
      }

      // Core injection: Assign the found game variable to a global window property (`__idleon_cheats__`)
      // This makes the game's main object accessible to the cheat script.
      // Use a non-global regex for replacement to ensure only the first match is replaced.
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
      // Attempt to continue the request with the original content if modification fails,
      // to prevent the game from potentially hanging.
      try {
        await Network.continueInterceptedRequest({ interceptionId });
      } catch (continueError) {
        console.error("Error trying to continue request after interception error:", continueError);
      }
    }
  });

  console.log("Interception listener setup complete.");
  return client; // Return the CDP client for further interaction.
}

// Main execution block
(async () => {
  // Wrap main logic in try-catch for overall error handling.
  try {
    const hook = await attach('LegendsOfIdleon.exe');
    console.log("Attached to game process.");

    const client = await setupIntercept(hook);
    console.log("Interceptor setup finished.");

    const { Runtime, Page } = client;

    // Wait for the page's load event to ensure the DOM, including the iframe, is ready.
    Page.loadEventFired(async () => {
      // Wrap event handler logic in try-catch.
      try {
        console.log("Page load event fired.");
        // Define the JavaScript context within the game's iframe where the cheats operate.
        // This relies on the successful injection performed by the interceptor.
        const context = `window.document.querySelector('iframe').contentWindow.__idleon_cheats__`;

        console.log('Inititalizing cheats ingame...');
        // Verify that the cheat context actually exists before trying to use it.
        const contextExists = await Runtime.evaluate({ expression: `!!${context}` });
        if (!contextExists.result.value) {
          console.error("Cheat context not found in iframe. Injection might have failed.");
          return; // Stop if context is missing
        }

        // Call the `setup` function defined in cheats.js within the game's context.
        const init = await Runtime.evaluate({ expression: `setup.call(${context})`, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true });
        console.log(init.result.value);

        // Fetch autocomplete suggestions and confirmation requirements from the cheat context.
        let choicesResult = await Runtime.evaluate({ expression: `getAutoCompleteSuggestions.call(${context})`, awaitPromise: true, returnByValue: true });
        if (choicesResult.exceptionDetails) {
          console.error("Error getting autocomplete suggestions:", choicesResult.exceptionDetails.text);
          return; // Stop if fetching suggestions fails.
        }
        let choices = choicesResult.result.value || []; // Default to empty array

        let cheatsNeedingConfirmationResult = await Runtime.evaluate({ expression: `getChoicesNeedingConfirmation.call(${context})`, awaitPromise: true, returnByValue: true });
        if (cheatsNeedingConfirmationResult.exceptionDetails) {
          console.error("Error getting confirmation choices:", cheatsNeedingConfirmationResult.exceptionDetails.text);
          return; // Stop if fetching confirmation list fails.
        }
        let cheatsNeedingConfirmation = cheatsNeedingConfirmationResult.result.value || []; // Default to empty array

        // Function to continuously prompt the user for cheat commands.
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
                  // Ensure the choice message includes all words from the input.
                  for (word of mustInclude) {
                    if (!ch.message.toLowerCase().includes(word)) return false;
                  }
                  return true
                });
              },
              // Custom submit logic to handle confirmation for specific cheats.
              onSubmit: function (name, value, prompt) {
                value = this.focused ? this.focused.value : value; // Use focused value if available.
                let choiceNeedsConfirmation = false;
                // Check if the selected cheat requires confirmation.
                cheatsNeedingConfirmation.forEach((e) => {
                  if (value.indexOf(e) === 0) choiceNeedsConfirmation = true;
                });
                // If confirmation is needed and not yet given, re-render the prompt
                // with the chosen value, requiring a second Enter press to confirm.
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
                // Ensure completion runs, potentially needed for async operations within prompt.
                await this.complete();
              },
              cancel: function () { }, // Define cancel behavior if needed.
            });

            // Special command to open Chrome DevTools for the game instance.
            if (action === 'chromedebug') {
              const response = await client.Target.getTargetInfo();
              const url = `http://localhost:${cdp_port}/devtools/inspector.html?experiment=true&ws=localhost:${cdp_port}/devtools/page/${response.targetInfo.targetId}`;
              spawn(injectorConfig.chrome, ["--new-window", url])
              console.log('Opened idleon chrome debugger');
            } else {
              // Execute the selected cheat command within the game's context.
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
        // Start the initial user prompt loop.
        await promptUser();
      } catch (loadEventError) {
        console.error("Error during Page.loadEventFired handler:", loadEventError);
      }
    });

    console.log("Page load event listener attached.");

  } catch (error) {
    console.error("An error occurred in the main execution block:", error);
  }
})();
