const Logger = require('./logger');

class DebugSession {
  constructor(options = {}) {
    this.logger = options.logger || new Logger({ context: 'DEBUG' });
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.steps = [];
    this.metrics = {
      cdpCommands: 0,
      injectionAttempts: 0,
      injectionSuccesses: 0,
      errors: 0
    };
    
    this.logger.info(`🚀 Debug session started`, { sessionId: this.sessionId });
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startStep(name, data = {}) {
    const step = {
      name,
      startTime: Date.now(),
      data,
      status: 'running'
    };
    
    this.steps.push(step);
    this.logger.step(name, data);
    
    return {
      success: (result = null) => this.completeStep(step, 'success', result),
      error: (error) => this.completeStep(step, 'error', error),
      info: (message, data) => this.logger.debug(`  ℹ️  ${name}: ${message}`, data),
      warn: (message, data) => this.logger.warn(`  ⚠️  ${name}: ${message}`, data)
    };
  }

  completeStep(step, status, result = null) {
    step.status = status;
    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    step.result = result;

    if (status === 'success') {
      this.logger.stepSuccess(step.name, { 
        duration: step.duration,
        result: typeof result === 'object' ? result : { value: result }
      });
    } else if (status === 'error') {
      this.metrics.errors++;
      this.logger.stepError(step.name, result, { duration: step.duration });
    }
  }

  incrementMetric(metric) {
    if (this.metrics.hasOwnProperty(metric)) {
      this.metrics[metric]++;
    }
  }

  dumpState(context = 'State Dump') {
    const sessionDuration = Date.now() - this.startTime;
    const completedSteps = this.steps.filter(s => s.status !== 'running');
    const failedSteps = this.steps.filter(s => s.status === 'error');
    
    const state = {
      sessionId: this.sessionId,
      sessionDuration,
      totalSteps: this.steps.length,
      completedSteps: completedSteps.length,
      failedSteps: failedSteps.length,
      metrics: this.metrics,
      steps: this.steps.map(s => ({
        name: s.name,
        status: s.status,
        duration: s.duration || (Date.now() - s.startTime),
        hasError: s.status === 'error'
      }))
    };

    this.logger.info(`📊 ${context}`, state);
    return state;
  }

  createChildLogger(context) {
    return this.logger.createChild(context);
  }

  end() {
    const sessionDuration = Date.now() - this.startTime;
    this.logger.info(`🏁 Debug session ended`, {
      sessionId: this.sessionId,
      duration: sessionDuration,
      totalSteps: this.steps.length,
      metrics: this.metrics
    });
  }
}

module.exports = DebugSession;