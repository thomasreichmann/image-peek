// zlib decompression (RFC 1950 around RFC 1951 DEFLATE), for PNG's image
// data. The hooks environment has no DecompressionStream and no WebAssembly,
// so this is plain code: canonical Huffman codes looked up through one table
// per code, indexed by the next `bits` bits of input (least significant first).

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
/** The order code-length code lengths are sent in. */
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Entries `(symbol << 4) | length`, 0 where no code lands. */
type Table = { codes: Int32Array; bits: number };

function table(lengths: ArrayLike<number>): Table {
  let bits = 0;
  const count = new Int32Array(16);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    count[len]!++;
    if (len > bits) bits = len;
  }
  count[0] = 0;
  const next = new Int32Array(16);
  for (let len = 1, code = 0; len <= 15; len++) {
    code = (code + count[len - 1]!) << 1;
    next[len] = code;
  }
  const size = 1 << bits;
  const codes = new Int32Array(size);
  for (let sym = 0; sym < lengths.length; sym++) {
    const len = lengths[sym]!;
    if (len === 0) continue;
    let code = next[len]!++;
    let reversed = 0;
    for (let i = 0; i < len; i++) {
      reversed = (reversed << 1) | (code & 1);
      code >>= 1;
    }
    for (let j = reversed; j < size; j += 1 << len) codes[j] = (sym << 4) | len;
  }

  return { codes, bits };
}

const FIXED_LIT = table(
  Array.from({ length: 288 }, (_, i) => (i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8)),
);
const FIXED_DIST = table(Array.from({ length: 30 }, () => 5));

/**
 * Inflates a zlib stream. `size` is the expected output length: the buffer
 * is made that big, and decoding stops once it is full (a PNG's data past its
 * last row means nothing, and a stream that would run on is cut there).
 */
export function inflate(data: Uint8Array, size: number): Uint8Array {
  if (data.length < 2 || (data[0]! & 0x0f) !== 8 || ((data[0]! << 8) | data[1]!) % 31 !== 0) {
    throw new Error("not a zlib stream");
  }
  if (data[1]! & 0x20) throw new Error("zlib preset dictionary");

  const out = new Uint8Array(size);
  let o = 0;
  let pos = 2;
  // Bit buffer, least significant bit first. Reads past the end are zeros;
  // `pos` keeps counting so a stream that ends early is caught.
  let buf = 0;
  let cnt = 0;
  const end = data.length;

  for (let last = 0; !last && o < size; ) {
    while (cnt < 3) {
      buf |= (pos < end ? data[pos]! : 0) << cnt;
      pos++;
      cnt += 8;
    }
    last = buf & 1;
    const type = (buf >>> 1) & 3;
    buf >>>= 3;
    cnt -= 3;

    if (type === 0) {
      // Stored: the rest of this byte is dropped, then LEN, NLEN and the bytes.
      buf >>>= cnt & 7;
      cnt -= cnt & 7;
      pos -= cnt >> 3;
      buf = 0;
      cnt = 0;
      if (pos + 4 > end) throw new Error("deflate stream ends early");
      const len = data[pos]! | (data[pos + 1]! << 8);
      const nlen = data[pos + 2]! | (data[pos + 3]! << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error("bad stored block");
      pos += 4;
      if (pos + len > end) throw new Error("deflate stream ends early");
      const n = Math.min(len, size - o);
      out.set(data.subarray(pos, pos + n), o);
      o += n;
      pos += len;
      continue;
    }

    let lit = FIXED_LIT;
    let dist = FIXED_DIST;
    if (type === 2) {
      while (cnt < 14) {
        buf |= (pos < end ? data[pos]! : 0) << cnt;
        pos++;
        cnt += 8;
      }
      const hlit = (buf & 31) + 257;
      const hdist = ((buf >>> 5) & 31) + 1;
      const hclen = ((buf >>> 10) & 15) + 4;
      buf >>>= 14;
      cnt -= 14;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) {
        while (cnt < 3) {
          buf |= (pos < end ? data[pos]! : 0) << cnt;
          pos++;
          cnt += 8;
        }
        cl[CL_ORDER[i]!] = buf & 7;
        buf >>>= 3;
        cnt -= 3;
      }
      const clt = table(cl);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < lens.length; ) {
        while (cnt < 15) {
          buf |= (pos < end ? data[pos]! : 0) << cnt;
          pos++;
          cnt += 8;
        }
        const entry = clt.codes[buf & ((1 << clt.bits) - 1)]!;
        if (entry === 0) throw new Error("bad code length code");
        buf >>>= entry & 15;
        cnt -= entry & 15;
        const sym = entry >> 4;
        if (sym < 16) {
          lens[i++] = sym;
          continue;
        }
        let repeat: number;
        let value = 0;
        if (sym === 16) {
          if (i === 0) throw new Error("bad code length repeat");
          value = lens[i - 1]!;
          repeat = 3 + (buf & 3);
          buf >>>= 2;
          cnt -= 2;
        } else if (sym === 17) {
          repeat = 3 + (buf & 7);
          buf >>>= 3;
          cnt -= 3;
        } else {
          repeat = 11 + (buf & 127);
          buf >>>= 7;
          cnt -= 7;
        }
        if (i + repeat > lens.length) throw new Error("bad code length repeat");
        lens.fill(value, i, i + repeat);
        i += repeat;
      }
      lit = table(lens.subarray(0, hlit));
      dist = table(lens.subarray(hlit));
    } else if (type !== 1) {
      throw new Error("bad deflate block type");
    }

    const litMask = (1 << lit.bits) - 1;
    const distMask = (1 << dist.bits) - 1;
    for (;;) {
      while (cnt < 15) {
        buf |= (pos < end ? data[pos]! : 0) << cnt;
        pos++;
        cnt += 8;
      }
      const entry = lit.codes[buf & litMask]!;
      if (entry === 0) throw new Error("bad literal/length code");
      buf >>>= entry & 15;
      cnt -= entry & 15;
      const sym = entry >> 4;
      if (sym < 256) {
        if (o >= size) break;
        out[o++] = sym;
        continue;
      }
      if (sym === 256) break;

      const li = sym - 257;
      if (li >= 29) throw new Error("bad length code");
      let length = LENGTH_BASE[li]!;
      const lx = LENGTH_EXTRA[li]!;
      while (cnt < 15 + lx) {
        buf |= (pos < end ? data[pos]! : 0) << cnt;
        pos++;
        cnt += 8;
      }
      if (lx) {
        length += buf & ((1 << lx) - 1);
        buf >>>= lx;
        cnt -= lx;
      }
      const de = dist.codes[buf & distMask]!;
      if (de === 0) throw new Error("bad distance code");
      buf >>>= de & 15;
      cnt -= de & 15;
      const ds = de >> 4;
      if (ds >= 30) throw new Error("bad distance code");
      const dx = DIST_EXTRA[ds]!;
      while (cnt < dx) {
        buf |= (pos < end ? data[pos]! : 0) << cnt;
        pos++;
        cnt += 8;
      }
      const distance = DIST_BASE[ds]! + (buf & ((1 << dx) - 1));
      buf >>>= dx;
      cnt -= dx;
      if (distance > o) throw new Error("distance before the start");
      const stop = Math.min(o + length, size);
      for (; o < stop; o++) out[o] = out[o - distance]!;
      if (o >= size) break;
    }
    if (pos - (cnt >> 3) > end) throw new Error("deflate stream ends early");
  }
  if (o < size) throw new Error("deflate stream ends early");

  return out;
}
