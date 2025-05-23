// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyASh50cDkMQCiST0GndxNqWwBv-QO9U1h8",
  authDomain: "josmarketfind.firebaseapp.com",
  projectId: "josmarketfind",
  storageBucket: "josmarketfind.appspot.com", // Corrected: .appspot.com for storageBucket
  messagingSenderId: "166343463420",
  appId: "1:166343463420:web:ec4bbda2689bafde71e279",
  measurementId: "G-C7FXYSQFXY"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Optional: export if using modules, but global scope is fine for these scripts
// export { app, auth, db, storage };
