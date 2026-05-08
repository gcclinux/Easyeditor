use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

/// OAuth token structure for Tauri communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: String, // ISO date string
    pub scope: String,
    pub token_type: String,
}

/// OAuth authentication result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthResult {
    pub success: bool,
    pub provider: String,
    pub tokens: Option<OAuthTokens>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// OAuth authentication status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthStatus {
    pub provider: String,
    pub is_authenticated: bool,
    pub expires_at: Option<String>,
    pub last_refresh: Option<String>,
}

/// OAuth provider information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthProvider {
    pub name: String,
    pub display_name: String,
    pub enabled: bool,
}

/// OAuth authentication request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthAuthRequest {
    pub provider: String,
    pub force_reauth: Option<bool>,
}

/// OAuth logout request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthLogoutRequest {
    pub provider: String,
    pub revoke_tokens: Option<bool>,
}

/// OAuth state management for tracking active flows
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct OAuthFlowState {
    pub flow_id: String,
    pub provider: String,
    pub started_at: std::time::SystemTime,
    pub status: String,
}

/// OAuth manager state for Tauri
pub struct OAuthManagerState {
    pub active_flows: Mutex<HashMap<String, OAuthFlowState>>,
    pub last_error: Mutex<Option<String>>,
}

impl Default for OAuthManagerState {
    fn default() -> Self {
        Self {
            active_flows: Mutex::new(HashMap::new()),
            last_error: Mutex::new(None),
        }
    }
}

/// Initiate OAuth authentication flow
/// Requirements: 1.1, 6.1
#[tauri::command]
pub async fn oauth_authenticate(
    app_handle: AppHandle,
    state: State<'_, OAuthManagerState>,
    request: OAuthAuthRequest,
) -> Result<String, String> {
    let flow_id = Uuid::new_v4().to_string();
    
    // Create flow state
    let flow_state = OAuthFlowState {
        flow_id: flow_id.clone(),
        provider: request.provider.clone(),
        started_at: std::time::SystemTime::now(),
        status: "initiated".to_string(),
    };
    
    // Store active flow
    {
        let mut active_flows = state.active_flows.lock().unwrap();
        active_flows.insert(flow_id.clone(), flow_state);
    }
    
    // Emit event to frontend to start OAuth flow
    let _ = app_handle.emit("oauth-flow-started", serde_json::json!({
        "flow_id": flow_id,
        "provider": request.provider,
        "force_reauth": request.force_reauth.unwrap_or(false)
    }));
    
    Ok(flow_id)
}

/// Check OAuth authentication status for a provider
/// Requirements: 1.5, 6.4
#[tauri::command]
pub async fn oauth_get_status(
    app_handle: AppHandle,
    provider: String,
) -> Result<OAuthStatus, String> {
    // Emit event to frontend to check status
    let _ = app_handle.emit("oauth-status-requested", serde_json::json!({
        "provider": provider
    }));
    
    // For now, return a placeholder - the frontend will handle the actual status check
    // and update through events
    Ok(OAuthStatus {
        provider: provider.clone(),
        is_authenticated: false,
        expires_at: None,
        last_refresh: None,
    })
}

/// Get authentication status for all providers
/// Requirements: 1.5
#[tauri::command]
pub async fn oauth_get_all_status(
    app_handle: AppHandle,
) -> Result<Vec<OAuthStatus>, String> {
    // Emit event to frontend to get all status
    let _ = app_handle.emit("oauth-all-status-requested", serde_json::json!({}));
    
    // Return empty vec - frontend will populate through events
    Ok(vec![])
}

/// Logout from OAuth provider
/// Requirements: 4.4, 7.5
#[tauri::command]
pub async fn oauth_logout(
    app_handle: AppHandle,
    request: OAuthLogoutRequest,
) -> Result<bool, String> {
    // Emit event to frontend to handle logout
    let _ = app_handle.emit("oauth-logout-requested", serde_json::json!({
        "provider": request.provider,
        "revoke_tokens": request.revoke_tokens.unwrap_or(false)
    }));
    
    Ok(true)
}

