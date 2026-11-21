#![forbid(unsafe_code)]

use documents::config::Config;

fn main() {
    if let Err(error) = Config::from_env(|key| std::env::var(key).ok()) {
        eprintln!("documents: {error}");
        std::process::exit(1);
    }
}
