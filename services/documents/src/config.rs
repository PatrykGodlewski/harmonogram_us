use std::net::SocketAddr;

/// The shortest service token accepted, in bytes.
const MIN_TOKEN_BYTES: usize = 32;

/// Settings read from the environment at start-up.
#[derive(Debug, Clone)]
pub struct Config {
    /// Bearer token every caller must send (`DOCUMENTS_TOKEN`).
    pub token: String,
    /// Default `[::]:50051`: IPv6 any, which also accepts IPv4 (Railway's private
    /// network may be IPv6-only).
    pub grpc_addr: SocketAddr,
    pub metrics_addr: SocketAddr,
    /// Bearer token for `/metrics`; `None` hides the endpoint.
    pub metrics_token: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    TokenTooShort,
    InvalidAddress(&'static str),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TokenTooShort => write!(
                f,
                "DOCUMENTS_TOKEN must be set to at least {MIN_TOKEN_BYTES} bytes"
            ),
            Self::InvalidAddress(name) => write!(f, "{name} is not a valid socket address"),
        }
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    /// Reads the settings through `get` (the process environment in production).
    pub fn from_env(get: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let token = get("DOCUMENTS_TOKEN").unwrap_or_default();
        if token.len() < MIN_TOKEN_BYTES {
            return Err(ConfigError::TokenTooShort);
        }
        let addr = |name: &'static str, default: &str| {
            get(name)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| default.to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidAddress(name))
        };
        Ok(Self {
            token,
            grpc_addr: addr("DOCUMENTS_GRPC_ADDR", "[::]:50051")?,
            metrics_addr: addr("DOCUMENTS_METRICS_ADDR", "[::]:9464")?,
            metrics_token: get("METRICS_TOKEN").filter(|value| !value.is_empty()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn env(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        move |key| map.get(key).cloned()
    }

    const TOKEN: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn refuses_short_token() {
        let result = Config::from_env(env(&[("DOCUMENTS_TOKEN", &TOKEN[..31])]));
        assert_eq!(result.unwrap_err(), ConfigError::TokenTooShort);
    }

    #[test]
    fn refuses_missing_token() {
        assert_eq!(
            Config::from_env(env(&[])).unwrap_err(),
            ConfigError::TokenTooShort
        );
    }

    #[test]
    fn defaults_ports() {
        let config = Config::from_env(env(&[("DOCUMENTS_TOKEN", TOKEN)])).unwrap();
        // IPv6 any (also accepts IPv4): Railway's private network may be IPv6-only.
        assert_eq!(config.grpc_addr, "[::]:50051".parse().unwrap());
        assert_eq!(config.metrics_addr, "[::]:9464".parse().unwrap());
    }

    #[test]
    fn reads_metrics_token() {
        let empty =
            Config::from_env(env(&[("DOCUMENTS_TOKEN", TOKEN), ("METRICS_TOKEN", "")])).unwrap();
        assert_eq!(empty.metrics_token, None);
        let set =
            Config::from_env(env(&[("DOCUMENTS_TOKEN", TOKEN), ("METRICS_TOKEN", "m")])).unwrap();
        assert_eq!(set.metrics_token.as_deref(), Some("m"));
    }
}
