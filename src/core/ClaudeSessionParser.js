import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { Operation, OperationType } from './Operation.js';
import { UndoTracker } from './UndoTracker.js';

export class ClaudeSessionParser {
  constructor() {
    this.claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
  }

  async getCurrentProjectDir() {
    const cwd = process.cwd();
    let safePath;
    
    // Claude uses different formats for different operating systems
    if (process.platform === 'win32') {
      // Windows: C:\Users\... → C--Users-...
      safePath = cwd.replace(/:[\\\/]/g, '--')
                     .replace(/[\\/]/g, '-')
                     .replace(/[\s_]/g, '-');
    } else {
      // Linux/macOS: /home/... → -home-...
      safePath = cwd.replace(/[\s\/_]/g, '-');
    }
    
    return path.join(this.claudeProjectsDir, safePath);
  }

  async getCurrentSessionFile() {
    const projectDir = await this.getCurrentProjectDir();
    
    try {
      const files = await fs.readdir(projectDir);
      const sessionFiles = files.filter(f => f.endsWith('.jsonl'));
      
      if (sessionFiles.length === 0) return null;
      
      // Get the most recently modified session file
      const stats = await Promise.all(
        sessionFiles.map(async f => ({
          file: f,
          path: path.join(projectDir, f),
          mtime: (await fs.stat(path.join(projectDir, f))).mtime
        }))
      );
      
      stats.sort((a, b) => b.mtime - a.mtime);
      return stats[0].path;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async parseSessionFile(sessionFile) {
    const operations = [];
    const fileStream = createReadStream(sessionFile);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        
        // Look for tool use messages
        if (entry.type === 'assistant' && entry.message?.content) {
          for (const content of entry.message.content) {
            if (content.type === 'tool_use') {
              const operation = this.extractOperation(content, entry.timestamp);
              if (operation) {
                operations.push(operation);
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }

    // Filter out operations that have already been undone
    const undoTracker = new UndoTracker();
    await undoTracker.init();
    const filteredOperations = await undoTracker.filterUndoneOperations(operations, sessionFile);
    
    return filteredOperations;
  }

  extractOperation(toolUse, timestamp) {
    const { name, input } = toolUse;
    
    switch (name) {
      case 'Write':
        if (input.file_path) {
          const op = new Operation(OperationType.FILE_CREATE, {
            filePath: input.file_path,
            content: input.content || ''
          });
          op.timestamp = new Date(timestamp);
          op.id = toolUse.id;
          return op;
        }
        break;

      case 'Edit':
        if (input.file_path) {
          const op = new Operation(OperationType.FILE_EDIT, {
            filePath: input.file_path,
            // Note: We only have the string that was replaced, not the full file content
            // This will be handled differently in UndoManager
            oldString: input.old_string || '',
            newString: input.new_string || '',
            replaceAll: input.replace_all || false
          });
          op.timestamp = new Date(timestamp);
          op.id = toolUse.id;
          return op;
        }
        break;
        
      case 'MultiEdit':
        if (input.file_path) {
          // For MultiEdit, we have multiple edits but still just the strings
          const op = new Operation(OperationType.FILE_EDIT, {
            filePath: input.file_path,
            edits: input.edits || [],
            isMultiEdit: true
          });
          op.timestamp = new Date(timestamp);
          op.id = toolUse.id;
          return op;
        }
        break;

      case 'Bash':
        if (input.command) {
          const command = input.command;
          
          // Try to detect file operations in bash commands
          if (command.includes('rm ') && !command.includes('rmdir')) {
            const match = command.match(/rm\s+(?:-[rf]+\s+)?([^\s]+)/);
            if (match) {
              const op = new Operation(OperationType.FILE_DELETE, {
                filePath: match[1],
                content: '' // We can't recover content from session history
              });
              op.timestamp = new Date(timestamp);
              op.id = toolUse.id;
              return op;
            }
          } else if (command.includes('mv ')) {
            const match = command.match(/mv\s+([^\s]+)\s+([^\s]+)/);
            if (match) {
              const op = new Operation(OperationType.FILE_RENAME, {
                oldPath: match[1],
                newPath: match[2]
              });
              op.timestamp = new Date(timestamp);
              op.id = toolUse.id;
              return op;
            }
          } else if (command.includes('mkdir')) {
            const match = command.match(/mkdir\s+(?:-p\s+)?([^\s]+)/);
            if (match) {
              const op = new Operation(OperationType.DIRECTORY_CREATE, {
                dirPath: match[1]
              });
              op.timestamp = new Date(timestamp);
              op.id = toolUse.id;
              return op;
            }
          } else {
            // Generic bash command
            const op = new Operation(OperationType.BASH_COMMAND, {
              command: command
            });
            op.timestamp = new Date(timestamp);
            op.id = toolUse.id;
            return op;
          }
        }
        break;
    }
    
    return null;
  }

  async getAllSessions() {
    try {
      const projectDirs = await fs.readdir(this.claudeProjectsDir);
      const sessions = [];
      
      for (const projectDir of projectDirs) {
        const fullPath = path.join(this.claudeProjectsDir, projectDir);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(fullPath);
          const sessionFiles = files.filter(f => f.endsWith('.jsonl'));
          
          for (const sessionFile of sessionFiles) {
            const sessionId = sessionFile.replace('.jsonl', '');
            // Convert back to proper path - reverse the Claude encoding
            let projectPath = projectDir;
            
            if (process.platform === 'win32') {
              // Windows: C--Users-... → C:\Users\...
              projectPath = projectPath.replace(/--/g, ':\\');
              projectPath = projectPath.replace(/-/g, '\\');
            } else {
              // Linux/macOS: -home-... → /home/...
              projectPath = projectPath.replace(/^-/, '/');
              projectPath = projectPath.replace(/-/g, '/');
            }
            
            sessions.push({
              id: sessionId,
              project: projectPath, // Decoded path for display
              rawProjectDir: projectDir, // Raw directory name for comparison
              file: path.join(fullPath, sessionFile)
            });
          }
        }
      }
      
      return sessions;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
}