#######################################################################################################

1. Files Included:
   IdleOnInjecterUI.exe - The main application that injects cheats and runs the game.
   cheats.js - Contains the code for all the available cheat commands.
   config.json - Configuration files for setting up startup cheats, custom parameters, or other options. This will change every update.
   config.custom.example.js - (rename `config.custom.example.js` to `config.custom.js`) Personal configuration files for setting up startup cheats, custom parameters, or other options. Change things in here if you want.

2. Installation:
   Extract the contents of the download (at least the `.exe`, `.js`, and config files) directly into your Legends of Idleon game installation folder.
   This is usually located in your Steam directory: `Steam\steamapps\common\LegendsOfIdleon`.

3. How to Run:
   DO NOT run `LegendsOfIdleon.exe`. Instead, run the `IdleOnInjecterUI.exe`. This will launch the game with the cheat console enabled. A console window should appear alongside or shortly before the game window.
   Use this console to type commands.

4. Prerequisites & Troubleshooting:
   Make sure your Steam client is running.
   You will likely need NodeJS installed. If the console window appears and quickly disappears without launching the game, this is a common reason. Download the LTS version from https://nodejs.org/.
   Ensure no conflicting Node system variables are set (like `NODE_OPTIONS`).
   If injection fails (game loads but console doesn't respond or finish initializing cheats), close the console, wait about 5-10 seconds for the game process to fully terminate, and try running the injector again. Sometimes it takes a few tries.

#

#######################################################################################################

# The following Instructions are only needed if you want to change the Injector itself.

# Not needed for normal users.

#######################################################################################################

# Compile instructions from Creater0822 those still apply with the newest Version

Your first time installation of NodeJS:

1. Install NodeJS:
   Got mine through Chocolatey, which is currently version 16.5.0
2. npm install -g pkg
   The package which lets you build executables

The building procedure: 0) Have the source file in a new folder and open Powershell there

1. npm init -y
   Generates a package.json file
2. npm install -S child_process chrome-remote-interface atob btoa prompt
   These are all the packages that iBelg's tool uses
3. Edit the json file, e.g. give it a name, version, don't forget to keep ibelg's name in the author section.
4. Inside "Scripts": {} add:
   "build": "pkg main.js --targets node16-win-x64 --compress Brotli --output InjectCheatsF2"
   Or node14-win-x65 if you're using NodeJS 14.
5. Execute: npm run build

#######################################################################################################

# Known issues!!

- The tool doesn't always load beyond step 1. This issue is related to how iBelg's async request interception and game loading works. Unfortunately this ain't an issue I can fix yet, as a full redesign is still beyond the scope of my abilities.

#######################################################################################################

# What's new?

Version 3:

- Forked iBelg's version 1.1.1 tool
- Expanded config.js with the injection Regex, which you can freely edit.
- Improved the injection process: The tool now dynamically reads the random variable name in the Regex \\w+\\.ApplicationMain
