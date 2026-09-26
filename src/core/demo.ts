import { strToU8 } from "fflate";
import { defaultExport, exportProject, packSprites, buildTiles } from "./snes";
import { compileScene, type SceneMemory } from "./scene-export";
import type { Project, Scene, ExportSet } from "./model";

const hex = (n: number, digits = 2) =>
  "$" + (n >>> 0).toString(16).padStart(digits, "0");
const write = (address: number, value: number) =>
  `  lda #${hex(value & 255)}\n  sta ${hex(address, 4)}\n`;
const dma = (label: string, bytes: number, mode: number, port: number) =>
  write(0x4300, mode) +
  write(0x4301, port) +
  `  ldx #.loword(${label})\n  stx $4302\n` +
  write(0x4304, 0) +
  `  lda #^${label}\n  sta $4304\n  ldx #${hex(bytes & 65535, 4)}\n  stx $4305\n` +
  write(0x420b, 1);

/** A small, self-contained ca65 ROM. No game runtime or proprietary assets. */
export function demoSources(
  p: Project,
  s: Scene,
  ticks = p.fps * 2,
  options: ExportSet = defaultExport(p, s.id),
): Record<string, Uint8Array> {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 600)
    throw new Error("Demo duration: 1…600 frames");
  const opt = { ...options, sceneId: s.id },
    files = exportProject(p, opt),
    packed = packSprites(p, opt.actorIds),
    built = new Map(opt.sheetIds.map((id) => [id, buildTiles(p, id, opt)]));
  const first = compileScene(p, s, files, packed, built),
    out: Record<string, Uint8Array> = {};
  out["vram0.bin"] = first.vram.slice(0, 32768);
  out["vram1.bin"] = first.vram.slice(32768);
  const banks: string[] = ["", "", ""];
  let bank = 3,
    bankBytes = 0;
  const frames: string[] = [];
  let previous: SceneMemory = compileScene(
    p,
    s,
    files,
    packed,
    built,
    ticks - 1,
  );
  for (let tick = 0; tick < ticks; tick++) {
    const m =
        tick === 0 ? first : compileScene(p, s, files, packed, built, tick),
      label = "Frame" + tick;
    const chunks: { name: string; data: Uint8Array }[] = [
      { name: label + "Oam", data: m.oam },
      { name: label + "Cgram", data: m.cgram },
    ];
    let code =
      `${label}:\n` +
      write(0x420c, 0) +
      write(0x2102, 0) +
      write(0x2103, 0) +
      dma(label + "Oam", 544, 0, 4) +
      write(0x2121, 0) +
      dma(label + "Cgram", 512, 0, 0x22);
    let transfer = 1056;
    for (let i = 0; i < 65536;) {
      if (m.vram[i] === previous.vram[i]) {
        i++;
        continue;
      }
      const start = i & ~1;
      let end = start + 2;
      while (
        end < 65536 &&
        (m.vram[end] !== previous.vram[end] ||
          m.vram[end + 1] !== previous.vram[end + 1])
      )
        end += 2;
      const name = label + "Vram" + start;
      chunks.push({ name, data: m.vram.slice(start, end) });
      transfer += end - start;
      code +=
        write(0x2115, 0x80) +
        `  ldx #${hex(start / 2, 4)}\n  stx $2116\n` +
        dma(name, end - start, 1, 0x18);
      i = end;
    }
    if (transfer > 4096)
      throw new Error(
        `Demo frame ${tick}: ${transfer} DMA bytes exceed the 4096-byte preview budget`,
      );
    for (const [address, value] of m.registers) code += write(address, value);
    let hdmaMask = 0;
    for (const h of m.hdma) {
      const name = label + "Hdma" + h.channel,
        base = 0x4300 + h.channel * 16;
      chunks.push({ name, data: h.data });
      hdmaMask |= 1 << h.channel;
      code +=
        write(base, h.mode) +
        write(base + 1, h.register) +
        `  ldx #.loword(${name})\n  stx ${hex(base + 2, 4)}\n  lda #^${name}\n  sta ${hex(base + 4, 4)}\n`;
    }
    code += write(0x420c, hdmaMask) + "  rtl\n";
    const clockBudget = (262 - s.height - 2) * 1364;
    const clocks =
      transfer * 8 +
      code.split("\n").filter((line) => line.startsWith("  ")).length * 64 +
      1024;
    if (clocks > clockBudget)
      throw new Error(
        `Demo frame ${tick}: too many transfers/register writes for the preview vblank budget (${clocks}/${clockBudget} estimated master clocks)`,
      );
    // Conservative code size bound keeps every incbin and DMA source within one LoROM bank.
    const estimate =
      chunks.reduce((n, c) => n + c.data.length, 0) +
      code.split("\n").length * 3;
    if (estimate > 32768)
      throw new Error("Demo frame does not fit one ROM bank");
    if (bankBytes + estimate > 32768) {
      bank++;
      bankBytes = 0;
    }
    bankBytes += estimate;
    banks[bank] = (banks[bank] ?? "") + code;
    for (const c of chunks) {
      out[c.name + ".bin"] = c.data;
      banks[bank] += `${c.name}: .incbin "${c.name}.bin"\n`;
    }
    frames.push(`.faraddr ${label}`);
    previous = m;
  }
  let count = 4;
  while (count <= bank) count *= 2;
  if (count > 128) throw new Error("Demo exceeds 4 MiB LoROM");
  let cfg = "MEMORY {\n";
  for (let n = 0; n < count; n++)
    cfg += ` B${n}: start=$${(n * 65536 + 32768).toString(16)}, size=$8000, file=%O, fill=yes, fillval=$00;\n`;
  cfg +=
    "}\nSEGMENTS {\n CODE: load=B0,type=ro;\n HEADER: load=B0,type=ro,start=$FFC0;\n VECTORS: load=B0,type=ro,start=$FFE0;\n";
  for (let n = 1; n < count; n++)
    cfg += ` DATA${n}: load=B${n},type=ro,optional=yes;\n`;
  cfg += "}\n";
  let asm =
    `.setcpu "65816"\n.smart\n.segment "CODE"\nReset:\n  sei\n  clc\n  xce\n  rep #$38\n  .a16\n  .i16\n  ldx #$1fff\n  txs\n  lda #0\n  tcd\n  sep #$20\n  .a8\n  phk\n  plb\n` +
    write(0x2100, 0x80) +
    write(0x4200, 0) +
    write(0x420c, 0) +
    write(0x420b, 0);
  // Reset relevant PPU registers and both write latches, regardless of emulator power-on state.
  for (let r = 0x2101; r <= 0x2133; r++) {
    if ([0x2104, 0x2118, 0x2119, 0x2122].includes(r)) continue;
    asm += write(r, 0);
    if ((r >= 0x210d && r <= 0x2114) || (r >= 0x211b && r <= 0x2120))
      asm += write(r, 0);
  }
  asm +=
    write(0x2115, 0x80) +
    "  ldx #0\n  stx $2116\n" +
    dma("Vram0", 32768, 1, 0x18) +
    "  ldx #$4000\n  stx $2116\n" +
    dma("Vram1", 32768, 1, 0x18) +
    // HDMA table addresses are initialized at the start of a frame. Enable
    // the first set during vblank, never in the middle of visible scanlines.
    `WaitActive:\n  bit $4212\n  bmi WaitActive\nWaitBlank:\n  bit $4212\n  bpl WaitBlank\n  ldx #0\n  stx $04\n  jsr LoadFrame\n` +
    write(0x2100, 15) +
    write(0x4200, 0x80) +
    `Main:\n  wai\n  bra Main\nNmi:\n  php\n  rep #$30\n  pha\n  phx\n  phy\n  phb\n  phk\n  plb\n  sep #$20\n  .a8\n  lda $4210\n  jsr LoadFrame\n  rep #$20\n  .a16\n  lda $04\n  inc\n  cmp #${ticks}\n  bcc :+\n  lda #0\n: sta $04\n  plb\n  ply\n  plx\n  pla\n  plp\n  rti\nLoadFrame:\n  rep #$20\n  .a16\n  lda $04\n  asl\n  clc\n  adc $04\n  tax\n  lda FramePointers,x\n  sta $00\n  sep #$20\n  .a8\n  lda FramePointers+2,x\n  sta $02\n  jsl Dispatch\n  rts\nDispatch:\n  jml [$0000]\nIrq:\n  rti\nFramePointers:\n${frames.join("\n")}\n.segment "HEADER"\n.byte "SNES GRAPH DEMO      "\n.byte $20,$00,${Math.log2(count * 32)},$00,${p.fps === 50 ? "$02" : "$01"},$00,$00\n.word $ffff,$0000\n.segment "VECTORS"\n.word $0000,$0000,Irq,Irq,Irq,Nmi,$0000,Irq\n.word $0000,$0000,Irq,$0000,Irq,Nmi,Reset,Irq\n.segment "DATA1"\nVram0: .incbin "vram0.bin"\n.segment "DATA2"\nVram1: .incbin "vram1.bin"\n`;
  for (let n = 3; n < banks.length; n++)
    asm += `.segment "DATA${n}"\n${banks[n]}`;
  out["main.s"] = strToU8(asm);
  out["lorom.cfg"] = strToU8(cfg);
  out["README.txt"] = strToU8(
    `SNES Graph preview: ${ticks} frames at ${p.fps} Hz.\nca65 main.s -o main.o\nld65 -C lorom.cfg main.o -o demo.sfc\nThe generated ROM loops this preview. It is not a game runtime.\nHardware validation is separate from emulator validation.\n`,
  );
  return out;
}
export function fixRomChecksum(rom: Uint8Array) {
  rom[0x7fdc] = 255;
  rom[0x7fdd] = 255;
  rom[0x7fde] = 0;
  rom[0x7fdf] = 0;
  const sum = rom.reduce((n, v) => (n + v) & 65535, 0);
  rom[0x7fde] = sum & 255;
  rom[0x7fdf] = sum >> 8;
  rom[0x7fdc] = ~sum & 255;
  rom[0x7fdd] = (~sum >> 8) & 255;
  return rom;
}
