# Tunnel Management — Feature SSOT

> SSH local port forwarding | **Last Updated**: 2026-03-04

## Structure

```
features/tunnel-manage/
├── adapters/api/tunnelApi.ts — tunnelStart(), tunnelStop() IPC wrappers
├── ui/TunnelDialog.tsx       — Add/remove tunnels per session
└── index.ts
```

## Backend (Rust)

- `tunnel.rs`: `TunnelManager` holds `HashMap<tunnelId, CancelToken>`
- `tunnel_start`: binds local TCP listener, spawns tokio task per connection
- Each connection: `direct-tcpip` channel to remote, bidirectional copy
- `tunnel_stop`: sends cancel signal, task cleans up and removes entry
- Cleanup: explicit `tunnels.remove(&tid)` after loop exits (cancel or accept error)

## Frontend

- `tunnelStore` (entity): `MAX_TUNNELS=20`, `addTunnel` returns boolean
- `TunnelDialog`: filters tunnels by active session via `useMemo`
- Form: localPort, remoteHost, remotePort inputs

## IPC

| Command | Direction | Purpose |
|---------|-----------|---------|
| `tunnel_start` | FE→BE | Start local port forward |
| `tunnel_stop` | FE→BE | Stop tunnel by ID |
