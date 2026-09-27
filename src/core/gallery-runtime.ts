/** 65816 gallery shell. All persistent state is in bank-zero WRAM. */
export const galleryRuntime = String.raw`
.setcpu "65816"
.smart
.macpack longbranch
PTR = $00
HELD = $04
PRESSED = $06
PREVIOUS = $08
ENTRY = $0a
CATEGORY = $0c
MENU = $0e
PANEL = $10
PAUSED = $12
ANIMATION = $14
FRAME = $16
TIMER = $18
VARIANT = $1a
BACKDROP = $1c
CAMX = $1e
CAMY = $20
TICK = $22
ENDED = $24
OLDX = $28
OLDY = $2a
WORLDX = $2c
WORLDY = $2e
ROWPTR = $30
MAPROWS = $34
MAPWIDTH = $38
MAPHEIGHT = $3a
MAXX = $3c
MAXY = $3e
CENTERX = $40
CENTERY = $42
CELL = $44
DEST = $46
COUNTER = $48
SAVEDX = $4a
SAVEDY = $4c
SCROLLX = $4e
SCROLLY = $50
MAPBASE = $54
BLANK = $56
STEP = $58
HDMAMASK = $5a
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
  rep #$20
  .a16
  ldx #$005e
  lda #0
: sta $00,x
  dex
  dex
  bpl :-
  lda #1
  sta MENU
  jsr ShowMenu
  sep #$20
  .a8
  lda #1
  sta $4200
  jsr Reveal
Main:
  ; Input and preparation take place outside vblank; Draw commits during vblank.
  jsr WaitBlank
  jsr WaitActive
  ; Auto-joypad polling has completed by the end of vblank.
  lda $4218
  sta HELD
  eor PREVIOUS
  and HELD
  sta PRESSED
  lda HELD
  sta PREVIOUS
  jsr Handle
  lda MENU
  ora PANEL
  bne Main
  ldx ENTRY
  jsr CallUpdate
  jsr WaitBlank
  ldx ENTRY
  jsr CallDraw
  jsr EnableHDMA
  bra Main
WaitBlank:
  sep #$20
  .a8
: lda $4212
  bpl :-
  rep #$20
  .a16
  rts
WaitActive:
  sep #$20
  .a8
: lda $4212
  bmi :-
  rep #$20
  .a16
  rts
Black:
  sep #$20
  .a8
  lda #$80
  sta $2100
  stz $420c
  rep #$20
  .a16
  rts
EnableHDMA:
  sep #$20
  .a8
  lda HDMAMASK
  sta $420c
  rep #$20
  .a16
  rts
Reveal:
  jsr WaitActive
  jsr WaitBlank
  jsr EnableHDMA
  sep #$20
  .a8
  lda #15
  sta $2100
  rep #$20
  .a16
  rts
ResetPPU:
  stz HDMAMASK
  sep #$20
  .a8
  stz $420c
  .repeat $33, r
    .if r+1 <> $04 .and r+1 <> $18 .and r+1 <> $19 .and r+1 <> $22
      stz $2101+r
      .if (r+1 >= $0d .and r+1 <= $14) .or (r+1 >= $1b .and r+1 <= $20)
        stz $2101+r
      .endif
    .endif
  .endrepeat
  lda #$80
  sta $2115
  rep #$20
  .a16
  rts
Handle:
  lda PANEL
  beq NotPanel
  lda PRESSED
  and #$9000
  beq HandleDone
  stz PANEL
  jsr Black
  ldx ENTRY
  jsr CallInit
  jsr Reveal
HandleDone:
  rts
NotPanel:
  lda MENU
  jeq InResource
  lda PRESSED
  and #$0c00
  beq MenuChoose
  lda PRESSED
  and #$0800
  beq MenuDown
  lda CATEGORY
  bne :+
  lda #CategoryCount
: dec
  sta CATEGORY
  bra MenuChanged
MenuDown:
  inc CATEGORY
  lda CATEGORY
  cmp #CategoryCount
  bcc MenuChanged
  stz CATEGORY
MenuChanged:
  jsr ShowMenu
  jsr Reveal
MenuChoose:
  lda PRESSED
  and #$0080
  beq HandleDone
  stz MENU
  lda CATEGORY
  asl
  tax
  lda CategoryFirst,x
  sta ENTRY
  jmp NewEntry
InResource:
  lda PRESSED
  and #$8000
  beq :+
  lda #1
  sta MENU
  jsr ShowMenu
  jmp Reveal
: lda PRESSED
  and #$1000
  beq :+
  lda #1
  sta PANEL
  jsr Black
  jsr TextScreen
  ldx ENTRY
  jsr CallInfo
  jsr UploadText
  jmp Reveal
: lda PRESSED
  and #$0030
  beq HandleDone
  lda CATEGORY
  asl
  tax
  lda PRESSED
  and #$0020
  beq NextEntry
  lda ENTRY
  cmp CategoryFirst,x
  bne :+
  lda CategoryEnd,x
: dec
  sta ENTRY
  bra NewEntry
NextEntry:
  inc ENTRY
  lda ENTRY
  cmp CategoryEnd,x
  bcc NewEntry
  lda CategoryFirst,x
  sta ENTRY
NewEntry:
  stz PRESSED
  stz PAUSED
  stz ANIMATION
  stz FRAME
  stz TIMER
  stz VARIANT
  stz BACKDROP
  stz CAMX
  stz CAMY
  stz TICK
  stz ENDED
  ; Per-animation clocks, reset on resource changes, preserved across panels.
  lda #0
  ldx #$03fe
: sta $1000,x
  dex
  dex
  bpl :-
  jsr Black
  ldx ENTRY
  jsr CallInit
  jmp Reveal
Dispatch:
  jml [PTR]
; Text uses its own background and never takes VRAM/palettes from a resource.
Print:
  ldy #0
  sep #$20
  .a8
: lda [PTR],y
  cmp #255
  beq :+
  sta $7e2000,x
  inx
  lda #0
  sta $7e2000,x
  inx
  iny
  bra :-
: rep #$20
  .a16
  rts
UploadText:
  sep #$20
  .a8
  lda #$80
  sta $2115
  ldx #$1000
  stx $2116
  lda #1
  sta $4300
  lda #$18
  sta $4301
  ldx #$2000
  stx $4302
  lda #$7e
  sta $4304
  ldx #2048
  stx $4305
  lda #1
  sta $420b
  rep #$20
  .a16
  rts
; A map has a 64x32 ring in WRAM and VRAM. Its rows are bank-safe ROM records.
MapCell:
  lda BLANK
  sta CELL
  lda WORLDX
  bmi CellDone
  cmp MAPWIDTH
  bcs CellDone
  lda WORLDY
  bmi CellDone
  cmp MAPHEIGHT
  bcs CellDone
  asl
  clc
  adc WORLDY
  tay
  lda [MAPROWS],y
  sta ROWPTR
  iny
  iny
  sep #$20
  .a8
  lda [MAPROWS],y
  sta ROWPTR+2
  rep #$20
  .a16
  lda WORLDX
  asl
  tay
  lda [ROWPTR],y
  sta CELL
CellDone:
  lda WORLDX
  and #31
  sta DEST
  lda WORLDY
  and #31
  asl
  asl
  asl
  asl
  asl
  ora DEST
  sta DEST
  lda WORLDX
  and #32
  asl
  asl
  asl
  asl
  asl
  ora DEST
  asl
  tax
  lda CELL
  sta $7e3000,x
  rts
MapRow:
  lda WORLDX
  sta SAVEDX
  lda #64
  sta COUNTER
: jsr MapCell
  inc WORLDX
  dec COUNTER
  bne :-
  lda SAVEDX
  sta WORLDX
  rts
MapColumn:
  lda WORLDY
  sta SAVEDY
  lda #32
  sta COUNTER
: jsr MapCell
  inc WORLDY
  dec COUNTER
  bne :-
  lda SAVEDY
  sta WORLDY
  rts
MapPosition:
  lda CAMX
  sec
  sbc CENTERX
  sta SCROLLX
  ; Arithmetic shift, needed for centered small maps.
  cmp #$8000
  ror
  cmp #$8000
  ror
  cmp #$8000
  ror
  sta WORLDX
  lda CAMY
  sec
  sbc CENTERY
  sta SCROLLY
  cmp #$8000
  ror
  cmp #$8000
  ror
  cmp #$8000
  ror
  sta WORLDY
  rts
MapPrepare:
  jsr MapPosition
  lda WORLDX
  sta OLDX
  lda WORLDY
  sta OLDY
  lda #1
  sta STEP
  lda HELD
  and #$80
  beq :+
  lda #4
  sta STEP
: lda HELD
  and #$0200
  beq MoveRight
  lda CAMX
  sec
  sbc STEP
  bpl :+
  lda #0
: sta CAMX
MoveRight:
  lda HELD
  and #$0100
  beq MoveUp
  lda CAMX
  clc
  adc STEP
  cmp MAXX
  bcc :+
  lda MAXX
: sta CAMX
MoveUp:
  lda HELD
  and #$0800
  beq MoveDown
  lda CAMY
  sec
  sbc STEP
  bpl :+
  lda #0
: sta CAMY
MoveDown:
  lda HELD
  and #$0400
  beq Moved
  lda CAMY
  clc
  adc STEP
  cmp MAXY
  bcc :+
  lda MAXY
: sta CAMY
Moved:
  jsr MapPosition
  lda WORLDX
  cmp OLDX
  beq MapY
  bcc :+
  clc
  adc #32
: sta WORLDX
  jsr MapColumn
MapY:
  jsr MapPosition
  lda WORLDY
  cmp OLDY
  beq :++
  bcc :+
  clc
  adc #28
: sta WORLDY
  jsr MapRow
: jsr MapPosition
  rts
MapScroll:
  sep #$20
  .a8
  lda SCROLLX
  sta $210d
  lda SCROLLX+1
  sta $210d
  rep #$20
  .a16
  lda SCROLLY
  dec
  sep #$20
  .a8
  sta $210e
  xba
  sta $210e
  rep #$20
  .a16
  rts
; Transfer only entering row/column. Column DMA uses the PPU's 32-word increment.
MapCommit:
  lda WORLDX
  cmp OLDX
  beq CommitY
  bcc :+
  clc
  adc #32
: and #63
  sta DEST
  and #31
  sta CELL
  lda DEST
  and #32
  asl
  asl
  asl
  asl
  asl
  ora CELL
  sta DEST
  ; Gather the strided column into a contiguous 64-byte DMA buffer.
  asl
  tax
  ldy #0
: lda $7e3000,x
  phx
  tyx
  sta $7e4000,x
  plx
  txa
  clc
  adc #64
  tax
  iny
  iny
  cpy #64
  bne :-
  lda DEST
  clc
  adc MAPBASE
  tax
  sep #$20
  .a8
  lda #$81
  sta $2115
  stx $2116
  lda #1
  sta $4300
  lda #$18
  sta $4301
  ldx #$4000
  stx $4302
  lda #$7e
  sta $4304
  ldx #64
  stx $4305
  lda #1
  sta $420b
  rep #$20
  .a16
CommitY:
  lda WORLDY
  cmp OLDY
  beq CommitDone
  bcc :+
  clc
  adc #28
: and #31
  asl
  asl
  asl
  asl
  asl
  sta DEST
  clc
  adc MAPBASE
  tax
  sep #$20
  .a8
  lda #$80
  sta $2115
  stx $2116
  rep #$20
  .a16
  lda DEST
  asl
  clc
  adc #$3000
  tax
  stx $4302
  sep #$20
  .a8
  lda #1
  sta $4300
  lda #$18
  sta $4301
  lda #$7e
  sta $4304
  ldx #64
  stx $4305
  lda #1
  sta $420b
  rep #$20
  .a16
  lda DEST
  clc
  adc MAPBASE
  clc
  adc #1024
  tax
  stx $2116
  lda DEST
  asl
  clc
  adc #$3800
  tax
  stx $4302
  ldx #64
  stx $4305
  sep #$20
  .a8
  lda #1
  sta $420b
  rep #$20
  .a16
CommitDone:
  jmp MapScroll
Irq:
  rti
`;
