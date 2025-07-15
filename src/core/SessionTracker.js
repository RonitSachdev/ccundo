import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Operation, OperationType } from './Operation.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SessionTracker {
  constructor(sessionId = null) {
    this.sessionId = sessionId || new Date().toISOString().replace(/[:.]/g, '-');
    this.operations = [];
    this.sessionDir = path.join(os.homedir(), '.ccundo', 'sessions');
    this.sessionFile = path.join(this.sessionDir, `${this.sessionId}.json`);
  }

  async init() {
    await fs.mkdir(this.sessionDir, { recursive: true });
    await this.load();
  }

  async load() {
    try {
      const data = await fs.readFile(this.sessionFile, 'utf8');
      const session = JSON.parse(data);
      this.operations = session.operations.map(op => Operation.fromJSON(op));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async save() {
    const sessionData = {
      sessionId: this.sessionId,
      operations: this.operations.map(op => op.toJSON())
    };
    await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
  }

  async addOperation(operation) {
    this.operations.push(operation);
    await this.save();
  }

  async getOperations(includeUndone = false) {
    return includeUndone 
      ? this.operations 
      : this.operations.filter(op => !op.undone);
  }

  async getOperation(id) {
    return this.operations.find(op => op.id === id);
  }

  async markUndone(operationId) {
    const operation = await this.getOperation(operationId);
    if (operation) {
      operation.undone = true;
      await this.save();
    }
    return operation;
  }

  static async listSessions() {
    const sessionDir = path.join(os.homedir(), '.ccundo', 'sessions');
    try {
      const files = await fs.readdir(sessionDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  static async getCurrentSession() {
    const currentFile = path.join(os.homedir(), '.ccundo', 'current-session');
    try {
      const sessionId = await fs.readFile(currentFile, 'utf8');
      return sessionId.trim();
    } catch (error) {
      return null;
    }
  }

  static async setCurrentSession(sessionId) {
    const currentFile = path.join(os.homedir(), '.ccundo', 'current-session');
    await fs.mkdir(path.dirname(currentFile), { recursive: true });
    await fs.writeFile(currentFile, sessionId);
  }
}