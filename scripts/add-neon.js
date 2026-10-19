"use strict";
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html"));

for (const file of files) {
  const full = path.join(dir, file);
  let s = fs.readFileSync(full, "utf8");
  let changed = false;

  if (!s.includes("neon.css")) {
    if (s.includes('href="magic-bento.css"')) {
      s = s.replace(/([ \t]*<link rel="stylesheet" href="magic-bento.css" \/>)/, '$1\n  <link rel="stylesheet" href="neon.css" />');
    } else {
      s = s.replace(/([ \t]*<link rel="stylesheet" href="styles.css" \/>)/, '$1\n  <link rel="stylesheet" href="neon.css" />');
    }
    changed = true;
  }

  if (!s.includes("neon.js")) {
    if (s.includes('<script src="home.js"></script>')) {
      s = s.replace('<script src="home.js"></script>', '<script src="neon.js"></script>\n  <script src="home.js"></script>');
    } else if (s.includes('<script src="intro.js"></script>')) {
      s = s.replace('<script src="intro.js"></script>', '<script src="neon.js"></script>\n  <script src="intro.js"></script>');
    } else {
      s = s.replace("</body>", '  <script src="neon.js"></script>\n</body>');
    }
    changed = true;
  }

  if (changed) fs.writeFileSync(full, s);
  console.log((changed ? "updated " : "ok      ") + file);
}
