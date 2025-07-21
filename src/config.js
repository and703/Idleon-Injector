exports.injectorConfig = {
  injreg: "\\w+\\.ApplicationMain\\s*?=",
  interceptPattern: "*N.js",
  showConsoleLog: false,
  chrome: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  enableUI: true,
  onLinuxTimeout: 30000,
  debugLevel: "info", // error, warn, info, debug, trace
  enableFileLogging: false, // Save logs to injector.log
  // gameExePath: "C:/Path/To/LegendsOfIdleon.exe", // Optional: set this to override EXE search on Windows
};