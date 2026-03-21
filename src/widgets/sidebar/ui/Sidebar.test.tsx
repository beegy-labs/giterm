import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/widgets/sidebar";
import { useConnectionStore } from "@/entities/connection";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

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
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Connections")).toBeInTheDocument();
  });

  it("should show empty state when no connections", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
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
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Test Server")).toBeInTheDocument();
    expect(screen.getByText("SSH")).toBeInTheDocument();
    // Privacy: should NOT show user@host:port
    expect(screen.queryByText("user@example.com:22")).not.toBeInTheDocument();
  });

  it("should not leak port metadata for non-standard ports", () => {
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
    render(<Sidebar />, { wrapper: createWrapper() });
    // Privacy: should NOT show port info
    expect(screen.queryByText("Custom Port")).not.toBeInTheDocument();
    expect(screen.queryByText("2222")).not.toBeInTheDocument();
  });
});
