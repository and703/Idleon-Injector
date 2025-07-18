# Debug System Usage Guide

The enhanced Idleon Cheat Injector now includes comprehensive debugging and logging capabilities to help troubleshoot issues and understand the injection process.

## Debug Levels

Set the debug level in your `config.js` or `config.custom.js`:

```javascript
exports.injectorConfig = {
  debugLevel: "debug", // error, warn, info, debug, trace
  enableFileLogging: true, // Save logs to injector.log
  // ... other config
};
```

### Debug Levels Explained

- **error**: Only critical errors
- **warn**: Warnings and errors
- **info**: General information, warnings, and errors (default)
- **debug**: Detailed debugging information
- **trace**: Maximum verbosity including CDP commands

## File Logging

Enable file logging to save all debug output to `injector.log`:

```javascript
exports.injectorConfig = {
  enableFileLogging: true,
  // ... other config
};
```

The log file will automatically rotate when it exceeds 10MB.

## Running with Debug

### Command Line Options
```bash
# Standard run with configured debug level
npm run start:refactored

# Force debug level
npm run start:debug

# Maximum verbosity
npm run start:trace
```

### What Gets Logged

#### Game Detection Phase
- Platform detection
- Executable search paths
- Steam launch attempts
- Process spawning details
- WebSocket URL discovery

#### CDP Connection Phase
- Connection establishment
- Domain enabling
- WebSocket handshake details

#### Injection Setup Phase
- Request interception configuration
- CSP bypass setup
- Cheat code preparation
- Context evaluation

#### Request Interception Phase
- Every intercepted request
- Response body analysis
- Regex pattern matching
- Code injection details
- Modified response creation

#### Cheat Execution Phase
- Individual cheat commands
- Game context verification
- Execution results
- Error details

## Debug Output Examples

### Successful Injection
```
2024-01-15T10:30:15.123Z INFO  [DETECTOR]   🔄 STEP: FIND_AND_LAUNCH_GAME
2024-01-15T10:30:15.124Z INFO  [DETECTOR]     Detected platform {"platform":"win32"}
2024-01-15T10:30:15.125Z INFO  [DETECTOR]   ✅ SUCCESS: FIND_AND_LAUNCH_GAME
2024-01-15T10:30:15.200Z INFO  [INJECTOR]   🔄 STEP: CDP_CONNECT
2024-01-15T10:30:15.201Z INFO  [INJECTOR]     Establishing CDP connection
2024-01-15T10:30:15.350Z INFO  [INJECTOR]   ✅ SUCCESS: CDP_CONNECT
```

### Injection Process
```
2024-01-15T10:30:20.100Z DEBUG [REQUEST]    💉 Attempting injection on: https://game.com/script.js
2024-01-15T10:30:20.101Z DEBUG [REQUEST]      Searching for injection points in script
2024-01-15T10:30:20.102Z DEBUG [REQUEST]      Injection points found {"matchCount":1}
2024-01-15T10:30:20.103Z INFO  [REQUEST]    ✅ Injection successful: https://game.com/script.js
```

### Error Scenarios
```
2024-01-15T10:30:25.500Z ERROR [DETECTOR]   ❌ FAILED: LAUNCH_EXECUTABLE
{
  "error": "spawn ENOENT",
  "path": "C:/Games/LegendsOfIdleon.exe",
  "stack": "Error: spawn ENOENT\n    at ChildProcess.spawn..."
}
```

## Debug Session Tracking

Each run creates a unique debug session with metrics:

```
2024-01-15T10:35:00.000Z INFO  [DEBUG]     🚀 Debug session started {"sessionId":"1642248900000-abc123def"}
2024-01-15T10:35:30.000Z INFO  [DEBUG]     📊 State Dump {
  "sessionId": "1642248900000-abc123def",
  "sessionDuration": 30000,
  "totalSteps": 15,
  "completedSteps": 14,
  "failedSteps": 1,
  "metrics": {
    "cdpCommands": 25,
    "injectionAttempts": 3,
    "injectionSuccesses": 2,
    "errors": 1
  }
}
```

## Troubleshooting Common Issues

### Game Not Found
Look for these debug messages:
```
[DETECTOR] Checking path 1/4 {"path":"C:/Program Files (x86)/Steam/..."}
[DETECTOR] No game executable found in any location
```

### Injection Regex Not Matching
```
[INJECTOR] Injection regex pattern not found {
  "regex": "\\w+\\.ApplicationMain\\s*?=",
  "bodyPreview": "var someOtherCode = function() {...}"
}
```

### CDP Connection Issues
```
[DETECTOR] Debugger connection attempt failed {
  "error": "ECONNREFUSED",
  "attempt": 5
}
```

## Performance Monitoring

The debug system includes timing information:

```
2024-01-15T10:30:15.123Z DEBUG [INJECTOR]   ⏱️  TIMING: Script injection took 45ms
2024-01-15T10:30:15.200Z DEBUG [DETECTOR]   ⏱️  TIMING: Game launch took 2500ms
```

## Custom Debug Context

Create child loggers for specific components:

```javascript
const childLogger = mainLogger.createChild('CUSTOM');
childLogger.info('Custom component message');
// Output: [CUSTOM] Custom component message
```

This comprehensive debugging system makes it much easier to:
- Identify where the injection process fails
- Understand timing and performance issues
- Track down configuration problems
- Monitor the health of the injection system
- Provide detailed error reports for troubleshooting