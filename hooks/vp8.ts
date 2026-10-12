// WebP lossy (VP8 key frame, RFC 6386) decoding to RGBA. A port of libwebp's
// decoder (vp8_dec.c, tree_dec.c, quant_dec.c, frame_dec.c, dsp/dec.c,
// dsp/upsampling.c, dsp/yuv.h), so the output is libwebp's to the bit:
// prediction from unfiltered neighbours, the same in-loop filter, and the
// same "fancy" chroma upsampling and fixed-point YUV to RGB.

import {
  AC_TABLE,
  BANDS,
  BMODES_PROBA,
  CAT3,
  CAT4,
  CAT5,
  CAT6,
  COEFFS_PROBA0,
  COEFFS_UPDATE_PROBA,
  DC_TABLE,
  ZIGZAG,
} from "./webp-tables";

const CATS = [CAT3, CAT4, CAT5, CAT6];

// The reconstruction buffer, as libwebp lays it out: a stride of 32, the
// row above and the column left of each plane kept beside it.
const BPS = 32;
const Y_OFF = BPS + 8;
const U_OFF = Y_OFF + BPS * 16 + BPS;
const V_OFF = U_OFF + 16;
const YUV_SIZE = BPS * 17 + BPS * 9;
/** Where 4x4 block n starts inside the 16x16 one. */
const SCAN = Array.from({ length: 16 }, (_, n) => (n & 3) * 4 + (n >> 2) * 4 * BPS);

/** The boolean entropy decoder (RFC 6386 section 7); past the end, zeros. */
class BoolReader {
  readonly data: Uint8Array;
  pos: number;
  readonly end: number;
  value: number;
  range = 255;
  bitCount = 0;
  /** Bytes read past the end. */
  over = 0;

  constructor(data: Uint8Array, start: number, end: number) {
    this.data = data;
    this.pos = start;
    this.end = end;
    this.value = (this.next() << 8) | this.next();
  }

  next(): number {
    if (this.pos < this.end) return this.data[this.pos++]!;
    this.over++;
    return 0;
  }

  bit(prob: number): number {
    const split = 1 + (((this.range - 1) * prob) >> 8);
    const big = split << 8;
    let bit: number;
    if (this.value >= big) {
      bit = 1;
      this.range -= split;
      this.value -= big;
    } else {
      bit = 0;
      this.range = split;
    }
    while (this.range < 128) {
      this.value <<= 1;
      this.range <<= 1;
      if (++this.bitCount === 8) {
        this.bitCount = 0;
        this.value |= this.next();
      }
    }

    return bit;
  }

  value_(bits: number): number {
    let v = 0;
    while (bits-- > 0) v |= this.bit(0x80) << bits;
    return v;
  }

  flag(): number {
    return this.bit(0x80);
  }

  signed(bits: number): number {
    const v = this.value_(bits);
    return this.flag() ? -v : v;
  }
}

type Quant = { y1: number[]; y2: number[]; uv: number[] };
type FilterInfo = { limit: number; ilevel: number; hev: number; inner: number };

const clip = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);
const clip1 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const sclip1 = (v: number) => (v < -128 ? -128 : v > 127 ? 127 : v);
const sclip2 = (v: number) => (v < -16 ? -16 : v > 15 ? 15 : v);
const mul1 = (a: number) => ((a * 20091) >> 16) + a;
const mul2 = (a: number) => (a * 35468) >> 16;
const avg3 = (a: number, b: number, c: number) => (a + 2 * b + c + 2) >> 2;
const avg2 = (a: number, b: number) => (a + b + 1) >> 1;

export type Vp8Frame = {
  width: number;
  height: number;
  y: Uint8Array;
  u: Uint8Array;
  v: Uint8Array;
  yStride: number;
  uvStride: number;
};

