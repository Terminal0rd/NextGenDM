use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;

/// A token-bucket based global bandwidth limiter.
/// It uses a semaphore where 1 permit = 1 byte of bandwidth.
pub struct GlobalBandwidthLimiter {
    semaphore: Arc<Semaphore>,
    limit_bps: AtomicU64,
}

impl GlobalBandwidthLimiter {
    pub fn new() -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(0)),
            limit_bps: AtomicU64::new(0),
        }
    }

    /// Update the global speed limit in bytes per second.
    /// A limit of 0 means unlimited.
    pub fn set_limit(&self, bps: u64) {
        self.limit_bps.store(bps, Ordering::Relaxed);
    }

    /// Consume bytes from the bandwidth pool.
    /// If the pool is empty, this will block (await) until tokens are replenished.
    pub async fn acquire(&self, bytes: usize) {
        let limit = self.limit_bps.load(Ordering::Relaxed);
        if limit == 0 {
            return;
        }

        let mut needed = bytes as u32;
        while needed > 0 {
            // acquire_many max is u32::MAX, but we acquire in smaller chunks
            // to avoid blocking indefinitely for huge chunks.
            let acquire_amt = std::cmp::min(needed, 1_000_000);
            if let Ok(permit) = self.semaphore.acquire_many(acquire_amt).await {
                permit.forget();
                needed -= acquire_amt;
            } else {
                break; // Semaphore closed
            }
        }
    }

    /// Spawns a background task that adds bandwidth tokens periodically.
    pub fn start_replenish_task(self: Arc<Self>) {
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(50));
            loop {
                interval.tick().await;
                let limit = self.limit_bps.load(Ordering::Relaxed);
                
                if limit > 0 {
                    // Replenish 20 times a second (50ms)
                    let tokens_to_add = (limit / 20) as usize;
                    let current = self.semaphore.available_permits();
                    // Cap burst capacity to 1 second of bandwidth
                    let cap = limit as usize;
                    
                    if current < cap {
                        let add = std::cmp::min(tokens_to_add, cap - current);
                        if add > 0 {
                            self.semaphore.add_permits(add);
                        }
                    }
                } else {
                    // If unlimited, drain permits so it doesn't overflow if enabled later
                    let current = self.semaphore.available_permits();
                    if current > 0 {
                        if let Ok(permit) = self.semaphore.try_acquire_many(current as u32) {
                            permit.forget();
                        }
                    }
                }
            }
        });
    }
}
