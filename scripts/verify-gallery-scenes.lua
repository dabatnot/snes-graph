local dir=assert(os.getenv('SNES_GRAPH_TEST_OUTPUT'));local n=0
local steps={[20]={a=true},[70]={a=true},[95]={start=true},[125]={start=true},[160]={r=true},[220]={a=true},[245]={start=true},[275]={start=true},[310]={l=true}}
local shots={[80]='mode7-paused',[110]='mode7-info',[145]='mode7-restored',[230]='hdma-paused',[260]='hdma-info',[295]='hdma-restored',[340]='mode7-return'}
emu.addEventCallback(function()
 local i={a=false,b=false,x=false,y=false,l=false,r=false,start=false,select=false,up=false,down=false,left=false,right=false}
 for at,buttons in pairs(steps)do if n>=at and n<at+4 then for k,v in pairs(buttons)do i[k]=v end end end
 emu.setInput(i,0)
end,emu.eventType.inputPolled)
emu.addEventCallback(function()
 n=n+1;local name=shots[n];if name then local f=assert(io.open(dir..'/'..name..'.png','wb'));f:write(emu.takeScreenshot());f:close() end
 if n==350 then emu.stop(0) end
end,emu.eventType.endFrame)