/** Decodes a `VP8 ` chunk's payload to Y, U and V planes. */
export function decodeVp8(data: Uint8Array, maxPixels: number): Vp8Frame {
  if (data.length < 10) throw new Error("WebP data ends early");
  const tag = data[0]! | (data[1]! << 8) | (data[2]! << 16);
  if (tag & 1) throw new Error("WebP lossy data is not a key frame");
  if (((tag >> 1) & 7) > 3 || !((tag >> 4) & 1)) throw new Error("bad WebP key frame");
  if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) throw new Error("bad WebP key frame");
  const partLength = tag >>> 5;
  const width = ((data[7]! << 8) | data[6]!) & 0x3fff;
  const height = ((data[9]! << 8) | data[8]!) & 0x3fff;
  if (!(width > 0 && height > 0)) throw new Error("WebP image has no size");
  if (width * height > maxPixels) throw new Error(`${width}×${height} is too large to preview`);
  const mbW = (width + 15) >> 4;
  const mbH = (height + 15) >> 4;

  let pos = 10;
  if (pos + partLength > data.length) throw new Error("WebP data ends early");
  const br = new BoolReader(data, pos, pos + partLength);
  pos += partLength;
  br.flag(); // colour space
  br.flag(); // clamping type

  // Segments (9.3).
  const useSegment = br.flag();
  let updateMap = 0;
  let absoluteDelta = 1;
  const quantizer = [0, 0, 0, 0];
  const strength = [0, 0, 0, 0];
  const segProbs = [255, 255, 255];
  if (useSegment) {
    updateMap = br.flag();
    if (br.flag()) {
      absoluteDelta = br.flag();
      for (let s = 0; s < 4; s++) quantizer[s] = br.flag() ? br.signed(7) : 0;
      for (let s = 0; s < 4; s++) strength[s] = br.flag() ? br.signed(6) : 0;
    }
    if (updateMap) for (let s = 0; s < 3; s++) segProbs[s] = br.flag() ? br.value_(8) : 255;
  }

  // Loop filter (9.4).
  const simple = br.flag();
  const level = br.value_(6);
  const sharpness = br.value_(3);
  const useLfDelta = br.flag();
  const refDelta = [0, 0, 0, 0];
  const modeDelta = [0, 0, 0, 0];
  if (useLfDelta && br.flag()) {
    for (let i = 0; i < 4; i++) if (br.flag()) refDelta[i] = br.signed(6);
    for (let i = 0; i < 4; i++) if (br.flag()) modeDelta[i] = br.signed(6);
  }
  const filterType = level === 0 ? 0 : simple ? 1 : 2;

  // Token partitions (9.5).
  const numParts = 1 << br.value_(2);
  let partStart = pos + 3 * (numParts - 1);
  if (partStart > data.length) throw new Error("WebP data ends early");
  const parts: BoolReader[] = [];
  let left = data.length - partStart;
  for (let p = 0; p < numParts - 1; p++) {
    const at = pos + 3 * p;
    const size = Math.min(left, data[at]! | (data[at + 1]! << 8) | (data[at + 2]! << 16));
    parts.push(new BoolReader(data, partStart, partStart + size));
    partStart += size;
    left -= size;
  }
  if (partStart >= data.length) throw new Error("WebP data ends early");
  parts.push(new BoolReader(data, partStart, data.length));

  // Quantizers (9.6).
  const baseQ = br.value_(7);
  const dqY1Dc = br.flag() ? br.signed(4) : 0;
  const dqY2Dc = br.flag() ? br.signed(4) : 0;
  const dqY2Ac = br.flag() ? br.signed(4) : 0;
  const dqUvDc = br.flag() ? br.signed(4) : 0;
  const dqUvAc = br.flag() ? br.signed(4) : 0;
  const quants: Quant[] = [];
  for (let s = 0; s < 4; s++) {
    if (!useSegment && s > 0) {
      quants.push(quants[0]!);
      continue;
    }
    const q = useSegment ? quantizer[s]! + (absoluteDelta ? 0 : baseQ) : baseQ;
    const y2ac = (AC_TABLE[clip(q + dqY2Ac, 127)]! * 101581) >> 16;
    quants.push({
      y1: [DC_TABLE[clip(q + dqY1Dc, 127)]!, AC_TABLE[clip(q, 127)]!],
      y2: [DC_TABLE[clip(q + dqY2Dc, 127)]! * 2, y2ac < 8 ? 8 : y2ac],
      uv: [DC_TABLE[clip(q + dqUvDc, 117)]!, AC_TABLE[clip(q + dqUvAc, 127)]!],
    });
  }

  br.flag(); // update_proba: ignored, as libwebp does

  // Token probabilities (13.4) and the skip flag's.
  const proba = new Uint8Array(COEFFS_PROBA0.length);
  for (let i = 0; i < proba.length; i++) {
    proba[i] = br.bit(COEFFS_UPDATE_PROBA[i]!) ? br.value_(8) : COEFFS_PROBA0[i]!;
  }
  const useSkip = br.flag();
  const skipProb = useSkip ? br.value_(8) : 0;
  /** Offset of the probabilities for type t at coefficient n (band), context 0. */
  const bandAt = Array.from({ length: 4 }, (_, t) =>
    Int32Array.from({ length: 17 }, (_, n) => (t * 8 + BANDS[n]!) * 33),
  );

  // Filter strength per segment and per i4x4/i16x16.
  const strengths: FilterInfo[][] = [];
  for (let s = 0; s < 4; s++) {
    const base = useSegment ? strength[s]! + (absoluteDelta ? 0 : level) : level;
    const pair: FilterInfo[] = [];
    for (let i4x4 = 0; i4x4 <= 1; i4x4++) {
      let lvl = base;
      if (useLfDelta) {
        lvl += refDelta[0]!;
        if (i4x4) lvl += modeDelta[0]!;
      }
      lvl = clip(lvl, 63);
      let ilevel = lvl;
      if (sharpness > 0) {
        ilevel >>= sharpness > 4 ? 2 : 1;
        if (ilevel > 9 - sharpness) ilevel = 9 - sharpness;
      }
      if (ilevel < 1) ilevel = 1;
      pair.push({
        limit: filterType > 0 && lvl > 0 ? 2 * lvl + ilevel : 0,
        ilevel,
        hev: lvl >= 40 ? 2 : lvl >= 15 ? 1 : 0,
        inner: i4x4,
      });
    }
    strengths.push(pair);
  }

  // State.
  const yStride = mbW * 16;
  const uvStride = mbW * 8;
  const Y = new Uint8Array(yStride * mbH * 16);
  const U = new Uint8Array(uvStride * mbH * 8);
  const V = new Uint8Array(uvStride * mbH * 8);
  const intraT = new Uint8Array(4 * mbW);
  const intraL = new Uint8Array(4);
  const topNz = new Uint8Array(mbW);
  const topNzDc = new Uint8Array(mbW);
  const topY = new Uint8Array(yStride);
  const topU = new Uint8Array(uvStride);
  const topV = new Uint8Array(uvStride);
  const buf = new Uint8Array(YUV_SIZE);
  // One row of macroblocks, parsed then reconstructed.
  const isI4 = new Uint8Array(mbW);
  const imodes = new Uint8Array(mbW * 16);
  const uvMode = new Uint8Array(mbW);
  const segment = new Uint8Array(mbW);
  const skipFlag = new Uint8Array(mbW);
  const coeffs = new Int16Array(mbW * 384);
  // The whole frame's filter settings, applied once all is reconstructed.
  const fLimit = new Int32Array(mbW * mbH);
  const fIlevel = new Int32Array(mbW * mbH);
  const fHev = new Int32Array(mbW * mbH);
  const fInner = new Uint8Array(mbW * mbH);
  const dc = new Int16Array(16);

  function largeValue(t: BoolReader, p: number): number {
    if (!t.bit(proba[p + 3]!)) {
      return t.bit(proba[p + 4]!) ? 3 + t.bit(proba[p + 5]!) : 2;
    }
    if (!t.bit(proba[p + 6]!)) {
      if (!t.bit(proba[p + 7]!)) return 5 + t.bit(159);
      return 7 + 2 * t.bit(165) + t.bit(145);
    }
    const b1 = t.bit(proba[p + 8]!);
    const b0 = t.bit(proba[p + 9 + b1]!);
    const cat = 2 * b1 + b0;
    let v = 0;
    for (const pr of CATS[cat]!) v += v + t.bit(pr);
    return v + 3 + (8 << cat);
  }

  /** Coefficients of one 4x4 block from n on; the last non-zero position plus one. */
  function getCoeffs(
    t: BoolReader,
    type: number,
    ctx: number,
    dq: number[],
    n: number,
    out: Int16Array,
    at: number,
  ): number {
    const bands = bandAt[type]!;
    let p = bands[n]! + ctx * 11;
    for (; n < 16; ++n) {
      if (!t.bit(proba[p]!)) return n;
      while (!t.bit(proba[p + 1]!)) {
        p = bands[++n]!;
        if (n === 16) return 16;
      }
      const next = bands[n + 1]!;
      let v: number;
      if (!t.bit(proba[p + 2]!)) {
        v = 1;
        p = next + 11;
      } else {
        v = largeValue(t, p);
        p = next + 22;
      }
      out[at + ZIGZAG[n]!] = (t.bit(0x80) ? -v : v) * dq[n > 0 ? 1 : 0]!;
    }

    return 16;
  }

  const nzCode = (bits: number, nz: number, dcNz: number) =>
    (bits << 2) | (nz > 3 ? 3 : nz > 1 ? 2 : dcNz);

  let leftNz = 0;
  let leftNzDc = 0;

  /** libwebp's ParseResiduals: true when every coefficient is zero. */
  function residuals(t: BoolReader, mbX: number): boolean {
    const q = quants[segment[mbX]!]!;
    const base = mbX * 384;
    coeffs.fill(0, base, base + 384);
    let first: number;
    let acType: number;
    if (!isI4[mbX]) {
      dc.fill(0);
      const nz = getCoeffs(t, 1, topNzDc[mbX]! + leftNzDc, q.y2, 0, dc, 0);
      topNzDc[mbX] = leftNzDc = nz > 0 ? 1 : 0;
      wht(dc, coeffs, base);
      first = 1;
      acType = 0;
    } else {
      first = 0;
      acType = 3;
    }

    let tnz = topNz[mbX]! & 0x0f;
    let lnz = leftNz & 0x0f;
    let nonZeroY = 0;
    let at = base;
    for (let y = 0; y < 4; y++) {
      let l = lnz & 1;
      let bits = 0;
      for (let x = 0; x < 4; x++) {
        const nz = getCoeffs(t, acType, l + (tnz & 1), q.y1, first, coeffs, at);
        l = nz > first ? 1 : 0;
        tnz = (tnz >> 1) | (l << 7);
        bits = nzCode(bits, nz, coeffs[at] !== 0 ? 1 : 0);
        at += 16;
      }
      tnz >>= 4;
      lnz = (lnz >> 1) | (l << 7);
      nonZeroY = (nonZeroY << 8) | bits;
    }
    let outT = tnz;
    let outL = lnz >> 4;

    let nonZeroUv = 0;
    for (let ch = 0; ch < 4; ch += 2) {
      let bits = 0;
      tnz = topNz[mbX]! >> (4 + ch);
      lnz = leftNz >> (4 + ch);
      for (let y = 0; y < 2; y++) {
        let l = lnz & 1;
        for (let x = 0; x < 2; x++) {
          const nz = getCoeffs(t, 2, l + (tnz & 1), q.uv, 0, coeffs, at);
          l = nz > 0 ? 1 : 0;
          tnz = (tnz >> 1) | (l << 3);
          bits = nzCode(bits, nz, coeffs[at] !== 0 ? 1 : 0);
          at += 16;
        }
        tnz >>= 2;
        lnz = (lnz >> 1) | (l << 5);
      }
      nonZeroUv |= bits << (4 * ch);
      outT |= (tnz << 4) << ch;
      outL |= (lnz & 0xf0) << ch;
    }
    topNz[mbX] = outT & 0xff;
    leftNz = outL & 0xff;

    return (nonZeroY | nonZeroUv) === 0;
  }

  function intraModes(mbX: number) {
    segment[mbX] = updateMap
      ? !br.bit(segProbs[0]!)
        ? br.bit(segProbs[1]!)
        : br.bit(segProbs[2]!) + 2
      : 0;
    skipFlag[mbX] = useSkip ? br.bit(skipProb) : 0;
    const top = 4 * mbX;
    isI4[mbX] = br.bit(145) ? 0 : 1;
    if (!isI4[mbX]) {
      const mode = br.bit(156) ? (br.bit(128) ? 1 : 3) : br.bit(163) ? 2 : 0; // TM, H : V, DC
      imodes[mbX * 16] = mode;
      intraT.fill(mode, top, top + 4);
      intraL.fill(mode);
    } else {
      for (let y = 0; y < 4; y++) {
        let ymode = intraL[y]!;
        for (let x = 0; x < 4; x++) {
          const p = (intraT[top + x]! * 10 + ymode) * 9;
          const pr = (i: number) => BMODES_PROBA[p + i]!;
          ymode = !br.bit(pr(0))
            ? 0 // B_DC_PRED
            : !br.bit(pr(1))
              ? 1 // B_TM_PRED
              : !br.bit(pr(2))
                ? 2 // B_VE_PRED
                : !br.bit(pr(3))
                  ? !br.bit(pr(4))
                    ? 3 // B_HE_PRED
                    : !br.bit(pr(5))
                      ? 4 // B_RD_PRED
                      : 5 // B_VR_PRED
                  : !br.bit(pr(6))
                    ? 6 // B_LD_PRED
                    : !br.bit(pr(7))
                      ? 7 // B_VL_PRED
                      : !br.bit(pr(8))
                        ? 8 // B_HD_PRED
                        : 9; // B_HU_PRED
          intraT[top + x] = ymode;
        }
        for (let x = 0; x < 4; x++) imodes[mbX * 16 + y * 4 + x] = intraT[top + x]!;
        intraL[y] = ymode;
      }
    }
    uvMode[mbX] = !br.bit(142) ? 0 : !br.bit(114) ? 2 : br.bit(183) ? 1 : 3; // DC, V, TM, H
  }

  for (let mbY = 0; mbY < mbH; mbY++) {
    for (let mbX = 0; mbX < mbW; mbX++) intraModes(mbX);
    if (br.over > 8) throw new Error("WebP data ends early");
    const t = parts[mbY & (numParts - 1)]!;
    for (let mbX = 0; mbX < mbW; mbX++) {
      let skip = skipFlag[mbX]!;
      if (!skip) {
        skip = residuals(t, mbX) ? 1 : 0;
      } else {
        leftNz = topNz[mbX] = 0;
        if (!isI4[mbX]) leftNzDc = topNzDc[mbX] = 0;
        coeffs.fill(0, mbX * 384, mbX * 384 + 384);
      }
      if (filterType > 0) {
        const info = strengths[segment[mbX]!]![isI4[mbX]!]!;
        const i = mbY * mbW + mbX;
        fLimit[i] = info.limit;
        fIlevel[i] = info.ilevel;
        fHev[i] = info.hev;
        fInner[i] = info.inner | (skip ? 0 : 1);
      }
    }
    if (t.over > 8) throw new Error("WebP data ends early");
    leftNz = 0;
    leftNzDc = 0;
    intraL.fill(0);
    reconstructRow(mbY);
  }

  function reconstructRow(mbY: number) {
    for (let j = 0; j < 16; j++) buf[Y_OFF + j * BPS - 1] = 129;
    for (let j = 0; j < 8; j++) {
      buf[U_OFF + j * BPS - 1] = 129;
      buf[V_OFF + j * BPS - 1] = 129;
    }
    if (mbY > 0) {
      buf[Y_OFF - 1 - BPS] = buf[U_OFF - 1 - BPS] = buf[V_OFF - 1 - BPS] = 129;
    } else {
      buf.fill(127, Y_OFF - BPS - 1, Y_OFF - BPS - 1 + 21);
      buf.fill(127, U_OFF - BPS - 1, U_OFF - BPS - 1 + 9);
      buf.fill(127, V_OFF - BPS - 1, V_OFF - BPS - 1 + 9);
    }

    for (let mbX = 0; mbX < mbW; mbX++) {
      if (mbX > 0) {
        for (let j = -1; j < 16; j++) buf.copyWithin(Y_OFF + j * BPS - 4, Y_OFF + j * BPS + 12, Y_OFF + j * BPS + 16);
        for (let j = -1; j < 8; j++) {
          buf.copyWithin(U_OFF + j * BPS - 4, U_OFF + j * BPS + 4, U_OFF + j * BPS + 8);
          buf.copyWithin(V_OFF + j * BPS - 4, V_OFF + j * BPS + 4, V_OFF + j * BPS + 8);
        }
      }
      if (mbY > 0) {
        buf.set(topY.subarray(mbX * 16, mbX * 16 + 16), Y_OFF - BPS);
        buf.set(topU.subarray(mbX * 8, mbX * 8 + 8), U_OFF - BPS);
        buf.set(topV.subarray(mbX * 8, mbX * 8 + 8), V_OFF - BPS);
      }
      const base = mbX * 384;

      if (isI4[mbX]) {
        const tr = Y_OFF - BPS + 16;
        if (mbY > 0) {
          if (mbX >= mbW - 1) buf.fill(topY[mbX * 16 + 15]!, tr, tr + 4);
          else buf.set(topY.subarray((mbX + 1) * 16, (mbX + 1) * 16 + 4), tr);
        }
        for (let k = 1; k <= 3; k++) buf.copyWithin(tr + k * 4 * BPS, tr, tr + 4);
        for (let n = 0; n < 16; n++) {
          const dst = Y_OFF + SCAN[n]!;
          predLuma4(imodes[mbX * 16 + n]!, buf, dst);
          transform(coeffs, base + n * 16, buf, dst);
        }
      } else {
        predLuma16(checkMode(mbX, mbY, imodes[mbX * 16]!), buf, Y_OFF);
        for (let n = 0; n < 16; n++) transform(coeffs, base + n * 16, buf, Y_OFF + SCAN[n]!);
      }
      const uvPred = checkMode(mbX, mbY, uvMode[mbX]!);
      predChroma8(uvPred, buf, U_OFF);
      predChroma8(uvPred, buf, V_OFF);
      for (let k = 0; k < 4; k++) {
        const off = (k & 1) * 4 + (k >> 1) * 4 * BPS;
        transform(coeffs, base + (16 + k) * 16, buf, U_OFF + off);
        transform(coeffs, base + (20 + k) * 16, buf, V_OFF + off);
      }

      if (mbY < mbH - 1) {
        topY.set(buf.subarray(Y_OFF + 15 * BPS, Y_OFF + 15 * BPS + 16), mbX * 16);
        topU.set(buf.subarray(U_OFF + 7 * BPS, U_OFF + 7 * BPS + 8), mbX * 8);
        topV.set(buf.subarray(V_OFF + 7 * BPS, V_OFF + 7 * BPS + 8), mbX * 8);
      }
      for (let j = 0; j < 16; j++) {
        Y.set(buf.subarray(Y_OFF + j * BPS, Y_OFF + j * BPS + 16), (mbY * 16 + j) * yStride + mbX * 16);
      }
      for (let j = 0; j < 8; j++) {
        U.set(buf.subarray(U_OFF + j * BPS, U_OFF + j * BPS + 8), (mbY * 8 + j) * uvStride + mbX * 8);
        V.set(buf.subarray(V_OFF + j * BPS, V_OFF + j * BPS + 8), (mbY * 8 + j) * uvStride + mbX * 8);
      }
    }
  }

  // In-loop filter, macroblock by macroblock in raster order.
  if (filterType > 0) {
    for (let mbY = 0; mbY < mbH; mbY++) {
      for (let mbX = 0; mbX < mbW; mbX++) {
        const i = mbY * mbW + mbX;
        const limit = fLimit[i]!;
        if (limit === 0) continue;
        const ilevel = fIlevel[i]!;
        const hev = fHev[i]!;
        const inner = fInner[i]!;
        const y = mbY * 16 * yStride + mbX * 16;
        if (filterType === 1) {
          if (mbX > 0) simpleH16(Y, y, yStride, limit + 4);
          if (inner) for (let k = 4; k < 16; k += 4) simpleH16(Y, y + k, yStride, limit);
          if (mbY > 0) simpleV16(Y, y, yStride, limit + 4);
          if (inner) for (let k = 4; k < 16; k += 4) simpleV16(Y, y + k * yStride, yStride, limit);
        } else {
          const uv = mbY * 8 * uvStride + mbX * 8;
          if (mbX > 0) {
            loop26(Y, y, 1, yStride, 16, limit + 4, ilevel, hev);
            loop26(U, uv, 1, uvStride, 8, limit + 4, ilevel, hev);
            loop26(V, uv, 1, uvStride, 8, limit + 4, ilevel, hev);
          }
          if (inner) {
            for (let k = 4; k < 16; k += 4) loop24(Y, y + k, 1, yStride, 16, limit, ilevel, hev);
            loop24(U, uv + 4, 1, uvStride, 8, limit, ilevel, hev);
            loop24(V, uv + 4, 1, uvStride, 8, limit, ilevel, hev);
          }
          if (mbY > 0) {
            loop26(Y, y, yStride, 1, 16, limit + 4, ilevel, hev);
            loop26(U, uv, uvStride, 1, 8, limit + 4, ilevel, hev);
            loop26(V, uv, uvStride, 1, 8, limit + 4, ilevel, hev);
          }
          if (inner) {
            for (let k = 4; k < 16; k += 4) loop24(Y, y + k * yStride, yStride, 1, 16, limit, ilevel, hev);
            loop24(U, uv + 4 * uvStride, uvStride, 1, 8, limit, ilevel, hev);
            loop24(V, uv + 4 * uvStride, uvStride, 1, 8, limit, ilevel, hev);
          }
        }
      }
    }
  }

  return { width, height, y: Y, u: U, v: V, yStride, uvStride };
}

