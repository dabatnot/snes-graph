-- Mesen 2 --testrunner; SNES_GRAPH_TEST_OUTPUT points to one generated example.
local directory = assert(os.getenv('SNES_GRAPH_TEST_OUTPUT'))
local frames = 0
emu.addEventCallback(function()
  emu.setInput({b = (frames >= 20 and frames < 35) or (frames >= 45 and frames < 50)}, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  frames = frames + 1
  if frames == 10 or frames == 26 or frames == 40 or frames == 60 then
    local file = assert(io.open(directory .. '/frame-' .. frames .. '.png', 'wb'))
    file:write(emu.takeScreenshot()); file:close()
    local state = assert(io.open(directory .. '/state-' .. frames .. '.txt', 'w'))
    for k,v in pairs(emu.getInput(0)) do state:write(k,'=',tostring(v),'\n') end
    state:close()
  end
  if frames == 60 then emu.stop(0) end
end, emu.eventType.endFrame)
