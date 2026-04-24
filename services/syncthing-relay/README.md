# Syncthing Relay Server (self-host)

A private [Syncthing relay](https://docs.syncthing.net/users/relaying.html) so
agency teammates and freelancers can sync over our own infrastructure instead
of the public community pool. This keeps transfers fast, predictable, and off
the default relay network.

This is optional. Syncthing works fine with the public pool; self-hosting a
relay is a performance / privacy upgrade, not a requirement.

---

## What's in here

- `docker-compose.yml` - runs the official `syncthing/relaysrv` image as a
  private relay (opts out of the public pool via `STRELAYSRV_POOLS=""`).
- This README.

## Prerequisites

- A Linux / macOS / Windows box with Docker + Docker Compose installed.
- A public IPv4 or reachable private IP if teammates are on the same LAN / VPN.
- Ports `22067/tcp` and (optionally) `22070/tcp` open:
  - `22067` - relay traffic (required).
  - `22070` - status JSON endpoint (handy for monitoring; can stay internal).

## 1. Bring up the relay

```bash
cd services/syncthing-relay
docker compose up -d
docker compose logs -f strelaysrv
```

On first boot the container generates a TLS identity and prints a URI that
looks like:

```
relay://<public-host>:22067/?id=<RELAY_DEVICE_ID>
```

Copy that URI - you'll paste it into each teammate's Syncthing config.

## 2. Confirm it's running

```bash
curl http://<public-host>:22070/status | jq .
```

You should see JSON with `"numActiveSessions": 0` on a fresh relay. Active
sessions increase once teammates start relaying through it.

## 3. Point teammates at the relay

On each teammate's Syncthing install:

1. Open the web UI at `http://localhost:8384`.
2. Go to **Actions > Settings > Connections**.
3. In the **Sync Protocol Listen Addresses** / **Relays** fields add:
   ```
   relay://<public-host>:22067/?id=<RELAY_DEVICE_ID>
   ```
   Leave `dynamic+https://relays.syncthing.net/endpoint` if you still want
   public fallback, or remove it to force private-only.
4. Save. Syncthing will reconnect using your relay.

## 4. Update the ShortStack OS UI (optional)

If you want the in-app "Add device" QR flow to embed your relay automatically,
set the env var in the Next.js app:

```
SYNCTHING_RELAY_URI=relay://<public-host>:22067/?id=<RELAY_DEVICE_ID>
```

The share-kit API route reads this and appends it to the generated share URL
so new teammates are connected to the private relay on first pair.

## 5. Monitoring

- `GET /status` on port `22070` returns JSON with active sessions, bytes
  relayed, and uptime.
- Docker healthcheck in `docker-compose.yml` hits that same endpoint every
  30s and marks the container unhealthy after 3 failures.

## 6. Upgrades

```bash
cd services/syncthing-relay
docker compose pull
docker compose up -d
```

The relay identity is persisted in the `shortstack-strelaysrv-data` named
volume, so the relay URI does NOT change on upgrade.

## 7. Uninstall

```bash
cd services/syncthing-relay
docker compose down -v
```

`-v` also removes the data volume and the TLS identity; teammates pointing at
the old relay URI will need the new one if you redeploy.

## FAQ

**Do we need a relay if peers are online at the same time?**
No. Syncthing will connect peers directly when both are reachable. The relay
is only used when direct P2P fails (symmetric NAT, both behind CGNAT, etc.).

**Is traffic readable by the relay?**
No. Relay traffic is end-to-end encrypted between devices; the relay only
sees opaque ciphertext.

**Can I join the public relay pool instead?**
Yes - set `STRELAYSRV_POOLS` back to the default
`https://relays.syncthing.net/endpoint` in `docker-compose.yml`. You then
contribute to the community pool and also receive public traffic.

## References

- Syncthing Relay docs: https://docs.syncthing.net/users/relaying.html
- `strelaysrv` source: https://github.com/syncthing/syncthing/tree/main/cmd/strelaysrv
- ShortStack OS team-sync page: `/dashboard/files/team-sync`
