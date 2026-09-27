import { releaseMarkdown } from "../src/help/releases";
const language = process.argv[2] ?? "fr";
if (language !== "fr" && language !== "en")
  throw new Error("Usage: npm run release:notes -- fr|en");
process.stdout.write(releaseMarkdown(language));
