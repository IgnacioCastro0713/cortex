import { styleText } from "node:util";

const I = "  "; // indent

let verboseEnabled = false;

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export const log = {
  success: (msg: string) => console.log(`${I}${styleText("green",  "✓")}  ${msg}`),
  skip:    (msg: string) => console.log(`${I}${styleText("dim",    "–")}  ${styleText("dim", msg)}`),
  error:   (msg: string) => console.log(`${I}${styleText("red",    "✗")}  ${msg}`),
  warn:    (msg: string) => console.log(`${I}${styleText("yellow", "⚠")}  ${msg}`),
  info:    (msg: string) => console.log(`${I}${styleText("cyan",   "●")}  ${msg}`),
  dim:     (msg: string) => console.log(msg.split("\n").map((l) => `${I}${styleText("dim", l)}`).join("\n")),
  plain:   (msg: string) => console.log(`${I}${msg}`),
  verbose: (msg: string) => { if (verboseEnabled) console.log(`${I}${styleText("dim", `[verbose] ${msg}`)}`); },
  separator: () => console.log(),
  header:  (cmd: string) => {
    console.log();
    console.log(`${I}${styleText("bold", `cortex ${cmd}`)}`);
    console.log();
  },
  outro:   (msg: string) => {
    console.log();
    console.log(`${I}${styleText("dim", msg)}`);
    console.log();
  },
} as const;
