// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDXhnPbclOFP6o9T33BX7QHhLwJutzc0u0",
  authDomain: "login-form2-a62f2.firebaseapp.com",
  projectId: "login-form2-a62f2",
  storageBucket: "login-form2-a62f2.firebasestorage.app",
  messagingSenderId: "951254285323",
  appId: "1:951254285323:web:8408f85412d244fb339b0e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// improved showMessage (keeps concise UI behavior)
function showMessage(message, divId) {
  const div = document.getElementById(divId);
  if (!div) return;
  div.style.display = "block";
  div.textContent = message;
  div.style.opacity = 1;
  setTimeout(() => {
    div.style.opacity = 0;
    setTimeout(() => { div.style.display = "none"; }, 500);
  }, 4500);
}

// Wait for DOM so module can be placed anywhere
window.addEventListener('DOMContentLoaded', () => {
  console.log('Firebase handlers initializing');

  // expose a sign-out helper for pages like homepage.html
  window.doSignOut = function() {
    signOut(auth).then(() => {
      window.location.href = 'index.html';
    }).catch(err => {
      console.error('Sign-out error', err);
      alert('Sign-out failed');
    });
  }

  // Optional: on the index page, show current user/email if present
  onAuthStateChanged(auth, user => {
    // if user is on homepage, that page has its own observer. This helps keep UI consistent.
    const userSpan = document.getElementById('currentUserEmail');
    if (user && userSpan) userSpan.textContent = user.email || '(no email)';
  });

  // Storage helpers for resume
  window.uploadResume = function(file, onProgress){
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));
      const path = `resumes/Shubham_Sahu_CV.pdf`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(sRef, file);
      uploadTask.on('state_changed', (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(pct);
      }, (err) => reject(err), () => {
        getDownloadURL(uploadTask.snapshot.ref).then(url => resolve(url)).catch(reject);
      });
    });
  }

  window.getResumeURL = function(){
    const path = `resumes/Shubham_Sahu_CV.pdf`;
    const sRef = storageRef(storage, path);
    return getDownloadURL(sRef);
  }

  // Signup form (guarded)
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("signupEmail")?.value.trim() || "";
      const password = document.getElementById("signupPassword")?.value || "";
      const password2 = document.getElementById("signupPassword2")?.value || "";
      const msgId = "signupmessage";
      if (!email) return showMessage("Please enter your email", msgId);
      if (password.length < 6) return showMessage("Password should be at least 6 characters", msgId);
      if (password !== password2) return showMessage("Passwords do not match", msgId);

      createUserWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
          const user = userCredential.user;
          const docRef = doc(db, "users", user.uid);
          setDoc(docRef, { email })
            .then(() => {
              showMessage("Account successfully created", msgId);
              setTimeout(() => { window.location.href = "index.html"; }, 1200);
            })
            .catch(err => {
              console.error('DB setDoc error:', err);
              showMessage("Account creation failed (DB error)", msgId);
            });
        })
        .catch(err => {
          console.error('Signup error:', err.code, err.message);
          if (err.code === "auth/email-already-in-use") showMessage("Email already in use", msgId);
          else if (err.code === "auth/weak-password") showMessage("Password should be at least 6 characters", msgId);
          else if (err.code === "auth/invalid-email") showMessage("Invalid email address", msgId);
          else showMessage("Account creation failed", msgId);
        });
    });
  }

  // Login form (guarded)
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("loginEmail")?.value.trim() || "";
      const password = document.getElementById("loginPassword")?.value || "";
      const msgId = "signinmessage";
      if (!email) return showMessage("Please enter your email", msgId);
      if (!password) return showMessage("Please enter your password", msgId);

      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          showMessage("Login successful", msgId);
          setTimeout(() => { window.location.href = "homepage.html"; }, 1000);
        })
        .catch(err => {
          console.error('Login error:', err.code, err.message);
          if (err.code === "auth/invalid-email") showMessage("Invalid email address", msgId);
          else if (err.code === "auth/user-not-found") showMessage("No account found with this email", msgId);
          else if (err.code === "auth/wrong-password") showMessage("Incorrect password", msgId);
          else showMessage("Login failed", msgId);
        });
    });
  }

  // =========================
  // Forgot password (guarded)
  // =========================
  const forgotForm = document.getElementById("forgotForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("forgotEmail")?.value.trim() || "";
      const msgId = "forgotmessage";
      if (!email) return showMessage("Please enter your email", msgId);

      // Ensure this origin is added in Firebase Console -> Authentication -> Authorized domains
      const actionCodeSettings = {
        url: window.location.origin + "/index.html",
        handleCodeInApp: false
      };

      // Detect file:// origin which cannot receive password reset redirects
      if (window.location.protocol === 'file:') {
        console.warn('Running from file:// — password reset links require a valid origin (use a local server).');
        return showMessage('Cannot send reset link from file://. Start a local server (e.g. python -m http.server) and retry.', msgId);
      }

      sendPasswordResetEmail(auth, email, actionCodeSettings)
        .then(() => {
          console.log(`Password reset email requested for: ${email}`);
          showMessage("Password reset email sent! Check your inbox (or spam).", msgId);
        })
        .catch(err => {
          console.error('Password reset error:', err.code, err.message);
          if (err.code === "auth/invalid-email") {
            showMessage("Invalid email address", msgId);
          } else if (err.code === "auth/user-not-found") {
            showMessage("No account found with this email", msgId);
          } else if (err.code === "auth/unauthorized-domain") {
            console.error('Unauthorized domain. Add this origin to Firebase Console -> Authentication -> Authorized domains:', window.location.origin);
            showMessage("Redirect domain not authorized. Add this origin to Firebase Console -> Authentication -> Authorized domains", msgId);
          } else {
            showMessage("Error sending reset email. Try again later.", msgId);
          }
        });
    });
  }
});
// end of DOMContentLoaded
// (removed accidental code fence)
