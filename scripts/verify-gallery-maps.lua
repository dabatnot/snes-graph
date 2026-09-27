-- Large-map fixture produced by verify-gallery.ts; all four corners and streamed VRAM.
local dir=assert(os.getenv('SNES_GRAPH_TEST_OUTPUT'))
local n=0
local function word(a,t) t=t or emu.memType.snesWorkRam;return emu.read(a,t)+256*emu.read(a+1,t) end
emu.addEventCallback(function()
 local i={a=false,b=false,x=false,y=false,l=false,r=false,start=false,select=false,up=false,down=false,left=false,right=false}
 if n>=20 and n<23 then i.a=true end
 if n>=80 and n<310 then i.right=true;i.down=true;i.a=true end
 if n>=340 and n<570 then i.left=true;i.up=true;i.a=true end
 if n>=620 and n<850 then i.right=true;i.a=true end
 if n>=880 and n<1110 then i.left=true;i.down=true;i.a=true end
 emu.setInput(i,0)
end,emu.eventType.inputPolled)
emu.addEventCallback(function()
 n=n+1
 if n==70 or n==330 or n==600 or n==870 or n==1130 then
  local x,y=word(0x1e),word(0x20)
  local expectedCameras={[70]={0,0},[330]={776,552},[600]={0,0},[870]={776,0},[1130]={0,552}}
  local camera=expectedCameras[n]
  assert(x==camera[1] and y==camera[2], "Camera at "..n)
  local f=assert(io.open(dir..'/large-'..n..'.png','wb'));f:write(emu.takeScreenshot());f:close()
  local f=assert(io.open(dir..'/large-'..n..'.txt','w'));f:write('camera=',x,',',y,'\n')
  local base=word(0x54)*2
  for row=math.floor(y/8),math.floor(y/8)+27 do
   for col=math.floor(x/8),math.floor(x/8)+31 do
    local address=base+2*(math.floor((col%64)/32)*1024+(row%32)*32+(col%32))
    local v=word(address,emu.memType.snesVideoRam)%1024
    local expected=(col+row*3)%2==0 and 2 or 1
    assert(v==expected, "Streamed cell "..col..","..row)
   end
  end
  f:close()
 end
 if n==1140 then emu.stop(0) end
end,emu.eventType.endFrame)
