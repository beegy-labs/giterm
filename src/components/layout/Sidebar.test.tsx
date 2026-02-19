import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useConnectionStore } from "@/stores/connection-store";

// Mock @tauri-apps/api to prevent import errors in test
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

  it("should render the new connection button", () => {
    render(<Sidebar />);
    expect(screen.getByText("+ New")).toBeInTheDocument();
  });

  it("should render connection items", () => {
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
    expect(screen.getByText("user@example.com:22")).toBeInTheDocument();
  });
});
