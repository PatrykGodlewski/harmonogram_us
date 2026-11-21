//! A bounded render pool: at most `workers` renders at once and `queue` more waiting;
//! anything beyond is refused at once, so a burst cannot exhaust memory.

use prometheus_client::metrics::gauge::Gauge;
use std::sync::Arc;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

#[derive(Clone)]
pub struct Admission {
    slots: Arc<Semaphore>,
    workers: Arc<Semaphore>,
    in_use: Gauge,
}

/// A place in the pool, held for the whole request.
pub struct Ticket {
    _slot: OwnedSemaphorePermit,
    workers: Arc<Semaphore>,
    in_use: Gauge,
}

impl Admission {
    pub fn new(workers: usize, queue: usize) -> Self {
        Self {
            slots: Arc::new(Semaphore::new(workers + queue)),
            workers: Arc::new(Semaphore::new(workers)),
            in_use: Gauge::default(),
        }
    }

    /// One render per CPU, eight waiting per CPU.
    pub fn for_this_machine() -> Self {
        let cpus = std::thread::available_parallelism().map_or(1, usize::from);
        Self::new(cpus, cpus * 8)
    }

    /// A place in the pool, or `None` when it is full.
    pub fn try_enter(&self) -> Option<Ticket> {
        let slot = self.slots.clone().try_acquire_owned().ok()?;
        self.in_use.inc();
        Some(Ticket {
            _slot: slot,
            workers: self.workers.clone(),
            in_use: self.in_use.clone(),
        })
    }

    /// Requests holding a place (rendering or waiting), for the metrics.
    pub fn in_use(&self) -> Gauge {
        self.in_use.clone()
    }
}

impl Drop for Ticket {
    fn drop(&mut self) {
        self.in_use.dec();
    }
}

impl Ticket {
    /// Runs `work` on the blocking pool once a worker is free.
    pub async fn run<T: Send + 'static>(self, work: impl FnOnce() -> T + Send + 'static) -> T {
        let _worker = self
            .workers
            .clone()
            .acquire_owned()
            .await
            .expect("the worker semaphore is never closed");
        tokio::task::spawn_blocking(work)
            .await
            .expect("rendering does not panic")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_beyond_capacity() {
        let admission = Admission::new(1, 1);
        let first = admission.try_enter();
        let second = admission.try_enter();
        assert!(first.is_some() && second.is_some());
        assert!(admission.try_enter().is_none());
        assert_eq!(admission.in_use().get(), 2);
        drop(first);
        assert_eq!(admission.in_use().get(), 1);
        assert!(admission.try_enter().is_some());
    }
}