/// Get list of available OAuth providers
/// Requirements: 5.1
#[tauri::command]
pub async fn oauth_get_providers(
    app_handle: AppHandle,
) -> Result<Vec<OAuthProvider>, String> {
    // Emit event to frontend to get providers
    let _ = app_handle.emit("oauth-providers-requested", serde_json::json!({}));
    
    // Return empty vec - frontend will populate through events
    Ok(vec![])
}

/// Refresh tokens for a provider
/// Requirements: 4.2, 4.3
#[tauri::command]
pub async fn oauth_refresh_tokens(
    app_handle: AppHandle,
    provider: String,
) -> Result<bool, String> {
    // Emit event to frontend to refresh tokens
    let _ = app_handle.emit("oauth-refresh-requested", serde_json::json!({
        "provider": provider
    }));
    
    Ok(true)
}

/// Get OAuth flow status
#[tauri::command]
pub async fn oauth_get_flow_status(
    state: State<'_, OAuthManagerState>,
    flow_id: String,
) -> Result<Option<String>, String> {
    let active_flows = state.active_flows.lock().unwrap();
    
    if let Some(flow) = active_flows.get(&flow_id) {
        Ok(Some(flow.status.clone()))
    } else {
        Ok(None)
    }
}

/// Update OAuth flow status (called by frontend)
#[tauri::command]
pub async fn oauth_update_flow_status(
    state: State<'_, OAuthManagerState>,
    flow_id: String,
    status: String,
) -> Result<(), String> {
    let mut active_flows = state.active_flows.lock().unwrap();
    
    if let Some(flow) = active_flows.get_mut(&flow_id) {
        flow.status = status;
    }
    
    Ok(())
}

/// Complete OAuth flow (called by frontend when flow completes)
#[tauri::command]
pub async fn oauth_complete_flow(
    app_handle: AppHandle,
    state: State<'_, OAuthManagerState>,
    flow_id: String,
    result: OAuthResult,
) -> Result<(), String> {
    // Remove flow from active flows
    {
        let mut active_flows = state.active_flows.lock().unwrap();
        active_flows.remove(&flow_id);
    }
    
    // Emit completion event
    let _ = app_handle.emit("oauth-flow-completed", serde_json::json!({
        "flow_id": flow_id,
        "result": result
    }));
    
    Ok(())
}

/// Handle OAuth errors
#[tauri::command]
pub async fn oauth_handle_error(
    app_handle: AppHandle,
    state: State<'_, OAuthManagerState>,
    flow_id: Option<String>,
    error: String,
    error_description: Option<String>,
) -> Result<(), String> {
    // Store last error
    {
        let mut last_error = state.last_error.lock().unwrap();
        *last_error = Some(error.clone());
    }
    
    // Remove flow if provided
    if let Some(flow_id) = &flow_id {
        let mut active_flows = state.active_flows.lock().unwrap();
        active_flows.remove(flow_id);
    }
    
    // Emit error event
    let _ = app_handle.emit("oauth-error", serde_json::json!({
        "flow_id": flow_id,
        "error": error,
        "error_description": error_description
    }));
    
    Ok(())
}

/// Get last OAuth error
#[tauri::command]
pub async fn oauth_get_last_error(
    state: State<'_, OAuthManagerState>,
) -> Result<Option<String>, String> {
    let last_error = state.last_error.lock().unwrap();
    Ok(last_error.clone())
}

/// Clear OAuth errors
#[tauri::command]
pub async fn oauth_clear_errors(
    state: State<'_, OAuthManagerState>,
) -> Result<(), String> {
    let mut last_error = state.last_error.lock().unwrap();
    *last_error = None;
    
    Ok(())
}

/// Validate OAuth configuration
#[tauri::command]
pub async fn oauth_validate_config(
    app_handle: AppHandle,
) -> Result<bool, String> {
    // Emit event to frontend to validate config
    let _ = app_handle.emit("oauth-config-validation-requested", serde_json::json!({}));
    
    Ok(true)
}

/// Get OAuth configuration status
#[tauri::command]
pub async fn oauth_get_config_status(
    app_handle: AppHandle,
) -> Result<HashMap<String, bool>, String> {
    // Emit event to frontend to get config status
    let _ = app_handle.emit("oauth-config-status-requested", serde_json::json!({}));
    
    // Return empty map - frontend will populate through events
    Ok(HashMap::new())
}

