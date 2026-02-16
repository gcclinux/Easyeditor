fn main() {
    // Skip tauri_build during `cargo publish` verification to avoid modifying
    // the source directory outside of OUT_DIR. During verification, cargo builds
    // from inside target/package/<crate>-<version>/, so we detect that path.
    // This does NOT skip during `cargo install` (which uses /tmp/cargo-install*/).
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    if manifest_dir.contains("target/package") || manifest_dir.contains("target\\package") {
        return;
    }
    tauri_build::build()
}