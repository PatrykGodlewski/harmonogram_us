//! The documents service: renders the app's PDFs over gRPC.
#![forbid(unsafe_code)]

pub mod config;
pub mod fonts;
pub mod layout;
pub mod qr;
pub mod ticket;

/// Generated from `proto/harmonogram/documents/v1/documents.proto`.
pub mod proto {
    tonic::include_proto!("harmonogram.documents.v1");
}
