//! # Workspace Configuration
//!
//! Purpose: Reads and writes per-workspace settings (exclude folders, hidden files,
//! last-open tabs, AI config, identity/trust) stored in `<appData>/workspaces/<hash>.json`.
//!
//! Pipeline: Frontend invoke("read_workspace_config") → this module → filesystem.
//! On first read, migrates from legacy `.tmark/` directory format if present.
//!
//! Key decisions:
//!   - Workspace root paths are hashed (SHA-256, first 8 bytes) to produce deterministic
//!     filenames, avoiding special-character issues in path-based filenames.
//!   - Legacy migration is one-shot: after writing to the new location, the old `.tmark/`
//!     directory is cleaned up (best-effort).
//!   - Writes use atomic_write_file to prevent partial reads by concurrent processes.
//!
//! Known limitations:
//!   - Hash collisions are theoretically possible but extremely unlikely (2^64 space).

use crate::app_paths;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, FilePath};

/// Workspace identity and trust information for permission management.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceIdentity {
    /// Unique identifier for this workspace (UUID v4)
    pub id: String,
    /// When this workspace was first created (unix timestamp ms)
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    /// Current trust level: "untrusted" or "trusted"
    #[serde(rename = "trustLevel")]
    pub trust_level: String,
    /// When trust was granted (null if untrusted)
    #[serde(rename = "trustedAt", skip_serializing_if = "Option::is_none")]
    pub trusted_at: Option<i64>,
}

/// Workspace configuration — the public API type.
/// Stored as `<app_data>/workspaces/<hash>.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub version: u32,
    #[serde(rename = "excludeFolders")]
    pub exclude_folders: Vec<String>,
    #[serde(rename = "showHiddenFiles", default)]
    pub show_hidden_files: bool,
    #[serde(rename = "lastOpenTabs")]
    pub last_open_tabs: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity: Option<WorkspaceIdentity>,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            version: 1,
            exclude_folders: vec![".git".to_string(), "node_modules".to_string()],
            show_hidden_files: false,
            last_open_tabs: vec![],
            ai: None,
            identity: None,
        }
    }
}

// ============================================================================
// Path hashing
// ============================================================================

/// Hash a workspace root path to a deterministic 16-hex-char filename.
/// Normalizes trailing separators before hashing for cross-platform consistency.
fn hash_root_path(root_path: &str) -> String {
    let normalized = root_path
        .trim_end_matches('/')
        .trim_end_matches('\\');
    let hash = Sha256::digest(normalized.as_bytes());
    hash.iter()
        .take(8)
        .map(|b| format!("{:02x}", b))
        .collect()
}

/// Get the workspaces directory inside app data.
fn get_workspaces_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data.join("workspaces"))
}

/// Get the path to a workspace config file in app data.
fn get_workspace_config_path(
    app: &tauri::AppHandle,
    root_path: &str,
) -> Result<std::path::PathBuf, String> {
    let ws_dir = get_workspaces_dir(app)?;
    let hash = hash_root_path(root_path);
    Ok(ws_dir.join(format!("{hash}.json")))
}

// ============================================================================
// Legacy migration types (kept private)
// ============================================================================

/// VS Code-compatible workspace file — legacy `.tmark/tmark.code-workspace`.
#[derive(Debug, Deserialize)]
struct LegacyWorkspaceFile {
    #[serde(default)]
    settings: LegacyWorkspaceSettings,
}

#[derive(Debug, Deserialize, Default)]
struct LegacyWorkspaceSettings {
    #[serde(rename = "tmark.excludeFolders", default)]
    exclude_folders: Vec<String>,
    #[serde(rename = "tmark.showHiddenFiles", default)]
    show_hidden_files: bool,
    #[serde(rename = "tmark.lastOpenTabs", default)]
    last_open_tabs: Vec<String>,
    #[serde(rename = "tmark.ai", default)]
    ai: Option<serde_json::Value>,
    #[serde(rename = "tmark.identity", default)]
    identity: Option<WorkspaceIdentity>,
}

/// Ancient legacy workspace configuration (plain `.tmark` file).
#[derive(Debug, Deserialize)]
struct AncientLegacyConfig {
    #[serde(default)]
    version: u32,
    #[serde(rename = "excludeFolders", default)]
    exclude_folders: Vec<String>,
    #[serde(rename = "lastOpenTabs", default)]
    last_open_tabs: Vec<String>,
    #[serde(default)]
    ai: Option<serde_json::Value>,
}

// ============================================================================
// Legacy migration
// ============================================================================