/** DC_PRED at the frame's edges becomes its no-top / no-left variants. */
function checkMode(mbX: number, mbY: number, mode: number): number {
  if (mode !== 0) return mode;
  if (mbX === 0) return mbY === 0 ? 6 : 5;
  return mbY === 0 ? 4 : 0;
}

/** The inverse Walsh-Hadamard transform into each 4x4 block's DC. */
function wht(input: Int16Array, out: Int16Array, at: number) {
  const tmp = new Int32Array(16);
  for (let i = 0; i < 4; i++) {
    const a0 = input[i]! + input[12 + i]!;
    const a1 = input[4 + i]! + input[8 + i]!;
    const a2 = input[4 + i]! - input[8 + i]!;
    const a3 = input[i]! - input[12 + i]!;
    tmp[i] = a0 + a1;
    tmp[8 + i] = a0 - a1;
    tmp[4 + i] = a3 + a2;
    tmp[12 + i] = a3 - a2;
  }
  for (let i = 0; i < 4; i++) {
    const dc = tmp[i * 4]! + 3;
    const a0 = dc + tmp[3 + i * 4]!;
    const a1 = tmp[1 + i * 4]! + tmp[2 + i * 4]!;
    const a2 = tmp[1 + i * 4]! - tmp[2 + i * 4]!;
    const a3 = dc - tmp[3 + i * 4]!;
    const o = at + i * 64;
    out[o] = (a0 + a1) >> 3;
    out[o + 16] = (a3 + a2) >> 3;
    out[o + 32] = (a0 - a1) >> 3;
    out[o + 48] = (a3 - a2) >> 3;
  }
}

