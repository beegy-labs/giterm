import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/widgets/sidebar";
import { useConnectionStore } from "@/entities/connection";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    useConnectionStore.setState({ connections: [] });
  });

  it("should render the header", () => {
    render(<Sidebar />);
    expect(screen.getByText("Connections")).toBeInTheDocument();
  });

  it("should show empty state when no connections", () => {
    render(<Sidebar />);
    expect(screen.getByText("No saved connections")).toBeInTheDocument();
  });

  it("should render connection items with privacy-safe display", () => {
    useConnectionStore.setState({
      connections: [
        {
          id: "1",
          name: "Test Server",
          host: "example.com",
          port: 22,
          username: "user",
          authMethod: "password",
        },
      ],
    });
    render(<Sidebar />);
    expect(screen.getByText("Test Server")).toBeInTheDocument();
    expect(screen.getByText("SSH")).toBeInTheDocument();
    // Privacy: should NOT show user@host:port
    expect(screen.queryByText("user@example.com:22")).not.toBeInTheDocument();
  });

  it("should show custom port indicator for non-standard ports", () => {
    useConnectionStore.setState({
      connections: [
        {
          id: "1",
          name: "Custom Port Server",
          host: "example.com",
          port: 2222,
          username: "user",
          authMethod: "password",
        },
      ],
    });
    render(<Sidebar />);
    expect(screen.getByText("Custom Port")).toBeInTheDocument();
  });
});
