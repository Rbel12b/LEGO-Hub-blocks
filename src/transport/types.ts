export type TransportKind = "ble" | "serial" | "mock";

export interface TransportInfo {
  name: string;
  mtu?: number;
}

export type DataListener = (chunk: Uint8Array) => void;
export type Unsubscribe = () => void;

export interface Transport {
  readonly kind: TransportKind;
  readonly info: TransportInfo;
  readonly connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(chunk: Uint8Array): Promise<void>;
  onData(cb: DataListener): Unsubscribe;
  onDisconnect(cb: () => void): Unsubscribe;
}

export class TransportError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "TransportError";
    this.cause = cause;
  }
}
