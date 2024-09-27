#!/usr/bin/env node
import fs from "fs";
import path from "path";
import chalk from "chalk";
import fontSpider from "font-spider"
import { program } from "commander";

const defaultFileTypes = "js|ts|json",
  defaultFontName = "FSFont",
  defaultFontPath = `./`,
  defaultSrcPath = "./tfp",
  defaultASCII = true;

program
  .version(getPackageVersion())
  .option("-f, --fontName [font name]", "字体名称", defaultFontName)
  .option("-s, --src [source]", "源码文件夹的路径", defaultSrcPath)
  .option("--fontPath [font path]", "字体路径", defaultFontPath)
  .option('-t, --filetypes [file types]', '接受的文件后缀,用|连接', defaultFileTypes)
  .option('-n, --no-ascii', '不默认包含ASCII码', defaultASCII)
  .parse(process.argv);

const {
  src = defaultSrcPath,
  filetypes = defaultFileTypes,
  fontPath = defaultFontPath,
  fontName = defaultFontName,
  ascii = defaultASCII
} = program.opts();

const tempFilePath = path.resolve("./tfp") + "/index.html";

const fileExtReg = new RegExp(`^\.${filetypes}`, "i");

const defaultCharset = ` !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_\`abcdefghijklmnopqrstuvwxyz{|}~`;

doJob(src);

function getPackageVersion() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  try {
    const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
    const parsedPackageJson = JSON.parse(packageJson);
    return parsedPackageJson.version
  } catch (error) {
    console.error('无法读取 package.json', error);
  }
}

/**
 * filter characters
 * @param {string} str
 */
function getChr(str) {
  // const matched = str.match(/[^\x00-\x7F]/g);
  const matched = str.match(/[\s\S]/g);
  return Array.isArray(matched)
    ? matched.filter((ch, pos) => matched.indexOf(ch) === pos).join("")
    : "";
}

/**
 * Walk through all files in `dir`
 * @param {string} dir
 */
function walk(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        return reject(error);
      }
      Promise.all(
        files.map((file) => {
          return new Promise((resolve, reject) => {
            const filepath = path.join(dir, file);
            fs.stat(filepath, (error, stats) => {
              if (error) {
                return reject(error);
              }
              if (stats.isDirectory()) {
                walk(filepath).then(resolve);
              } else if (stats.isFile()) {
                // resolve(filepath);
                const ext = path.extname(filepath);
                if (fileExtReg.test(ext)) {
                  fs.readFile(
                    filepath,
                    {
                      encoding: "utf8",
                    },
                    (err, content) => {
                      if (err || typeof content !== "string") {
                        console.error(err);
                        reject(err);
                        return;
                      }
                      resolve(getChr(content));
                    },
                  );
                } else {
                  resolve("");
                }
              }
            });
          });
        }),
      ).then(
        /**
         * @param {string[]} foldersContents
         */
        (foldersContents) => {
          resolve(
            foldersContents.reduce(
              (all, folderContents) => all + folderContents,
              "",
            ),
          );
        },
      );
    });
  });
}

/**
 * Generate a fake html file for font-spider to walk through
 * @param {string} textContent
 */
function generateFakeHtml(textContent, callback) {
  const font = path.join(fontPath, fontName);
  const template = `<html><head><style>@font-face {
        font-family: '${fontName}';
        src: url('${font}.eot');
        src:
          url('${font}.eot?#font-spider') format('embedded-opentype'),
          url('${font}.woff2') format('woff2'),
          url('${font}.woff') format('woff'),
          url('${font}.ttf') format('truetype'),
          url('${font}.svg') format('svg');
        font-weight: normal;
        font-style: normal;
      } .charset { font-family: '${fontName}'; }</style>
      </head><body><div class="charset">${textContent}${ascii ? defaultCharset : ''}`;
  fs.writeFile(tempFilePath, template, (err) => {
    if (err) {
      console.error(err);
      return;
    }

    log("html file generated!");

    log("交给字蛛生成字体，源字体位于", font + ".ttf");
    callback();
  });
}

/**
 * entry
 * @param {string} _dir
 */
function doJob(_dir) {
  const dir = path.resolve(_dir);
  walk(dir).then(
    /**
     * @param {string} content
     */
    (content) => {
      log(`文本包含${content.length}个字符`, content);

      if (content.length) {
        generateFakeHtml(content, runFontSpider);
      }
    },
  );
}

/**
 * @param {string} title
 * @param {string} [message]
 */
function log(title, message) {
  console.log(chalk.white.bgGreen(title), "\n" + (message || ""));
}

/**
 *
 * @param {string} htmlFile
 */
function runFontSpider(htmlFile = tempFilePath) {
  fontSpider
    .spider(htmlFile, {
      silent: false,
    })
    .then(function (webFonts) {
      return fontSpider.compressor(webFonts, {
        backup: true,
      });
    })
    .then(function (webFonts) {
      console.log(webFonts);
    });
}
