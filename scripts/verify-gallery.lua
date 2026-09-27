-- Mesen --testrunner --debug.scriptWindow.allowIoOsAccess=true ROM scripts/verify-gallery.lua
-- Football gallery controller journey; captures are real emulator output.
local directory = assert(os.getenv('SNES_GRAPH_TEST_OUTPUT'))
local frame = 0
local function word(address) return emu.read(address,emu.memType.snesWorkRam)+256*emu.read(address+1,emu.memType.snesWorkRam) end
local expected = {[35]={1,0,0},[60]={0,0,0},[80]={0,0,1},[125]={0,0,0},[255]={0,1,0},[280]={0,1,1},[410]={0,2,0},[450]={0,2,1},[480]={0,2,0},[510]={1,2,0}}
local steps = {
  [45]={a=true}, [70]={start=true}, [90]={start=true},
  [115]={a=true}, [135]={right=true}, [155]={x=true}, [175]={y=true},
  [200]={b=true}, [220]={down=true}, [240]={a=true},
  [270]={start=true}, [290]={start=true}, [340]={b=true},
  [360]={down=true}, [380]={a=true}, [420]={a=true},
  [440]={start=true}, [460]={start=true}, [490]={b=true}
}
local captures = { [35]='home', [60]='sprite', [80]='sprite-info', [125]='sprite-paused', [145]='sprite-step', [165]='sprite-variant', [185]='sprite-background', [255]='map', [280]='map-info', [325]='map-scroll', [410]='scene', [430]='scene-paused', [450]='scene-info', [480]='scene-restored', [510]='home-return' }
emu.addEventCallback(function()
  local input={a=false,b=false,x=false,y=false,l=false,r=false,start=false,select=false,up=false,down=false,left=false,right=false}
  for at,buttons in pairs(steps) do if frame>=at and frame<at+3 then for k,v in pairs(buttons) do input[k]=v end end end
  if frame>=300 and frame<325 then input.right=true;input.down=true;input.a=true end
  emu.setInput(input,0)
end,emu.eventType.inputPolled)
emu.addEventCallback(function()
  frame=frame+1
  if expected[frame] then
    local e=expected[frame]
    assert(word(0x0e)==e[1] and word(0x0c)==e[2] and word(0x10)==e[3], "Gallery navigation state at "..frame)
  end
  if frame==325 then
    -- The framed viewport starts above world row zero. Crossing zero while
    -- scrolling must upload row 28 rather than leave its initial blank border.
    assert(word(0x3000+28*64)%1024 ~= word(0x56), "Map row 28 lost while scrolling across zero")
  end
  local name=captures[frame]
  if name then
    local f=assert(io.open(directory..'/'..name..'.png','wb'));f:write(emu.takeScreenshot());f:close()
    local state=assert(io.open(directory..'/'..name..'.txt','w'))
    for address=0,0x58,2 do state:write(string.format('ram.%02x=%d\n',address,emu.read(address,emu.memType.snesWorkRam)+256*emu.read(address+1,emu.memType.snesWorkRam))) end
    for k,v in pairs(emu.getState()) do state:write(k,'=',tostring(v),'\n') end
    state:close()
  end
  if frame==520 then emu.stop(0) end
end,emu.eventType.endFrame)
