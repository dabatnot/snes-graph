import { exportProject } from "./core/snes";
import { demoSources } from "./core/demo";
import type { Project, ExportSet } from "./core/model";
self.onmessage = ({
  data,
}: {
  data: {
    project: Project;
    options: ExportSet;
    demo?: boolean;
    ticks?: number;
  };
}) => {
  try {
    const files = data.demo
      ? demoSources(
          data.project,
          data.project.scenes.find((s) => s.id === data.options.sceneId)!,
          data.ticks,
          data.options,
        )
      : exportProject(data.project, data.options);
    self.postMessage(
      { files },
      { transfer: Object.values(files).map((f) => f.buffer) },
    );
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
};
