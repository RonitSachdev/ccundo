# Changelog

All notable changes to ccundo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-05

### Added
- **Core Functionality**
  - Direct integration with Claude Code session files
  - Automatic operation tracking from `.jsonl` session files
  - Cascading undo system for maintaining project consistency
  - Detailed operation previews before undoing
  - Safe backup system for all undo operations

- **Supported Operations**
  - File creation/deletion with content preservation
  - File editing with diff previews
  - File and directory renaming
  - Directory creation/removal
  - Bash command tracking (manual intervention required)

- **User Interface**
  - Interactive operation selection with cascading indicators
  - Detailed preview system showing exact changes
  - Color-coded status and action indicators
  - Confirmation prompts with operation summaries

- **Session Management**
  - Multi-session support across different projects
  - Session switching and listing functionality
  - Automatic current session detection

- **Internationalization**
  - Full English language support
  - Complete Japanese (日本語) localization
  - Persistent language preferences
  - Localized time formatting and error messages

- **CLI Commands**
  - `ccundo list` - View operations from current session
  - `ccundo preview` - Preview changes without executing
  - `ccundo undo` - Interactive undo with cascading safety
  - `ccundo sessions` - Manage multiple sessions
  - `ccundo language` - Switch interface language

- **Safety Features**
  - Automatic backups before any changes
  - Cascading undo prevents inconsistent states
  - Preview system prevents accidental changes
  - Operation validation and error handling

### Technical Details
- Node.js 16+ support with ES modules
- Zero-configuration setup
- File system integration with Claude Code's storage format
- Robust JSON Lines parser for session files
- Modular architecture for easy extension

### Dependencies
- commander ^11.1.0 - CLI framework
- chalk ^5.3.0 - Terminal styling
- inquirer ^9.2.12 - Interactive prompts

## [1.0.1] - 2025-07-05

### Fixed
- **Critical Bug Fix**: Operations that have been undone are now properly tracked and filtered out from subsequent undo lists
- Added `UndoTracker` to maintain state of undone operations across sessions
- Prevents errors when trying to undo already-undone operations
- Session file tracking for proper operation filtering

### Added
- Persistent undo history in `~/.ccundo/undone-operations.json`
- Automatic filtering of undone operations from Claude Code sessions

## [1.0.2] - 2025-07-05

### Fixed
- **Critical Fix**: File edit undo now correctly reverses only the specific string changes instead of replacing entire file content
- Fixed issue where undoing an edit operation would delete more content than intended
- Improved handling of Edit and MultiEdit operations from Claude Code sessions

### Changed
- Edit operations now track the specific strings that were changed (oldString/newString) rather than full file content
- UndoManager now performs targeted string replacements instead of full file overwrites
- Enhanced preview system to show exact string replacements that will be reversed

### Technical Details
- Claude session parser now properly extracts Edit tool parameters (old_string, new_string, replace_all)
- Support for MultiEdit operations with multiple string replacements
- More accurate undo behavior that matches the original Claude Code edit operations

## [1.1.0] - 2025-07-07

### Added
- **Redo Functionality**: Added complete redo system to reverse previously undone operations
- New `ccundo redo` command with interactive operation selection
- Cascading redo support - redoing an operation automatically redos all operations that were undone before it
- RedoManager class for safely re-applying undone operations
- Full i18n support for redo functionality in English and Japanese
- Updated UndoTracker to support redo state management

### CLI Commands
- `ccundo redo` - Interactive redo of previously undone operations
- `ccundo redo [operation-id]` - Redo specific operation by ID
- Added `-y, --yes` flag to skip confirmation prompts

### Technical Details
- RedoManager reverses undo operations safely
- Support for all operation types: file create/edit/delete, rename, directory operations
- Automatic backup creation before redo operations
- Enhanced UndoTracker with `markAsRedone()` method
- Cascading redo maintains project consistency

### Internationalization
- Added Japanese translations for all redo-related messages
- Enhanced prompt translations for redo confirmations

## [1.1.1] - 2025-07-09

### Fixed
- **Critical Bug Fix**: Fixed ccundo list command failing in directories with underscores in their names
- Updated path conversion regex in ClaudeSessionParser to handle underscores correctly
- Changed regex from `/[\s\/]/g` to `/[\s\/_]/g` to match Claude Code's directory naming convention

### Technical Details
- Directories like `/home/user/my_project_name` now correctly map to `-home-user-my-project-name`
- Maintains backward compatibility with existing functionality
- All ccundo commands now work properly in directories containing underscores

## [1.1.2] - 2026-02-08

### Fixed
- **Windows session path decoding**: Fix `getAllSessions()` incorrectly decoding UNC/WSL paths (e.g. `--wsl-localhost-...` was decoded as `:\wsl\...` instead of `//wsl/...`)
- The `--` prefix is now only treated as a drive letter (`C:\`) when preceded by `[A-Z]`; otherwise it's treated as a UNC path prefix (`//`)

### Note
- PR #6 cross-platform fix (os.homedir, Windows path encoding) was merged to main but never published to npm — this release includes those fixes plus the UNC path decode fix above

## [Unreleased]

### Planned Features
- Additional language support
- Git integration for version-aware undo
- Plugin system for custom operation types
- Web interface for session management
- Batch operation support