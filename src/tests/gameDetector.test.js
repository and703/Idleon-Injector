const GameDetector = require('../lib/gameDetector');
const { existsSync } = require('fs');

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

// Mock os module
jest.mock('os', () => ({
  platform: jest.fn()
}));

describe('GameDetector', () => {
  let detector;
  const mockConfig = {
    cdp_port: 32123,
    gameExePath: null
  };

  beforeEach(() => {
    detector = new GameDetector(mockConfig);
    jest.clearAllMocks();
  });

  describe('findIdleonExe', () => {
    test('should return custom path if provided and exists', () => {
      const customPath = 'C:/Custom/Path/LegendsOfIdleon.exe';
      detector.config.gameExePath = customPath;
      existsSync.mockReturnValue(true);

      const result = detector.findIdleonExe();
      
      expect(result).toBe(customPath);
      expect(existsSync).toHaveBeenCalledWith(customPath);
    });

    test('should return first existing default path', () => {
      detector.config.gameExePath = null;
      existsSync
        .mockReturnValueOnce(false) // First path doesn't exist
        .mockReturnValueOnce(true);  // Second path exists

      const result = detector.findIdleonExe();
      
      expect(result).toBeTruthy();
      expect(existsSync).toHaveBeenCalledTimes(2);
    });

    test('should return null if no paths exist', () => {
      detector.config.gameExePath = null;
      existsSync.mockReturnValue(false);

      const result = detector.findIdleonExe();
      
      expect(result).toBeNull();
    });
  });

  describe('waitForDebugger', () => {
    test('should resolve when debugger URL is found', async () => {
      const mockHttp = {
        get: jest.fn((url, callback) => {
          const mockRes = {
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler('{"webSocketDebuggerUrl": "ws://localhost:32123/test"}');
              } else if (event === 'end') {
                handler();
              }
            })
          };
          callback(mockRes);
          return { on: jest.fn() };
        })
      };

      // Mock http module
      jest.doMock('http', () => mockHttp);
      
      const GameDetector = require('../lib/gameDetector');
      const detector = new GameDetector(mockConfig);

      const result = await detector.waitForDebugger(1000);
      
      expect(result).toBe('ws://localhost:32123/test');
    });

    test('should reject on timeout', async () => {
      const mockHttp = {
        get: jest.fn(() => ({
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              // Simulate connection error
              setTimeout(() => handler(new Error('Connection failed')), 10);
            }
          })
        }))
      };

      jest.doMock('http', () => mockHttp);
      
      const GameDetector = require('../lib/gameDetector');
      const detector = new GameDetector(mockConfig);

      await expect(detector.waitForDebugger(100)).rejects.toThrow('Timeout waiting for debugger');
    });
  });
});