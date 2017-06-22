const DEBOUNCE_TIME = 5000 // millisecond
const DEFAULT_DELAY = 500 // millisecond
const RETRY_TIMES = 3
const DEFAULT_PORT = 3721
const LOG_CONFIG_PATH = '/etc/rsyslog.d/99-smbaudit.conf'
const LOG_CONFIG = 'LOCAL7.*    @127.0.0.1:3721'

export {
  DEBOUNCE_TIME,
  DEFAULT_DELAY,
  RETRY_TIMES,
  DEFAULT_PORT,
  LOG_CONFIG_PATH,
  LOG_CONFIG,
}