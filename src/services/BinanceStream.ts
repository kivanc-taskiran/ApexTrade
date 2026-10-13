import { WS_ENDPOINTS } from '../config';
import { ConnectionStatus } from '../types';

type MessageHandler = (stream: string, data: any) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const MAX_BACKOFF_MS = 30_000;

/**
 * Thin, framework-agnostic wrapper around Binance's combined WebSocket stream.
 * - Exponential backoff reconnect (1s, 2s, 4s ... 30s)
 * - Rotates between endpoints on failure
 * - Never throws into the UI layer
 */
export class BinanceStream {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly streams: string[],
    private readonly onMessage: MessageHandler,
    private readonly onStatus: StatusHandler,
  ) {}

  connect(): void {
    if (this.disposed) return;
    this.onStatus('connecting');

    const endpoint = WS_ENDPOINTS[this.attempt % WS_ENDPOINTS.length];
    const ws = new WebSocket(`${endpoint}?streams=${this.streams.join('/')}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.onStatus('open');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.stream && msg?.data) this.onMessage(msg.stream, msg.data);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => this.onStatus('error');

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.disposed) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt);
    this.attempt += 1;
    this.onStatus('connecting');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onmessage = null;
      ws.close();
    }
    this.onStatus('closed');
  }
}
