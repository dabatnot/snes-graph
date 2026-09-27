import { exportProject } from "./core/snes";
import {
  gallerySources,
  type ExportKind,
  type GalleryLanguage,
} from "./core/gallery";
import { demoSources } from "./core/demo";
import type { Project, ExportSet } from "./core/model";
self.onmessage = ({
  data,
}: {
  data: {
    project: Project;
    options: ExportSet;
    kind?: ExportKind;
    language?: GalleryLanguage;
    ticks?: number;
  };
}) => {
  try {
    const files =
      data.kind === "gallery"
        ? gallerySources(data.project, data.options, data.ticks, data.language)
        : data.kind === "scene"
          ? demoSources(
              data.project,
              data.project.scenes.find((s) => s.id === data.options.sceneId)!,
              data.ticks,
              data.options,
            )
          : exportProject(data.project, data.options);
    self.postMessage(
      { files },
      { transfer: [...new Set(Object.values(files).map((f) => f.buffer))] },
    );
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
};
