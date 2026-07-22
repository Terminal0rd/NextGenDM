export interface AppSettings {
  default_download_path: string;
  max_concurrent_downloads: number;
  max_connections_per_download: number;
  speed_limit_bytes_per_sec: number;
  connect_timeout_secs: number;
  read_timeout_secs: number;
  user_agent: string;
  theme: string;
  language: string;
  auto_start_downloads: boolean;
  show_notifications: boolean;
  routing_rules: Record<string, string>;
  scheduler_enabled: boolean;
  scheduler_start_time: string;
  scheduler_stop_time: string;
  scheduler_shutdown: boolean;
}

export type AppSettingsUpdate = Partial<AppSettings>;