const idct = new Int32Array(16);

/** Adds one 4x4 block's inverse DCT to the prediction (none if all zero). */
function transform(c: Int16Array, at: number, b: Uint8Array, dst: number) {
  let any = 0;
  for (let i = 0; i < 16; i++) any |= c[at + i]!;
  if (any === 0) return;
  for (let i = 0; i < 4; i++) {
    const a = c[at + i]! + c[at + 8 + i]!;
    const bb = c[at + i]! - c[at + 8 + i]!;
    const cc = mul2(c[at + 4 + i]!) - mul1(c[at + 12 + i]!);
    const d = mul1(c[at + 4 + i]!) + mul2(c[at + 12 + i]!);
    idct[i * 4] = a + d;
    idct[i * 4 + 1] = bb + cc;
    idct[i * 4 + 2] = bb - cc;
    idct[i * 4 + 3] = a - d;
  }
  for (let i = 0; i < 4; i++) {
    const dc = idct[i]! + 4;
    const a = dc + idct[8 + i]!;
    const bb = dc - idct[8 + i]!;
    const cc = mul2(idct[4 + i]!) - mul1(idct[12 + i]!);
    const d = mul1(idct[4 + i]!) + mul2(idct[12 + i]!);
    const o = dst + i * BPS;
    b[o] = clip1(b[o]! + ((a + d) >> 3));
    b[o + 1] = clip1(b[o + 1]! + ((bb + cc) >> 3));
    b[o + 2] = clip1(b[o + 2]! + ((bb - cc) >> 3));
    b[o + 3] = clip1(b[o + 3]! + ((a - d) >> 3));
  }
}

