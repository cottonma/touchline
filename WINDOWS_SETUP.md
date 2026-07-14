# Touchline - Windows Setup Guide

## Problem: "gyp ERR! find VS" error

The `better-sqlite3` package needs C++ build tools to install on Windows.
You have two options:

## Option A: Install Windows Build Tools (Recommended - One Time Only)

Open Command Prompt **as Administrator** (right-click → Run as administrator) and run:

```
npm install -g windows-build-tools
```

If that doesn't work, try:

```
npm install -g --production windows-build-tools
```

Then close Command Prompt, reopen it normally, and retry the install.

## Option B: Install Visual Studio Build Tools manually

1. Go to: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Download "Build Tools for Visual Studio 2022"
3. Run the installer
4. Select "Desktop development with C++" workload
5. Click Install
6. Restart your computer
7. Retry the npm install

## After installing build tools:

```
cd C:\Users\matth\Downloads\touchline-main\touchline-main\server
npm install
npx tsx src/db/migrate.ts
npx tsx src/db/seed-all.ts
cd ..\client
npm install
cd ..
npm run dev
```

Then open http://localhost:5173 in your browser.
