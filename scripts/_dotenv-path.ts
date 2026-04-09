import path from "node:path";
import { config } from "dotenv";

const cwd = process.cwd();

/**
 * Load Next.js-style env files for CLI scripts (tsx/node), then `import "dotenv/config"`.
 *
 * - Default: `.env.local` then `.env` (first wins for each key in dotenv's merge, so shared
 *   keys keep the value from `.env.local`).
 * - If `DOTENV_CONFIG_PATH` is set, only that file is loaded here (relative paths resolve from cwd).
 *
 * A follow-up `import "dotenv/config"` still loads `.env` by default; existing keys are not
 * overwritten unless `DOTENV_CONFIG_OVERRIDE` is set.
 */
const explicit = process.env.DOTENV_CONFIG_PATH?.trim();
if (explicit) {
  const resolved = path.isAbsolute(explicit) ? explicit : path.resolve(cwd, explicit);
  config({ path: resolved });
} else {
  config({
    path: [path.resolve(cwd, ".env.local"), path.resolve(cwd, ".env")],
  });
}
