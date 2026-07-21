//! Progress tracking utilities — speed calculation, ETA estimation,
//! and a combined progress tracker used during active downloads.

use std::collections::VecDeque;
use std::time::Instant;

// ─── SpeedCalculator ────────────────────────────────────────────────────────

/// Computes download speed using a sliding window of byte samples
/// over the most recent 5 seconds.
#[derive(Debug)]
pub struct SpeedCalculator {
    /// Ring of `(timestamp, cumulative_bytes_at_that_instant)` samples.
    samples: VecDeque<(Instant, u64)>,
    /// Total bytes recorded through this calculator.
    total_bytes: u64,
    /// Width of the sliding window.
    window: std::time::Duration,
}

impl SpeedCalculator {
    /// Create a new calculator with a 5-second sliding window.
    pub fn new() -> Self {
        Self {
            samples: VecDeque::with_capacity(256),
            total_bytes: 0,
            window: std::time::Duration::from_secs(5),
        }
    }

    /// Record that `bytes` additional bytes have been received.
    pub fn record_bytes(&mut self, bytes: u64) {
        self.total_bytes += bytes;
        let now = Instant::now();
        self.samples.push_back((now, self.total_bytes));
        self.prune(now);
    }

    /// Return the current download speed in bytes/second.
    pub fn get_speed(&mut self) -> f64 {
        let now = Instant::now();
        self.prune(now);

        if self.samples.len() < 2 {
            return 0.0;
        }

        let (oldest_time, oldest_bytes) = self.samples.front().copied().unwrap();
        let (newest_time, newest_bytes) = self.samples.back().copied().unwrap();

        let elapsed = newest_time.duration_since(oldest_time).as_secs_f64();
        if elapsed < 0.001 {
            return 0.0;
        }

        (newest_bytes - oldest_bytes) as f64 / elapsed
    }

    /// Discard samples older than the sliding window.
    fn prune(&mut self, now: Instant) {
        let cutoff = now.checked_sub(self.window).unwrap_or(now);
        while let Some(&(t, _)) = self.samples.front() {
            if t < cutoff && self.samples.len() > 1 {
                self.samples.pop_front();
            } else {
                break;
            }
        }
    }

    /// Reset the calculator (e.g. after a pause/resume).
    pub fn reset(&mut self) {
        self.samples.clear();
        self.total_bytes = 0;
    }
}

// ─── EtaCalculator ──────────────────────────────────────────────────────────

/// Simple ETA estimator.
pub struct EtaCalculator;

impl EtaCalculator {
    /// Given the current speed (bytes/sec) and remaining bytes,
    /// return the estimated time of arrival in seconds.
    ///
    /// Returns `None` if speed is zero or remaining bytes is unknown.
    pub fn calculate(speed: f64, remaining_bytes: Option<u64>) -> Option<f64> {
        match remaining_bytes {
            Some(remaining) if speed > 0.1 => Some(remaining as f64 / speed),
            _ => None,
        }
    }
}

// ─── ProgressTracker ────────────────────────────────────────────────────────

/// Combines speed calculation with total/downloaded byte tracking.
#[derive(Debug)]
pub struct ProgressTracker {
    speed_calc: SpeedCalculator,
    total_bytes: Option<u64>,
    downloaded_bytes: u64,
}

impl ProgressTracker {
    /// Create a new tracker.
    ///
    /// `total_bytes` may be `None` if the server did not report Content-Length.
    pub fn new(total_bytes: Option<u64>) -> Self {
        Self {
            speed_calc: SpeedCalculator::new(),
            total_bytes,
            downloaded_bytes: 0,
        }
    }

    /// Create a tracker pre-seeded with bytes already downloaded (for resume).
    pub fn with_initial(total_bytes: Option<u64>, already_downloaded: u64) -> Self {
        Self {
            speed_calc: SpeedCalculator::new(),
            total_bytes,
            downloaded_bytes: already_downloaded,
        }
    }

    /// Record newly received bytes.
    pub fn update(&mut self, new_bytes: u64) {
        self.downloaded_bytes += new_bytes;
        self.speed_calc.record_bytes(new_bytes);
    }

    /// Return `(speed_bps, percentage, eta_seconds)`.
    pub fn get_progress(&mut self) -> (f64, f64, Option<f64>) {
        let speed = self.speed_calc.get_speed();

        let percentage = match self.total_bytes {
            Some(total) if total > 0 => {
                (self.downloaded_bytes as f64 / total as f64 * 100.0).min(100.0)
            }
            _ => 0.0,
        };

        let remaining = self
            .total_bytes
            .map(|t| t.saturating_sub(self.downloaded_bytes));

        let eta = EtaCalculator::calculate(speed, remaining);

        (speed, percentage, eta)
    }

    /// The total bytes downloaded so far.
    pub fn downloaded(&self) -> u64 {
        self.downloaded_bytes
    }

    /// The total expected size, if known.
    pub fn total(&self) -> Option<u64> {
        self.total_bytes
    }

    /// Update the total bytes (e.g. after receiving Content-Length on a redirect).
    pub fn set_total(&mut self, total: u64) {
        self.total_bytes = Some(total);
    }

    /// Reset the speed calculator (useful after pause/resume).
    pub fn reset_speed(&mut self) {
        self.speed_calc.reset();
    }
}
