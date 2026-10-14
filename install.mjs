#!/usr/bin/env node
// generated from src/install; do not edit
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a2, b) => (typeof require !== "undefined" ? require : a2)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/sisteransi@1.0.5/node_modules/sisteransi/src/index.js
var require_src = __commonJS({
  "node_modules/.pnpm/sisteransi@1.0.5/node_modules/sisteransi/src/index.js"(exports, module) {
    "use strict";
    var ESC2 = "\x1B";
    var CSI2 = `${ESC2}[`;
    var beep = "\x07";
    var cursor3 = {
      to(x, y2) {
        if (!y2) return `${CSI2}${x + 1}G`;
        return `${CSI2}${y2 + 1};${x + 1}H`;
      },
      move(x, y2) {
        let ret = "";
        if (x < 0) ret += `${CSI2}${-x}D`;
        else if (x > 0) ret += `${CSI2}${x}C`;
        if (y2 < 0) ret += `${CSI2}${-y2}A`;
        else if (y2 > 0) ret += `${CSI2}${y2}B`;
        return ret;
      },
      up: (count = 1) => `${CSI2}${count}A`,
      down: (count = 1) => `${CSI2}${count}B`,
      forward: (count = 1) => `${CSI2}${count}C`,
      backward: (count = 1) => `${CSI2}${count}D`,
      nextLine: (count = 1) => `${CSI2}E`.repeat(count),
      prevLine: (count = 1) => `${CSI2}F`.repeat(count),
      left: `${CSI2}G`,
      hide: `${CSI2}?25l`,
      show: `${CSI2}?25h`,
      save: `${ESC2}7`,
      restore: `${ESC2}8`
    };
    var scroll = {
      up: (count = 1) => `${CSI2}S`.repeat(count),
      down: (count = 1) => `${CSI2}T`.repeat(count)
    };
    var erase3 = {
      screen: `${CSI2}2J`,
      up: (count = 1) => `${CSI2}1J`.repeat(count),
      down: (count = 1) => `${CSI2}J`.repeat(count),
      line: `${CSI2}2K`,
      lineEnd: `${CSI2}K`,
      lineStart: `${CSI2}1K`,
      lines(count) {
        let clear = "";
        for (let i2 = 0; i2 < count; i2++)
          clear += this.line + (i2 < count - 1 ? cursor3.up() : "");
        if (count)
          clear += cursor3.left;
        return clear;
      }
    };
    module.exports = { cursor: cursor3, scroll, erase: erase3, beep };
  }
});

// node_modules/.pnpm/@vercel+detect-agent@1.2.7/node_modules/@vercel/detect-agent/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/@vercel+detect-agent@1.2.7/node_modules/@vercel/detect-agent/dist/index.js"(exports, module) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var src_exports = {};
    __export(src_exports, {
      KNOWN_AGENTS: () => KNOWN_AGENTS,
      determineAgent: () => determineAgent2
    });
    module.exports = __toCommonJS(src_exports);
    var import_promises = __require("node:fs/promises");
    var import_node_fs3 = __require("node:fs");
    var DEVIN_LOCAL_PATH = "/opt/.devin";
    var CURSOR = "cursor";
    var CURSOR_CLI = "cursor-cli";
    var CLAUDE = "claude";
    var COWORK = "cowork";
    var DEVIN = "devin";
    var REPLIT = "replit";
    var GEMINI = "gemini";
    var CODEX = "codex";
    var ANTIGRAVITY = "antigravity";
    var AUGMENT_CLI = "augment-cli";
    var OPENCODE = "opencode";
    var GITHUB_COPILOT = "github-copilot";
    var GITHUB_COPILOT_CLI = "github-copilot-cli";
    var V0 = "v0";
    var FX = "fx";
    var EVE = "eve";
    var KNOWN_AGENTS = {
      CURSOR,
      CURSOR_CLI,
      CLAUDE,
      COWORK,
      DEVIN,
      REPLIT,
      GEMINI,
      CODEX,
      ANTIGRAVITY,
      AUGMENT_CLI,
      OPENCODE,
      GITHUB_COPILOT,
      V0,
      FX,
      EVE
    };
    async function determineAgent2() {
      if (process.env.AI_AGENT) {
        const name = process.env.AI_AGENT.trim();
        if (name) {
          if (name === GITHUB_COPILOT || name === GITHUB_COPILOT_CLI) {
            return {
              isAgent: true,
              agent: { name: GITHUB_COPILOT }
            };
          }
          if (name === V0) {
            return {
              isAgent: true,
              agent: { name: V0 }
            };
          }
          return {
            isAgent: true,
            agent: { name }
          };
        }
      }
      if (process.env.CURSOR_TRACE_ID) {
        return { isAgent: true, agent: { name: CURSOR } };
      }
      if (process.env.CURSOR_AGENT || process.env.CURSOR_EXTENSION_HOST_ROLE === "agent-exec") {
        return { isAgent: true, agent: { name: CURSOR_CLI } };
      }
      if (process.env.GEMINI_CLI) {
        return { isAgent: true, agent: { name: GEMINI } };
      }
      if (process.env.CODEX_SANDBOX || process.env.CODEX_CI || process.env.CODEX_THREAD_ID) {
        return { isAgent: true, agent: { name: CODEX } };
      }
      if (process.env.ANTIGRAVITY_AGENT) {
        return { isAgent: true, agent: { name: ANTIGRAVITY } };
      }
      if (process.env.AUGMENT_AGENT) {
        return { isAgent: true, agent: { name: AUGMENT_CLI } };
      }
      if (process.env.OPENCODE === "1" || process.env.OPENCODE_CLIENT) {
        return { isAgent: true, agent: { name: OPENCODE } };
      }
      if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) {
        if (process.env.CLAUDE_CODE_IS_COWORK) {
          return { isAgent: true, agent: { name: COWORK } };
        }
        return { isAgent: true, agent: { name: CLAUDE } };
      }
      if (process.env.REPL_ID) {
        return { isAgent: true, agent: { name: REPLIT } };
      }
      if (process.env.COPILOT_MODEL || process.env.COPILOT_ALLOW_ALL || process.env.COPILOT_GITHUB_TOKEN) {
        return { isAgent: true, agent: { name: GITHUB_COPILOT } };
      }
      try {
        await (0, import_promises.access)(DEVIN_LOCAL_PATH, import_node_fs3.constants.F_OK);
        return { isAgent: true, agent: { name: DEVIN } };
      } catch (_error) {
      }
      return { isAgent: false, agent: void 0 };
    }
  }
});

// src/install/cli.mjs
import fs2 from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// node_modules/.pnpm/@clack+core@1.5.1/node_modules/@clack/core/dist/index.mjs
import { styleText } from "node:util";
import { stdout, stdin } from "node:process";
import * as l from "node:readline";
import l__default from "node:readline";

// node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/utils.js
var getCodePointsLength = /* @__PURE__ */ (() => {
  const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  return (input) => {
    let surrogatePairsNr = 0;
    SURROGATE_PAIR_RE.lastIndex = 0;
    while (SURROGATE_PAIR_RE.test(input)) {
      surrogatePairsNr += 1;
    }
    return input.length - surrogatePairsNr;
  };
})();
var isFullWidth = (x) => {
  return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
var isWideNotCJKTNotEmoji = (x) => {
  return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};

// node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/index.js
var ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
var CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
var CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/yu;
var TAB_RE = /\t{1,1000}/y;
var EMOJI_RE = new RegExp("[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F\\u20E3?))*", "yu");
var LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
var MODIFIER_RE = new RegExp("\\p{M}+", "gu");
var NO_TRUNCATION = { limit: Infinity, ellipsis: "" };
var getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
  const LIMIT = truncationOptions.limit ?? Infinity;
  const ELLIPSIS = truncationOptions.ellipsis ?? "";
  const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION, widthOptions).width : 0);
  const ANSI_WIDTH = 0;
  const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
  const TAB_WIDTH = widthOptions.tabWidth ?? 8;
  const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
  const FULL_WIDTH_WIDTH = 2;
  const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
  const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
  const PARSE_BLOCKS = [
    [LATIN_RE, REGULAR_WIDTH],
    [ANSI_RE, ANSI_WIDTH],
    [CONTROL_RE, CONTROL_WIDTH],
    [TAB_RE, TAB_WIDTH],
    [EMOJI_RE, EMOJI_WIDTH],
    [CJKT_WIDE_RE, WIDE_WIDTH]
  ];
  let indexPrev = 0;
  let index = 0;
  let length = input.length;
  let lengthExtra = 0;
  let truncationEnabled = false;
  let truncationIndex = length;
  let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
  let unmatchedStart = 0;
  let unmatchedEnd = 0;
  let width = 0;
  let widthExtra = 0;
  outer: while (true) {
    if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
      const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
      lengthExtra = 0;
      for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
        const codePoint = char.codePointAt(0) || 0;
        if (isFullWidth(codePoint)) {
          widthExtra = FULL_WIDTH_WIDTH;
        } else if (isWideNotCJKTNotEmoji(codePoint)) {
          widthExtra = WIDE_WIDTH;
        } else {
          widthExtra = REGULAR_WIDTH;
        }
        if (width + widthExtra > truncationLimit) {
          truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
        }
        if (width + widthExtra > LIMIT) {
          truncationEnabled = true;
          break outer;
        }
        lengthExtra += char.length;
        width += widthExtra;
      }
      unmatchedStart = unmatchedEnd = 0;
    }
    if (index >= length) {
      break outer;
    }
    for (let i2 = 0, l2 = PARSE_BLOCKS.length; i2 < l2; i2++) {
      const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i2];
      BLOCK_RE.lastIndex = index;
      if (BLOCK_RE.test(input)) {
        lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
        widthExtra = lengthExtra * BLOCK_WIDTH;
        if (width + widthExtra > truncationLimit) {
          truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
        }
        if (width + widthExtra > LIMIT) {
          truncationEnabled = true;
          break outer;
        }
        width += widthExtra;
        unmatchedStart = indexPrev;
        unmatchedEnd = index;
        index = indexPrev = BLOCK_RE.lastIndex;
        continue outer;
      }
    }
    index += 1;
  }
  return {
    width: truncationEnabled ? truncationLimit : width,
    index: truncationEnabled ? truncationIndex : length,
    truncated: truncationEnabled,
    ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
  };
};
var dist_default = getStringTruncatedWidth;

// node_modules/.pnpm/fast-string-width@3.0.2/node_modules/fast-string-width/dist/index.js
var NO_TRUNCATION2 = {
  limit: Infinity,
  ellipsis: "",
  ellipsisWidth: 0
};
var fastStringWidth = (input, options = {}) => {
  return dist_default(input, NO_TRUNCATION2, options).width;
};
var dist_default2 = fastStringWidth;