/// Token exchange request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenExchangeRequest {
    pub code: String,
    pub redirect_uri: String,
    pub code_verifier: String,
    pub client_id: String,
    pub token_url: String,
    pub scope: Option<String>,
    pub grant_type: Option<String>,
    pub refresh_token: Option<String>,
}

/// Token exchange response sent back to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenExchangeResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Exchange an OAuth authorization code for tokens using a native HTTP request.
/// This avoids the AADSTS90023 error that occurs when the token exchange is
/// performed from a browser context (cross-origin fetch).
#[tauri::command]
pub async fn oauth_exchange_code(
    request: OAuthTokenExchangeRequest,
) -> Result<OAuthTokenExchangeResponse, String> {
    let client = Client::new();

    let grant_type = request.grant_type.as_deref().unwrap_or("authorization_code");

    let mut params: Vec<(&str, String)> = vec![
        ("grant_type", grant_type.to_string()),
        ("client_id", request.client_id.clone()),
    ];

    if grant_type == "refresh_token" {
        // Refresh token grant
        if let Some(ref rt) = request.refresh_token {
            if !rt.is_empty() {
                params.push(("refresh_token", rt.clone()));
            }
        }
    } else {
        // Authorization code grant (default)
        params.push(("code", request.code.clone()));
        params.push(("redirect_uri", request.redirect_uri.clone()));
        if !request.code_verifier.is_empty() {
            params.push(("code_verifier", request.code_verifier.clone()));
        }
    }

    if let Some(scope) = &request.scope {
        if !scope.is_empty() {
            params.push(("scope", scope.clone()));
        }
    }

    let response = client
        .post(&request.token_url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    Ok(OAuthTokenExchangeResponse {
        access_token: body["access_token"].as_str().map(String::from),
        refresh_token: body["refresh_token"].as_str().map(String::from),
        expires_in: body["expires_in"].as_u64(),
        token_type: body["token_type"].as_str().map(String::from),
        scope: body["scope"].as_str().map(String::from),
        error: body["error"].as_str().map(String::from),
        error_description: body["error_description"].as_str().map(String::from),
    })
}

/// Start a local HTTP server for OAuth callback
#[tauri::command]
pub async fn oauth_start_server(
    app_handle: AppHandle,
    port: u16,
) -> Result<String, String> {
    let addr = format!("127.0.0.1:{}", port);
    
    // Bind first to ensure port is available and to get the listener
    // This allows us to return an error if the port is in use
    let listener = tokio::net::TcpListener::bind(&addr).await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;
        
    // Spawn task to handle the connection
    tauri::async_runtime::spawn(async move {
        // Accept a single connection
        if let Ok((mut socket, _)) = listener.accept().await {
            let mut buffer = [0; 2048]; // Buffer for request
            if let Ok(n) = tokio::io::AsyncReadExt::read(&mut socket, &mut buffer).await {
                let request = String::from_utf8_lossy(&buffer[..n]);
                
                let url_part = request.lines().next().unwrap_or("");
                
                let mut callback_params = std::collections::HashMap::new();
                
                if let Some(idx) = url_part.find('?') {
                    let query = &url_part[idx+1..];
                    if let Some(end_idx) = query.find(' ') {
                        let query_str = &query[..end_idx];
                        for pair in query_str.split('&') {
                            if let Some((key, value)) = pair.split_once('=') {
                                // URL-decode the value (replace %XX sequences)
                                let decoded_value = urlencoding::decode(value)
                                    .unwrap_or_else(|_| std::borrow::Cow::Borrowed(value))
                                    .into_owned();
                                callback_params.insert(key.to_string(), decoded_value);
                            }
                        }
                    }
                }
                
                // Send nice response
                let response_body = "<html><body><h1>Authenticated!</h1><p>You can close this window now.</p><script>window.close()</script></body></html>";
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", 
                    response_body.len(), 
                    response_body
                );
                
                let _ = tokio::io::AsyncWriteExt::write_all(&mut socket, response.as_bytes()).await;
                
                // Emit event with params
                let _ = app_handle.emit("oauth-server-callback", callback_params);
            }
        }
    });

    // Use localhost for Microsoft OAuth compatibility (they reject 127.0.0.1)
    Ok(format!("http://localhost:{}/callback", port))
}