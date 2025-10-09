import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : null;
const initialAuthToken =
  typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

// Firebase Instances
let app;
let db;
let auth;
let currentOrgId = null;
let orgName = "N/A";

// Utility Functions
const getOrgDocRef = (orgId) =>
  doc(db, "artifacts", appId, "public", "data", "organizations", orgId);
const getOpportunitiesCollectionRef = () =>
  collection(db, "artifacts", appId, "public", "data", "opportunities");

/**
 * Converts a date string/timestamp to a readable format.
 * @param {string | object} dateInput - The date string or Firestore Timestamp object.
 * @returns {string} Formatted date string.
 */
const formatDate = (dateInput) => {
  if (!dateInput) return "N/A";
  let date;
  // Handle Firebase Timestamp object (if retrieved directly)
  if (dateInput.toDate) {
    date = dateInput.toDate();
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date)) return "Invalid Date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Safely fetches and parses JSON data, retrying on failure.
 * Using exponential backoff for retries.
 * @param {() => Promise<any>} apiCall - The API call to execute.
 * @param {number} maxRetries - Maximum number of retries.
 * @returns {Promise<any>} The result of the successful API call.
 */
async function withExponentialBackoff(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// --- AUTHENTICATION & INITIALIZATION ---

async function initializeFirebase() {
  if (!firebaseConfig) {
    console.error("Firebase config is missing.");
    document.getElementById("status-message").textContent =
      "ERROR: Firebase Configuration Missing.";
    return false;
  }

  // setLogLevel('debug'); // Uncomment for debugging

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // 1. Sign In
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentOrgId = user.uid;
        document.getElementById("data-org-id").textContent = currentOrgId;
        console.log("Authenticated with UID:", currentOrgId);
        resolve(true);
      } else {
        // Attempt to sign in with custom token or anonymously
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
            currentOrgId = auth.currentUser.uid;
            console.log("Signed in anonymously with UID:", currentOrgId);
          }
          // Re-run onAuthStateChanged listener to catch the user object
        } catch (error) {
          console.error("Authentication failed:", error);
          document.getElementById("status-message").textContent =
            "Authentication Failed. Check Console.";
          // Fallback to a random ID for unauthenticated simulation if needed, but best to stop here.
          currentOrgId = crypto.randomUUID();
          document.getElementById("data-org-id").textContent =
            currentOrgId + " (Unauthenticated)";
          resolve(false);
        }
      }
    });
  });
}

// --- DATA LOADING ---

/**
 * Loads the organization's profile from Firestore.
 */
async function loadOrganizationProfile() {
  if (!db || !currentOrgId) return;

  const orgDocRef = getOrgDocRef(currentOrgId);
  document.getElementById("welcome-message").textContent = "Loading profile...";

  try {
    const docSnap = await withExponentialBackoff(() => getDoc(orgDocRef));

    if (docSnap.exists()) {
      const data = docSnap.data();
      orgName = data.name || "HopeDeeds Partner Organization";

      document.getElementById("data-org-name").textContent = orgName;
      document.getElementById("data-email").textContent = data.email || "N/A";
      document.getElementById("data-phone").textContent = data.phone || "N/A";
      document.getElementById("data-address").textContent =
        data.address || "N/A";
      document.getElementById(
        "welcome-message"
      ).textContent = `Welcome Back, ${orgName}!`;
      document.getElementById("status-message").textContent =
        "Profile loaded successfully.";
    } else {
      // Initialize a mock/default profile if one doesn't exist
      console.log(
        "No organization profile found. Initializing a default profile."
      );
      orgName = "New Organization " + currentOrgId.substring(0, 4);
      const defaultProfile = {
        name: orgName,
        email: "contact@example.org",
        phone: "555-1234",
        address: "123 Main St, Anytown",
        createdAt: serverTimestamp(),
      };
      await withExponentialBackoff(() => setDoc(orgDocRef, defaultProfile));
      // Recursive call to display the newly created profile
      loadOrganizationProfile();
    }
  } catch (error) {
    console.error("Error loading organization profile:", error);
    document.getElementById("status-message").textContent =
      "ERROR loading profile.";
    document.getElementById("welcome-message").textContent =
      "Error Loading Dashboard";
  }
}

/**
 * Sets up a real-time listener for the organization's opportunities.
 */
