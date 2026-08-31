@echo off
REM ============================================================================
REM  claude-remote-control.cmd  (theleague-web)
REM  Auto-launches a Claude Code session with Remote Control enabled after
REM  login, so this project is reachable from claude.ai / the mobile app
REM  without touching the laptop. Sibling of the identically-named script in
REM  sportsbook-bot; the two run SIDE BY SIDE as separately named sessions.
REM
REM  WHY THERE IS NO SERVICE/WATCHDOG HERE (unlike sportsbook-bot):
REM  that project must stay always-on because it RUNS things -- a Telegram
REM  poller, the Mini App server and a cloudflared tunnel. This project runs
REM  nothing locally: the site is statically hosted, and the league data is
REM  refreshed hourly by .github/workflows/refresh-data.yml in GitHub Actions.
REM  So the ONLY thing worth auto-starting is the remote-control session.
REM
REM  NOTE: fresh session each boot (CLAUDE.md -> @AGENTS.md auto-loads context);
REM  it does NOT resurrect a prior conversation.
REM
REM  Installed to the Startup folder as a shortcut so it runs at login:
REM    %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
REM ============================================================================

cd /d "C:\Users\Mark\Desktop\theleague-web\theleague-web"

REM 90s: deliberately LONGER than sportsbook-bot's 45s. That one shares the
REM login window with the bot stack + tunnel coming up; staggering keeps the two
REM Windows Terminal launches from racing each other for focus at login.
timeout /t 90 /nobreak >nul

REM Remote control needs a TTY, hence an interactive Windows Terminal window.
REM  -d forces the tab to open in THIS repo (note the nested path: the git repo
REM  is theleague-web\theleague-web, not the outer folder). Without -d, new-tab
REM  ignores this script's cwd and opens in %USERPROFILE%, which is neither
REM  trust-accepted nor CLAUDE.md-bearing -> blocking prompt + no context.
start "" wt.exe new-tab -d "C:\Users\Mark\Desktop\theleague-web\theleague-web" --title "Claude RC (theleague)" cmd /k ""C:\Users\Mark\.local\bin\claude.exe" --remote-control theleague"
