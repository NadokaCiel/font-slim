#!/usr/bin/env node
import fs from "fs";
import path from "path";
import fontSpider from "font-spider";
import { program } from "commander";
import { log, warn, getChr, getPackageVersion } from "./tools/index.js";
import { ASCIICharset } from "./constants/index.js";
import { promisify } from "util"

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const defaultConfig = {
  textExt: "js|ts|json",
  fontName: "FSFont",
  src: "./tfp",
  hasASCII: true,
}

program
  .version(getPackageVersion())
  .option("-f, --fontName [font name]", "字体名称", defaultConfig.fontName)
  .option("-s, --src [source]", "源码文件夹的路径", defaultConfig.src)
  .option('-t, --textExt [text ext]', '文本文件后缀,用|连接', defaultConfig.textExt)
  .option('-n, --no-ascii', '不默认包含ASCII码', defaultConfig.hasASCII)
  .parse(process.argv);

const {
  src = defaultConfig.src,
  textExt = defaultConfig.textExt,
  fontName = defaultConfig.fontName,
  hasAscii = defaultConfig.hasASCII
} = program.opts();

const fileExtReg = new RegExp(`^\.${textExt}`, "i");
const tempFilePath = path.join(path.resolve(src), "/font.html");


initProcessor();

async function initProcessor() {
  const dir = path.resolve(src);
  const content = await getAllText(dir)
  log(`文本包含${content.length}个字符`, content);
  if (content.length) {
    await generateFakeHtml(content);
    runFontSpider()
  }
}

/**
 * Walk through all files in `dir`
 * @param {string} dir
 */
async function getAllText(dir) {
  try {
    const files = await readdir(dir);
    const contents = await Promise.all(files.map(async (file) => {
      const filepath = path.join(dir, file);
      const stats = await stat(filepath);

      if (stats.isDirectory()) {
        return await getAllText(filepath);
      } else if (stats.isFile() && fileExtReg.test(path.extname(filepath))) {
        const content = await readFile(filepath, { encoding: 'utf8' });
        return getChr(content);
      }
      return '';
    }));

    return contents.reduce((all, folderContents) => all + folderContents, '');
  } catch (error) {
    warn("获取文字失败", error);
    throw error;
  }
}

/**
 * Generate a fake html file for font-spider to walk through
 * @param {string} textContent
 */
async function generateFakeHtml(textContent) {
  try {
    const font = path.join(src, fontName);
    const template = `<html><head><style>@font-face {
      font-family: '${fontName}';
      src: url('./${fontName}.eot');
      src:
        url('./${fontName}.eot?#font-spider') format('embedded-opentype'),
        url('./${fontName}.woff2') format('woff2'),
        url('./${fontName}.woff') format('woff'),
        url('./${fontName}.ttf') format('truetype'),
        url('./${fontName}.svg') format('svg');
      font-weight: normal;
      font-style: normal;
    } .charset { font-family: '${fontName}'; }</style>
    </head><body><div class="charset">${textContent}${hasAscii ? ASCIICharset : ''}</div></body></html>`;

    await writeFile(tempFilePath, template);

    log("html file generated!");
    log("交给字蛛生成字体，源字体位于", font + ".ttf");
  } catch (error) {
    warn("生成html失败", error);
    throw error;
  }
}

function runFontSpider() {
  fontSpider
    .spider(tempFilePath, {
      silent: false,
    })
    .then((webFonts) => {
      return fontSpider.compressor(webFonts, {
        backup: true,
      });
    });
}
