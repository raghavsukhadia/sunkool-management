const { existsSync, rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");

if (!existsSync(nextDir)) {
  process.exit(0);
}

try {
  rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  process.exit(0);
} catch (rmError) {
  // OneDrive reparse points can make Node's recursive delete fail on Windows.
  if (process.platform === "win32") {
    const result = spawnSync("cmd.exe", ["/d", "/s", "/c", "rd /s /q .next"], {
      cwd: projectRoot,
      stdio: "inherit",
    });

    if (result.status === 0) {
      process.exit(0);
    }
  }

  console.error("Failed to clean .next before dev startup.");
  console.error(rmError);
  process.exit(1);
}
