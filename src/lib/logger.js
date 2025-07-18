const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logFile = options.logFile || path.join(process.cwd(), 'injector.log');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.context = options.context || 'MAIN';
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      trace: '\x1b[37m', // White
      reset: '\x1b[0m'
    };
  }

  createChild(context) {
    return new Logger({
      level: this.level,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      logFile: this.logFile,
      maxFileSize: this.maxFileSize,
      context: context
    });
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const upperLevel = level.toUpperCase().padEnd(5);
    const contextStr = `[${this.context}]`.padEnd(12);
    
    let formatted = `${timestamp} ${upperLevel} ${contextStr} ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        formatted += '\n' + JSON.stringify(data, null, 2);
      } else {
        formatted += ` ${data}`;
      }
    }
    
    return formatted;
  }

  async writeToFile(message) {
    if (!this.enableFile) return;
    
    try {
      // Check file size and rotate if needed
      try {
        const stats = await fs.stat(this.logFile);
        if (stats.size > this.maxFileSize) {
          const backupFile = this.logFile + '.old';
          await fs.rename(this.logFile, backupFile);
        }
      } catch (e) {
        // File doesn't exist yet, that's fine
      }
      
      await fs.appendFile(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async log(level, message, data = null) {
    if (!this.shouldLog(level)) return;
    
    const formatted = this.formatMessage(level, message, data);
    
    if (this.enableConsole) {
      const colored = `${this.colors[level]}${formatted}${this.colors.reset}`;
      console.log(colored);
    }
    
    await this.writeToFile(formatted);
  }

  error(message, data = null) { return this.log('error', message, data); }
  warn(message, data = null) { return this.log('warn', message, data); }
  info(message, data = null) { return this.log('info', message, data); }
  debug(message, data = null) { return this.log('debug', message, data); }
  trace(message, data = null) { return this.log('trace', message, data); }

  // Special methods for step tracking
  step(stepName, data = null) {
    return this.info(`🔄 STEP: ${stepName}`, data);
  }

  stepSuccess(stepName, data = null) {
    return this.info(`✅ SUCCESS: ${stepName}`, data);
  }

  stepError(stepName, error, data = null) {
    const errorData = {
      error: error.message,
      stack: error.stack,
      ...data
    };
    return this.error(`❌ FAILED: ${stepName}`, errorData);
  }

  timing(label) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.debug(`⏱️  TIMING: ${label} took ${duration}ms`);
        return duration;
      }
    };
  }

  // Network request debugging
  networkRequest(method, url, data = null) {
    this.debug(`🌐 ${method} ${url}`, data);
  }

  networkResponse(method, url, status, data = null) {
    const emoji = status >= 200 && status < 300 ? '✅' : '❌';
    this.debug(`${emoji} ${method} ${url} -> ${status}`, data);
  }

  // CDP debugging
  cdpCommand(domain, method, params = null) {
    this.trace(`📡 CDP: ${domain}.${method}`, params);
  }

  cdpEvent(domain, method, params = null) {
    this.trace(`📨 CDP Event: ${domain}.${method}`, params);
  }

  // Injection debugging
  injectionAttempt(url, pattern) {
    this.debug(`💉 Attempting injection on: ${url}`, { pattern });
  }

  injectionSuccess(url, modifications) {
    this.info(`✅ Injection successful: ${url}`, modifications);
  }

  injectionSkipped(url, reason) {
    this.debug(`⏭️  Injection skipped: ${url}`, { reason });
  }
}

module.exports = Logger;