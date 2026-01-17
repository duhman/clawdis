---
summary: "SSH tunnel setup for Clawdbot.app connecting to a remote gateway"
read_when: "Connecting the macOS app to a remote gateway over SSH"
---

# Running Clawdbot.app with a Remote Gateway

Clawdbot.app manages its own SSH tunnel when Remote over SSH is enabled. This guide shows both:
- **App-managed tunnels** (recommended)
- **Manual tunnels** (CLI-only or legacy setups)

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Machine                          │
│                                                              │
│  Clawdbot.app ──► ws://127.0.0.1:18789 (local port)           │
│                     │                                        │
│                     ▼                                        │
│  SSH Tunnel ────────────────────────────────────────────────│
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         Remote Machine                        │
│                                                              │
│  Gateway WebSocket ──► ws://127.0.0.1:18789 ──►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## App-Managed Tunnel (Recommended)

### Step 1: Add SSH Config (optional but recommended)

Edit `~/.ssh/config` and add:

```ssh
Host gateway-host
    HostName <tailnet-ip-or-magicdns>
    User <remote-user>
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

### Step 2: Configure the macOS app

In *Settings → General*:
- **Remote over SSH**: enabled
- **SSH target**: `user@gateway-host`
- **Identity file** (optional): `~/.ssh/id_ed25519`
- **Project root** (optional): remote checkout path

Click **Test remote**. The app will open the tunnel automatically.

Note: Do **not** run a separate SSH tunnel LaunchAgent when using the app; it can occupy local port `18789` and cause “local port unavailable” errors.

---

## Manual Tunnel (CLI or legacy)

### Step 1: Add SSH Config

Edit `~/.ssh/config` and add:

```ssh
Host gateway-host
    HostName <remote-host>
    User <remote-user>
    AddressFamily inet
    LocalForward 127.0.0.1:18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Replace `<remote-host>` and `<remote-user>` with your values.

### Step 2: Copy SSH Key

Copy your public key to the remote machine (enter password once):

```bash
ssh-copy-id -i ~/.ssh/id_ed25519 <remote-user>@<remote-host>
```

### Step 3: Set Gateway Token

```bash
launchctl setenv CLAWDBOT_GATEWAY_TOKEN "<your-token>"
```

### Step 4: Start SSH Tunnel

```bash
ssh -N gateway-host &
```

### Step 5: Restart Clawdbot.app

```bash
# Quit Clawdbot.app (⌘Q), then reopen:
open /path/to/Clawdbot.app
```

The app will now connect to the remote gateway through the SSH tunnel.

---

## Auto-Start Tunnel on Login (Manual Tunnel Only)

To have a manual SSH tunnel start automatically when you log in, create a Launch Agent.
Skip this if the macOS app is managing your tunnel.

### Create the PLIST file

Save this as `~/Library/LaunchAgents/com.clawdbot.ssh-tunnel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clawdbot.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>-o</string>
        <string>ExitOnForwardFailure=yes</string>
        <string>-o</string>
        <string>ServerAliveInterval=30</string>
        <string>-o</string>
        <string>ServerAliveCountMax=3</string>
        <string>gateway-host</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/com.clawdbot.ssh-tunnel.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/com.clawdbot.ssh-tunnel.err.log</string>
</dict>
</plist>
```

### Load the Launch Agent

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.clawdbot.ssh-tunnel.plist
```

The tunnel will now:
- Start automatically when you log in
- Restart if it crashes
- Keep running in the background

If the tunnel fails to start, check the logs in `/tmp/com.clawdbot.ssh-tunnel.err.log`
and confirm nothing else is listening on `127.0.0.1:18789`.

---

## Troubleshooting

**Check if tunnel is running:**

```bash
ps aux | grep "ssh -N gateway-host" | grep -v grep
lsof -i :18789
```

**Restart the tunnel:**

```bash
launchctl kickstart -k gui/$UID/com.clawdbot.ssh-tunnel
```

**Stop the tunnel:**

```bash
launchctl bootout gui/$UID/com.clawdbot.ssh-tunnel
```

---

## How It Works

| Component | What It Does |
|-----------|--------------|
| `LocalForward 18789 127.0.0.1:18789` | Forwards local port 18789 to remote port 18789 |
| `ssh -N` | SSH without executing remote commands (just port forwarding) |
| `KeepAlive` | Automatically restarts tunnel if it crashes |
| `RunAtLoad` | Starts tunnel when the agent loads |

Clawdbot.app connects to `ws://127.0.0.1:18789` on your client machine. The SSH tunnel forwards that connection to port 18789 on the remote machine where the Gateway is running.
