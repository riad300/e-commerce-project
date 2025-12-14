// js/firebase.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAf2Km1a07ZOLfyvUX8xOWmDkE6Rm7lN90",
  authDomain: "ecommerce-auth-359dd.firebaseapp.com",
  projectId: "ecommerce-auth-359dd",
  appId: "1:345618204792:web:7d693af8b5aff11232458d"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
