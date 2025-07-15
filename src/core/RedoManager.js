import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { OperationType } from './Operation.js';

export class RedoManager {
  constructor() {
    this.backupDir = path.join(os.homedir(), '.ccundo', 'backups');
  }

  async init() {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  async redo(operation) {
    switch (operation.type) {
      case OperationType.FILE_CREATE:
        return await this.redoFileCreate(operation);
      case OperationType.FILE_EDIT:
        return await this.redoFileEdit(operation);
      case OperationType.FILE_DELETE:
        return await this.redoFileDelete(operation);
      case OperationType.FILE_RENAME:
        return await this.redoFileRename(operation);
      case OperationType.DIRECTORY_CREATE:
        return await this.redoDirectoryCreate(operation);
      case OperationType.DIRECTORY_DELETE:
        return await this.redoDirectoryDelete(operation);
      case OperationType.BASH_COMMAND:
        return await this.redoBashCommand(operation);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  async redoFileCreate(operation) {
    const { filePath, content } = operation.data;
    
    try {
      // Check if file already exists
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        return {
          success: false,
          message: `Cannot redo file creation: ${filePath} already exists`
        };
      }

      // Try to restore from backup first
      const backupPath = path.join(this.backupDir, `${operation.id}-deleted`);
      let fileContent = content || '';
      
      try {
        fileContent = await fs.readFile(backupPath, 'utf8');
      } catch (e) {
        // If no backup, use original content if available
        if (!content) {
          return {
            success: false,
            message: `Cannot redo file creation: no content available for ${filePath}`
          };
        }
      }

      await fs.writeFile(filePath, fileContent);
      
      return {
        success: true,
        message: `File recreated: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to redo file creation: ${error.message}`
      };
    }
  }

  async redoFileEdit(operation) {
    const { filePath, originalContent, oldString, newString, replaceAll, edits, isMultiEdit } = operation.data;
    
    try {
      const currentContent = await fs.readFile(filePath, 'utf8');
      const backupPath = path.join(this.backupDir, `${operation.id}-redo`);
      await fs.writeFile(backupPath, currentContent);
      
      let redoneContent = currentContent;
      
      if (originalContent) {
        // This was a legacy full-content edit, but we can't safely redo it
        // because we don't know what the "new" content should be
        return {
          success: false,
          message: `Cannot redo legacy file edit: insufficient data for ${filePath}`
        };
      } else if (isMultiEdit && edits) {
        // Redo MultiEdit by applying each edit in original order
        for (const edit of edits) {
          if (edit.old_string !== undefined && edit.new_string) {
            if (redoneContent.includes(edit.old_string)) {
              redoneContent = redoneContent.replace(edit.old_string, edit.new_string);
            }
          }
        }
      } else if (oldString !== undefined && newString) {
        // Redo single Edit operation - apply the original string replacement
        if (replaceAll) {
          // Replace all occurrences
          redoneContent = redoneContent.split(oldString).join(newString);
        } else {
          // Replace first occurrence only
          if (redoneContent.includes(oldString)) {
            redoneContent = redoneContent.replace(oldString, newString);
          } else {
            return {
              success: false,
              message: `Cannot redo edit: original string not found in ${filePath}`
            };
          }
        }
      } else {
        return {
          success: false,
          message: `Cannot redo file edit: insufficient data for ${filePath}`
        };
      }
      
      await fs.writeFile(filePath, redoneContent);
      
      return {
        success: true,
        message: `File edit redone: ${filePath}`,
        backupPath
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to redo file edit: ${error.message}`
      };
    }
  }

  async redoFileDelete(operation) {
    const { filePath } = operation.data;
    
    try {
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return {
          success: false,
          message: `Cannot redo file deletion: ${filePath} does not exist`
        };
      }

      // Backup the file before deleting
      const backupPath = path.join(this.backupDir, `${operation.id}-redo-deleted`);
      const content = await fs.readFile(filePath, 'utf8');
      await fs.writeFile(backupPath, content);
      
      await fs.unlink(filePath);
      
      return {
        success: true,
        message: `File deleted again: ${filePath}`,
        backupPath
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to redo file deletion: ${error.message}`
      };
    }
  }

  async redoFileRename(operation) {
    const { oldPath, newPath } = operation.data;
    
    try {
      const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
      const newExists = await fs.access(newPath).then(() => true).catch(() => false);
      
      if (!oldExists) {
        return {
          success: false,
          message: `Cannot redo rename: ${oldPath} does not exist`
        };
      }
      
      if (newExists) {
        return {
          success: false,
          message: `Cannot redo rename: ${newPath} already exists`
        };
      }

      await fs.rename(oldPath, newPath);
      
      return {
        success: true,
        message: `File renamed again: ${oldPath} → ${newPath}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to redo rename: ${error.message}`
      };
    }
  }

  async redoDirectoryCreate(operation) {
    const { dirPath } = operation.data;
    
    try {
      const exists = await fs.access(dirPath).then(() => true).catch(() => false);
      if (exists) {
        return {
          success: false,
          message: `Cannot redo directory creation: ${dirPath} already exists`
        };
      }

      await fs.mkdir(dirPath, { recursive: true });
      
      return {
        success: true,
        message: `Directory created again: ${dirPath}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to redo directory creation: ${error.message}`
      };
    }
  }

  async redoDirectoryDelete(operation) {
    const { dirPath } = operation.data;
    
    try {
      const exists = await fs.access(dirPath).then(() => true).catch(() => false);
      if (!exists) {
        return {
          success: false,
          message: `Cannot redo directory deletion: ${dirPath} does not exist`
        };
      }

      await fs.rmdir(dirPath);
      
      return {
        success: true,
        message: `Directory deleted again: ${dirPath}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to redo directory deletion: ${error.message}`
      };
    }
  }

  async redoBashCommand(operation) {
    const { command } = operation.data;
    
    return {
      success: false,
      message: `Cannot redo bash command: ${command}\nPlease manually re-run the command.`
    };
  }
}