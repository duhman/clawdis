use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};

/// Connection status for the tray
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connected,
    Connecting,
    Disconnected,
    Error,
}

/// Health status for the tray
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Token usage for display
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
}

/// App state for tray management
pub struct TrayState {
    tray: Mutex<Option<TrayIcon>>,
    status: Mutex<ConnectionStatus>,
    usage: Mutex<TokenUsage>,
    health: Mutex<HealthStatus>,
    latency: Mutex<Option<u64>>,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            tray: Mutex::new(None),
            status: Mutex::new(ConnectionStatus::Disconnected),
            usage: Mutex::new(TokenUsage::default()),
            health: Mutex::new(HealthStatus::Unknown),
            latency: Mutex::new(None),
        }
    }
}

/// Format token count with k/M suffixes
fn format_tokens(count: u64) -> String {
    if count >= 1_000_000 {
        format!("{:.1}M", count as f64 / 1_000_000.0)
    } else if count >= 1_000 {
        format!("{:.1}k", count as f64 / 1_000.0)
    } else {
        count.to_string()
    }
}

/// Build the tray menu with current connection status, usage, and health
fn build_tray_menu(
    app: &AppHandle,
    status: &ConnectionStatus,
    usage: &TokenUsage,
    health: &HealthStatus,
    latency: Option<u64>,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // Status indicator text
    let status_text = match status {
        ConnectionStatus::Connected => "● Connected",
        ConnectionStatus::Connecting => "○ Connecting...",
        ConnectionStatus::Disconnected => "○ Disconnected",
        ConnectionStatus::Error => "✕ Connection Error",
    };

    // Health indicator text
    let health_text = match health {
        HealthStatus::Healthy => match latency {
            Some(ms) => format!("♥ Healthy ({}ms)", ms),
            None => "♥ Healthy".to_string(),
        },
        HealthStatus::Degraded => match latency {
            Some(ms) => format!("◐ Degraded ({}ms)", ms),
            None => "◐ Degraded".to_string(),
        },
        HealthStatus::Unhealthy => "✕ Unhealthy".to_string(),
        HealthStatus::Unknown => "? Unknown".to_string(),
    };

    // Usage text (only show if there's usage)
    let usage_text = if usage.total_tokens > 0 {
        format!(
            "Tokens: {} (↓{} ↑{})",
            format_tokens(usage.total_tokens),
            format_tokens(usage.input_tokens),
            format_tokens(usage.output_tokens)
        )
    } else {
        "Tokens: —".to_string()
    };

    // Create menu items
    let status_item = MenuItem::with_id(app, "status", status_text, false, None::<&str>)?;
    let health_item = MenuItem::with_id(app, "health", &health_text, false, None::<&str>)?;
    let usage_item = MenuItem::with_id(app, "usage", &usage_text, false, None::<&str>)?;
    let new_chat = MenuItem::with_id(app, "new_chat", "New Chat", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Clawdis", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
    let quit = MenuItem::with_id(app, "quit", "Quit Clawdis", true, Some("CmdOrCtrl+Q"))?;

    // Build menu with separators
    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .item(&health_item)
        .item(&usage_item)
        .separator()
        .item(&new_chat)
        .separator()
        .item(&show)
        .item(&settings)
        .separator()
        .item(&quit)
        .build()?;

    Ok(menu)
}

/// Create the system tray with menu items
fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();
    let status = ConnectionStatus::Disconnected;
    let usage = TokenUsage::default();
    let health = HealthStatus::Unknown;
    let latency = None;
    let menu = build_tray_menu(&app_handle, &status, &usage, &health, latency)?;

    // Tooltip based on status
    let tooltip = "Clawdis - Disconnected";

    // Create the tray icon
    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .tooltip(tooltip)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            match id {
                "new_chat" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("tray-new-chat", ());
                    }
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("tray-settings", ());
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    // Store tray in state
    let state: State<TrayState> = app.state();
    *state.tray.lock().unwrap() = Some(tray);
    *state.status.lock().unwrap() = status;

    Ok(())
}

/// Helper to rebuild the tray menu with current state
fn rebuild_tray_menu(app: &AppHandle, state: &TrayState) -> Result<(), String> {
    let status = state.status.lock().unwrap().clone();
    let usage = state.usage.lock().unwrap().clone();
    let health = state.health.lock().unwrap().clone();
    let latency = *state.latency.lock().unwrap();

    // Update tooltip
    let tooltip = match &status {
        ConnectionStatus::Connected => "Clawdis - Connected",
        ConnectionStatus::Connecting => "Clawdis - Connecting...",
        ConnectionStatus::Disconnected => "Clawdis - Disconnected",
        ConnectionStatus::Error => "Clawdis - Connection Error",
    };

    // Rebuild menu
    let menu = build_tray_menu(app, &status, &usage, &health, latency).map_err(|e| e.to_string())?;

    // Update tray
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Update the tray connection status (called from frontend)
#[tauri::command]
fn set_tray_status(app: AppHandle, state: State<TrayState>, status: ConnectionStatus) -> Result<(), String> {
    *state.status.lock().unwrap() = status;
    rebuild_tray_menu(&app, &state)
}

/// Update the tray token usage (called from frontend)
#[tauri::command]
fn set_tray_usage(app: AppHandle, state: State<TrayState>, usage: TokenUsage) -> Result<(), String> {
    *state.usage.lock().unwrap() = usage;
    rebuild_tray_menu(&app, &state)
}

/// Health info for tray update
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthInfo {
    pub status: HealthStatus,
    pub latency: Option<u64>,
}

/// Update the tray health status (called from frontend)
#[tauri::command]
fn set_tray_health(app: AppHandle, state: State<TrayState>, health: HealthInfo) -> Result<(), String> {
    *state.health.lock().unwrap() = health.status;
    *state.latency.lock().unwrap() = health.latency;
    rebuild_tray_menu(&app, &state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(TrayState::default())
        .invoke_handler(tauri::generate_handler![set_tray_status, set_tray_usage, set_tray_health])
        .setup(|app| {
            create_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
