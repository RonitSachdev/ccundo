import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { languages } from './languages.js';

class I18n {
  constructor() {
    this.currentLanguage = 'en';
    this.configFile = path.join(os.homedir(), '.ccundo', 'config.json');
  }

  async init() {
    await this.loadConfig();
  }

  async loadConfig() {
    try {
      const config = JSON.parse(await fs.readFile(this.configFile, 'utf8'));
      this.currentLanguage = config.language || 'en';
    } catch (error) {
      // Use default language if config doesn't exist
      this.currentLanguage = 'en';
    }
  }

  async saveConfig() {
    try {
      await fs.mkdir(path.dirname(this.configFile), { recursive: true });
      const config = { language: this.currentLanguage };
      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save language config:', error.message);
    }
  }

  async setLanguage(lang) {
    if (!languages[lang]) {
      throw new Error(`Unsupported language: ${lang}`);
    }
    this.currentLanguage = lang;
    await this.saveConfig();
  }

  t(key, params = {}) {
    const lang = languages[this.currentLanguage] || languages['en'];
    let message = lang.messages[key] || key;
    
    // Replace parameters in the message
    Object.keys(params).forEach(param => {
      message = message.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });
    
    return message;
  }

  getAvailableLanguages() {
    return Object.keys(languages).map(code => ({
      code,
      name: languages[code].name
    }));
  }

  getCurrentLanguage() {
    return {
      code: this.currentLanguage,
      name: languages[this.currentLanguage]?.name || 'Unknown'
    };
  }
}

// Create a singleton instance
export const i18n = new I18n();