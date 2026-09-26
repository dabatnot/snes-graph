-- Run from repository root:
-- Mesen --testrunner artifacts/football/demo/demo.sfc scripts/verify-rom.lua
local frames = 0
emu.addEventCallback(function()
  frames = frames + 1
  if frames == 40 then
    local directory = assert(os.getenv('SNES_GRAPH_TEST_OUTPUT'))
    local file = assert(io.open(directory .. '/mesen.png', 'wb'))
    file:write(emu.takeScreenshot())
    file:close()
    local state = assert(io.open(directory .. '/mesen-state.txt', 'w'))
    for k,v in pairs(emu.getState()) do state:write(k, '=', tostring(v), '\n') end
    state:close()
    emu.stop(0)
  end
end, emu.eventType.endFrame)
