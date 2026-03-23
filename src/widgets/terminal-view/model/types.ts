import type { Terminal as XTerminal } from "@xterm/xterm";
import type { CanvasAddon } from "@xterm/addon-canvas";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";

export interface TermInstance {
  terminal: XTerminal;
  fitAddon: FitAddon;
  canvasAddon: CanvasAddon | null;
  webglAddon: WebglAddon | null;
  containerEl: HTMLDivElement;
}
