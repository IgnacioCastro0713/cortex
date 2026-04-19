import { styleText } from "node:util";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const I = " "; // 1-space indent — sits left of log's 2-space indent

export interface Spinner {
  succeed: (msg?: string) => void;
  fail:    (msg?: string) => void;
  stop:    () => void;
}

export function spinner(msg: string): Spinner {
  let i = 0;
  const timer = setInterval(() => {
    const frame = styleText("cyan", FRAMES[i++ % FRAMES.length]!);
    process.stdout.write(`\r${I} ${frame}  ${msg}`);
  }, 80);

  function clear(label: string) {
    clearInterval(timer);
    process.stdout.write(`\r${" ".repeat(msg.length + 8)}\r`);
    process.stdout.write(`${label}\n`);
  }

  return {
    succeed: (done = msg) => clear(`${I} ${styleText("green", "✓")}  ${done}`),
    fail:    (done = msg) => clear(`${I} ${styleText("red",   "✗")}  ${done}`),
    stop:    ()           => { clearInterval(timer); process.stdout.write(`\r${" ".repeat(msg.length + 8)}\r`); },
  };
}
