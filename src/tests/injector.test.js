const CheatInjector = require('../lib/injector');

describe('CheatInjector', () => {
  let injector;
  const mockConfig = {
    injreg: '\\w+\\.ApplicationMain\\s*?=',
    interceptPattern: '*N.js',
    showConsoleLog: false,
    cdp_port: 32123
  };

  beforeEach(() => {
    injector = new CheatInjector(mockConfig);
  });

  describe('objToString', () => {
    test('should convert simple object to string', () => {
      const obj = { test: 'value', number: 42, bool: true };
      const result = injector.objToString(obj);
      
      expect(result).toContain('test: "value"');
      expect(result).toContain('number: 42');
      expect(result).toContain('bool: true');
    });

    test('should handle functions', () => {
      const obj = { func: (x) => x * 2 };
      const result = injector.objToString(obj);
      
      expect(result).toContain('func: (x) => x * 2');
    });

    test('should handle nested objects', () => {
      const obj = { nested: { inner: 'value' } };
      const result = injector.objToString(obj);
      
      expect(result).toContain('nested: {');
      expect(result).toContain('inner: "value"');
    });

    test('should handle arrays', () => {
      const obj = { arr: [1, 2, 3] };
      const result = injector.objToString(obj);
      
      expect(result).toContain('arr: [1,2,3]');
    });
  });

  describe('injectCheats', () => {
    test('should return null if regex does not match', async () => {
      const mockBody = 'some random javascript code';
      const result = await injector.injectCheats(mockBody);
      
      expect(result).toBeNull();
    });

    test('should inject cheat code when regex matches', async () => {
      const mockBody = 'var ApplicationMain = function() {};';
      
      // Mock the client Runtime.evaluate method
      injector.client = {
        Runtime: {
          evaluate: jest.fn().mockResolvedValue({
            result: { type: 'undefined' }
          })
        }
      };

      const result = await injector.injectCheats(mockBody);
      
      expect(result).toContain('window.__idleon_cheats__=');
      expect(result).toContain('ApplicationMain');
    });
  });
});