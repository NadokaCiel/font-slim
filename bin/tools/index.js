import fs from "fs";
import chalk from "chalk";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';

/**
 * @param {string} title
 * @param {string} [message]
 */
export function log(title, message) {
  console.log(chalk.white.bgGreen(title), "\n" + (message || ""));
}

/**
 * @param {string} title
 * @param {string} [message]
 */
export function warn(title, message) {
  console.log(chalk.white.bgRed(title), "\n" + (message || ""));
}

export function getPackageVersion() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = path.join(__dirname, '../..', 'package.json');
    const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
    const parsedPackageJson = JSON.parse(packageJson);
    return parsedPackageJson.version
  } catch (error) {
    warn('无法读取 package.json', error);
  }
}

/**
 * filter characters
 * @param {string} str
 */
export function getChr(str) {
  // const matched = str.match(/[^\x00-\x7F]/g);
  const matched = str.match(/[\s\S]/g);
  return Array.isArray(matched)
    ? matched.filter((ch, pos) => matched.indexOf(ch) === pos).join("")
    : "";
}