function loadOpportunities() {
  if (!db || !currentOrgId) return;

  const opportunitiesListEl = document.getElementById("org-opportunities-list");
  const noOpportunitiesEl = document.getElementById("no-opportunities");
  const totalOpportunitiesEl = document.getElementById("data-opportunities");

  // Query for opportunities created by this organization
  const opportunitiesQuery = query(
    getOpportunitiesCollectionRef(),
    where("orgId", "==", currentOrgId)
  );

  onSnapshot(
    opportunitiesQuery,
    (snapshot) => {
      opportunitiesListEl.innerHTML = ""; // Clear existing list
      let opportunityCount = 0;

      if (snapshot.empty) {
        noOpportunitiesEl.style.display = "block";
        opportunitiesListEl.style.display = "none";
      } else {
        noOpportunitiesEl.style.display = "none";
        opportunitiesListEl.style.display = "block";

        snapshot.forEach((doc) => {
          const data = doc.data();
          const opportunityId = doc.id;
          opportunityCount++;

          const listItem = document.createElement("li");
          const dateAndTime = `${formatDate(data.date)} (${data.time})`;

          listItem.innerHTML = `
                    <span>
                        ${data.title} - ${dateAndTime} (${data.duration} hrs)
                    </span>
                    <div>
                        <button class="btn btn-secondary text-sm px-3 py-1 mr-2" data-id="${opportunityId}" data-action="view">
                            <i class="fas fa-users"></i> Volunteers
                        </button>
                        <button class="btn btn-secondary text-sm px-3 py-1" data-id="${opportunityId}" data-action="delete" style="background-color: #f87171; color: white;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
          opportunitiesListEl.appendChild(listItem);
        });
      }
      totalOpportunitiesEl.textContent = opportunityCount;
      opportunitiesListEl.addEventListener("click", handleOpportunityAction);
    },
    (error) => {
      console.error("Error fetching opportunities:", error);
      opportunitiesListEl.innerHTML = `<li>Error loading opportunities: ${error.message}</li>`;
    }
  );
}

// --- DATA MANIPULATION ---

/**
 * Handles the form submission to add a new opportunity.
 * @param {Event} e - The form submit event.
 */
async function handleAddOpportunity(e) {
  e.preventDefault();

  if (!db || !currentOrgId || orgName === "N/A") {
    document.getElementById("status-message").textContent =
      "System not ready. Please wait for profile to load.";
    return;
  }

  const title = document.getElementById("opportunity-title").value;
  const date = document.getElementById("opportunity-date").value;
  const time = document.getElementById("opportunity-time").value;
  const duration = parseFloat(
    document.getElementById("opportunity-duration").value
  );
  const description = document.getElementById("opportunity-description").value;

  // Simple validation
  if (!title || !date || !time || !description || isNaN(duration)) {
    document.getElementById("status-message").textContent =
      "Please fill all fields correctly.";
    return;
  }

  const submitBtnText = document.getElementById("form-submit-text");
  const submitBtnSpinner = document.getElementById("form-spinner");

  submitBtnText.style.display = "none";
  submitBtnSpinner.style.display = "inline-block";

  const newOpportunity = {
    orgId: currentOrgId,
    orgName: orgName,
    title: title,
    date: date, // Storing as string (YYYY-MM-DD) for simplicity
    time: time, // Storing as string (HH:MM)
    duration: duration,
    description: description,
    volunteers: 0, // Counter for volunteers who sign up
    createdAt: serverTimestamp(),
  };

  try {
    await withExponentialBackoff(() =>
      addDoc(getOpportunitiesCollectionRef(), newOpportunity)
    );
    document.getElementById(
      "status-message"
    ).textContent = `Opportunity "${title}" posted successfully!`;
    document.getElementById("new-opportunity-form").reset();
  } catch (error) {
    console.error("Error posting opportunity:", error);
    document.getElementById("status-message").textContent =
      "ERROR: Failed to post opportunity.";
  } finally {
    submitBtnText.style.display = "inline-block";
    submitBtnSpinner.style.display = "none";
  }
}

/**
 * Handles clicks on the View Volunteers and Delete buttons in the list.
 * @param {Event} e - The click event.
 */
async function handleOpportunityAction(e) {
  const button = e.target.closest("button");
  if (!button) return;

  const opportunityId = button.dataset.id;
  const action = button.dataset.action;

  if (action === "delete") {
    // IMPORTANT: Using custom modal/confirmation in a real app, but using window.confirm for simplicity here based on previous code.
    const customConfirm = (message) => {
      const result = window.confirm(message);
      return result;
    };

    if (
      !customConfirm(
        "Are you sure you want to delete this opportunity? This cannot be undone."
      )
    ) {
      return;
    }

    const docRef = doc(getOpportunitiesCollectionRef(), opportunityId);
    try {
      await withExponentialBackoff(() => deleteDoc(docRef));
      document.getElementById(
        "status-message"
      ).textContent = `Opportunity ID ${opportunityId.substring(
        0,
        8
      )}... deleted.`;
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      document.getElementById("status-message").textContent =
        "ERROR: Failed to delete opportunity.";
    }
  } else if (action === "view") {
    // In a real app, this would navigate to a detailed volunteer list page.
    document.getElementById(
      "status-message"
    ).textContent = `Viewing volunteer list for Opportunity ID ${opportunityId.substring(
      0,
      8
    )}... (Feature not fully implemented)`;
  }
}

// --- MAIN APPLICATION SETUP ---

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("status-message").textContent =
    "Initializing Firebase and authenticating...";

  const isAuthenticated = await initializeFirebase();

  if (isAuthenticated) {
    await loadOrganizationProfile();
    loadOpportunities();

    // Set up event listeners only after auth/db is ready
    document
      .getElementById("new-opportunity-form")
      .addEventListener("submit", handleAddOpportunity);

    // Note: The 'View Volunteers' and 'Delete' listeners are attached inside loadOpportunities (onSnapshot callback)
  } else {
    document.getElementById("welcome-message").textContent =
      "Authentication Required";
    document.getElementById("status-message").textContent =
      "Please check your connection or log in.";
  }
});
