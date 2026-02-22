import { describe, it, expect, beforeEach } from "vitest";
import { useConnectionStore, type ConnectionConfig } from "@/entities/connection";

describe("connectionStore", () => {
  beforeEach(() => {
    useConnectionStore.setState({ connections: [] });
  });

  const mockConnection: ConnectionConfig = {
    id: "test-1",
    name: "Test Server",
    host: "example.com",
    port: 22,
    username: "user",
    authMethod: "password",
  };

  it("should start with empty connections", () => {
    const { connections } = useConnectionStore.getState();
    expect(connections).toEqual([]);
  });

  it("should add a connection", () => {
    useConnectionStore.getState().addConnection(mockConnection);
    const { connections } = useConnectionStore.getState();
    expect(connections).toHaveLength(1);
    expect(connections[0]).toEqual(mockConnection);
  });

  it("should remove a connection", () => {
    useConnectionStore.getState().addConnection(mockConnection);
    useConnectionStore.getState().removeConnection("test-1");
    const { connections } = useConnectionStore.getState();
    expect(connections).toHaveLength(0);
  });

  it("should update a connection", () => {
    useConnectionStore.getState().addConnection(mockConnection);
    useConnectionStore.getState().updateConnection("test-1", { name: "Updated Server" });
    const { connections } = useConnectionStore.getState();
    expect(connections[0]?.name).toBe("Updated Server");
    expect(connections[0]?.host).toBe("example.com");
  });

  it("should get a connection by id", () => {
    useConnectionStore.getState().addConnection(mockConnection);
    const conn = useConnectionStore.getState().getConnection("test-1");
    expect(conn).toEqual(mockConnection);
  });

  it("should return undefined for non-existent connection", () => {
    const conn = useConnectionStore.getState().getConnection("non-existent");
    expect(conn).toBeUndefined();
  });

  it("should add multiple connections", () => {
    useConnectionStore.getState().addConnection(mockConnection);
    useConnectionStore.getState().addConnection({
      ...mockConnection,
      id: "test-2",
      name: "Another Server",
    });
    const { connections } = useConnectionStore.getState();
    expect(connections).toHaveLength(2);
  });
});
