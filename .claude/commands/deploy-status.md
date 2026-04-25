---
description: Show current Vercel deploy state for ShortStack — production + active branch deploys, with green/yellow/red status and links.
---

# /deploy-status

Use the Vercel MCP to fetch and report deploy state. Be concise — the user just wants a quick "is it deployed" check.

## Steps

1. List recent deployments:
   ```
   mcp__a16118ad-55ec-41f7-9a3c-c365114a34d0__list_deployments({
     projectId: "prj_QItTb3oaVz7NbAz85fVSEbtij9mP",
     teamId: "team_17XswmnMpNJxm8qbRxVxlyAH"
   })
   ```

2. Filter to: most recent **production** deploy + most recent deploy on **current branch**.

3. **Output format** (be terse):
   ```
   📦 Production
   ✅ READY  d4d1d57  (12 min ago)  fix(supabase): SSG-resilient browser client
   https://app.shortstack.work

   🌿 Current branch (feat/twilio-elevenlabs-bridge)
   ✅ READY  0d00366  (10 min ago)  Merge branch 'main' into feat/twilio-elevenlabs-bridge
   https://shortstack-os-git-feat-twilio-elev-524453-growth-9598s-projects.vercel.app
   ```

4. **If state == ERROR**, immediately fetch build logs and surface the failure cause. Hand off to the `vercel-deploy-watcher` agent if logs are large.

5. **If multiple recent ERROR'd attempts on the same branch**, that's a stuck-deploy signal — surface it as a P1.

## Constraints

- Don't wait/poll. If state is BUILDING, report "in flight, last estimate 5-7 min" and stop.
- Don't push code to fix the deploy unless the user asked. Just report.
- Always include the deploy URL so the user can click into it.
