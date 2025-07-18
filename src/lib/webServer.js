const express = require('express');
const path = require('path');

class WebServer {
  constructor(config, cheatManager) {
    this.config = config;
    this.cheatManager = cheatManager;
    this.app = express();
    this.server = null;
    this.port = config.web_port || 8080;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../ui')));
  }

  setupRoutes() {
    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../ui', 'index.html'));
    });

    // API Routes
    this.app.get('/api/cheats', this.handleGetCheats.bind(this));
    this.app.post('/api/toggle', this.handleToggleCheat.bind(this));
    this.app.get('/api/needs-confirmation', this.handleGetConfirmation.bind(this));
    this.app.get('/api/devtools-url', this.handleGetDevToolsUrl.bind(this));
    this.app.get('/api/config', this.handleGetConfig.bind(this));
    this.app.post('/api/config/update', this.handleUpdateConfig.bind(this));
    this.app.post('/api/config/save', this.handleSaveConfig.bind(this));

    // Error handling
    this.app.use(this.handleError.bind(this));
  }

  async handleGetCheats(req, res) {
    try {
      const suggestions = await this.cheatManager.getAutoCompleteSuggestions();
      res.json(suggestions);
    } catch (error) {
      console.error('API Error getting cheats:', error);
      res.status(500).json({ error: 'Failed to get cheats', details: error.message });
    }
  }

  async handleToggleCheat(req, res) {
    const { action } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    try {
      const result = await this.cheatManager.executeCheat(action);
      console.log(`[Web UI] Executed: ${action} -> ${result}`);
      res.json({ result });
    } catch (error) {
      console.error(`API Error executing cheat '${action}':`, error);
      res.status(500).json({ error: `Failed to execute cheat '${action}'`, details: error.message });
    }
  }

  async handleGetConfirmation(req, res) {
    try {
      const confirmationList = await this.cheatManager.getChoicesNeedingConfirmation();
      res.json(confirmationList);
    } catch (error) {
      console.error('API Error getting confirmation choices:', error);
      res.status(500).json({ error: 'Failed to get confirmation list', details: error.message });
    }
  }

  async handleGetDevToolsUrl(req, res) {
    try {
      const url = await this.cheatManager.getDevToolsUrl();
      res.json({ url });
    } catch (error) {
      console.error('API Error getting DevTools URL:', error);
      res.status(500).json({ error: 'Failed to get DevTools URL', details: error.message });
    }
  }

  handleGetConfig(req, res) {
    try {
      const config = this.cheatManager.getFullConfig();
      res.json(config);
    } catch (error) {
      console.error('API Error getting config:', error);
      res.status(500).json({ error: 'Failed to get configuration', details: error.message });
    }
  }

  async handleUpdateConfig(req, res) {
    try {
      const result = await this.cheatManager.updateConfig(req.body);
      res.json({ message: 'Configuration updated successfully', details: result });
    } catch (error) {
      console.error('API Error updating config:', error);
      res.status(500).json({ error: 'Failed to update configuration', details: error.message });
    }
  }

  async handleSaveConfig(req, res) {
    try {
      await this.cheatManager.saveConfig(req.body);
      res.json({ message: 'Configuration successfully saved to config.custom.js' });
    } catch (error) {
      console.error('API Error saving config:', error);
      res.status(500).json({ error: 'Failed to save configuration', details: error.message });
    }
  }

  handleError(error, req, res, next) {
    console.error('Unhandled API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`\n--------------------------------------------------`);
          console.log(`Web UI available at: http://localhost:${this.port}`);
          console.log(`--------------------------------------------------\n`);
          resolve();
        }
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = WebServer;