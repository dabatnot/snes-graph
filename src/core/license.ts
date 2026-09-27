import { strToU8 } from "fflate";

export const MIT_LICENSE =
  'MIT License\n\nCopyright (c) 2026 David Brugneaux and contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n';
export function licenseRomSources(files: Record<string, Uint8Array>) {
  files["LICENSE.txt"] = strToU8(MIT_LICENSE);
  files["README.txt"] = strToU8(
    new TextDecoder().decode(files["README.txt"]) +
      "\nThe supplied assembly program is licensed under MIT; see LICENSE.txt.\nUser graphics and project assets keep their own ownership and licensing.\n",
  );
  files["main.s"] = strToU8(
    "; Copyright (c) 2026 David Brugneaux and contributors\n; SPDX-License-Identifier: MIT — see LICENSE.txt\n" +
      new TextDecoder().decode(files["main.s"]),
  );
  return files;
}
