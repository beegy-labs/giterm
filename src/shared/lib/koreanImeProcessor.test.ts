import { describe, it, expect } from "vitest";
import {
  processText,
  createInitialState,
  type ImeState,
  type ImeAction,
} from "./koreanImeProcessor";

/** Helper: run a sequence of input values through processText */
function runSequence(inputs: string[]): {
  allActions: ImeAction[][];
  state: ImeState;
} {
  const state = createInitialState();
  const allActions = inputs.map((text) => processText(state, text));
  return { allActions, state };
}

/** Helper: extract specific action types from a list */
function commits(actions: ImeAction[]): string[] {
  return actions
    .filter((a) => a.type === "commit")
    .map((a) => (a as { type: "commit"; char: string }).char);
}

function composings(actions: ImeAction[]): string[] {
  return actions
    .filter((a) => a.type === "composing")
    .map((a) => (a as { type: "composing"; text: string }).text);
}

function hasSwap(actions: ImeAction[]): boolean {
  return actions.some((a) => a.type === "swap");
}

function backspaceCount(actions: ImeAction[]): number {
  return actions.filter((a) => a.type === "backspace").length;
}

// ============================================================================
// Test: Forward typing Korean "반가워"
// ============================================================================
describe("Korean typing: 반가워", () => {
  // iOS Korean IME event sequence for typing "반가워":
  // ㅂ → 바 → 반 → 반ㄱ → 반가 → 반가ㅇ → 반가워
  const inputs = ["ㅂ", "바", "반", "반ㄱ", "반가", "반가ㅇ", "반가워"];

  it("should commit 반 when 반ㄱ appears", () => {
    const { allActions } = runSequence(inputs.slice(0, 4)); // up to "반ㄱ"
    const step4 = allActions[3]!; // "반ㄱ"
    expect(commits(step4)).toEqual(["반"]);
    expect(composings(step4)).toContain("ㄱ");
  });

  it("should NOT swap when composing is still active after commit", () => {
    const { allActions } = runSequence(inputs.slice(0, 4));
    const step4 = allActions[3]!;
    expect(hasSwap(step4)).toBe(false);
  });

  it("should commit 가 when 반가ㅇ appears", () => {
    const { allActions } = runSequence(inputs.slice(0, 6)); // up to "반가ㅇ"
    const step6 = allActions[5]!; // "반가ㅇ"
    expect(commits(step6)).toEqual(["가"]);
    expect(composings(step6)).toContain("ㅇ");
  });

  it("should have outputted=반가 and composing=워 at the end", () => {
    const { state } = runSequence(inputs);
    expect(state.outputted).toBe("반가");
    expect(state.composing).toBe("워");
  });
});

// ============================================================================
// Test: Backspace from "반가워"
// ============================================================================
describe("Korean backspace: 반가워 → empty", () => {
  // Forward typing to get to "반가워"
  const typingInputs = [
    "ㅂ", "바", "반", "반ㄱ", "반가", "반가ㅇ", "반가워",
  ];

  // iOS backspace sequence from "반가워":
  // 반가워 → 반가우 → 반가ㅇ → 반가
  // (composing 워 → 우 → ㅇ → empty)
  // iOS backspace values: "반가우", "반가ㅇ", "반가"

  it("should update composing during jamo deletion: 워→우→ㅇ", () => {
    const state = createInitialState();
    // Type forward
    for (const input of typingInputs) {
      processText(state, input);
    }
    expect(state.composing).toBe("워");
    expect(state.outputted).toBe("반가");

    // Backspace 1: 반가워 → 반가우 (remove ㅓ from 워)
    const a1 = processText(state, "반가우");
    expect(composings(a1)).toContain("우");
    expect(state.composing).toBe("우");

    // Backspace 2: 반가우 → 반가ㅇ (remove ㅜ from 우)
    const a2 = processText(state, "반가ㅇ");
    expect(composings(a2)).toContain("ㅇ");
    expect(state.composing).toBe("ㅇ");

    // Backspace 3: 반가ㅇ → 반가 (remove ㅇ, composing empty)
    processText(state, "반가");
    expect(state.composing).toBe("");
  });

  it("should SWAP when composing becomes empty and outputted is not", () => {
    const state = createInitialState();
    for (const input of typingInputs) {
      processText(state, input);
    }

    processText(state, "반가우");
    processText(state, "반가ㅇ");
    const a3 = processText(state, "반가");

    // Should swap: composing="" and outputted was "반가"
    expect(hasSwap(a3)).toBe(true);
  });

  it("should keep outputted after swap signal (consumer resets)", () => {
    const state = createInitialState();
    for (const input of typingInputs) {
      processText(state, input);
    }

    processText(state, "반가우");
    processText(state, "반가ㅇ");
    processText(state, "반가");

    // Processor signals swap but does NOT reset state.
    // The consumer (HiddenImeInput) resets when the swap actually executes.
    expect(state.outputted).toBe("반가");
    expect(state.lastText).toBe("반가");
  });

  it("should NOT send backspace when composing is simply deleted by IME", () => {
    const state = createInitialState();
    for (const input of typingInputs) {
      processText(state, input);
    }

    // Each backspace during composing should NOT send terminal backspace
    // (the chars were never committed to terminal)
    const a1 = processText(state, "반가우");
    expect(backspaceCount(a1)).toBe(0);

    const a2 = processText(state, "반가ㅇ");
    expect(backspaceCount(a2)).toBe(0);
  });
});

