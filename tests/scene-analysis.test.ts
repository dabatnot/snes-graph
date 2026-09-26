import {it,expect} from "vitest";
import {footballProject,clone} from "../src/core/model";
import {sceneMemory} from "../src/core/scene-analysis";
import {defaultExport,exportProject,objectLoad,diagnose} from "../src/core/snes";
it("uses the same memory allocations and bytes as export",()=>{
 const p=footballProject(),s=p.scenes[0],m=sceneMemory(p,s),files=exportProject(p,defaultExport(p,s.id));
 expect(m.vram).toEqual(files["scene/vram.bin"]);expect(m.cgram).toEqual(files["scene/cgram.bin"]);
 expect(m.allocations).toEqual(JSON.parse(new TextDecoder().decode(files["scene/layout.json"])).allocations);
});
it("locates overloaded rows and their contributing instances",()=>{
 const p=footballProject(),s=p.scenes[0],instance=s.instances[0];
 s.instances=Array.from({length:40},(_,i)=>({...clone(instance),id:`instance-${i}`,x:64,y:80}));
 const load=objectLoad(p,s,0),first=load.rows.findIndex(r=>r.sprites>32||r.slivers>34);
 expect(first).toBeGreaterThanOrEqual(0);expect(load.rows[first].instances).toHaveLength(40);
 expect(diagnose(p,s).find(d=>d.code==="scanline")?.values.line).toBe(first);
});
