import type { Terminal as XTerminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";

export interface TermInstance {
  terminal: XTerminal;
  fitAddon: FitAddon;
  webglAddon: WebglAddon | null;
  containerEl: HTMLDivElement;
}