function trueMotion(b: Uint8Array, dst: number, size: number) {
  const topLeft = b[dst - BPS - 1]!;
  for (let y = 0; y < size; y++) {
    const left = b[dst + y * BPS - 1]!;
    for (let x = 0; x < size; x++) b[dst + y * BPS + x] = clip1(b[dst - BPS + x]! + left - topLeft);
  }
}

function fill(b: Uint8Array, dst: number, size: number, v: number) {
  for (let y = 0; y < size; y++) b.fill(v, dst + y * BPS, dst + y * BPS + size);
}

function predLuma16(mode: number, b: Uint8Array, dst: number) {
  let dc: number;
  switch (mode) {
    case 1:
      return trueMotion(b, dst, 16);
    case 2:
      for (let y = 0; y < 16; y++) b.copyWithin(dst + y * BPS, dst - BPS, dst - BPS + 16);
      return;
    case 3:
      for (let y = 0; y < 16; y++) b.fill(b[dst + y * BPS - 1]!, dst + y * BPS, dst + y * BPS + 16);
      return;
    case 4: // no top
      dc = 8;
      for (let j = 0; j < 16; j++) dc += b[dst - 1 + j * BPS]!;
      return fill(b, dst, 16, dc >> 4);
    case 5: // no left
      dc = 8;
      for (let i = 0; i < 16; i++) dc += b[dst + i - BPS]!;
      return fill(b, dst, 16, dc >> 4);
    case 6:
      return fill(b, dst, 16, 0x80);
    default:
      dc = 16;
      for (let j = 0; j < 16; j++) dc += b[dst - 1 + j * BPS]! + b[dst + j - BPS]!;
      return fill(b, dst, 16, dc >> 5);
  }
}

