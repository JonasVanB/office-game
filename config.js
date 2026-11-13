// Multiplayer settings. None of these values are secrets: they identify the app, and access is
// controlled by the Entra ID app registration and the Firebase database rules.
// While a block is empty, the game runs without it (see MULTIPLAYER.md).
window.OFFICE_CONFIG = {
  // Microsoft Entra ID (Azure AD) app registration: single tenant, platform "Single-page application"
  msal: {
    clientId: '2d5e2108-a36e-41b6-a02b-3dbed6c097d7',   // Application (client) ID
    tenantId: 'a3ee6e5a-9032-4e96-8f5c-12dda7786246',   // Directory (tenant) ID of Orbid
  },
  // Firebase project: Project settings → General → Your apps → Web app → SDK setup and configuration
  firebase: {
    apiKey: 'AIzaSyDyQdLGiSetTDHyO49ucbbkm7pC5Gwq4zo',
    authDomain: 'office-game-87f7f.firebaseapp.com',
    databaseURL: 'https://office-game-87f7f-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'office-game-87f7f',
    appId: '1:333833731727:web:371cd6e5eda78d3fb1fafa',
  },
};