// ============================================================================
// Test: RECOMP — iOS merges jamo across syllable boundary
// ============================================================================
describe("Korean RECOMP: 반가우 → 반강", () => {
  const typingInputs = [
    "ㅂ", "바", "반", "반ㄱ", "반가", "반가ㅇ", "반가워",
  ];

  it("should detect RECOMP and extract merged jongseong", () => {
    const state = createInitialState();
    for (const input of typingInputs) {
      processText(state, input);
    }

    // Instead of normal backspace "반가우" → "반가ㅇ" → "반가",
    // iOS might RECOMP: "반가우" → "반강"
    // (ㅇ from 우 merges into 가 → 강)
    processText(state, "반가우"); // 워→우 (normal)

    // Now iOS recomposes: "반가우" → "반강" (instead of "반가ㅇ")
    const a = processText(state, "반강");

    // Should detect RECOMP and extract "ㅇ" as composing
    expect(composings(a)).toContain("ㅇ");
    expect(state.composing).toBe("ㅇ");
    // Outputted should stay "반가" (unchanged)
    expect(state.outputted).toBe("반가");
  });

  it("should NOT send backspace during RECOMP", () => {
    const state = createInitialState();
    for (const input of typingInputs) {
      processText(state, input);
    }
    processText(state, "반가우");
    const a = processText(state, "반강");
    expect(backspaceCount(a)).toBe(0);
  });

  it("should NOT swap during RECOMP (composing is not empty)", () => {
    const state = createInitialState();
    for (const input of typingInputs) {
      processText(state, input);
    }
    processText(state, "반가우");
    const a = processText(state, "반강");
    expect(hasSwap(a)).toBe(false);
  });
});

// ============================================================================
// Test: After RECOMP, continue backspace to empty
// ============================================================================
describe("Korean after RECOMP: 반강 → swap", () => {
  it("should swap when composing becomes empty after RECOMP", () => {
    const state = createInitialState();
    // Type 반가워
    for (const input of ["ㅂ", "바", "반", "반ㄱ", "반가", "반가ㅇ", "반가워"]) {
      processText(state, input);
    }
    // Backspace 워→우
    processText(state, "반가우");
    // RECOMP: 반가우 → 반강
    processText(state, "반강");
    expect(state.composing).toBe("ㅇ");

    // After RECOMP, lastText was set to "반가ㅇ" (outputted + mergedJamo)
    // Next backspace: "반가ㅇ" → "반가" (ㅇ deleted)
    const a = processText(state, "반가");
    expect(state.composing).toBe("");
    expect(hasSwap(a)).toBe(true);
    // Processor signals swap but does NOT reset state (consumer resets)
    expect(state.outputted).toBe("반가");
  });
});

// ============================================================================
// Test: Non-Korean typing
// ============================================================================
describe("Non-Korean typing", () => {
  it("should commit single non-Korean char and swap", () => {
    const state = createInitialState();
    const a = processText(state, "a");
    expect(commits(a)).toEqual(["a"]);
    expect(hasSwap(a)).toBe(true);
    expect(state.outputted).toBe("a");
    expect(state.composing).toBe("");
  });

  it("should commit multiple non-Korean chars without double-commit", () => {
    const state = createInitialState();
    const a1 = processText(state, "a");
    expect(commits(a1)).toEqual(["a"]);
    expect(state.outputted).toBe("a");

    // If swap didn't execute (deferred), next char arrives with accumulated text.
    // Should only commit the NEW char, not re-commit 'a'.
    const a2 = processText(state, "ab");
    expect(commits(a2)).toEqual(["b"]);
    expect(state.outputted).toBe("ab");
  });

  it("should commit after swap reset", () => {
    const state = createInitialState();
    processText(state, "a");

    // Consumer executed swap → reset state
    state.outputted = "";
    state.lastText = "";

    const a2 = processText(state, "b");
    expect(commits(a2)).toEqual(["b"]);
    expect(state.outputted).toBe("b");
  });
});