function predChroma8(mode: number, b: Uint8Array, dst: number) {
  let dc: number;
  switch (mode) {
    case 1:
      return trueMotion(b, dst, 8);
    case 2:
      for (let y = 0; y < 8; y++) b.copyWithin(dst + y * BPS, dst - BPS, dst - BPS + 8);
      return;
    case 3:
      for (let y = 0; y < 8; y++) b.fill(b[dst + y * BPS - 1]!, dst + y * BPS, dst + y * BPS + 8);
      return;
    case 4: // no top
      dc = 4;
      for (let i = 0; i < 8; i++) dc += b[dst - 1 + i * BPS]!;
      return fill(b, dst, 8, dc >> 3);
    case 5: // no left
      dc = 4;
      for (let i = 0; i < 8; i++) dc += b[dst + i - BPS]!;
      return fill(b, dst, 8, dc >> 3);
    case 6:
      return fill(b, dst, 8, 0x80);
    default:
      dc = 8;
      for (let i = 0; i < 8; i++) dc += b[dst + i - BPS]! + b[dst - 1 + i * BPS]!;
      return fill(b, dst, 8, dc >> 4);
  }
}

function predLuma4(mode: number, b: Uint8Array, dst: number) {
  const at = (x: number, y: number) => b[dst + x + y * BPS]!;
  const set = (x: number, y: number, v: number) => {
    b[dst + x + y * BPS] = v;
  };
  const I = at(-1, 0), J = at(-1, 1), K = at(-1, 2), L = at(-1, 3);
  const X = at(-1, -1);
  const A = at(0, -1), B = at(1, -1), C = at(2, -1), D = at(3, -1);
  const E = at(4, -1), F = at(5, -1), G = at(6, -1), H = at(7, -1);
  switch (mode) {
    case 0: {
      // DC
      const dc = (A + B + C + D + I + J + K + L + 4) >> 3;
      return fill(b, dst, 4, dc);
    }
    case 1:
      return trueMotion(b, dst, 4);
    case 2: {
      // VE: smoothed top
      const vals = [avg3(X, A, B), avg3(A, B, C), avg3(B, C, D), avg3(C, D, E)];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(x, y, vals[x]!);
      return;
    }
    case 3: {
      // HE: smoothed left
      const rows = [avg3(X, I, J), avg3(I, J, K), avg3(J, K, L), avg3(K, L, L)];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(x, y, rows[y]!);
      return;
    }
    case 4: // RD
      set(0, 3, avg3(J, K, L));
      set(1, 3, avg3(I, J, K)), set(0, 2, avg3(I, J, K));
      set(2, 3, avg3(X, I, J)), set(1, 2, avg3(X, I, J)), set(0, 1, avg3(X, I, J));
      for (const [x, y] of [[3, 3], [2, 2], [1, 1], [0, 0]]) set(x!, y!, avg3(A, X, I));
      for (const [x, y] of [[3, 2], [2, 1], [1, 0]]) set(x!, y!, avg3(B, A, X));
      set(3, 1, avg3(C, B, A)), set(2, 0, avg3(C, B, A));
      set(3, 0, avg3(D, C, B));
      return;
    case 5: // VR
      set(0, 0, avg2(X, A)), set(1, 2, avg2(X, A));
      set(1, 0, avg2(A, B)), set(2, 2, avg2(A, B));
      set(2, 0, avg2(B, C)), set(3, 2, avg2(B, C));
      set(3, 0, avg2(C, D));
      set(0, 3, avg3(K, J, I));
      set(0, 2, avg3(J, I, X));
      set(0, 1, avg3(I, X, A)), set(1, 3, avg3(I, X, A));
      set(1, 1, avg3(X, A, B)), set(2, 3, avg3(X, A, B));
      set(2, 1, avg3(A, B, C)), set(3, 3, avg3(A, B, C));
      set(3, 1, avg3(B, C, D));
      return;
    case 6: // LD
      set(0, 0, avg3(A, B, C));
      set(1, 0, avg3(B, C, D)), set(0, 1, avg3(B, C, D));
      for (const [x, y] of [[2, 0], [1, 1], [0, 2]]) set(x!, y!, avg3(C, D, E));
      for (const [x, y] of [[3, 0], [2, 1], [1, 2], [0, 3]]) set(x!, y!, avg3(D, E, F));
      for (const [x, y] of [[3, 1], [2, 2], [1, 3]]) set(x!, y!, avg3(E, F, G));
      set(3, 2, avg3(F, G, H)), set(2, 3, avg3(F, G, H));
      set(3, 3, avg3(G, H, H));
      return;
    case 7: // VL
      set(0, 0, avg2(A, B));
      set(1, 0, avg2(B, C)), set(0, 2, avg2(B, C));
      set(2, 0, avg2(C, D)), set(1, 2, avg2(C, D));
      set(3, 0, avg2(D, E)), set(2, 2, avg2(D, E));
      set(0, 1, avg3(A, B, C));
      set(1, 1, avg3(B, C, D)), set(0, 3, avg3(B, C, D));
      set(2, 1, avg3(C, D, E)), set(1, 3, avg3(C, D, E));
      set(3, 1, avg3(D, E, F)), set(2, 3, avg3(D, E, F));
      set(3, 2, avg3(E, F, G));
      set(3, 3, avg3(F, G, H));
      return;
    case 8: // HD
      set(0, 0, avg2(I, X)), set(2, 1, avg2(I, X));
      set(0, 1, avg2(J, I)), set(2, 2, avg2(J, I));
      set(0, 2, avg2(K, J)), set(2, 3, avg2(K, J));
      set(0, 3, avg2(L, K));
      set(3, 0, avg3(A, B, C));
      set(2, 0, avg3(X, A, B));
      set(1, 0, avg3(I, X, A)), set(3, 1, avg3(I, X, A));
      set(1, 1, avg3(J, I, X)), set(3, 2, avg3(J, I, X));
      set(1, 2, avg3(K, J, I)), set(3, 3, avg3(K, J, I));
      set(1, 3, avg3(L, K, J));
      return;
    default: // 9: HU
      set(0, 0, avg2(I, J));
      set(2, 0, avg2(J, K)), set(0, 1, avg2(J, K));
      set(2, 1, avg2(K, L)), set(0, 2, avg2(K, L));
      set(1, 0, avg3(I, J, K));
      set(3, 0, avg3(J, K, L)), set(1, 1, avg3(J, K, L));
      set(3, 1, avg3(K, L, L)), set(1, 2, avg3(K, L, L));
      for (const [x, y] of [[3, 2], [2, 2], [0, 3], [1, 3], [2, 3], [3, 3]]) set(x!, y!, L);
      return;
  }
}