/// Try to read config from legacy `.tmark/` directory or ancient `.tmark` file.
/// Returns `Ok(Some(config))` if found, `Ok(None)` if no legacy exists.
fn migrate_from_legacy(root_path: &str) -> Result<Option<WorkspaceConfig>, String> {
    let root = Path::new(root_path);
    let dot_tmark = root.join(".tmark");

    // 1. Try .tmark/tmark.code-workspace (directory format)
    if dot_tmark.is_dir() {
        let ws_file_path = dot_tmark.join("tmark.code-workspace");
        if ws_file_path.exists() {
            let content = fs::read_to_string(&ws_file_path)
                .map_err(|e| format!("Failed to read legacy workspace file: {e}"))?;
            let ws_file: LegacyWorkspaceFile = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse legacy workspace file: {e}"))?;

            // Strip ".tmark" from exclude_folders if present (no longer needed)
            let exclude_folders: Vec<String> = ws_file
                .settings
                .exclude_folders
                .into_iter()
                .filter(|f| f != ".tmark")
                .collect();

            return Ok(Some(WorkspaceConfig {
                version: 1,
                exclude_folders,
                show_hidden_files: ws_file.settings.show_hidden_files,
                last_open_tabs: ws_file.settings.last_open_tabs,
                ai: ws_file.settings.ai,
                identity: ws_file.settings.identity,
            }));
        }
    }

    // 2. Try .tmark as a plain file (ancient format)
    if dot_tmark.exists() && dot_tmark.is_file() {
        let content = fs::read_to_string(&dot_tmark)
            .map_err(|e| format!("Failed to read ancient .tmark: {e}"))?;
        let ancient: AncientLegacyConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse ancient .tmark: {e}"))?;

        let exclude_folders: Vec<String> = ancient
            .exclude_folders
            .into_iter()
            .filter(|f| f != ".tmark")
            .collect();

        return Ok(Some(WorkspaceConfig {
            version: ancient.version,
            exclude_folders,
            show_hidden_files: false,
            last_open_tabs: ancient.last_open_tabs,
            ai: ancient.ai,
            identity: None,
        }));
    }

    Ok(None)
}

/// Best-effort cleanup of legacy `.tmark/` in a workspace root.
/// Removes workspace file, then tries to remove the directory (only if empty).
fn cleanup_old_tmark(root_path: &str) {
    let root = Path::new(root_path);
    let dot_tmark = root.join(".tmark");

    if dot_tmark.is_dir() {
        // Remove known file
        let _ = fs::remove_file(dot_tmark.join("tmark.code-workspace"));
        // Try rmdir (fails if not empty — that's fine)
        let _ = fs::remove_dir(&dot_tmark);
    } else if dot_tmark.is_file() {
        let _ = fs::remove_file(&dot_tmark);
    }
}

// ============================================================================
// Tauri commands
// ============================================================================

/// Open folder dialog and return selected path.
#[tauri::command]
pub async fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<FilePath>>();

    app.dialog()
        .file()
        .set_title("Open Workspace")
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Dialog error: {e}")),
    }
}

/// Read workspace config from app data, with one-time migration from legacy `.tmark/`.
#[tauri::command]
pub fn read_workspace_config(
    app: tauri::AppHandle,
    root_path: &str,
) -> Result<Option<WorkspaceConfig>, String> {
    let ws_path = get_workspace_config_path(&app, root_path)?;

    // New location exists — read directly
    if ws_path.exists() {
        let content = fs::read_to_string(&ws_path)
            .map_err(|e| format!("Failed to read workspace config: {e}"))?;
        let config: WorkspaceConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse workspace config: {e}"))?;
        return Ok(Some(config));
    }

    // Try migrate from legacy locations
    if let Some(config) = migrate_from_legacy(root_path)? {
        // Write to new location — only cleanup old .tmark/ on success
        let ws_dir = get_workspaces_dir(&app)?;
        fs::create_dir_all(&ws_dir)
            .map_err(|e| format!("Failed to create workspaces dir: {e}"))?;
        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {e}"))?;

        if app_paths::atomic_write_file(&ws_path, content.as_bytes()).is_ok() {
            cleanup_old_tmark(root_path);
        }

        return Ok(Some(config));
    }

    Ok(None)
}