// ============================================================================
// Test: Mixed Korean + non-Korean
// ============================================================================
describe("Mixed Korean and non-Korean", () => {
  it("should commit Korean then non-Korean", () => {
    const state = createInitialState();
    processText(state, "ㄱ");
    processText(state, "가");
    expect(state.composing).toBe("가");

    // Non-Korean typed after Korean: "가a"
    const a = processText(state, "가a");
    expect(commits(a)).toContain("가");
    expect(commits(a)).toContain("a");
    expect(state.composing).toBe("");
  });
});

// ============================================================================
// Test: Composing deletion to empty (all jamo backspaced)
// ============================================================================
describe("Composing deletion to empty", () => {
  it("should send backspace when composing text is fully deleted", () => {
    const state = createInitialState();
    processText(state, "ㄱ"); // composing "ㄱ"
    expect(state.composing).toBe("ㄱ");

    // Delete ㄱ → empty
    const a = processText(state, "");
    expect(backspaceCount(a)).toBe(1);
    expect(state.composing).toBe("");
  });

  it("should swap when composing deleted to empty (iOS IME buffer reset needed)", () => {
    const state = createInitialState();
    processText(state, "ㄱ");
    const a = processText(state, "");
    expect(hasSwap(a)).toBe(true); // Reset iOS IME buffer
  });
});

// ============================================================================
// Test: Verify state.lastText tracks properly for the swap'd input
// ============================================================================
describe("State tracking after swap", () => {
  it("should signal swap and allow consumer to reset for fresh input", () => {
    const state = createInitialState();
    // Type "반가" then backspace composing
    for (const input of ["ㅂ", "바", "반", "반ㄱ", "반가"]) {
      processText(state, input);
    }
    expect(state.outputted).toBe("반");
    expect(state.composing).toBe("가");

    // Backspace 가→ㄱ
    processText(state, "반ㄱ");
    // Backspace ㄱ→empty
    const swapActions = processText(state, "반");

    // Processor signals swap but doesn't reset
    expect(hasSwap(swapActions)).toBe(true);
    expect(state.outputted).toBe("반");

    // Consumer resets state when swap actually executes
    state.outputted = "";
    state.lastText = "";

    // After reset, typing on fresh input should work normally
    const a = processText(state, "ㄴ");
    expect(composings(a)).toContain("ㄴ");
    expect(state.composing).toBe("ㄴ");
  });
});

// ============================================================================
// Test: Enter key scenario (composing flushed externally)
// ============================================================================
describe("External composing flush (Enter)", () => {
  it("should handle state after external composing clear", () => {
    const state = createInitialState();
    for (const input of ["ㅂ", "바", "반"]) {
      processText(state, input);
    }
    expect(state.composing).toBe("반");

    // Simulate Enter: externally commit composing and reset
    state.composing = "";
    state.outputted = "";
    state.lastText = "";

    // Type again on fresh input
    const a = processText(state, "ㅎ");
    expect(composings(a)).toContain("ㅎ");
  });
});

// ============================================================================
// Test: Duplicate event filtering
// ============================================================================
describe("Duplicate event filtering", () => {
  it("should ignore duplicate text values", () => {
    const state = createInitialState();
    processText(state, "ㄱ");
    const a = processText(state, "ㄱ"); // duplicate
    expect(a).toEqual([]);
  });
});

// ============================================================================
// Test: The key scenario - "반가" deletion tracking after swap
// ============================================================================
describe("Post-swap backspace sends terminal backspace", () => {
  it("after swap, further processText calls on empty should not crash", () => {
    const state = createInitialState();
    // Type 반가워
    for (const input of [
      "ㅂ", "바", "반", "반ㄱ", "반가", "반가ㅇ", "반가워",
    ]) {
      processText(state, input);
    }
    // Backspace composing: 워→우→ㅇ→empty
    processText(state, "반가우");
    processText(state, "반가ㅇ");
    const swapActions = processText(state, "반가"); // → swap signal

    expect(hasSwap(swapActions)).toBe(true);

    // Consumer resets state when executing the swap
    state.outputted = "";
    state.composing = "";
    state.lastText = "";

    // After reset, the input is empty.
    // processText with "" should be a no-op (lastText is already "")
    const a = processText(state, "");
    expect(backspaceCount(a)).toBe(0); // Already empty, no action
  });
});
