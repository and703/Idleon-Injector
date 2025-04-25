const spawn = require('child_process').spawn;
const _ = require('lodash');
const CDP = require('chrome-remote-interface');
const fs = require('fs').promises;
const atob = require('atob');
const btoa = require('btoa');
const Enquirer = require('enquirer');
const express = require('express'); // Added for web UI
const path = require('path'); // Added for static file serving

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
console.log("Credits:");
console.log("iBelg");
console.log("Creater0822");
console.log("valleymon");
console.log("Disputate");
console.log("and everyone that contributed to this project");
console.log('------------------------------------------------------------------------------------------');
console.log('InjectCheatUI v1.1.1');
console.log('------------------------------------------------------------------------------------------');
console.log('');

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
const cdp_port = 32123;

// --- Web Server Setup ---
const app = express();
const web_port = 8080; // Port for the web UI
app.use(express.json()); // Middleware to parse JSON request bodies

if (injectorConfig.enableUI) {
  // Serve static files (CSS, JS) from the 'ui' directory
  app.use(express.static(path.join(__dirname, 'ui')));

  // Explicitly serve index.html for the root path
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'index.html'));
  });
  console.log('Web UI enabled. Static files and root route configured.');
} else {
  console.log('Web UI disabled in config.');
}
// --- End Web Server Setup ---

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

    // Add error handler for spawn issues (like ENOENT)
    idleon.on('error', (err) => {
      reject(err); // Reject the promise to propagate the error
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

    console.log("Attaching Page.loadEventFired listener..."); // Added for diagnostics
    // Wait for the page's load event to ensure the DOM, including the iframe, is ready.
    Page.loadEventFired(async () => {
      console.log(">>> Page.loadEventFired callback started."); // Added for diagnostics

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
        console.log("init.result.value", init.result.value);

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

        if (injectorConfig.enableUI) {
          // --- API Endpoints ---
          app.get('/api/cheats', async (req, res) => {
            try {
              const suggestionsResult = await Runtime.evaluate({ expression: `getAutoCompleteSuggestions.call(${context})`, awaitPromise: true, returnByValue: true });
              if (suggestionsResult.exceptionDetails) {
                console.error("API Error getting autocomplete suggestions:", suggestionsResult.exceptionDetails.text);
                res.status(500).json({ error: 'Failed to get cheats from game', details: suggestionsResult.exceptionDetails.text });
              } else {
                res.json(suggestionsResult.result.value || []);
              }
            } catch (apiError) {
              console.error("API Error in /api/cheats:", apiError);
              res.status(500).json({ error: 'Internal server error while fetching cheats' });
            }
          });

          app.post('/api/toggle', async (req, res) => {
            const { action } = req.body;
            if (!action) {
              return res.status(400).json({ error: 'Missing action parameter' });
            }
            try {
              // Execute the selected cheat command within the game's context.
              const cheatResponse = await Runtime.evaluate({ expression: `cheat.call(${context}, '${action}')`, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true });
              if (cheatResponse.exceptionDetails) {
                console.error(`API Error executing cheat '${action}':`, cheatResponse.exceptionDetails.text);
                res.status(500).json({ error: `Failed to execute cheat '${action}'`, details: cheatResponse.exceptionDetails.text });
              } else {
                console.log(`[Web UI] Executed: ${action} -> ${cheatResponse.result.value}`);
                res.json({ result: cheatResponse.result.value });
              }
            } catch (apiError) {
              console.error(`API Error executing cheat '${action}':`, apiError);
              res.status(500).json({ error: `Internal server error while executing cheat '${action}'` });
            }
          });

          // New endpoint to get cheats needing confirmation
          app.get('/api/needs-confirmation', async (req, res) => {
            try {
              const confirmationResult = await Runtime.evaluate({ expression: `getChoicesNeedingConfirmation.call(${context})`, awaitPromise: true, returnByValue: true });
              if (confirmationResult.exceptionDetails) {
                console.error("API Error getting confirmation choices:", confirmationResult.exceptionDetails.text);
                res.status(500).json({ error: 'Failed to get confirmation list from game', details: confirmationResult.exceptionDetails.text });
              } else {
                res.json(confirmationResult.result.value || []);
              }
            } catch (apiError) {
              console.error("API Error in /api/needs-confirmation:", apiError);
              res.status(500).json({ error: 'Internal server error while fetching confirmation list' });
            }
          });

          // --- API Endpoint for DevTools URL ---
          app.get('/api/devtools-url', async (req, res) => {
            try {
              // Use the existing CDP client to get target info
              const response = await client.Target.getTargetInfo();
              if (response && response.targetInfo && response.targetInfo.targetId) {
                const targetId = response.targetInfo.targetId;
                // Construct the DevTools URL
                // Note: Using http, not ws, for the main URL. The ws part is a parameter.
                const devtoolsUrl = `http://localhost:${cdp_port}/devtools/inspector.html?ws=localhost:${cdp_port}/devtools/page/${targetId}`;
                console.log(`[Web UI] Generated DevTools URL: ${devtoolsUrl}`);
                res.json({ url: devtoolsUrl });
              } else {
                console.error("API Error: Could not get target info to generate DevTools URL.");
                res.status(500).json({ error: 'Failed to get target information from CDP client.' });
              }
            } catch (apiError) {
              console.error("API Error getting DevTools URL:", apiError);
              res.status(500).json({ error: 'Internal server error while fetching DevTools URL', details: apiError.message });
            }
          });
          // --- End DevTools URL Endpoint ---

          // --- API Endpoint for Cheat Configuration ---

          // Helper function to prepare config for JSON serialization, converting functions to strings
          const prepareConfigForJson = (obj) => {
            const result = {};
            for (const key in obj) {
              if (Object.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (typeof value === 'function') {
                  result[key] = value.toString(); // Convert function to string
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  result[key] = prepareConfigForJson(value); // Recurse for nested objects
                } else {
                  // Keep other JSON-serializable types as is (string, number, boolean, array, null)
                  result[key] = value;
                }
              }
            }
            return result;
          };

          // Helper function to parse config from JSON, converting function strings back to functions
          const parseConfigFromJson = (obj) => {
            const result = {};
            for (const key in obj) {
              if (Object.hasOwnProperty.call(obj, key)) {
                let value = obj[key];
                if (typeof value === 'string') {
                  const trimmedValue = value.trim();
                  // Check if it looks like a function string
                  // Pattern 1: Standard function keyword
                  if (trimmedValue.startsWith('function')) {
                    try {
                      // Standard functions might be declarations (function name(){}) or expressions (function(){})
                      // Wrapping in parentheses handles both cases for evaluation
                      value = new Function(`return (${trimmedValue})`)();
                    } catch (e) {
                      console.warn(`[Config Parse] Failed to convert standard function string for key '${key}': ${e}. Keeping as string.`);
                    }
                  }
                  // Pattern 2: Arrow function with name prefix (the problematic case)
                  // Example: SnailStuff (t, args) => { ... }
                  else if (/^\w+\s*\(.*\)\s*=>/.test(trimmedValue)) {
                    try {
                      // Extract the part from the first '(' onwards
                      const arrowFuncBody = trimmedValue.substring(trimmedValue.indexOf('('));
                      // Evaluate the extracted anonymous arrow function expression
                      value = new Function(`return (${arrowFuncBody})`)();
                    } catch (e) {
                      console.warn(`[Config Parse] Failed to convert named arrow function string for key '${key}': ${e}. Keeping as string.`);
                    }
                  }
                  // Pattern 3: Arrow function starting with ( or single param without ()
                  // Example: (t, args) => { ... }  OR  t => ...
                  else if (/^\(.*\)\s*=>/.test(trimmedValue) || /^\w+\s*=>/.test(trimmedValue)) {
                    try {
                      // These are already valid expressions, wrap in parentheses for safety
                      value = new Function(`return (${trimmedValue})`)();
                    } catch (e) {
                      console.warn(`[Config Parse] Failed to convert standard arrow function string for key '${key}': ${e}. Keeping as string.`);
                    }
                  }
                  // If none of the patterns match, it's likely just a regular string
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  value = parseConfigFromJson(value); // Recurse for nested objects
                }
                result[key] = value;
              }
            }
            return result;
          };


          app.get('/api/config', (req, res) => {
            try {
              const serializableCheatConfig = prepareConfigForJson(cheatConfig);
              const fullConfigResponse = {
                startupCheats: startupCheats, // Send the raw startupCheats array
                cheatConfig: serializableCheatConfig // Send the processed cheatConfig
              };
              res.json(fullConfigResponse);
            } catch (error) {
              console.error("API Error preparing full config for JSON:", error);
              res.status(500).json({ error: 'Internal server error while preparing configuration' });
            }
          });

          app.post('/api/config/update', async (req, res) => {
            const receivedFullConfig = req.body;
            // console.log('[Web UI] Received full config for update:', receivedFullConfig);

            if (!receivedFullConfig || typeof receivedFullConfig !== 'object' || !receivedFullConfig.cheatConfig) {
              return res.status(400).json({ error: 'Invalid configuration data received. Expected { startupCheats: [...], cheatConfig: {...} }.' });
            }

            try {
              // 1. Extract and parse the cheatConfig part
              const receivedCheatConfig = receivedFullConfig.cheatConfig;
              const parsedCheatConfig = parseConfigFromJson(receivedCheatConfig);
              // console.log('[Web UI] Parsed cheatConfig (with functions):', parsedCheatConfig);

              // 2. Update the server-side cheatConfig object (merge)
              _.merge(cheatConfig, parsedCheatConfig);
              // console.log('[Web UI] Updated server-side cheatConfig:', cheatConfig);

              // 3. Update server-side startupCheats (replace)
              if (Array.isArray(receivedFullConfig.startupCheats)) {
                // Overwrite the existing array content while keeping the reference
                startupCheats.length = 0; // Clear existing items
                startupCheats.push(...receivedFullConfig.startupCheats); // Add new items
                console.log('[Web UI] Updated server-side startupCheats.');
              } else {
                console.warn('[Web UI] Received startupCheats is not an array. Skipping update.');
              }

              // 4. Inject the updated *cheatConfig* into the game context
              const contextExistsResult = await Runtime.evaluate({ expression: `!!(${context})` }); // Re-check context
              if (!contextExistsResult || !contextExistsResult.result || !contextExistsResult.result.value) {
                console.error("API Error: Cheat context not found in iframe. Cannot update config in game.");
                return res.status(200).json({ message: 'Configuration updated on server, but failed to apply in game (context lost).' });
              }

              // Only inject cheatConfig changes
              const configStringForInjection = objToString(parsedCheatConfig);

              const updateExpression = `
                if (typeof updateCheatConfig === 'function') {
                  updateCheatConfig(${configStringForInjection});
                  'Config updated in game.';
                } else {
                  'Error: updateCheatConfig function not found in game context.';
                }
              `;

              const updateResult = await Runtime.evaluate({
                expression: updateExpression,
                awaitPromise: true,
                allowUnsafeEvalBlockedByCSP: true
              });

              let gameUpdateDetails = 'N/A';
              if (updateResult.exceptionDetails) {
                console.error(`API Error updating config in game:`, updateResult.exceptionDetails.text);
                gameUpdateDetails = `Failed to apply in game: ${updateResult.exceptionDetails.text}`;
                return res.status(200).json({ message: 'Configuration updated on server, but failed to apply in game.', details: gameUpdateDetails });
              } else {
                gameUpdateDetails = updateResult.result.value;
                console.log(`[Web UI] In-game config update result: ${gameUpdateDetails}`);
                if (gameUpdateDetails.startsWith('Error:')) {
                  return res.status(200).json({ message: 'Configuration updated on server, but failed to apply in game.', details: gameUpdateDetails });
                }
              }

              res.json({ message: 'Configuration updated successfully.', details: gameUpdateDetails });

            } catch (apiError) {
              console.error("API Error in /api/config/update:", apiError);
              res.status(500).json({ error: 'Internal server error while updating configuration', details: apiError.message });
            }
          });
          // --- End Cheat Configuration Endpoint ---

          // --- API Endpoint for Saving Configuration to File ---
          app.post('/api/config/save', async (req, res) => {
            const receivedFullConfig = req.body;

            if (!receivedFullConfig || typeof receivedFullConfig !== 'object' || !receivedFullConfig.cheatConfig || !Array.isArray(receivedFullConfig.startupCheats)) {
              return res.status(400).json({ error: 'Invalid configuration data received for saving. Expected { startupCheats: [...], cheatConfig: {...} }.' });
            }

            try {
              // 1. Extract parts from UI payload
              const uiCheatConfigRaw = receivedFullConfig.cheatConfig;
              const uiStartupCheats = receivedFullConfig.startupCheats;
              const new_injectorConfig = objToString(injectorConfig).replaceAll("\\", "\\\\");

              // 2. Parse UI cheatConfig to handle functions for saving
              const parsedUiCheatConfig = parseConfigFromJson(uiCheatConfigRaw);

              // 3. Construct file content string
              const fileContentString = `
/****************************************************************************************************
 * This file is generated by the Idleon Cheat Injector UI.
 * Manual edits might be overwritten when saving from the UI.
 ****************************************************************************************************/

exports.startupCheats = ${JSON.stringify(uiStartupCheats, null, '\t')}; // Use startupCheats from UI

exports.cheatConfig = ${objToString(parsedUiCheatConfig)}; // Use parsed cheatConfig from UI

exports.injectorConfig = ${new_injectorConfig}; // Use current injectorConfig
`;
              // 4. Define save path
              const savePath = path.join(process.cwd(), 'config.custom.js');

              // 5. Write to file
              await fs.writeFile(savePath, fileContentString.trim());
              console.log(`[Web UI] Configuration saved to ${savePath}`);

              // 6. Update in-memory variables AFTER successful save
              startupCheats.length = 0; // Clear existing
              startupCheats.push(...uiStartupCheats); // Add new
              _.merge(cheatConfig, parsedUiCheatConfig); // Merge cheatConfig updates

              res.json({ message: 'Configuration successfully saved to config.custom.js' });

            } catch (apiError) {
              console.error("API Error in /api/config/save:", apiError);
              res.status(500).json({ error: 'Internal server error while saving configuration file', details: apiError.message });
            }
          });

          // --- Start Web Server ---
          app.listen(web_port, () => {
            console.log(`\n--------------------------------------------------`);
            console.log(`Web UI available at: http://localhost:${web_port}`);
            console.log(`--------------------------------------------------\n`);
          }).on('error', (err) => {
            console.error('Failed to start web server:', err);
            // Decide if we should exit or just continue with CLI only
          });
          // --- End Start Web Server ---
        }

        // Start the initial user prompt loop (CLI).
        await promptUser();
      } catch (loadEventError) {
        console.error("Error during Page.loadEventFired handler:", loadEventError);
      }
    });

    console.log("Page load event listener attached.");

  } catch (error) {
    console.error("An error occurred:", error); // Simplified initial log

    // Check for specific error types/messages
    if (error.code === 'ENOENT' && error.syscall === 'spawn LegendsOfIdleon.exe') {
      console.log(`\n>>> NOOB DETECTED!`);
      console.log(`\n>>> Specific Error Detected: Could not find 'LegendsOfIdleon.exe'.`);
      console.log(`>>> Please ensure the injector is in the same directory as the game!`);
    } else if (error && error.message && error.message.includes('No inspectable targets')) {
      console.log("\n>>> Specific Error Detected: Is Steam running?!");
    } else {
      // Generic error message if not specifically handled above
      console.log("\n>>> An unexpected error occurred.");
    }

    // Keep the console open on error
    console.log("\nPress Enter to exit...");
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question('', () => {
      readline.close();
      process.exit(1); // Exit with error code
    });
  }
})();
