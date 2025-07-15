import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class UndoTracker {
  constructor() {
    this.undoFile = path.join(os.homedir(), '.ccundo', 'undone-operations.json');
  }

  async init() {
    await fs.mkdir(path.dirname(this.undoFile), { recursive: true });
  }

  async getUndoneOperations() {
    try {
      const data = await fs.readFile(this.undoFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async markAsUndone(operationId, sessionFile) {
    const undoneOps = await this.getUndoneOperations();
    
    if (!undoneOps[sessionFile]) {
      undoneOps[sessionFile] = [];
    }
    
    if (!undoneOps[sessionFile].includes(operationId)) {
      undoneOps[sessionFile].push(operationId);
      await fs.writeFile(this.undoFile, JSON.stringify(undoneOps, null, 2));
    }
  }

  async markAsRedone(operationId, sessionFile) {
    const undoneOps = await this.getUndoneOperations();
    
    if (undoneOps[sessionFile]) {
      const index = undoneOps[sessionFile].indexOf(operationId);
      if (index > -1) {
        undoneOps[sessionFile].splice(index, 1);
        await fs.writeFile(this.undoFile, JSON.stringify(undoneOps, null, 2));
      }
    }
  }

  async isUndone(operationId, sessionFile) {
    const undoneOps = await this.getUndoneOperations();
    return undoneOps[sessionFile]?.includes(operationId) || false;
  }

  async filterUndoneOperations(operations, sessionFile) {
    const undoneOps = await this.getUndoneOperations();
    const undoneIds = undoneOps[sessionFile] || [];
    
    return operations.filter(op => !undoneIds.includes(op.id));
  }

  async getUndoneOperationsList(operations, sessionFile) {
    const undoneOps = await this.getUndoneOperations();
    const undoneIds = undoneOps[sessionFile] || [];
    
    // Return operations that have been undone, in reverse order (most recent first)
    return operations
      .filter(op => undoneIds.includes(op.id))
      .reverse();
  }
}