/// Write workspace config to `<app_data>/workspaces/<hash>.json`.
#[tauri::command]
pub fn write_workspace_config(
    app: tauri::AppHandle,
    root_path: &str,
    config: WorkspaceConfig,
) -> Result<(), String> {
    let ws_path = get_workspace_config_path(&app, root_path)?;

    // Ensure parent directory exists
    if let Some(parent) = ws_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create workspaces dir: {e}"))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    app_paths::atomic_write_file(&ws_path, content.as_bytes())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_hash_root_path_deterministic() {
        let h1 = hash_root_path("/Users/test/project");
        let h2 = hash_root_path("/Users/test/project");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 16); // 8 bytes = 16 hex chars
    }

    #[test]
    fn test_hash_root_path_normalizes_trailing_slash() {
        let h1 = hash_root_path("/Users/test/project");
        let h2 = hash_root_path("/Users/test/project/");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_root_path_normalizes_trailing_backslash() {
        let h1 = hash_root_path("C:\\Users\\test\\project");
        let h2 = hash_root_path("C:\\Users\\test\\project\\");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_root_path_different_paths_differ() {
        let h1 = hash_root_path("/Users/test/project-a");
        let h2 = hash_root_path("/Users/test/project-b");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_default_workspace_config() {
        let config = WorkspaceConfig::default();
        assert_eq!(config.version, 1);
        assert!(config.exclude_folders.contains(&".git".to_string()));
        assert!(config.exclude_folders.contains(&"node_modules".to_string()));
        assert!(!config.exclude_folders.contains(&".tmark".to_string()));
        assert!(!config.show_hidden_files);
        assert!(config.last_open_tabs.is_empty());
    }

    #[test]
    fn test_migrate_from_legacy_directory_format() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create .tmark/tmark.code-workspace
        let tmark_dir = root.join(".tmark");
        fs::create_dir_all(&tmark_dir).unwrap();
        let ws_content = r#"{
            "folders": [{"path": "."}],
            "settings": {
                "tmark.excludeFolders": [".git", "node_modules", ".tmark"],
                "tmark.showHiddenFiles": true,
                "tmark.lastOpenTabs": ["doc.md"]
            }
        }"#;
        fs::write(tmark_dir.join("tmark.code-workspace"), ws_content).unwrap();

        let config = migrate_from_legacy(root.to_str().unwrap())
            .unwrap()
            .unwrap();
        assert!(config.show_hidden_files);
        assert!(config.last_open_tabs.contains(&"doc.md".to_string()));
        // .tmark should be stripped from exclude_folders
        assert!(!config.exclude_folders.contains(&".tmark".to_string()));
        assert!(config.exclude_folders.contains(&".git".to_string()));
    }

    #[test]
    fn test_migrate_from_legacy_ancient_file_format() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create .tmark as plain file
        let legacy_content = r#"{
            "version": 1,
            "excludeFolders": ["legacy_folder", ".tmark"],
            "lastOpenTabs": ["old.md"]
        }"#;
        fs::write(root.join(".tmark"), legacy_content).unwrap();

        let config = migrate_from_legacy(root.to_str().unwrap())
            .unwrap()
            .unwrap();
        assert!(config.exclude_folders.contains(&"legacy_folder".to_string()));
        assert!(!config.exclude_folders.contains(&".tmark".to_string()));
        assert!(config.last_open_tabs.contains(&"old.md".to_string()));
    }

    #[test]
    fn test_migrate_from_legacy_nothing() {
        let dir = tempdir().unwrap();
        let result = migrate_from_legacy(dir.path().to_str().unwrap()).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_cleanup_old_tmark_directory() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create .tmark directory with workspace file
        let tmark_dir = root.join(".tmark");
        fs::create_dir_all(&tmark_dir).unwrap();
        fs::write(tmark_dir.join("tmark.code-workspace"), "{}").unwrap();

        cleanup_old_tmark(root.to_str().unwrap());

        // Directory should be removed (was empty after file removal)
        assert!(!tmark_dir.exists());
    }

    #[test]
    fn test_cleanup_old_tmark_directory_non_empty() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create .tmark directory with extra file
        let tmark_dir = root.join(".tmark");
        fs::create_dir_all(&tmark_dir).unwrap();
        fs::write(tmark_dir.join("tmark.code-workspace"), "{}").unwrap();
        fs::write(tmark_dir.join("other-file"), "keep").unwrap();

        cleanup_old_tmark(root.to_str().unwrap());

        // Directory should still exist (has other files)
        assert!(tmark_dir.exists());
        // But workspace file should be gone
        assert!(!tmark_dir.join("tmark.code-workspace").exists());
    }

    #[test]
    fn test_cleanup_old_tmark_file() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create .tmark as plain file
        fs::write(root.join(".tmark"), "{}").unwrap();

        cleanup_old_tmark(root.to_str().unwrap());

        assert!(!root.join(".tmark").exists());
    }

    #[test]
    fn test_workspace_config_serialization_roundtrip() {
        let config = WorkspaceConfig {
            version: 1,
            exclude_folders: vec!["test".to_string()],
            show_hidden_files: true,
            last_open_tabs: vec!["file.md".to_string()],
            ai: None,
            identity: None,
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        let back: WorkspaceConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(back.exclude_folders, config.exclude_folders);
        assert_eq!(back.show_hidden_files, config.show_hidden_files);
        assert_eq!(back.last_open_tabs, config.last_open_tabs);
    }
}
