import { releaseMarkdown } from "../src/help/releases";
const args = process.argv.slice(2);
const language = args[0] === "fr" || args[0] === "en" ? args.shift()! : "en";
let version: string | undefined;
if (args.length) {
  if (args.length !== 2 || args[0] !== "--version" || !args[1])
    throw new Error(
      "Usage: npm run release:notes -- [fr|en] [--version VERSION]",
    );
  version = args[1];
}
process.stdout.write(releaseMarkdown(language as "fr" | "en", version));
