// Global test setup
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock Chrome DevTools Protocol
global.mockCDP = {
  Runtime: {
    enable: jest.fn().mockResolvedValue({}),
    evaluate: jest.fn().mockResolvedValue({ result: { value: 'mock result' } })
  },
  Page: {
    enable: jest.fn().mockResolvedValue({}),
    setBypassCSP: jest.fn().mockResolvedValue({}),
    loadEventFired: jest.fn()
  },
  Network: {
    enable: jest.fn().mockResolvedValue({}),
    setRequestInterception: jest.fn().mockResolvedValue({}),
    requestIntercepted: jest.fn(),
    getResponseBodyForInterception: jest.fn().mockResolvedValue({ body: 'bW9jayBib2R5' }),
    continueInterceptedRequest: jest.fn().mockResolvedValue({})
  },
  DOM: {
    enable: jest.fn().mockResolvedValue({})
  },
  Target: {
    getTargetInfo: jest.fn().mockResolvedValue({
      targetInfo: { targetId: 'mock-target-id' }
    })
  },
  close: jest.fn()
};