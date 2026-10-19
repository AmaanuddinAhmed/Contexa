// Checks that the Contexa UI redesign files are in place.
// Run from the web folder:  node check-ui.mjs
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const EXPECTED = [
  ["src/app/globals.css", "a0e7fc2d6d8e0da5"],
  ["src/app/layout.tsx", "a73a41af940e662d"],
  ["src/app/page.tsx", "ae48604c89ea4d8d"],
  ["src/app/icon.svg", "ae14a9ff102402f4"],
  ["src/app/not-found.tsx", "00be86s255cc2aee4"],
  ["src/app/login/page.tsx", "2175a1c883d752d8"],
  ["src/app/register/page.tsx", "28791bba7daf5d12"],
  ["src/app/profile/page.tsx", "89c274bfacba9b54"],
  ["src/app/context/page.tsx", "faf63ba846164d70"],
  ["src/app/recommendations/page.tsx", "5a2c3f299c61f617"],
  ["src/app/connections/page.tsx", "7614cfab88f6f971"],
  ["src/app/messages/page.tsx", "61e5067800c20ea1"],
  ["src/app/map/page.tsx", "d19b6a5d82f00dba"],
  ["src/app/feedback/page.tsx", "da23cdc1a77cec5b"],
  ["src/app/admin/page.tsx", "69231e6731dd9076"],
  ["src/components/SiteHeader.tsx", "15eaa5f36c454a6f"],
  ["src/components/Logo.tsx", "e71e1d7a5a025621"],
  ["src/components/ScanRadar.tsx", "d74608129780af3a"],
  ["src/components/ScanPanel.tsx", "98ef472de7ee256b"],
  ["src/components/MatchCard.tsx", "c633648ddce48fdb"],
  ["src/components/Segmented.tsx", "6cd22d599a0cc4d7"],
  ["src/components/AuthShell.tsx", "ecafdbc443280660"],
  ["src/components/Avatar.tsx", "fced979f2bb1baca"],
  ["src/components/FormBits.tsx", "e031f71f34b90267"],
  ["src/components/OnboardingSteps.tsx", "333f58e518e59a93"],
  ["src/components/MapView.tsx", "773349d508094d05"]
];

const hash = (path) =>
  createHash("sha256")
    .update(readFileSync(path, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex")
    .slice(0, 16);

let problems = 0;
for (const [path, expected] of EXPECTED) {
  if (!existsSync(path)) {
    console.log(`MISSING    ${path}`);
    problems++;
  } else if (hash(path) !== expected) {
    console.log(`DIFFERENT  ${path}`);
    problems++;
  }
}

// Leftovers from copying: renamed delivery files that were never renamed,
// and the old favicon that the new icon.svg replaces.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
for (const path of walk("src")) {
  const normal = path.replace(/\\/g, "/");
  if (/-page\.tsx$/.test(normal) || normal.endsWith("app/favicon.ico")) {
    console.log(`LEFTOVER   ${normal}  (delete it)`);
    problems++;
  }
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const dep of ["@fontsource-variable/geist", "@fontsource-variable/bricolage-grotesque"]) {
  if (!pkg.dependencies?.[dep]) {
    console.log(`NOT INSTALLED  ${dep}  (run: npm install ${dep})`);
    problems++;
  }
}

console.log(problems ? `\n${problems} problem(s) found.` : "All UI files match.");
