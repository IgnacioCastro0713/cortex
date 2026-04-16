import { styleText } from "node:util";

export const log = {
  success: (msg: string) => console.log(styleText("green", msg)),
  error: (msg: string) => console.error(styleText("red", msg)),
  warn: (msg: string) => console.log(styleText("yellow", msg)),
  info: (msg: string) => console.log(styleText("cyan", msg)),
  dim: (msg: string) => console.log(styleText("dim", msg)),
  plain: (msg: string) => console.log(msg),
} as const;