// node_modules/.pnpm/fast-wrap-ansi@0.2.2/node_modules/fast-wrap-ansi/lib/main.js
var ESC = "\x1B";
var CSI = "\x9B";
var END_CODE = 39;
var ANSI_ESCAPE_BELL = "\x07";
var ANSI_CSI = "[";
var ANSI_OSC = "]";
var ANSI_SGR_TERMINATOR = "m";
var ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
var GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
var getClosingCode = (openingCode) => {
  if (openingCode >= 30 && openingCode <= 37)
    return 39;
  if (openingCode >= 90 && openingCode <= 97)
    return 39;
  if (openingCode >= 40 && openingCode <= 47)
    return 49;
  if (openingCode >= 100 && openingCode <= 107)
    return 49;
  if (openingCode === 1 || openingCode === 2)
    return 22;
  if (openingCode === 3)
    return 23;
  if (openingCode === 4)
    return 24;
  if (openingCode === 7)
    return 27;
  if (openingCode === 8)
    return 28;
  if (openingCode === 9)
    return 29;
  if (openingCode === 0)
    return 0;
  return void 0;
};
var wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
var wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
var wrapWord = (rows, word, columns) => {
  const characters = word[Symbol.iterator]();
  let isInsideEscape = false;
  let isInsideLinkEscape = false;
  let lastRow = rows.at(-1);
  let visible = lastRow === void 0 ? 0 : dist_default2(lastRow);
  let currentCharacter = characters.next();
  let nextCharacter = characters.next();
  let rawCharacterIndex = 0;
  while (!currentCharacter.done) {
    const character = currentCharacter.value;
    const characterLength = dist_default2(character);
    if (visible + characterLength <= columns) {
      rows[rows.length - 1] += character;
    } else {
      rows.push(character);
      visible = 0;
    }
    if (character === ESC || character === CSI) {
      isInsideEscape = true;
      isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
    }
    if (isInsideEscape) {
      if (isInsideLinkEscape) {
        if (character === ANSI_ESCAPE_BELL) {
          isInsideEscape = false;
          isInsideLinkEscape = false;
        }
      } else if (character === ANSI_SGR_TERMINATOR) {
        isInsideEscape = false;
      }
    } else {
      visible += characterLength;
      if (visible === columns && !nextCharacter.done) {
        rows.push("");
        visible = 0;
      }
    }
    currentCharacter = nextCharacter;
    nextCharacter = characters.next();
    rawCharacterIndex += character.length;
  }
  lastRow = rows.at(-1);
  if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) {
    rows[rows.length - 2] += rows.pop();
  }
};
var stringVisibleTrimSpacesRight = (string) => {
  const words = string.split(" ");
  let last = words.length;
  while (last) {
    if (dist_default2(words[last - 1])) {
      break;
    }
    last--;
  }
  if (last === words.length) {
    return string;
  }
  return words.slice(0, last).join(" ") + words.slice(last).join("");
};
var exec = (string, columns, options = {}) => {
  if (options.trim !== false && string.trim() === "") {
    return "";
  }
  let returnValue = "";
  let escapeCode;
  let escapeUrl;
  const words = string.split(" ");
  let rows = [""];
  let rowLength = 0;
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (options.trim !== false) {
      const row = rows.at(-1) ?? "";
      const trimmed = row.trimStart();
      if (row.length !== trimmed.length) {
        rows[rows.length - 1] = trimmed;
        rowLength = dist_default2(trimmed);
      }
    }
    if (index !== 0) {
      if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
        rows.push("");
        rowLength = 0;
      }
      if (rowLength || options.trim === false) {
        rows[rows.length - 1] += " ";
        rowLength++;
      }
    }
    const wordLength = dist_default2(word);
    if (options.hard && wordLength > columns) {
      const remainingColumns = columns - rowLength;
      const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
      const breaksStartingNextLine = Math.floor((wordLength - 1) / columns);
      if (breaksStartingNextLine < breaksStartingThisLine) {
        rows.push("");
      }
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    if (rowLength + wordLength > columns && rowLength && wordLength) {
      if (options.wordWrap === false && rowLength < columns) {
        wrapWord(rows, word, columns);
        rowLength = dist_default2(rows.at(-1) ?? "");
        continue;
      }
      rows.push("");
      rowLength = 0;
    }
    if (rowLength + wordLength > columns && options.wordWrap === false) {
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    rows[rows.length - 1] += word;
    rowLength += wordLength;
  }
  if (options.trim !== false) {
    rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
  }
  const preString = rows.join("\n");
  let inSurrogate = false;
  for (let i2 = 0; i2 < preString.length; i2++) {
    const character = preString[i2];
    returnValue += character;
    if (!inSurrogate) {
      inSurrogate = character >= "\uD800" && character <= "\uDBFF";
      if (inSurrogate) {
        continue;
      }
    } else {
      inSurrogate = false;
    }
    if (character === ESC || character === CSI) {
      GROUP_REGEX.lastIndex = i2 + 1;
      const groupsResult = GROUP_REGEX.exec(preString);
      const groups = groupsResult?.groups;
      if (groups?.code !== void 0) {
        const code = Number.parseFloat(groups.code);
        escapeCode = code === END_CODE ? void 0 : code;
      } else if (groups?.uri !== void 0) {
        escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
      }
    }
    if (preString[i2 + 1] === "\n") {
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink("");
      }
      const closingCode = escapeCode ? getClosingCode(escapeCode) : void 0;
      if (escapeCode && closingCode) {
        returnValue += wrapAnsiCode(closingCode);
      }
    } else if (character === "\n") {
      if (escapeCode && getClosingCode(escapeCode)) {
        returnValue += wrapAnsiCode(escapeCode);
      }
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink(escapeUrl);
      }
    }
  }
  return returnValue;
};
var CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
  return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join("\n");
}