// Loop filter primitives (RFC 6386 section 15, libwebp dsp/dec.c).

function doFilter2(b: Uint8Array, p: number, step: number) {
  const p1 = b[p - 2 * step]!, p0 = b[p - step]!, q0 = b[p]!, q1 = b[p + step]!;
  const a = 3 * (q0 - p0) + sclip1(p1 - q1);
  const a1 = sclip2((a + 4) >> 3);
  const a2 = sclip2((a + 3) >> 3);
  b[p - step] = clip1(p0 + a2);
  b[p] = clip1(q0 - a1);
}

function doFilter4(b: Uint8Array, p: number, step: number) {
  const p1 = b[p - 2 * step]!, p0 = b[p - step]!, q0 = b[p]!, q1 = b[p + step]!;
  const a = 3 * (q0 - p0);
  const a1 = sclip2((a + 4) >> 3);
  const a2 = sclip2((a + 3) >> 3);
  const a3 = (a1 + 1) >> 1;
  b[p - 2 * step] = clip1(p1 + a3);
  b[p - step] = clip1(p0 + a2);
  b[p] = clip1(q0 - a1);
  b[p + step] = clip1(q1 - a3);
}

function doFilter6(b: Uint8Array, p: number, step: number) {
  const p2 = b[p - 3 * step]!, p1 = b[p - 2 * step]!, p0 = b[p - step]!;
  const q0 = b[p]!, q1 = b[p + step]!, q2 = b[p + 2 * step]!;
  const a = sclip1(3 * (q0 - p0) + sclip1(p1 - q1));
  const a1 = (27 * a + 63) >> 7;
  const a2 = (18 * a + 63) >> 7;
  const a3 = (9 * a + 63) >> 7;
  b[p - 3 * step] = clip1(p2 + a3);
  b[p - 2 * step] = clip1(p1 + a2);
  b[p - step] = clip1(p0 + a1);
  b[p] = clip1(q0 - a1);
  b[p + step] = clip1(q1 - a2);
  b[p + 2 * step] = clip1(q2 - a3);
}

const hev = (b: Uint8Array, p: number, step: number, thresh: number) =>
  Math.abs(b[p - 2 * step]! - b[p - step]!) > thresh || Math.abs(b[p + step]! - b[p]!) > thresh;

const needsFilter = (b: Uint8Array, p: number, step: number, t: number) =>
  4 * Math.abs(b[p - step]! - b[p]!) + Math.abs(b[p - 2 * step]! - b[p + step]!) <= t;

function needsFilter2(b: Uint8Array, p: number, step: number, t: number, it: number): boolean {
  const p3 = b[p - 4 * step]!, p2 = b[p - 3 * step]!, p1 = b[p - 2 * step]!, p0 = b[p - step]!;
  const q0 = b[p]!, q1 = b[p + step]!, q2 = b[p + 2 * step]!, q3 = b[p + 3 * step]!;
  if (4 * Math.abs(p0 - q0) + Math.abs(p1 - q1) > t) return false;
  return (
    Math.abs(p3 - p2) <= it &&
    Math.abs(p2 - p1) <= it &&
    Math.abs(p1 - p0) <= it &&
    Math.abs(q3 - q2) <= it &&
    Math.abs(q2 - q1) <= it &&
    Math.abs(q1 - q0) <= it
  );
}

