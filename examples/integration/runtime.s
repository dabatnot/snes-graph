; Copyright (c) 2026 David Brugneaux and contributors
; SPDX-License-Identifier: MIT
; Three deliberately small consumers of SNES Graph exports.
; MODE: 0 = background, 1 = two sprite poses, 2 = B toggles palette.
.setcpu "65816"
.smart
.include "settings.inc"
.macro DMA source, length, mode, port
  lda #mode
  sta $4300
  lda #port
  sta $4301
  ldx #.loword(source)
  stx $4302
  lda #^source
  sta $4304
  ldx #length
  stx $4305
  lda #1
  sta $420b
.endmacro
.segment "CODE"
Reset:
  sei
  clc
  xce
  rep #$38
  .a16
  .i16
  ldx #$1fff
  txs
  lda #0
  tcd
  sep #$20
  .a8
  phk
  plb
  lda #$80
  sta $2100
  stz $4200
  stz $420c
  stz $420b
  stz $00 ; frame counter
  stz $01 ; selected palette
  stz $02 ; previous B state
  ; Clear both halves of the PPU write latches.
  .repeat $33, n
    .if n+1 <> $04 .and n+1 <> $18 .and n+1 <> $19 .and n+1 <> $22
      stz $2101+n
      .if (n+1 >= $0d .and n+1 <= $14) .or (n+1 >= $1b .and n+1 <= $20)
        stz $2101+n
      .endif
    .endif
  .endrepeat
  lda #$80
  sta $2115
  ldx #0
  stx $2116
  DMA Vram0, $8000, 1, $18
  ldx #$4000
  stx $2116
  DMA Vram1, $8000, 1, $18
  .include "registers.inc"
  jsr Upload
WaitActive:
  bit $4212
  bmi WaitActive
WaitBlank:
  bit $4212
  bpl WaitBlank
  lda #15
  sta $2100
  lda #$80
  sta $4200
Main:
  wai
  bra Main
Nmi:
  php
  rep #$30
  pha
  phx
  phy
  phb
  phk
  plb
  sep #$20
  .a8
  lda $4210
  inc $00
  .if MODE = 2
    ; Manual serial read: B is the first controller bit.
    lda #1
    sta $4016
    stz $4016
    lda $4016
    and #1
    cmp $02
    beq NoPress
    sta $02
    cmp #0
    beq NoPress
    lda $01
    eor #1
    sta $01
NoPress:
  .endif
  jsr Upload
  rep #$30
  .a16
  plb
  ply
  plx
  pla
  plp
  rti
Upload:
  sep #$20
  .a8
  stz $2121
  lda $01
  beq Palette0
  DMA Cgram1, 512, 0, $22
  bra PaletteDone
Palette0:
  DMA Cgram0, 512, 0, $22
PaletteDone:
  stz $2102
  stz $2103
  .if MODE = 1
    lda $00
    and #$10
    beq Pose0
    DMA Oam1, 544, 0, $04
    bra PoseDone
  .endif
Pose0:
  DMA Oam0, 544, 0, $04
PoseDone:
  rts
Irq:
  rti
.segment "HEADER"
.byte "SNES GRAPH EXAMPLE   "
.byte $20,$00,$07,$00,$01,$00,$00
.word $ffff,$0000
.segment "VECTORS"
.word 0,0,Irq,Irq,Irq,Nmi,0,Irq
.word 0,0,Irq,0,Irq,Nmi,Reset,Irq
.segment "DATA1"
Vram0: .incbin "vram0.bin"
.segment "DATA2"
Vram1: .incbin "vram1.bin"
.segment "DATA3"
Cgram0: .incbin "cgram0.bin"
Cgram1: .incbin "cgram1.bin"
Oam0: .incbin "oam0.bin"
Oam1: .incbin "oam1.bin"
