//! A bounded render pool: at most `workers` renders at once and `queue` more waiting;
//! anything beyond is refused at once, so a burst cannot exhaust memory.

use std::sync::Arc;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

#[derive(Clone)]
pub struct Admission {
    slots: Arc<Semaphore>,
    workers: Arc<Semaphore>,
}

/// A place in the pool, held for the whole request.
pub struct Ticket {
    _slot: OwnedSemaphorePermit,
    workers: Arc<Semaphore>,
}

impl Admission {
    pub fn new(workers: usize, queue: usize) -> Self {
        Self {
            slots: Arc::new(Semaphore::new(workers + queue)),
            workers: Arc::new(Semaphore::new(workers)),
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
        Some(Ticket {
            _slot: slot,
            workers: self.workers.clone(),
        })
    }
}

impl Ticket {
    /// Runs `work` on the blocking pool once a worker is free.
    pub async fn run<T: Send + 'static>(self, work: impl FnOnce() -> T + Send + 'static) -> T {
        let _worker = self
            .workers
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
        drop(first);
        assert!(admission.try_enter().is_some());
    }
}
