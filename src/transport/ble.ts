import type { DataListener, Transport, TransportInfo, Unsubscribe } from "./types";
import { TransportError } from "./types";

export const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // host -> device (write)
export const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // device -> host (notify)

// Safe chunk = ATT MTU (23) - 3 opcode/handle bytes. Larger writes are rejected
// unless MTU negotiation upgrades the link; without a reliable banner from the
// device we stick to the safe minimum. Trade-off: slower uploads.
const DEFAULT_CHUNK = 20;
const BANNER_PREFIX = 0x04;
const BANNER_MTU_RE = /^MTU=(\d+)$/;

export function bleSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export class BleTransport implements Transport {
  readonly kind = "ble" as const;
  info: TransportInfo = { name: "" };
  private device: BluetoothDevice | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dataCbs = new Set<DataListener>();
  private discCbs = new Set<() => void>();
  private writeQueue: Promise<void> = Promise.resolve();
  private writeCount = 0;
  private bannerSeen = false;
  private chunkSize = DEFAULT_CHUNK;

  get connected(): boolean {
    return this.device?.gatt?.connected === true;
  }

  async connect(): Promise<void> {
    if (!bleSupported()) {
      throw new TransportError("Web Bluetooth not supported in this browser");
    }
    // Linux BlueZ often drops the NUS service UUID from surfaced advertisement
    // data, so a services-only filter hides the device. Use name-based filters
    // and let optionalServices unlock the actual GATT service on connect.
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        // { services: [NUS_SERVICE] },
        { namePrefix: "LEGO" },
        { namePrefix: "Hub" },
      ],
      optionalServices: [NUS_SERVICE],
    });
    this.device = device;
    this.info = { name: device.name ?? "BLE device" };
    device.addEventListener("gattserverdisconnected", this.handleDisconnect);
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(NUS_SERVICE);
    this.rxChar = await service.getCharacteristic(NUS_RX);
    this.txChar = await service.getCharacteristic(NUS_TX);
    this.txChar.addEventListener("characteristicvaluechanged", this.handleNotify);
    await this.txChar.startNotifications();
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanup();
  }

  write(chunk: Uint8Array): Promise<void> {
    if (!this.rxChar) throw new TransportError("Not connected");
    const rx = this.rxChar;
    for (let offset = 0; offset < chunk.length; offset += this.chunkSize) {
      const slice = chunk.subarray(offset, offset + this.chunkSize);
      this.writeQueue = this.writeQueue.then(async () => {
        this.writeCount++;
        const buf = new Uint8Array(slice.byteLength);
        buf.set(slice);
        try {
          // Use with-response for reliability. writeValueWithoutResponse can
          // silently drop chunks on Linux/BlueZ when MTU or flow-control state
          // isn't ideal.
          await rx.writeValueWithResponse(buf);
        } catch (e) {
          console.error("[ble] write failed at offset", offset, "len", slice.byteLength, e);
          throw e;
        }
      });
    }
    return this.writeQueue;
  }

  onData(cb: DataListener): Unsubscribe {
    this.dataCbs.add(cb);
    return () => this.dataCbs.delete(cb);
  }

  onDisconnect(cb: () => void): Unsubscribe {
    this.discCbs.add(cb);
    return () => this.discCbs.delete(cb);
  }

  private handleNotify = (ev: Event) => {
    const target = ev.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (!this.bannerSeen && bytes.length >= 2 && bytes[0] === BANNER_PREFIX) {
      const nl = bytes.indexOf(0x0a);
      if (nl > 0) {
        const text = new TextDecoder().decode(bytes.subarray(1, nl));
        const m = BANNER_MTU_RE.exec(text);
        if (m) {
          const mtu = parseInt(m[1], 10);
          this.info = { ...this.info, mtu };
          this.chunkSize = Math.max(20, Math.min(mtu - 3, 512));
          this.bannerSeen = true;
          const rest = bytes.subarray(nl + 1);
          if (rest.length) this.emit(rest);
          return;
        }
      }
    }
    this.emit(bytes);
  };

  private emit(bytes: Uint8Array) {
    for (const cb of this.dataCbs) cb(bytes);
  }

  private handleDisconnect = () => {
    for (const cb of this.discCbs) cb();
  };

  private cleanup() {
    if (this.device) {
      this.device.removeEventListener("gattserverdisconnected", this.handleDisconnect);
    }
    if (this.txChar) {
      this.txChar.removeEventListener("characteristicvaluechanged", this.handleNotify);
    }
    this.device = null;
    this.rxChar = null;
    this.txChar = null;
    this.bannerSeen = false;
    this.chunkSize = DEFAULT_CHUNK;
  }
}
