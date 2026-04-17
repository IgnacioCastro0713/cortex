import { styleText } from "node:util";

export const log = {
  success: (msg: string) => console.log(styleText("green", msg)),
  error: (msg: string) => console.error(styleText("red", msg)),
  warn: (msg: string) => console.log(styleText("yellow", msg)),
  info: (msg: string) => console.log(styleText("cyan", msg)),
  dim: (msg: string) => console.log(styleText("dim", msg)),
  plain: (msg: string) => console.log(msg),
  separator: () => console.log(),
  header: (cmd: string) => {
    console.log();
    console.log(styleText("bold", `  cortex ${cmd}`));
  },
} as const;
