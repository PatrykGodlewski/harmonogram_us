//! Compiles the shared contract in `packages/proto/` (no system `protoc` needed).
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_root = "../../packages/proto";
    println!("cargo:rerun-if-changed={proto_root}");
    let files = protox::compile(
        [format!(
            "{proto_root}/harmonogram/documents/v1/documents.proto"
        )],
        [proto_root],
    )?;
    tonic_prost_build::configure().compile_fds(files)?;
    Ok(())
}