/** Across a horizontal edge at `p` (16 pixels along the row). */
function simpleV16(b: Uint8Array, p: number, stride: number, thresh: number) {
  const t2 = 2 * thresh + 1;
  for (let i = 0; i < 16; i++) if (needsFilter(b, p + i, stride, t2)) doFilter2(b, p + i, stride);
}

/** Across a vertical edge at `p` (16 pixels down the column). */
function simpleH16(b: Uint8Array, p: number, stride: number, thresh: number) {
  const t2 = 2 * thresh + 1;
  for (let i = 0; i < 16; i++) if (needsFilter(b, p + i * stride, 1, t2)) doFilter2(b, p + i * stride, 1);
}

function loop26(b: Uint8Array, p: number, hstride: number, vstride: number, size: number, thresh: number, ithresh: number, hevThresh: number) {
  const t2 = 2 * thresh + 1;
  for (let i = 0; i < size; i++, p += vstride) {
    if (needsFilter2(b, p, hstride, t2, ithresh)) {
      if (hev(b, p, hstride, hevThresh)) doFilter2(b, p, hstride);
      else doFilter6(b, p, hstride);
    }
  }
}

function loop24(b: Uint8Array, p: number, hstride: number, vstride: number, size: number, thresh: number, ithresh: number, hevThresh: number) {
  const t2 = 2 * thresh + 1;
  for (let i = 0; i < size; i++, p += vstride) {
    if (needsFilter2(b, p, hstride, t2, ithresh)) {
      if (hev(b, p, hstride, hevThresh)) doFilter2(b, p, hstride);
      else doFilter4(b, p, hstride);
    }
  }
}

// YUV to RGB, libwebp's fixed point (BT.601, limited range).
const multHi = (v: number, c: number) => (v * c) >> 8;
const clip8 = (v: number) => ((v & ~16383) === 0 ? v >> 6 : v < 0 ? 0 : 255);

function putRgb(out: Uint8Array, o: number, y: number, u: number, v: number) {
  out[o] = clip8(multHi(y, 19077) + multHi(v, 26149) - 14234);
  out[o + 1] = clip8(multHi(y, 19077) - multHi(u, 6419) - multHi(v, 13320) + 8708);
  out[o + 2] = clip8(multHi(y, 19077) + multHi(u, 33050) - 17685);
}

/**
 * One or two output rows from one row of chroma above and one below
 * (libwebp's UpsampleRgbaLinePair): each chroma sample is weighted 9-3-3-1
 * by distance, the "fancy" upsampling libwebp does by default.
 */
function upsamplePair(
  f: Vp8Frame,
  out: Uint8Array,
  topRow: number,
  bottomRow: number,
  topUv: number,
  curUv: number,
) {
  const w = f.width;
  const Y = f.y, U = f.u, V = f.v;
  const ty = topRow * f.yStride;
  const by = bottomRow * f.yStride;
  const tu = topUv * f.uvStride;
  const cu = curUv * f.uvStride;
  const to = topRow * w * 4;
  const bo = bottomRow * w * 4;
  const hasBottom = bottomRow >= 0;
  const last = (w - 1) >> 1;

  let tlU = U[tu]!, tlV = V[tu]!;
  let lU = U[cu]!, lV = V[cu]!;
  putRgb(out, to, Y[ty]!, (3 * tlU + lU + 2) >> 2, (3 * tlV + lV + 2) >> 2);
  if (hasBottom) putRgb(out, bo, Y[by]!, (3 * lU + tlU + 2) >> 2, (3 * lV + tlV + 2) >> 2);
  for (let x = 1; x <= last; x++) {
    const tU = U[tu + x]!, tV = V[tu + x]!;
    const cU = U[cu + x]!, cV = V[cu + x]!;
    const avgU = tlU + tU + lU + cU + 8;
    const avgV = tlV + tV + lV + cV + 8;
    const d12U = (avgU + 2 * (tU + lU)) >> 3, d12V = (avgV + 2 * (tV + lV)) >> 3;
    const d03U = (avgU + 2 * (tlU + cU)) >> 3, d03V = (avgV + 2 * (tlV + cV)) >> 3;
    putRgb(out, to + (2 * x - 1) * 4, Y[ty + 2 * x - 1]!, (d12U + tlU) >> 1, (d12V + tlV) >> 1);
    putRgb(out, to + 2 * x * 4, Y[ty + 2 * x]!, (d03U + tU) >> 1, (d03V + tV) >> 1);
    if (hasBottom) {
      putRgb(out, bo + (2 * x - 1) * 4, Y[by + 2 * x - 1]!, (d03U + lU) >> 1, (d03V + lV) >> 1);
      putRgb(out, bo + 2 * x * 4, Y[by + 2 * x]!, (d12U + cU) >> 1, (d12V + cV) >> 1);
    }
    tlU = tU;
    tlV = tV;
    lU = cU;
    lV = cV;
  }
  if (!(w & 1)) {
    putRgb(out, to + (w - 1) * 4, Y[ty + w - 1]!, (3 * tlU + lU + 2) >> 2, (3 * tlV + lV + 2) >> 2);
    if (hasBottom) {
      putRgb(out, bo + (w - 1) * 4, Y[by + w - 1]!, (3 * lU + tlU + 2) >> 2, (3 * lV + tlV + 2) >> 2);
    }
  }
}

/** The frame as RGBA, alpha 255 (libwebp's EmitFancyRGB over the whole frame). */
export function vp8ToRgba(f: Vp8Frame): Uint8Array {
  const { width: w, height: h } = f;
  const out = new Uint8Array(w * h * 4);
  upsamplePair(f, out, 0, -1, 0, 0);
  let y = 0;
  let uv = 0;
  for (; y + 2 < h; y += 2) {
    upsamplePair(f, out, y + 1, y + 2, uv, uv + 1);
    uv++;
  }
  if (!(h & 1)) upsamplePair(f, out, h - 1, -1, uv, uv);
  for (let i = 3; i < out.length; i += 4) out[i] = 255;

  return out;
}
