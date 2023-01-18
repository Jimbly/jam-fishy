import { NetErrorCallback } from './types';

export const PACKET_DEBUG = 1;

type PacketFlags = 0 | typeof PACKET_DEBUG;

export function packetDefaultFlags(): PacketFlags;
export function packetEnableDebug(enable: true): void;

export interface Packet {
  readU8: () => number;
  writeU8: (value: number) => void;
  readU32: () => number;
  writeU32: (value: number) => void;
  readInt: () => number;
  writeInt: (value: number) => void;
  readFloat: () => number;
  writeFloat: (value: number) => void;
  readString: () => string;
  writeString: (value: string) => void;
  readAnsiString: () => string;
  writeAnsiString: (value: string) => void;
  readJSON: () => unknown;
  writeJSON: (value: unknown) => void;
  readBool: () => boolean;
  writeBool: (value: boolean) => void;
  readBuffer: (do_copy: boolean) => Uint8Array;
  writeBuffer: (value: Uint8Array) => void;

  append: (other: Packet) => void;
  appendRemaining: (other: Packet) => void;
  send: <T=never>(resp_func?: NetErrorCallback<T>) => void;
  ended: () => boolean;
  updateFlags: (flags: number) => void;
  readFlags: () => void;
  writeFlags: () => void;
  getFlags: () => number;
  getBuffer: () => Uint8Array;
  getBufferLen: () => number;
  getInternalFlags: () => number;
  getOffset: () => number;
  getRefCount: () => number;
  makeReadable: () => void;
  pool: () => void;
  ref: () => void;
  seek: (offs: number) => void;
  totalSize: () => number;
}

export function packetCreate(flags?: PacketFlags, init_size?: number): Packet;
export function packetFromBuffer(buf: Uint8Array, buf_len: number, need_copy?: boolean): Packet;
export function packetFromJSON(js_obj: unknown): Packet;
export function isPacket(thing: unknown): thing is Packet;
