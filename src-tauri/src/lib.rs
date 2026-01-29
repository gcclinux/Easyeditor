use tauri::Emitter;
use std::env;

mod oauth;
use oauth::*;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Command to get command line arguments
#[tauri::command]
fn get_command_line_args() -> Vec<String> {
    env::args().collect()
}

// Command to open a file from command line
#[tauri::command]
fn open_file_from_args(_app_handle: tauri::AppHandle) -> Option<String> {
    let args: Vec<String> = env::args().collect();
    
    // Skip the first argument (executable path) and look for file arguments
    for arg in args.iter().skip(1) {
        if arg.ends_with(".md") || arg.ends_with(".markdown") || 
           arg.ends_with(".mdown") || arg.ends_with(".mkd") || 
           arg.ends_with(".mkdn") || arg.ends_with(".mdwn") || 
           arg.ends_with(".mdtxt") || arg.ends_with(".mdtext") ||
           arg.ends_with(".sstp") || arg.ends_with(".txt") {
            return Some(arg.clone());
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set WebKit environment variables for Linux to fix rendering issues
    // with certain GPU drivers (especially on Wayland or with hardware acceleration)
    #[cfg(target_os = "linux")]
    {
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(OAuthManagerState::default())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_command_line_args, 
            open_file_from_args,
            oauth_authenticate,
            oauth_get_status,
            oauth_get_all_status,
            oauth_logout,
            oauth_get_providers,
            oauth_refresh_tokens,
            oauth_get_flow_status,
            oauth_update_flow_status,
            oauth_complete_flow,
            oauth_handle_error,
            oauth_get_last_error,
            oauth_clear_errors,
            oauth_validate_config,
            oauth_get_config_status,
            oauth_start_server
        ])
        .setup(|app| {
            // Handle file opening on startup
            let args: Vec<String> = env::args().collect();
            
            // Check if a markdown file was passed as argument
            for arg in args.iter().skip(1) {
                if arg.ends_with(".md") || arg.ends_with(".markdown") || 
                   arg.ends_with(".mdown") || arg.ends_with(".mkd") || 
                   arg.ends_with(".mkdn") || arg.ends_with(".mdwn") || 
                   arg.ends_with(".mdtxt") || arg.ends_with(".mdtext") ||
                   arg.ends_with(".sstp") || arg.ends_with(".txt") {
                    
                    // Emit an event to the frontend with the file path
                    let _ = app.emit("open-file", arg);
                    break;
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}