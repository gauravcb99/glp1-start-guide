// Every user-facing string lives here. tests/copy.test.ts (Phase 5) scans this file for banned phrasing.

export const strings = {
  appName: "GLP-1 Start Guide",
  footer: "For general wellness and education. Not medical advice.",

  connection: {
    checking: "Checking your WHOOP connection…",
    connected: "Connected to WHOOP",
    notConnected: "Not connected",
    connect: "Connect your WHOOP",
    disconnect: "Disconnect",
    failed: "Couldn't connect to WHOOP. Please try again.",
  },
} as const;
