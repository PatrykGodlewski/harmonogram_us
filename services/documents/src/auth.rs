//! Service-to-service authentication: a shared bearer token per service.

use subtle::ConstantTimeEq;
use tonic::Status;
use tonic::metadata::MetadataMap;

/// `Ok` when the call carries `authorization: Bearer <token>`.
pub fn check(metadata: &MetadataMap, token: &str) -> Result<(), Status> {
    let sent = metadata
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    if bool::from(sent.as_bytes().ct_eq(token.as_bytes())) {
        Ok(())
    } else {
        Err(Status::unauthenticated("missing or wrong service token"))
    }
}