// node_modules/.pnpm/@clack+core@1.5.1/node_modules/@clack/core/dist/index.mjs
var import_sisteransi = __toESM(require_src(), 1);
import { ReadStream } from "node:tty";
function findCursor(s, o, l2) {
  if (!l2.some((r2) => !r2.disabled))
    return s;
  const t2 = s + o, n3 = Math.max(l2.length - 1, 0), e = t2 < 0 ? n3 : t2 > n3 ? 0 : t2;
  return l2[e]?.disabled ? findCursor(e, o < 0 ? -1 : 1, l2) : e;
}
var a$1 = ["up", "down", "left", "right", "space", "enter", "cancel"];
var t = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var settings = {
  actions: new Set(a$1),
  aliases: /* @__PURE__ */ new Map([
    // vim support
    ["k", "up"],
    ["j", "down"],
    ["h", "left"],
    ["l", "right"],
    ["", "cancel"],
    // opinionated defaults!
    ["escape", "cancel"]
  ]),
  messages: {
    cancel: "Canceled",
    error: "Something went wrong"
  },
  withGuide: true,
  accessible: void 0,
  date: {
    monthNames: [...t],
    messages: {
      required: "Please enter a valid date",
      invalidMonth: "There are only 12 months in a year",
      invalidDay: (n3, e) => `There are only ${n3} days in ${e}`,
      afterMin: (n3) => `Date must be on or after ${n3.toISOString().slice(0, 10)}`,
      beforeMax: (n3) => `Date must be on or before ${n3.toISOString().slice(0, 10)}`
    }
  }
};
function isAccessible(n3) {
  if (n3 !== void 0) return n3;
  if (settings.accessible !== void 0) return settings.accessible;
  const e = process.env.ACCESSIBLE;
  return e !== void 0 && e !== "" && e !== "0" && e !== "false";
}
function isActionKey(n3, e) {
  if (typeof n3 == "string")
    return settings.aliases.get(n3) === e;
  for (const s of n3)
    if (s !== void 0 && isActionKey(s, e))
      return true;
  return false;
}
function diffLines(i2, s) {
  if (i2 === s) return;
  const e = i2.split(`
`), t2 = s.split(`
`), r2 = Math.max(e.length, t2.length), f = [];
  for (let n3 = 0; n3 < r2; n3++)
    e[n3] !== t2[n3] && f.push(n3);
  return {
    lines: f,
    numLinesBefore: e.length,
    numLinesAfter: t2.length,
    numLines: r2
  };
}
var R = globalThis.process.platform.startsWith("win");
var CANCEL_SYMBOL = /* @__PURE__ */ Symbol("clack:cancel");
function isCancel(e) {
  return e === CANCEL_SYMBOL;
}
function setRawMode(e, r2) {
  const o = e;
  o.isTTY && o.setRawMode(r2);
}
function block({
  input: e = stdin,
  output: r2 = stdout,
  overwrite: o = true,
  hideCursor: n3 = true
} = {}) {
  const s = l.createInterface({
    input: e,
    output: r2,
    prompt: "",
    tabSize: 1
  });
  l.emitKeypressEvents(e, s), e instanceof ReadStream && e.isTTY && e.setRawMode(true);
  const t2 = (f, { name: a2, sequence: w }) => {
    const c2 = String(f);
    if (isActionKey([c2, a2, w], "cancel")) {
      n3 && r2.write(import_sisteransi.cursor.show), process.exit(0);
      return;
    }
    if (!o) return;
    const i2 = a2 === "return" ? 0 : -1, m2 = a2 === "return" ? -1 : 0;
    l.moveCursor(r2, i2, m2, () => {
      l.clearLine(r2, 1, () => {
        e.once("keypress", t2);
      });
    });
  };
  return n3 && r2.write(import_sisteransi.cursor.hide), e.once("keypress", t2), () => {
    e.off("keypress", t2), n3 && r2.write(import_sisteransi.cursor.show), e instanceof ReadStream && e.isTTY && !R && e.setRawMode(false), s.terminal = false, s.close();
  };
}
var getColumns = (e) => "columns" in e && typeof e.columns == "number" ? e.columns : 80;
var getRows = (e) => "rows" in e && typeof e.rows == "number" ? e.rows : 20;
function wrapTextWithPrefix(e, r2, o, n3 = o, s = o, t2) {
  const f = getColumns(e ?? stdout);
  return wrapAnsi(r2, f - o.length, {
    hard: true,
    trim: false
  }).split(`
`).map((c2, i2, m2) => {
    const d = t2 ? t2(c2, i2) : c2;
    return i2 === 0 ? `${n3}${d}` : i2 === m2.length - 1 ? `${s}${d}` : `${o}${d}`;
  }).join(`
`);
}
function runValidation(e, a2) {
  if ("~standard" in e) {
    const n3 = e["~standard"].validate(a2);
    return n3 instanceof Promise ? n3.then((r2) => r2.issues?.at(0)?.message) : n3.issues?.at(0)?.message;
  }
  return e(a2);
}
var y = class {
  input;
  output;
  _abortSignal;
  rl;
  opts;
  _render;
  _track = false;
  _prevFrame = "";
  _subscribers = /* @__PURE__ */ new Map();
  _cursor = 0;
  state = "initial";
  error = "";
  value;
  userInput = "";
  /**
   * Whether accessible (static, screen-reader friendly) output is enabled for
   * this prompt, resolved from the `accessible` option, the global setting,
   * and the `ACCESSIBLE` env var.
   */
  get accessible() {
    return isAccessible(this.opts.accessible);
  }
  constructor(t2, e = true) {
    const { input: i2 = stdin, output: s = stdout, render: r2, signal: n3, ...o } = t2;
    this.opts = o, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = r2.bind(this), this._track = e, this._abortSignal = n3, this.input = i2, this.output = s;
  }
  /**
   * Unsubscribe all listeners
   */
  unsubscribe() {
    this._subscribers.clear();
  }
  /**
   * Set a subscriber with opts
   * @param event - The event name
   */
  setSubscriber(t2, e) {
    const i2 = this._subscribers.get(t2) ?? [];
    i2.push(e), this._subscribers.set(t2, i2);
  }
  /**
   * Subscribe to an event
   * @param event - The event name
   * @param cb - The callback
   */
  on(t2, e) {
    this.setSubscriber(t2, { cb: e });
  }
  /**
   * Subscribe to an event once
   * @param event - The event name
   * @param cb - The callback
   */
  once(t2, e) {
    this.setSubscriber(t2, { cb: e, once: true });
  }
  /**
   * Emit an event with data
   * @param event - The event name
   * @param data - The data to pass to the callback
   */
  emit(t2, ...e) {
    const i2 = this._subscribers.get(t2) ?? [], s = [];
    for (const r2 of i2)
      r2.cb(...e), r2.once && s.push(() => i2.splice(i2.indexOf(r2), 1));
    for (const r2 of s)
      r2();
  }
  prompt() {
    return new Promise((t2) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted)
          return this.state = "cancel", this.close(), t2(CANCEL_SYMBOL);
        this._abortSignal.addEventListener(
          "abort",
          () => {
            this.state = "cancel", this.close();
          },
          { once: true }
        );
      }
      this.rl = l__default.createInterface({
        input: this.input,
        tabSize: 2,
        prompt: "",
        escapeCodeTimeout: 50,
        terminal: true
      }), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), setRawMode(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t2(this.value);
      }), this.once("cancel", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t2(CANCEL_SYMBOL);
      });
    });
  }
  _isActionKey(t2, e) {
    return t2 === "	";
  }
  _shouldSubmit(t2, e) {
    return true;
  }
  _setValue(t2) {
    this.value = t2, this.emit("value", this.value);
  }
  _setUserInput(t2, e) {
    this.userInput = t2 ?? "", this.emit("userInput", this.userInput), e && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
  }
  _clearUserInput() {
    this.rl?.write(null, { ctrl: true, name: "u" }), this._setUserInput("");
  }
  async onKeypress(t2, e) {
    if (this.state !== "validating") {
      if (this._track && e.name !== "return" && (e.name && this._isActionKey(t2, e) && this.rl?.write(null, { ctrl: true, name: "h" }), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), e?.name && (!this._track && settings.aliases.has(e.name) && this.emit("cursor", settings.aliases.get(e.name)), settings.actions.has(e.name) && this.emit("cursor", e.name)), t2 && (t2.toLowerCase() === "y" || t2.toLowerCase() === "n") && this.emit("confirm", t2.toLowerCase() === "y"), this.emit("key", t2, e), e?.name === "return" && this._shouldSubmit(t2, e)) {
        if (this.opts.validate) {
          const i2 = runValidation(this.opts.validate, this.value);
          let s;
          i2 instanceof Promise ? (this.state = "validating", this.render(), s = await i2) : s = i2, s && (this.error = s instanceof Error ? s.message : s, this.state = "error", this.rl?.write(this.userInput));
        }
        this.state !== "error" && (this.state = "submit");
      }
      isActionKey([t2, e?.name, e?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
    }
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), setRawMode(this.input, false), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const t2 = wrapAnsi(this._prevFrame, process.stdout.columns, { hard: true, trim: false }).split(`
`).length - 1;
    this.output.write(import_sisteransi.cursor.move(-999, t2 * -1));
  }
  render() {
    const t2 = wrapAnsi(this._render(this) ?? "", process.stdout.columns, {
      hard: true,
      trim: false
    });
    if (t2 !== this._prevFrame) {
      if (this.state === "initial")
        this.output.write(import_sisteransi.cursor.hide);
      else {
        const e = diffLines(this._prevFrame, t2), i2 = getRows(this.output);
        if (this.restoreCursor(), e) {
          const s = Math.max(0, e.numLinesAfter - i2), r2 = Math.max(0, e.numLinesBefore - i2);
          let n3 = e.lines.find((o) => o >= s);
          if (n3 === void 0) {
            this._prevFrame = t2;
            return;
          }
          if (e.lines.length === 1) {
            this.output.write(import_sisteransi.cursor.move(0, n3 - r2)), this.output.write(import_sisteransi.erase.lines(1));
            const o = t2.split(`
`);
            this.output.write(o[n3]), this._prevFrame = t2, this.output.write(import_sisteransi.cursor.move(0, o.length - n3 - 1));
            return;
          } else if (e.lines.length > 1) {
            if (s < r2)
              n3 = s;
            else {
              const h2 = n3 - r2;
              h2 > 0 && this.output.write(import_sisteransi.cursor.move(0, h2));
            }
            this.output.write(import_sisteransi.erase.down());
            const f = t2.split(`
`).slice(n3);
            this.output.write(f.join(`
`)), this._prevFrame = t2;
            return;
          }
        }
        this.output.write(import_sisteransi.erase.down());
      }
      this.output.write(t2), this.state === "initial" && (this.state = "active"), this._prevFrame = t2;
    }
  }
};
var r = class extends y {
  get cursor() {
    return this.value ? 0 : 1;
  }
  get _value() {
    return this.cursor === 0;
  }
  constructor(t2) {
    super(t2, false), this.value = !!t2.initialValue, this.on("userInput", () => {
      this.value = this._value;
    }), this.on("confirm", (i2) => {
      this.output.write(import_sisteransi.cursor.move(0, -1)), this.value = i2, this.state = "submit", this.close();
    }), this.on("cursor", () => {
      this.value = !this.value;
    });
  }
};
var a = class extends y {
  options;
  cursor = 0;
  get _value() {
    return this.options[this.cursor]?.value;
  }
  get _enabledOptions() {
    return this.options.filter((e) => e.disabled !== true);
  }
  toggleAll() {
    const e = this._enabledOptions, i2 = this.value !== void 0 && this.value.length === e.length;
    this.value = i2 ? [] : e.map((t2) => t2.value);
  }
  toggleInvert() {
    const e = this.value;
    if (!e)
      return;
    const i2 = this._enabledOptions.filter((t2) => !e.includes(t2.value));
    this.value = i2.map((t2) => t2.value);
  }
  toggleValue() {
    this.value === void 0 && (this.value = []);
    const e = this.value.includes(this._value);
    this.value = e ? this.value.filter((i2) => i2 !== this._value) : [...this.value, this._value];
  }
  constructor(e) {
    super(e, false), this.options = e.options, this.value = [...e.initialValues ?? []];
    const i2 = Math.max(
      this.options.findIndex(({ value: t2 }) => t2 === e.cursorAt),
      0
    );
    this.cursor = this.options[i2]?.disabled ? findCursor(i2, 1, this.options) : i2, this.on("key", (t2, l2) => {
      l2.name === "a" && this.toggleAll(), l2.name === "i" && this.toggleInvert();
    }), this.on("cursor", (t2) => {
      switch (t2) {
        case "left":
        case "up":
          this.cursor = findCursor(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = findCursor(this.cursor, 1, this.options);
          break;
        case "space":
          this.toggleValue();
          break;
      }
    });
  }
};
var n$1 = class n extends y {
  options;
  cursor = 0;
  get _selectedValue() {
    return this.options[this.cursor];
  }
  changeValue() {
    const e = this._selectedValue;
    this.value = e === void 0 ? void 0 : e.value;
  }
  constructor(e) {
    super(e, false), this.options = e.options;
    const o = this.options.findIndex(({ value: s }) => s === e.initialValue), t2 = o === -1 ? 0 : o;
    this.cursor = this.options[t2]?.disabled ? findCursor(t2, 1, this.options) : t2, this.changeValue(), this.on("cursor", (s) => {
      switch (s) {
        case "left":
        case "up":
          this.cursor = findCursor(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = findCursor(this.cursor, 1, this.options);
          break;
      }
      this.changeValue();
    });
  }
};
var n2 = class extends y {
  get userInputWithCursor() {
    if (this.state === "submit")
      return this.userInput;
    const t2 = this.userInput;
    if (this.cursor >= t2.length)
      return `${this.userInput}\u2588`;
    const r2 = t2.slice(0, this.cursor), s = t2.slice(this.cursor, this.cursor + 1), e = t2.slice(this.cursor + 1);
    return `${r2}${styleText("inverse", s)}${e}`;
  }
  get cursor() {
    return this._cursor;
  }
  constructor(t2) {
    super({
      ...t2,
      initialUserInput: t2.initialUserInput ?? t2.initialValue
    }), this.on("userInput", (r2) => {
      this._setValue(r2);
    }), this.on("finalize", () => {
      this.value || (this.value = t2.defaultValue), this.value === void 0 && (this.value = "");
    });
  }
};

// node_modules/.pnpm/@clack+prompts@1.8.1/node_modules/@clack/prompts/dist/index.mjs
import { styleText as styleText2, stripVTControlCharacters } from "node:util";
import process$1 from "node:process";
var import_sisteransi2 = __toESM(require_src(), 1);
function isUnicodeSupported() {
  if (process$1.platform !== "win32") {
    return process$1.env.TERM !== "linux";
  }
  return Boolean(process$1.env.CI) || Boolean(process$1.env.WT_SESSION) || Boolean(process$1.env.TERMINUS_SUBLIME) || process$1.env.ConEmuTask === "{cmd::Cmder}" || process$1.env.TERM_PROGRAM === "Terminus-Sublime" || process$1.env.TERM_PROGRAM === "vscode" || process$1.env.TERM === "xterm-256color" || process$1.env.TERM === "alacritty" || process$1.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
var unicode = isUnicodeSupported();
var isCI = () => process.env.CI === "true";
var unicodeOr = (o, e) => unicode ? o : e;
var S_STEP_ACTIVE = unicodeOr("\u25C6", "*");
var S_STEP_CANCEL = unicodeOr("\u25A0", "x");
var S_STEP_ERROR = unicodeOr("\u25B2", "x");
var S_STEP_SUBMIT = unicodeOr("\u25C7", "o");
var S_BAR_START = unicodeOr("\u250C", "T");
var S_BAR = unicodeOr("\u2502", "|");
var S_BAR_END = unicodeOr("\u2514", "\u2014");
var S_BAR_START_RIGHT = unicodeOr("\u2510", "T");
var S_BAR_END_RIGHT = unicodeOr("\u2518", "\u2014");
var S_RADIO_ACTIVE = unicodeOr("\u25CF", ">");
var S_RADIO_INACTIVE = unicodeOr("\u25CB", " ");
var S_CHECKBOX_ACTIVE = unicodeOr("\u25FB", "[\u2022]");
var S_CHECKBOX_SELECTED = unicodeOr("\u25FC", "[+]");
var S_CHECKBOX_INACTIVE = unicodeOr("\u25FB", "[ ]");
var S_PASSWORD_MASK = unicodeOr("\u25AA", "\u2022");
var S_BAR_H = unicodeOr("\u2500", "-");
var S_CORNER_TOP_RIGHT = unicodeOr("\u256E", "+");
var S_CONNECT_LEFT = unicodeOr("\u251C", "+");
var S_CORNER_BOTTOM_RIGHT = unicodeOr("\u256F", "+");
var S_CORNER_BOTTOM_LEFT = unicodeOr("\u2570", "+");
var S_CORNER_TOP_LEFT = unicodeOr("\u256D", "+");
var S_INFO = unicodeOr("\u25CF", "\u2022");
var S_SUCCESS = unicodeOr("\u25C6", "*");
var S_WARN = unicodeOr("\u25B2", "!");
var S_ERROR = unicodeOr("\u25A0", "x");
var symbol = (o) => {
  switch (o) {
    case "initial":
    case "active":
      return styleText2("cyan", S_STEP_ACTIVE);
    case "cancel":
      return styleText2("red", S_STEP_CANCEL);
    case "error":
      return styleText2("yellow", S_STEP_ERROR);
    case "submit":
      return styleText2("green", S_STEP_SUBMIT);
    case "validating":
      return styleText2("dim", S_STEP_ACTIVE);
  }
};
var symbolBar = (o) => {
  switch (o) {
    case "initial":
    case "active":
      return styleText2("cyan", S_BAR);
    case "cancel":
      return styleText2("red", S_BAR);
    case "error":
      return styleText2("yellow", S_BAR);
    case "submit":
      return styleText2("green", S_BAR);
  }
};
function formatInstructionFooter(o, e) {
  const r2 = [`${e ? `${styleText2("cyan", S_BAR)}  ` : ""}${o.join(" \u2022 ")}`];
  return e && r2.push(styleText2("cyan", S_BAR_END)), r2;
}
var I = (l2, e, w, p, b, C2 = false) => {
  let r2 = e, O = 0;
  if (C2)
    for (let i2 = p - 1; i2 >= w; i2--) {
      const m2 = l2[i2];
      if (m2 && (r2 -= m2.length), O++, r2 <= b) break;
    }
  else
    for (let i2 = w; i2 < p; i2++) {
      const m2 = l2[i2];
      if (m2 && (r2 -= m2.length), O++, r2 <= b) break;
    }
  return { lineCount: r2, removals: O };
};
var limitOptions = ({
  cursor: l2,
  options: e,
  style: w,
  output: p = process.stdout,
  maxItems: b = Number.POSITIVE_INFINITY,
  columnPadding: C2 = 0,
  rowPadding: r2 = 4
}) => {
  const i2 = getColumns(p) - C2, m2 = getRows(p), M = styleText2("dim", "..."), v = Math.max(m2 - r2, 0), a2 = Math.max(Math.min(b, v), 5);
  let f = 0;
  l2 >= a2 - 3 && (f = Math.max(
    Math.min(l2 - a2 + 3, e.length - a2),
    0
  ));
  let d = a2 < e.length && f > 0, c2 = a2 < e.length && f + a2 < e.length;
  const W2 = Math.min(
    f + a2,
    e.length
  ), s = [];
  let g = 0;
  d && g++, c2 && g++;
  const T = f + (d ? 1 : 0), y2 = W2 - (c2 ? 1 : 0);
  for (let t2 = T; t2 < y2; t2++) {
    const n3 = e[t2], o = n3 ? w(n3, t2 === l2) : "", h2 = wrapAnsi(o, i2, {
      hard: true,
      trim: false
    }).split(`
`);
    s.push(h2), g += h2.length;
  }
  if (g > v) {
    let t2 = 0, n3 = 0, o = g;
    const h2 = l2 - T;
    let u3 = v;
    const L = () => I(s, o, 0, h2, u3), E = () => I(
      s,
      o,
      h2 + 1,
      s.length,
      u3,
      true
    );
    d ? ({ lineCount: o, removals: t2 } = L(), o > u3 && (c2 || (u3 -= 1), { lineCount: o, removals: n3 } = E())) : (c2 || (u3 -= 1), { lineCount: o, removals: n3 } = E(), o > u3 && (u3 -= 1, { lineCount: o, removals: t2 } = L())), t2 > 0 && (d = true, s.splice(0, t2)), n3 > 0 && (c2 = true, s.splice(s.length - n3, n3));
  }
  const x = [];
  d && x.push(M);
  for (const t2 of s)
    for (const n3 of t2)
      x.push(n3);
  return c2 && x.push(M), x;
};
var confirm = (e) => {
  const a2 = e.active ?? "Yes", o = e.inactive ?? "No";
  return new r({
    active: a2,
    inactive: o,
    signal: e.signal,
    input: e.input,
    output: e.output,
    initialValue: e.initialValue ?? true,
    render() {
      const i2 = e.withGuide ?? settings.withGuide, u3 = `${symbol(this.state)}  `, l2 = i2 ? `${styleText2("gray", S_BAR)}  ` : "", f = wrapTextWithPrefix(
        e.output,
        e.message,
        l2,
        u3
      ), s = `${i2 ? `${styleText2("gray", S_BAR)}
` : ""}${f}
`, c2 = this.value ? a2 : o;
      switch (this.state) {
        case "submit": {
          const r2 = i2 ? `${styleText2("gray", S_BAR)}  ` : "";
          return `${s}${r2}${styleText2("dim", c2)}`;
        }
        case "cancel": {
          const r2 = i2 ? `${styleText2("gray", S_BAR)}  ` : "";
          return `${s}${r2}${styleText2(["strikethrough", "dim"], c2)}${i2 ? `
${styleText2("gray", S_BAR)}` : ""}`;
        }
        default: {
          const r2 = i2 ? `${styleText2("cyan", S_BAR)}  ` : "", g = i2 ? styleText2("cyan", S_BAR_END) : "";
          return `${s}${r2}${this.value ? `${styleText2("green", S_RADIO_ACTIVE)} ${a2}` : `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", a2)}`}${e.vertical ? i2 ? `
${styleText2("cyan", S_BAR)}  ` : `
` : ` ${styleText2("dim", "/")} `}${this.value ? `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", o)}` : `${styleText2("green", S_RADIO_ACTIVE)} ${o}`}
${g}
`;
        }
      }
    }
  }).prompt();
};
var MULTISELECT_INSTRUCTIONS = [
  `${styleText2("dim", "\u2191/\u2193")} to navigate`,
  `${styleText2("dim", "Space:")} select`,
  `${styleText2("dim", "Enter:")} confirm`
];
var m = (i2, u3) => i2.split(`
`).map((d) => u3(d)).join(`
`);
var multiselect = (i2) => {
  const u3 = (t2, a2) => {
    const r2 = t2.label ?? String(t2.value);
    return a2 === "disabled" ? `${styleText2("gray", S_CHECKBOX_INACTIVE)} ${m(r2, (o) => styleText2(["strikethrough", "gray"], o))}${t2.hint ? ` ${styleText2("dim", `(${t2.hint ?? "disabled"})`)}` : ""}` : a2 === "active" ? `${styleText2("cyan", S_CHECKBOX_ACTIVE)} ${r2}${t2.hint ? ` ${styleText2("dim", `(${t2.hint})`)}` : ""}` : a2 === "selected" ? `${styleText2("green", S_CHECKBOX_SELECTED)} ${m(r2, (o) => styleText2("dim", o))}${t2.hint ? ` ${styleText2("dim", `(${t2.hint})`)}` : ""}` : a2 === "cancelled" ? `${m(r2, (o) => styleText2(["strikethrough", "dim"], o))}` : a2 === "active-selected" ? `${styleText2("green", S_CHECKBOX_SELECTED)} ${r2}${t2.hint ? ` ${styleText2("dim", `(${t2.hint})`)}` : ""}` : a2 === "submitted" ? `${m(r2, (o) => styleText2("dim", o))}` : `${styleText2("dim", S_CHECKBOX_INACTIVE)} ${m(r2, (o) => styleText2("dim", o))}`;
  }, d = i2.required ?? true, x = i2.showInstructions ?? true;
  return new a({
    options: i2.options,
    signal: i2.signal,
    input: i2.input,
    output: i2.output,
    initialValues: i2.initialValues,
    required: d,
    cursorAt: i2.cursorAt,
    validate(t2) {
      if (d && (t2 === void 0 || t2.length === 0))
        return `Please select at least one option.
${styleText2(
          "reset",
          styleText2(
            "dim",
            `Press ${styleText2(["gray", "bgWhite", "inverse"], " space ")} to select, ${styleText2(
              "gray",
              styleText2("bgWhite", styleText2("inverse", " enter "))
            )} to submit`
          )
        )}`;
    },
    render() {
      const t2 = i2.withGuide ?? settings.withGuide, a2 = wrapTextWithPrefix(
        i2.output,
        i2.message,
        t2 ? `${symbolBar(this.state)}  ` : "",
        `${symbol(this.state)}  `
      ), r2 = `${t2 ? `${styleText2("gray", S_BAR)}
` : ""}${a2}
`, o = this.value ?? [], g = (n3, l2) => {
        if (n3.disabled)
          return u3(n3, "disabled");
        const s = o.includes(n3.value);
        return l2 && s ? u3(n3, "active-selected") : s ? u3(n3, "selected") : u3(n3, l2 ? "active" : "inactive");
      };
      switch (this.state) {
        case "submit": {
          const n3 = this.options.filter(({ value: s }) => o.includes(s)).map((s) => u3(s, "submitted")).join(styleText2("dim", ", ")) || styleText2("dim", "none"), l2 = wrapTextWithPrefix(
            i2.output,
            n3,
            t2 ? `${styleText2("gray", S_BAR)}  ` : ""
          );
          return `${r2}${l2}`;
        }
        case "cancel": {
          const n3 = this.options.filter(({ value: s }) => o.includes(s)).map((s) => u3(s, "cancelled")).join(styleText2("dim", ", "));
          if (n3.trim() === "")
            return `${r2}${styleText2("gray", S_BAR)}`;
          const l2 = wrapTextWithPrefix(
            i2.output,
            n3,
            t2 ? `${styleText2("gray", S_BAR)}  ` : ""
          );
          return `${r2}${l2}${t2 ? `
${styleText2("gray", S_BAR)}` : ""}`;
        }
        case "error": {
          const n3 = t2 ? `${styleText2("yellow", S_BAR)}  ` : "", l2 = this.error.split(`
`).map(
            ($, v) => v === 0 ? `${t2 ? `${styleText2("yellow", S_BAR_END)}  ` : ""}${styleText2("yellow", $)}` : `   ${$}`
          ).join(`
`), s = r2.split(`
`).length, h2 = l2.split(`
`).length + 1;
          return `${r2}${n3}${limitOptions({
            output: i2.output,
            options: this.options,
            cursor: this.cursor,
            maxItems: i2.maxItems,
            columnPadding: n3.length,
            rowPadding: s + h2,
            style: g
          }).join(`
${n3}`)}
${l2}
`;
        }
        default: {
          const n3 = t2 ? `${styleText2("cyan", S_BAR)}  ` : "", l2 = r2.split(`
`).length, s = x ? formatInstructionFooter(MULTISELECT_INSTRUCTIONS, t2) : t2 ? [styleText2("cyan", S_BAR_END)] : [], h2 = s.join(`
`), $ = s.length + 1;
          return `${r2}${n3}${limitOptions({
            output: i2.output,
            options: this.options,
            cursor: this.cursor,
            maxItems: i2.maxItems,
            columnPadding: n3.length,
            rowPadding: l2 + $,
            style: g
          }).join(`
${n3}`)}
${h2}
`;
        }
      }
    }
  }).prompt();
};
var log = {
  message: (s = [], {
    symbol: e = styleText2("gray", S_BAR),
    secondarySymbol: r2 = styleText2("gray", S_BAR),
    output: m2 = process.stdout,
    spacing: l2 = 1,
    withGuide: c2
  } = {}) => {
    const t2 = [], o = c2 ?? settings.withGuide, f = o ? r2 : "", O = o ? `${e}  ` : "", u3 = o ? `${r2}  ` : "";
    for (let i2 = 0; i2 < l2; i2++)
      t2.push(f);
    const g = Array.isArray(s) ? s : s.split(`
`);
    if (g.length > 0) {
      const [i2, ...y2] = g;
      i2.length > 0 ? t2.push(`${O}${i2}`) : t2.push(o ? e : "");
      for (const p of y2)
        p.length > 0 ? t2.push(`${u3}${p}`) : t2.push(o ? r2 : "");
    }
    m2.write(`${t2.join(`
`)}
`);
  },
  info: (s, e) => {
    log.message(s, { ...e, symbol: styleText2("blue", S_INFO) });
  },
  success: (s, e) => {
    log.message(s, { ...e, symbol: styleText2("green", S_SUCCESS) });
  },
  step: (s, e) => {
    log.message(s, { ...e, symbol: styleText2("green", S_STEP_SUBMIT) });
  },
  warn: (s, e) => {
    log.message(s, { ...e, symbol: styleText2("yellow", S_WARN) });
  },
  /** alias for `log.warn()`. */
  warning: (s, e) => {
    log.warn(s, e);
  },
  error: (s, e) => {
    log.message(s, { ...e, symbol: styleText2("red", S_ERROR) });
  }
};
var cancel = (o = "", t2) => {
  const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR_END)}  ` : "";
  i2.write(`${e}${styleText2("red", o)}

`);
};
var intro = (o = "", t2) => {
  const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR_START)}  ` : "";
  i2.write(`${e}${o}
`);
};
var outro = (o = "", t2) => {
  const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR)}
${styleText2("gray", S_BAR_END)}  ` : "";
  i2.write(`${e}${o}

`);
};
var W$1 = (o) => o;
var C = (o, e, s) => {
  const a2 = {
    hard: true,
    trim: false
  }, i2 = wrapAnsi(o, e, a2).split(`
`), c2 = i2.reduce((n3, t2) => Math.max(dist_default2(t2), n3), 0), u3 = i2.map(s).reduce((n3, t2) => Math.max(dist_default2(t2), n3), 0), g = e - (u3 - c2);
  return wrapAnsi(o, g, a2);
};
var note = (o = "", e = "", s) => {
  const a2 = s?.output ?? process$1.stdout, i2 = s?.withGuide ?? settings.withGuide, c2 = s?.format ?? W$1, g = ["", ...C(o, getColumns(a2) - 6, c2).split(`
`).map(c2), ""], n3 = dist_default2(e), t2 = Math.max(
    g.reduce((m2, F) => {
      const O = dist_default2(F);
      return O > m2 ? O : m2;
    }, 0),
    n3
  ) + 2, h2 = g.map(
    (m2) => `${styleText2("gray", S_BAR)}  ${m2}${" ".repeat(t2 - dist_default2(m2))}${styleText2("gray", S_BAR)}`
  ).join(`
`), T = i2 ? `${styleText2("gray", S_BAR)}
` : "", l$1 = i2 ? S_CONNECT_LEFT : S_CORNER_BOTTOM_LEFT;
  a2.write(
    `${T}${styleText2("green", S_STEP_SUBMIT)}  ${styleText2("reset", e)} ${styleText2(
      "gray",
      S_BAR_H.repeat(Math.max(t2 - n3 - 1, 1)) + S_CORNER_TOP_RIGHT
    )}
${h2}
${styleText2("gray", l$1 + S_BAR_H.repeat(t2 + 2) + S_CORNER_BOTTOM_RIGHT)}
`
  );
};
var W = (l2) => styleText2("magenta", l2);
var spinner = ({
  indicator: l2 = "dots",
  onCancel: h2,
  output: n3 = process.stdout,
  cancelMessage: G,
  errorMessage: O,
  frames: E = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"],
  delay: F = unicode ? 80 : 120,
  signal: m2,
  ...I2
} = {}) => {
  const u3 = isCI();
  let M, T, d = false, S = false, s = "", p, w = performance.now();
  const x = getColumns(n3), k = I2?.styleFrame ?? W, g = (e) => {
    const r2 = e > 1 ? O ?? settings.messages.error : G ?? settings.messages.cancel;
    S = e === 1, d && (a2(r2, e), S && typeof h2 == "function" && h2());
  }, f = () => g(2), i2 = () => g(1), A = () => {
    process.on("uncaughtExceptionMonitor", f), process.on("unhandledRejection", f), process.on("SIGINT", i2), process.on("SIGTERM", i2), process.on("exit", g), m2 && m2.addEventListener("abort", i2);
  }, H = () => {
    process.removeListener("uncaughtExceptionMonitor", f), process.removeListener("unhandledRejection", f), process.removeListener("SIGINT", i2), process.removeListener("SIGTERM", i2), process.removeListener("exit", g), m2 && m2.removeEventListener("abort", i2);
  }, y2 = () => {
    if (p === void 0) return;
    u3 && n3.write(`
`);
    const r2 = wrapAnsi(p, x, {
      hard: true,
      trim: false
    }).split(`
`);
    r2.length > 1 && n3.write(import_sisteransi2.cursor.up(r2.length - 1)), n3.write(import_sisteransi2.cursor.to(0)), n3.write(import_sisteransi2.erase.down());
  }, C2 = (e) => e.replace(/\.+$/, ""), _ = (e) => {
    const r2 = (performance.now() - e) / 1e3, t2 = Math.floor(r2 / 60), o = Math.floor(r2 % 60);
    return t2 > 0 ? `[${t2}m ${o}s]` : `[${o}s]`;
  }, N = I2.withGuide ?? settings.withGuide, P = (e = "") => {
    d = true, M = block({ output: n3 }), s = C2(e), w = performance.now(), N && n3.write(`${styleText2("gray", S_BAR)}
`);
    let r2 = 0, t2 = 0;
    A(), T = setInterval(() => {
      if (u3 && s === p)
        return;
      y2(), p = s;
      const o = k(E[r2]);
      let v;
      if (u3)
        v = `${o}  ${s}...`;
      else if (l2 === "timer")
        v = `${o}  ${s} ${_(w)}`;
      else {
        const B = ".".repeat(Math.floor(t2)).slice(0, 3);
        v = `${o}  ${s}${B}`;
      }
      const j = wrapAnsi(v, x, {
        hard: true,
        trim: false
      });
      n3.write(j), r2 = r2 + 1 < E.length ? r2 + 1 : 0, t2 = t2 < 4 ? t2 + 0.125 : 0;
    }, F);
  }, a2 = (e = "", r2 = 0, t2 = false) => {
    if (!d) return;
    d = false, clearInterval(T), y2();
    const o = r2 === 0 ? styleText2("green", S_STEP_SUBMIT) : r2 === 1 ? styleText2("red", S_STEP_CANCEL) : styleText2("red", S_STEP_ERROR);
    s = e ?? s, t2 || (l2 === "timer" ? n3.write(`${o}  ${s} ${_(w)}
`) : n3.write(`${o}  ${s}
`)), H(), M();
  };
  return {
    start: P,
    stop: (e = "") => a2(e, 0),
    message: (e = "") => {
      s = C2(e ?? s);
    },
    cancel: (e = "") => a2(e, 1),
    error: (e = "") => a2(e, 2),
    clear: () => a2("", 0, true),
    get isCancelled() {
      return S;
    }
  };
};
var u2 = {
  light: unicodeOr("\u2500", "-"),
  heavy: unicodeOr("\u2501", "="),
  block: unicodeOr("\u2588", "#")
};
var SELECT_INSTRUCTIONS = [
  `${styleText2("dim", "\u2191/\u2193")} to navigate`,
  `${styleText2("dim", "Enter:")} confirm`
];
var c = (t2, o) => t2.includes(`
`) ? t2.split(`
`).map((d) => o(d)).join(`
`) : o(t2);
var select = (t2) => {
  const o = (n3, m2) => {
    if (n3 === void 0)
      return "";
    const s = n3.label ?? String(n3.value);
    switch (m2) {
      case "disabled":
        return `${styleText2("gray", S_RADIO_INACTIVE)} ${c(s, (i2) => styleText2("gray", i2))}${n3.hint ? ` ${styleText2("dim", `(${n3.hint ?? "disabled"})`)}` : ""}`;
      case "selected":
        return `${c(s, (i2) => styleText2("dim", i2))}`;
      case "active":
        return `${styleText2("green", S_RADIO_ACTIVE)} ${s}${n3.hint ? ` ${styleText2("dim", `(${n3.hint})`)}` : ""}`;
      case "cancelled":
        return `${c(s, (i2) => styleText2(["strikethrough", "dim"], i2))}`;
      default:
        return `${styleText2("dim", S_RADIO_INACTIVE)} ${c(s, (i2) => styleText2("dim", i2))}`;
    }
  }, d = t2.showInstructions ?? true;
  return new n$1({
    options: t2.options,
    signal: t2.signal,
    input: t2.input,
    output: t2.output,
    initialValue: t2.initialValue,
    render() {
      const n3 = t2.withGuide ?? settings.withGuide, m2 = `${symbol(this.state)}  `, s = `${symbolBar(this.state)}  `, i2 = wrapTextWithPrefix(
        t2.output,
        t2.message,
        s,
        m2
      ), u3 = `${n3 ? `${styleText2("gray", S_BAR)}
` : ""}${i2}
`;
      switch (this.state) {
        case "submit": {
          const r2 = n3 ? `${styleText2("gray", S_BAR)}  ` : "", a2 = wrapTextWithPrefix(
            t2.output,
            o(this.options[this.cursor], "selected"),
            r2
          );
          return `${u3}${a2}`;
        }
        case "cancel": {
          const r2 = n3 ? `${styleText2("gray", S_BAR)}  ` : "", a2 = wrapTextWithPrefix(
            t2.output,
            o(this.options[this.cursor], "cancelled"),
            r2
          );
          return `${u3}${a2}${n3 ? `
${styleText2("gray", S_BAR)}` : ""}`;
        }
        default: {
          const r2 = n3 ? `${styleText2("cyan", S_BAR)}  ` : "", a2 = u3.split(`
`).length, p = d ? formatInstructionFooter(SELECT_INSTRUCTIONS, n3) : n3 ? [styleText2("cyan", S_BAR_END)] : [], f = p.join(`
`), b = p.length + 1;
          return `${u3}${r2}${limitOptions({
            output: t2.output,
            cursor: this.cursor,
            options: this.options,
            maxItems: t2.maxItems,
            columnPadding: r2.length,
            rowPadding: a2 + b,
            style: (g, x) => o(g, g.disabled ? "disabled" : x ? "active" : "inactive")
          }).join(`
${r2}`)}
${f}
`;
        }
      }
    }
  }).prompt();
};
var i = `${styleText2("gray", S_BAR)}  `;
var text = (t2) => new n2({
  validate: t2.validate,
  placeholder: t2.placeholder,
  defaultValue: t2.defaultValue,
  initialValue: t2.initialValue,
  output: t2.output,
  signal: t2.signal,
  input: t2.input,
  render() {
    const r2 = t2?.withGuide ?? settings.withGuide, l2 = `${`${r2 ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  `}${t2.message}
`, d = t2.placeholder && t2.placeholder.length > 0 ? (
      // biome-ignore lint/style/noNonNullAssertion: guarded by placeholder.length > 0
      styleText2("inverse", t2.placeholder[0]) + styleText2("dim", t2.placeholder.slice(1))
    ) : styleText2(["inverse", "hidden"], "_"), o = this.userInput ? this.userInputWithCursor : d, s = this.value ?? "";
    switch (this.state) {
      case "validating": {
        const n3 = r2 ? `${styleText2("cyan", S_BAR)}  ` : "", i2 = r2 ? styleText2("cyan", S_BAR_END) : "", c2 = styleText2("dim", o), $ = styleText2("dim", "Validating...");
        return `${l2}${n3}${c2}
${i2}  ${$}
`;
      }
      case "error": {
        const n3 = this.error ? `  ${styleText2("yellow", this.error)}` : "", i2 = r2 ? `${styleText2("yellow", S_BAR)}  ` : "", c2 = r2 ? styleText2("yellow", S_BAR_END) : "";
        return `${l2.trim()}
${i2}${o}
${c2}${n3}
`;
      }
      case "submit": {
        const n3 = s ? `${r2 ? "  " : ""}${styleText2("dim", s)}` : "", i2 = r2 ? styleText2("gray", S_BAR) : "";
        return `${l2}${i2}${n3}`;
      }
      case "cancel": {
        const n3 = s ? `  ${styleText2(["strikethrough", "dim"], s)}` : "", i2 = r2 ? styleText2("gray", S_BAR) : "";
        return `${l2}${i2}${n3}${s.trim() ? `
${i2}` : ""}`;
      }
      default: {
        const n3 = r2 ? `${styleText2("cyan", S_BAR)}  ` : "", i2 = r2 ? styleText2("cyan", S_BAR_END) : "";
        return `${l2}${n3}${o}
${i2}
`;
      }
    }
  }
}).prompt();

// src/install/cli.mjs
var import_detect_agent = __toESM(require_dist(), 1);

// src/install/core.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var SKILLS = ["agent-huddle", "huddle-start", "huddle-join", "huddle-rooms", "huddle-end"];
var SKILL_FILES = [
  "agent-huddle/SKILL.md",
  "agent-huddle/huddle.mjs",
  "agent-huddle/page.html",
  ...SKILLS.slice(1).map((name) => `${name}/SKILL.md`)
];
var AGENTS = [
  { key: "claude", label: "Claude Code" },
  { key: "codex", label: "Codex" },
  { key: "agy", label: "Antigravity" },
  { key: "gemini", label: "Gemini CLI" },
  { key: "opencode", label: "opencode" },
  { key: "other", label: "Other" }
];
var DEFAULT_BASE_URL = "https://agent-huddle.vercel.app";
var isDir = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;
var isFile = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
var lexists = (p) => fs.lstatSync(p, { throwIfNoEntry: false }) !== void 0;
function labelOf(agent) {
  return AGENTS.find((a2) => a2.key === agent)?.label ?? "Other";
}
function knownAgent(agent) {
  return AGENTS.some((a2) => a2.key === agent);
}
function locations(env = process.env) {
  const home = env.HOME || os.homedir();
  const stateDir = env.AGENT_HUDDLE_HOME || path.join(home, ".agent-huddle");
  return { home, shared: path.join(home, ".agents", "skills"), stateDir, saved: path.join(stateDir, "install.json") };
}
function tilde(p, env = process.env) {
  const { home } = locations(env);
  if (p === home) return "~";
  if (p.startsWith(home + path.sep)) return "~" + p.slice(home.length);
  return p;
}
function resolvePath(p) {
  let dir = path.resolve(p);
  const rest = [];
  while (!isDir(dir) && dir !== path.dirname(dir)) {
    rest.unshift(path.basename(dir));
    dir = path.dirname(dir);
  }
  return path.join(fs.realpathSync(dir), ...rest);
}
function expandPath(input, env = process.env) {
  const { home } = locations(env);
  let s = input.trim();
  if (s === "~") s = home;
  else if (s.startsWith("~/")) s = home + s.slice(1);
  s = s.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g, (_, braced, bare) => {
    const name = braced || bare;
    if (env[name] === void 0) throw new Error(`$${name} is not set`);
    return env[name];
  });
  return path.resolve(s);
}
function onPath(binary, env = process.env) {
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, binary);
    try {
      if (!fs.statSync(file).isFile()) continue;
      fs.accessSync(file, fs.constants.X_OK);
      return true;
    } catch {
    }
  }
  return false;
}
function fixedAgents(env) {
  const { home, shared } = locations(env);
  return [
    { agent: "codex", signal: path.join(home, ".codex"), path: shared },
    { agent: "agy", signal: path.join(home, ".gemini", "antigravity-cli"), path: path.join(home, ".gemini", "antigravity-cli", "skills") },
    { agent: "gemini", signal: path.join(home, ".gemini", "settings.json"), path: path.join(home, ".gemini", "skills") },
    { agent: "opencode", signal: path.join(home, ".config", "opencode"), path: path.join(home, ".config", "opencode", "skills") }
  ];
}
function defaultPath(agent, env = process.env) {
  if (agent === "claude") return path.join(env.CLAUDE_CONFIG_DIR || path.join(locations(env).home, ".claude"), "skills");
  return fixedAgents(env).find((a2) => a2.agent === agent)?.path ?? "";
}
function makeRow(agent, p, extra = {}) {
  return {
    agent,
    label: labelOf(agent),
    path: p,
    found: false,
    selected: false,
    custom: false,
    added: false,
    shared: false,
    idle: false,
    isNew: false,
    hint: false,
    detail: "",
    ...extra
  };
}
function customRow(agent, p) {
  return makeRow(agent, p, { custom: true, added: true, selected: true });
}
function claudeDirs(env = process.env) {
  const { home } = locations(env);
  const candidates = [];
  if (env.CLAUDE_CONFIG_DIR) candidates.push({ dir: env.CLAUDE_CONFIG_DIR, reason: "CLAUDE_CONFIG_DIR", pinned: true });
  const dotClaude = path.join(home, ".claude");
  if (isDir(dotClaude)) candidates.push({ dir: dotClaude, reason: "folder exists" });
  let names = [];
  try {
    names = fs.readdirSync(home).sort();
  } catch {
  }
  for (const name of names) {
    if (name.startsWith(".claude-") && isFile(path.join(home, name, "settings.json"))) {
      candidates.push({ dir: path.join(home, name), reason: "has settings.json" });
    }
  }
  if (!isDir(dotClaude) && !env.CLAUDE_CONFIG_DIR && onPath("claude", env)) {
    const alone = !candidates.length;
    candidates.push({ dir: dotClaude, reason: alone ? "claude on PATH" : "claude on PATH, not created yet", idle: !alone });
  }
  const seen = /* @__PURE__ */ new Set();
  const dirs = [];
  for (const c2 of candidates) {
    const key = resolvePath(c2.dir);
    if (seen.has(key)) continue;
    seen.add(key);
    const idle = c2.idle ?? (!c2.pinned && isDir(c2.dir) && !isDir(path.join(c2.dir, "projects")));
    dirs.push({ dir: c2.dir, reason: c2.reason, idle });
  }
  return dirs;
}
function detect(env = process.env) {
  const rows = [];
  const dirs = claudeDirs(env);
  for (const { dir, reason, idle } of dirs) {
    const absent = !isDir(dir);
    const detail = `${tilde(dir, env)} (${reason}${idle && !absent ? ", no sessions here" : ""})`;
    rows.push(makeRow("claude", path.join(dir, "skills"), { found: true, selected: !idle, idle, absent, detail }));
  }
  if (!dirs.length) {
    const dir = env.CLAUDE_CONFIG_DIR || path.join(locations(env).home, ".claude");
    rows.push(makeRow("claude", path.join(dir, "skills"), { detail: `not found (no claude on PATH, no ${tilde(dir, env)})` }));
  }
  for (const { agent, signal, path: p } of fixedAgents(env)) {
    let reason = "";
    if (onPath(agent, env)) reason = `${agent} on PATH`;
    else if (fs.existsSync(signal)) reason = tilde(signal, env);
    const found = Boolean(reason);
    const detail = found ? reason : `not found (no ${agent} on PATH, no ${tilde(signal, env)})`;
    const shared = agent === "codex";
    rows.push(makeRow(agent, p, { found, selected: found || shared, shared, detail }));
  }
  return rows;
}
function loadSaved(env = process.env) {
  const file = locations(env).saved;
  if (!fs.existsSync(file)) return null;
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const targets = Array.isArray(json?.targets) ? json.targets : [];
  return targets.filter((t2) => t2 && typeof t2.agent === "string" && typeof t2.path === "string" && path.isAbsolute(t2.path)).map((t2) => ({ agent: knownAgent(t2.agent) ? t2.agent : "other", path: t2.path, custom: Boolean(t2.custom) }));
}
function applySaved(rows, targets, env = process.env) {
  const { shared } = locations(env);
  const matched = /* @__PURE__ */ new Set();
  for (const row of rows) if (!row.shared) row.selected = false;
  for (const t2 of targets) {
    if (t2.agent === "codex" && t2.path === shared) continue;
    const want = resolvePath(t2.path);
    const row = rows.find(
      (r2) => r2.agent === t2.agent && !r2.added && !r2.shared && !matched.has(r2) && (t2.agent !== "claude" || resolvePath(r2.path) === want)
    );
    if (row) {
      Object.assign(row, { path: t2.path, custom: t2.custom, selected: true });
      matched.add(row);
    } else {
      const added = makeRow(t2.agent, t2.path, { custom: t2.custom, selected: true, added: true });
      rows.push(added);
      matched.add(added);
    }
  }
  for (const row of rows) {
    if (!matched.has(row) && !row.shared && row.found && !row.idle) row.isNew = true;
  }
  return rows;
}
function pathError(rows, p, skip = -1, env = process.env) {
  if (fs.existsSync(p) && !isDir(p)) return `${tilde(p, env)} is a file`;
  const want = resolvePath(p);
  if (want === resolvePath(locations(env).shared)) return "that is the shared copy itself";
  const dup = rows.findIndex((r2, i2) => i2 !== skip && resolvePath(r2.path) === want);
  if (dup >= 0) return `already listed for ${rows[dup].label}`;
  let anc = p;
  while (!fs.existsSync(anc)) anc = path.dirname(anc);
  try {
    fs.accessSync(anc, fs.constants.W_OK);
  } catch {
    return `${tilde(anc, env)} is not writable`;
  }
  return "";
}
function claudeWarning(agent, p, env = process.env) {
  const parent = path.dirname(p);
  if (agent !== "claude" || isFile(path.join(parent, "settings.json"))) return "";
  return `${tilde(parent, env)} has no settings.json; it may not be a Claude Code config dir`;
}
function applyDir(rows, spec, env) {
  const eq = spec.indexOf("=");
  const agent = eq < 0 ? spec : spec.slice(0, eq);
  const given = eq < 0 ? "" : spec.slice(eq + 1);
  if (!knownAgent(agent)) throw new Error(`--dir: unknown agent '${agent}' (use claude, codex, agy, gemini, opencode or other)`);
  if (agent === "codex") {
    if (given) throw new Error(`--dir: Codex reads the shared copy at ${tilde(locations(env).shared, env)}; give no path`);
    rows.find((r2) => r2.shared).hint = true;
    return "";
  }
  let p;
  if (given) {
    try {
      p = expandPath(given, env);
    } catch (err2) {
      throw new Error(`--dir: could not expand '${spec}' (${err2.message})`);
    }
  } else {
    if (agent === "other") throw new Error("--dir: other needs a path (other=/path/to/skills)");
    p = defaultPath(agent, env);
  }
  const want = resolvePath(p);
  const index = agent === "claude" ? rows.findIndex((r2) => r2.agent === "claude" && resolvePath(r2.path) === want) : rows.findIndex((r2) => r2.agent === agent && !r2.added && !r2.shared && !r2.selected);
  const err = pathError(rows, p, index, env);
  if (err) throw new Error(`--dir ${spec}: ${err}`);
  if (index >= 0) Object.assign(rows[index], { path: p, custom: Boolean(given), selected: true });
  else rows.push(makeRow(agent, p, { custom: Boolean(given), selected: true, added: true }));
  return claudeWarning(agent, p, env);
}
function applyDirs(rows, specs, env = process.env) {
  for (const row of rows) if (!row.shared) row.selected = false;
  return specs.map((spec) => applyDir(rows, spec, env)).filter(Boolean);
}
function timestamp(date = /* @__PURE__ */ new Date()) {
  const pad = (n3) => String(n3).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
function readLink(p) {
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
}
function buildPlan(rows, env = process.env, stamp = timestamp()) {
  const { shared } = locations(env);
  const actions = SKILLS.map((name) => ({ kind: "copy", target: shared, name, path: path.join(shared, name) }));
  const sharedKey = resolvePath(shared);
  for (const row of rows) {
    if (!row.selected || row.shared) continue;
    const target = row.path;
    if (resolvePath(target) === sharedKey) {
      actions.push({ kind: "unchanged", target, sameAsShared: true });
      continue;
    }
    if (!isDir(target)) actions.push({ kind: "create", target });
    for (const name of SKILLS) {
      const link2 = path.join(target, name);
      const dest = path.join(shared, name);
      const was = readLink(link2);
      if (was === dest) actions.push({ kind: "unchanged", target, name, link: link2, dest });
      else if (was !== null) actions.push({ kind: "replace", target, name, link: link2, dest, was });
      else if (lexists(link2)) actions.push({ kind: "backup", target, name, link: link2, dest, backup: `${link2}.bak-${stamp}` });
      else actions.push({ kind: "link", target, name, link: link2, dest });
    }
  }
  return { stamp, shared, actions };
}
function planLines(plan, env = process.env) {
  const groups = /* @__PURE__ */ new Map();
  for (const a2 of plan.actions) {
    const key = a2.kind === "copy" ? "copy" : `target ${a2.target}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a2);
  }
  const lines = [];
  for (const actions of groups.values()) {
    const t2 = tilde(actions[0].target, env);
    const count = (kind) => actions.filter((a2) => a2.kind === kind).length;
    const skills = (n3) => `${n3} skill${n3 === 1 ? "" : "s"}`;
    if (actions[0].kind === "copy") {
      lines.push(`copy ${skills(actions.length)} \u2192 ${t2} (shared copy)`);
      continue;
    }
    if (actions[0].sameAsShared) {
      lines.push(`unchanged ${t2} (same folder as the shared copy)`);
      continue;
    }
    const links = count("link");
    const unchanged = count("unchanged");
    const already = unchanged ? `${skills(unchanged)} already linked` : "";
    if (links) {
      const create = count("create") ? " (create folder)" : "";
      lines.push(`link ${skills(links)} \u2192 ${t2}${create}${already ? `; ${already}` : ""}`);
    } else if (unchanged) {
      lines.push(`unchanged ${t2} (${already})`);
    }
    for (const a2 of actions) {
      if (a2.kind === "backup") lines.push(`backup ${tilde(a2.link, env)} \u2192 ${path.basename(a2.backup)}, then link`);
      if (a2.kind === "replace") lines.push(`replace ${tilde(a2.link, env)} (was \u2192 ${a2.was})`);
    }
  }
  return lines;
}
function link(dest, at) {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  if (lexists(at)) fs.unlinkSync(at);
  fs.symlinkSync(dest, at);
}
function applyPlan(plan, stagedDir) {
  for (const file of SKILL_FILES) {
    const to = path.join(plan.shared, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(stagedDir, file), to);
  }
  fs.chmodSync(path.join(plan.shared, "agent-huddle", "huddle.mjs"), 493);
  for (const a2 of plan.actions) {
    if (a2.kind === "create") fs.mkdirSync(a2.target, { recursive: true });
    if (a2.kind === "link" || a2.kind === "replace") link(a2.dest, a2.link);
    if (a2.kind === "backup") {
      fs.renameSync(a2.link, a2.backup);
      link(a2.dest, a2.link);
    }
  }
}
function saveTargets(rows, env = process.env, date = /* @__PURE__ */ new Date()) {
  const { stateDir, saved, shared } = locations(env);
  const targets = rows.filter((r2) => r2.selected).map((r2) => ({ agent: r2.agent, path: r2.path, custom: r2.custom }));
  const installedAt = date.toISOString().replace(/\.\d{3}Z$/, "Z");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.chmodSync(stateDir, 448);
  fs.writeFileSync(saved, JSON.stringify({ version: 1, shared, targets, installedAt }, null, 2) + "\n", { mode: 384 });
  fs.chmodSync(saved, 384);
  return saved;
}
function nextSteps(rows) {
  const on = (agent) => rows.some((r2) => r2.agent === agent && r2.selected && !r2.shared);
  const lines = [];
  if (on("claude")) lines.push('Claude Code: /huddle-start "my room"');
  if (on("codex") || rows.some((r2) => r2.shared && (r2.found || r2.hint))) {
    lines.push(
      'Codex: $huddle-start "my room". Its sandbox blocks localhost by default; approve network',
      "access when Codex asks, or add this to ~/.codex/config.toml:",
      "  [sandbox_workspace_write]",
      "  network_access = true"
    );
  }
  const others = ["agy", "gemini", "opencode", "other"].filter(on).map(labelOf);
  if (others.length) lines.push(`${others.join(", ")}: ask "start a huddle"`);
  return lines;
}
function uninstallPlan(env = process.env) {
  const { shared, saved } = locations(env);
  let targets = [];
  try {
    targets = loadSaved(env) ?? [];
  } catch {
  }
  const dirs = /* @__PURE__ */ new Set([...detect(env).filter((r2) => !r2.shared).map((r2) => r2.path), ...targets.map((t2) => t2.path)]);
  dirs.delete(shared);
  const paths = [];
  for (const dir of dirs) {
    for (const name of SKILLS) {
      const at = path.join(dir, name);
      if (readLink(at) === path.join(shared, name)) paths.push(at);
    }
  }
  for (const name of SKILLS) {
    const dir = path.join(shared, name);
    if (isDir(dir) && readLink(dir) === null) paths.push(dir);
  }
  if (fs.existsSync(saved)) paths.push(saved);
  return paths;
}
function uninstall(paths) {
  for (const p of paths) fs.rmSync(p, { recursive: true, force: true });
}
async function stageSkills({ sourceDir, baseUrl = DEFAULT_BASE_URL } = {}) {
  const local = sourceDir && isFile(path.join(sourceDir, "skills", "agent-huddle", "huddle.mjs")) ? path.join(sourceDir, "skills") : null;
  const base = baseUrl.replace(/\/+$/, "");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-huddle-"));
  try {
    for (const file of SKILL_FILES) {
      const to = path.join(dir, file);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (local) fs.copyFileSync(path.join(local, file), to);
      else fs.writeFileSync(to, await download(`${base}/skills/${file}`));
    }
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return { dir, from: local ?? base };
}
async function download(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`could not download ${url} (${err.cause?.code ?? err.message})`);
  }
  if (!res.ok) throw new Error(`could not download ${url} (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// src/install/cli.mjs
var SCRIPT_DIR = path2.dirname(fileURLToPath(import.meta.url));
var INVITE_LINE = "No skill in some agent? Paste the invite that /huddle-start prints instead.";
var USAGE = `Usage: install.sh [--yes] [--dir agent[=path]]... [--dry-run] [--uninstall] [--help]
       node install.mjs [same options]

Copies the agent-huddle skills to ~/.agents/skills and links them into your agents' skills folders.
In a terminal it asks which agents to install for; otherwise it prints the plan and installs only
with --yes or --dir.

  --yes, -y            Install without prompts: the saved targets, else the detected agents.
  --dir agent[=path]   Install for exactly these agents (repeatable). Agents: claude, codex, agy,
                       gemini, opencode, other. Without a path the agent's default folder is used.
  --dry-run            Print the plan and exit.
  --uninstall          Remove our links, the shared skill folders and the saved targets
                       (asks first in a terminal; otherwise needs --yes).
  --help, -h           Show this help.

Env: AGENT_HUDDLE_BASE_URL (download source), AGENT_HUDDLE_HOME (where install.json lives),
AGENT_HUDDLE_NO_TTY=1 (install.sh never reads answers from /dev/tty; for tests and CI).`;
function parseArgs(argv) {
  const opts = { yes: false, dirs: [], dryRun: false, uninstall: false, help: false };
  for (let i2 = 0; i2 < argv.length; i2++) {
    const arg = argv[i2];
    if (arg === "-y" || arg === "--yes") opts.yes = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--uninstall") opts.uninstall = true;
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg.startsWith("--dir=")) opts.dirs.push(arg.slice("--dir=".length));
    else if (arg === "--dir") {
      if (i2 + 1 >= argv.length) throw new Error("--dir needs agent[=path]");
      opts.dirs.push(argv[++i2]);
    } else throw new Error(`unknown option: ${arg}`);
  }
  return opts;
}
function fail(message) {
  console.error(message);
  process.exit(1);
}
function rowHint(row) {
  const notes = [];
  if (row.custom) notes.push("custom");
  if (row.isNew) notes.push("new since last install");
  if (row.idle) notes.push(row.absent ? "not created yet" : "no sessions here");
  if (!row.found && !row.added) notes.push("not found");
  return notes.join(", ") || void 0;
}
function detectedLines(rows) {
  return rows.filter((r2) => !r2.added).map((r2) => `${r2.found ? "\u2713" : "-"} ${r2.label.padEnd(12)} ${r2.detail}`);
}
function sharedLine(env) {
  return `The shared copy ${tilde(locations(env).shared, env)} is always installed (Codex reads it directly).`;
}
function prepareRows(rows, opts, env) {
  if (opts.dirs.length) return applyDirs(rows, opts.dirs, env);
  try {
    const saved = loadSaved(env);
    if (saved) applySaved(rows, saved, env);
    return [];
  } catch {
    return [`Could not read ${tilde(locations(env).saved, env)}; using detected agents`];
  }
}
async function stage(env) {
  const staged = await stageSkills({ sourceDir: SCRIPT_DIR, baseUrl: env.AGENT_HUDDLE_BASE_URL || DEFAULT_BASE_URL });
  process.on("exit", () => fs2.rmSync(staged.dir, { recursive: true, force: true }));
  return staged;
}
function install(rows, plan, staged, env) {
  applyPlan(plan, staged.dir);
  return saveTargets(rows, env);
}
async function runPlain(opts, env, agent) {
  const rows = detect(env);
  let warnings;
  try {
    warnings = prepareRows(rows, opts, env);
  } catch (err) {
    fail(err.message);
  }
  console.log("Agents:");
  for (const line of detectedLines(rows)) console.log(`  ${line}`);
  console.log(`  ${sharedLine(env)}`);
  for (const w of warnings) console.log(`! ${w}`);
  const plan = buildPlan(rows, env);
  console.log("\nPlan:");
  for (const line of planLines(plan, env)) console.log(`  ${line}`);
  if (opts.dryRun) {
    console.log("\nDry run; nothing installed.");
    return;
  }
  if (!opts.yes && !opts.dirs.length) {
    console.log("\nNothing installed. Rerun with --yes to install this plan, or --dir agent[=path] to choose.");
    if (agent.isAgent) console.log(`Running inside ${agent.agent.name}: ask your user which agents to install for before rerunning.`);
    return;
  }
  let staged;
  try {
    staged = await stage(env);
  } catch (err) {
    fail(err.message);
  }
  console.log(`
\u2713 Skills staged from ${tilde(staged.from, env)}`);
  const saved = install(rows, plan, staged, env);
  console.log(`\u2713 Installed: ${planLines(plan, env).join("; ")}`);
  console.log(`\u2713 Saved targets to ${tilde(saved, env)}`);
  const next = nextSteps(rows);
  if (next.length) console.log(`
Next:
${next.map((l2) => `  ${l2}`).join("\n")}`);
  console.log(`
${INVITE_LINE}`);
}
async function ask(prompt) {
  const value = await prompt;
  if (isCancel(value)) {
    cancel("Nothing changed.");
    process.exit(0);
  }
  return value;
}
function folderOptions(rows, env) {
  return rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.shared).map(({ row, index }) => ({ value: index, label: `${row.label.padEnd(12)} ${tilde(row.path, env)}`, hint: rowHint(row) }));
}
async function askFolder(rows, agent, skip, initialValue, env) {
  let value = initialValue;
  for (; ; ) {
    const answer = await ask(
      text({
        message: `Skills folder for ${labelOf(agent)}`,
        initialValue: value,
        placeholder: "~/path/to/skills",
        validate(input) {
          if (!input?.trim()) return "Enter a folder";
          try {
            return pathError(rows, expandPath(input, env), skip, env) || void 0;
          } catch (err) {
            return err.message;
          }
        }
      })
    );
    const folder = expandPath(answer, env);
    const warning = claudeWarning(agent, folder, env);
    if (!warning || await ask(confirm({ message: `${warning}. Use it anyway?`, initialValue: false }))) return folder;
    value = answer;
  }
}
async function editFolder(rows, env) {
  const index = await ask(select({ message: "Edit which folder?", options: folderOptions(rows, env) }));
  const row = rows[index];
  const folder = await askFolder(rows, row.agent, index, tilde(row.path, env), env);
  if (folder === row.path) return;
  Object.assign(row, { path: folder, custom: true, selected: true, isNew: false });
  log.step(`${row.label} \u2192 ${tilde(folder, env)} (custom)`);
}
async function addFolder(rows, env) {
  const agent = await ask(
    select({ message: "Which agent reads this folder?", options: AGENTS.map((a2) => ({ value: a2.key, label: a2.label })) })
  );
  const folder = await askFolder(rows, agent, -1, "", env);
  const row = customRow(agent, folder);
  rows.push(row);
  log.step(`${row.label} \u2192 ${tilde(folder, env)} (custom)`);
}
async function chooseTargets(rows, env) {
  const shared = rows.findIndex((row) => row.shared);
  const options = folderOptions(rows, env);
  if (shared >= 0) {
    const row = rows[shared];
    options.unshift({ value: shared, label: `${row.label.padEnd(12)} ${tilde(row.path, env)}`, hint: "shared copy, always installed" });
  }
  const picked = await ask(
    multiselect({
      message: "Install the skills for",
      options,
      initialValues: options.filter((o) => rows[o.value].selected || o.value === shared).map((o) => o.value),
      required: false
    })
  );
  for (const o of options) rows[o.value].selected = picked.includes(o.value);
  if (shared >= 0 && !rows[shared].selected) {
    rows[shared].selected = true;
    log.warn(`Codex reads the shared copy ${tilde(rows[shared].path, env)}, so it is always installed.`);
  }
  for (; ; ) {
    const choice = await ask(
      select({
        message: "Folders",
        initialValue: "continue",
        options: [
          { value: "continue", label: "Continue" },
          { value: "edit", label: "Edit a folder" },
          { value: "add", label: "Add a custom folder" }
        ]
      })
    );
    if (choice === "continue") return;
    if (choice === "edit") await editFolder(rows, env);
    else await addFolder(rows, env);
  }
}
async function runInteractive(env) {
  intro("agent-huddle");
  const spin = spinner();
  spin.start("Getting skills");
  let staged;
  try {
    staged = await stage(env);
  } catch (err) {
    spin.error(err.message);
    process.exit(1);
  }
  spin.stop(`${SKILLS.length} skills ready`);
  const rows = detect(env);
  const warnings = prepareRows(rows, { dirs: [] }, env);
  log.info(["Agents:", ...detectedLines(rows), sharedLine(env)].join("\n"));
  for (const w of warnings) log.warn(w);
  await chooseTargets(rows, env);
  const plan = buildPlan(rows, env);
  note(planLines(plan, env).join("\n"), "Plan");
  if (!await ask(confirm({ message: "Proceed?", initialValue: true }))) {
    cancel("Nothing changed.");
    process.exit(0);
  }
  spin.start("Installing");
  const saved = install(rows, plan, staged, env);
  spin.stop(`Installed; saved targets to ${tilde(saved, env)}`);
  const next = nextSteps(rows);
  if (next.length) note(next.join("\n"), "Next");
  outro(INVITE_LINE);
}
async function runUninstall(opts, env, canPrompt) {
  const paths = uninstallPlan(env);
  if (!paths.length) {
    console.log("Nothing to remove.");
    return;
  }
  const list = paths.map((x) => tilde(x, env));
  if (opts.yes) {
    uninstall(paths);
    for (const x of list) console.log(`\u2713 Removed ${x}`);
    return;
  }
  if (!canPrompt) {
    console.log(`Would remove:
${list.map((x) => `  ${x}`).join("\n")}`);
    console.log("\nNothing removed. Rerun with --uninstall --yes to remove these.");
    return;
  }
  intro("agent-huddle uninstall");
  note(list.join("\n"), "Remove");
  if (!await ask(confirm({ message: "Remove these?", initialValue: false }))) {
    cancel("Nothing changed.");
    process.exit(0);
  }
  uninstall(paths);
  outro(`Removed ${paths.length} item${paths.length === 1 ? "" : "s"}.`);
}
async function main(argv = process.argv.slice(2), env = process.env) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(USAGE);
    fail(err.message);
  }
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  const agent = await (0, import_detect_agent.determineAgent)();
  const canPrompt = Boolean(process.stdin.isTTY) && !agent.isAgent;
  if (opts.uninstall) return runUninstall(opts, env, canPrompt);
  if (canPrompt && !opts.yes && !opts.dirs.length && !opts.dryRun) return runInteractive(env);
  return runPlain(opts, env, agent);
}
await main();
