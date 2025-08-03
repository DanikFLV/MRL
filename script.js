// REMOVED: GOOGLE_SHEET_WEB_APP_URL - We're no longer directly using Apps Script for submission
// REMOVED: MECHANICS - This is now hardcoded in the HTML as per your previous preference
const MECHANIC_SESSION_KEY = "mechanicLoggedIn";
const MECHANIC_NAME_SESSION_KEY = "mechanicNameSession";
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
const REMINDER_INTERVAL = 10 * 60 * 1000; // Show reminder every 10 minutes

let inactivityTimer = null;
let reminderTimer = null;
let timeUpdateInterval = null;







document.addEventListener('DOMContentLoaded', function() {
    const machineNumSelect = document.getElementById('machineNum');
    const issueSelect = document.getElementById('issue');
    const repairForm = document.getElementById('repairForm');
    const messageDiv = document.getElementById('message');
    const logoutButton = document.getElementById('logoutButton');

    // PIN Elements
    const pinOverlay = document.getElementById('pin-overlay');
    const pinInput = document.getElementById('pin-input');
    const pinSubmitButton = document.getElementById('pin-submit');
    const pinMessage = document.getElementById('pin-message');
    const pinHeaderText = document.getElementById('pin-header-text');

    // Greeting Overlay Elements
    const greetingOverlay = document.getElementById('greeting-overlay');
    const greetingText = document.getElementById('greeting-text');

    // Confirmation Overlay Elements
    const confirmationOverlay = document.getElementById('confirmation-overlay');
    const confirmationMessage = document.getElementById('confirmation-message');

    // New info display elements
    const currentDateElement = document.getElementById('current-date');
    const currentTimeElement = document.getElementById('current-time');
    const currentMechanicElement = document.getElementById('current-mechanic');
    const sessionReminder = document.getElementById('session-reminder');


    // --- PIN LOGIC START --- (No changes here, it uses the global MECHANICS object)
    function showPinScreen(message = '', headerText = 'Enter PIN') {
        pinMessage.textContent = message;
        pinMessage.style.display = message ? 'block' : 'none';
        pinHeaderText.textContent = headerText;
        pinOverlay.style.display = 'flex';
        pinInput.value = '';
        pinInput.focus();
        
        // Clear session data
        sessionStorage.removeItem(MECHANIC_SESSION_KEY);
        sessionStorage.removeItem(MECHANIC_NAME_SESSION_KEY);
        
        // Clear all timers and stop time updates
        clearAllTimers();
        stopTimeUpdates();
        
        // Clear mechanic display
        if (currentMechanicElement) currentMechanicElement.textContent = '';
        
        // Hide session reminder
        if (sessionReminder) sessionReminder.style.display = 'none';
    }

    function hidePinScreen(mechanicName) {
        pinOverlay.style.display = 'none';
        if (mechanicName) {
            // Update mechanic display
            if (currentMechanicElement) currentMechanicElement.textContent = mechanicName;
            
            // Start time updates and session management
            startTimeUpdates();
            setupActivityListeners();
            resetInactivityTimer();
            
            console.log('Session started for:', mechanicName);
        }
    }

    function showGreeting(name) {
        greetingText.textContent = `Welcome ${name}!`;
        greetingOverlay.style.display = 'flex';
        setTimeout(() => {
            greetingOverlay.style.display = 'none';
        }, 1500);
    }

    // Function to update date and time display
    function updateDateTime() {
        const now = new Date();
        
        // Format date as MM/DD/YYYY (matching your example: 08/03/2025)
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${month}/${day}/${year}`;
        
        // Format time as HH:MM:SS (matching your example: 08:33:26)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}:${seconds}`;
        
        if (currentDateElement) currentDateElement.textContent = dateStr;
        if (currentTimeElement) currentTimeElement.textContent = timeStr;
    }

    // Function to start time updates
    function startTimeUpdates() {
        updateDateTime(); // Update immediately
        timeUpdateInterval = setInterval(updateDateTime, 1000); // Update every second
    }

    // Function to stop time updates
    function stopTimeUpdates() {
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = null;
        }
    }

    // Function to show session reminder
    function showSessionReminder() {
        if (sessionReminder) {
            sessionReminder.style.display = 'block';
            setTimeout(() => {
                if (sessionReminder) {
                    sessionReminder.style.display = 'none';
                }
            }, 5000); // Hide after 5 seconds
        }
    }

    // Function to reset inactivity timer
    function resetInactivityTimer() {
        // Clear existing timers
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (reminderTimer) clearTimeout(reminderTimer);

        // Set new inactivity timer (1 hour)
        inactivityTimer = setTimeout(() => {
            console.log('Session timeout - logging out');
            logout();
        }, SESSION_TIMEOUT);

        // Set reminder timer (show reminder every 10 minutes)
        reminderTimer = setTimeout(function showReminderAndSetNext() {
            showSessionReminder();
            reminderTimer = setTimeout(showReminderAndSetNext, REMINDER_INTERVAL);
        }, REMINDER_INTERVAL);
        
        console.log('Inactivity timer reset - session extended');
    }

    // Function to clear all timers
    function clearAllTimers() {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        if (reminderTimer) {
            clearTimeout(reminderTimer);
            reminderTimer = null;
        }
    }

    // Function to handle logout
    function logout() {
        clearAllTimers();
        stopTimeUpdates();
        
        // Clear the form fields upon logout
        repairForm.reset();
        
        // Clear mechanic display
        if (currentMechanicElement) currentMechanicElement.textContent = '';
        
        // Hide session reminder
        if (sessionReminder) sessionReminder.style.display = 'none';

        // Show the PIN screen, which also clears sessionStorage
        showPinScreen();
        
        // Optionally show a "Logged out" message briefly
        showMessage('Successfully logged out.', 'success');
        setTimeout(() => messageDiv.style.display = 'none', 2000);
    }

    // Function to setup activity listeners
    function setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        // Remove any existing listeners first
        events.forEach(event => {
            document.removeEventListener(event, resetInactivityTimer, true);
        });
        
        // Add new listeners
        events.forEach(event => {
            document.addEventListener(event, resetInactivityTimer, true);
        });
    }

    
    const isMechanicLoggedIn = sessionStorage.getItem(MECHANIC_SESSION_KEY);
    const rememberedMechanicName = sessionStorage.getItem(MECHANIC_NAME_SESSION_KEY);

    if (isMechanicLoggedIn === "true" && rememberedMechanicName) {
        hidePinScreen(rememberedMechanicName);
        showGreeting(rememberedMechanicName);
    } else {
        showPinScreen();
    }
    async function checkPin() {
        const enteredPin = pinInput.value.trim();
    
    if(!enteredPin) {
        showPinScreen('Please enter a PIN.');
        return;
    }
    
    try {
        const docRef = window.doc(window.db, "pins", enteredPin);
        const docSnap = await window.getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const mechanicName = data.name;
            
            sessionStorage.setItem(MECHANIC_SESSION_KEY, "true");
            sessionStorage.setItem(MECHANIC_NAME_SESSION_KEY, mechanicName);
            hidePinScreen(mechanicName);
            showGreeting(mechanicName);
        } else {
            showPinScreen('Invalid Pin. Try Again.');
        }
    } catch (error) {
        console.error("Error checking PIN:", error);
        showPinScreen('Something went wrong. Try again.');
    }
}
    pinSubmitButton.addEventListener('click', checkPin);
    pinInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            checkPin();
        }
    });
    // --- PIN LOGIC END ---


    // 1. Populate Machine # dropdown (1 to 70) - UNCHANGED
    for (let i = 1; i <= 74; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Machine ${i}`;
        machineNumSelect.appendChild(option);
    }

    // 2. Populate Issue dropdown (placeholder issues for now)
            const issues = [
                "Other...",
                "Thickness (TSS)", "Strand Width (STD)", "Bond (BND)",
                "Thickness, Strand (TNS)", "Thickness, Strand, Bond (BST)", "Edges (EDG)", "Width Varying (WIV)",
                "Breaking Strand (BKS)", "Thick and Thin (TNT)", "Zero Max (ZEM)", "Main Flattener Roll Grinding (MFR)",
                "Replace Backup Roll (BUR)", "Cam Issue (CAM)", "Cam Folower (CFL)",
                "Clearance (CLR)", "Connectin Rod Bearing (CRB)", "Index Timing (EIT)",
                "Electrical Issue (ELE)", "Feed Roll Bearing (FEB)", "Belt Broken/Slipping",
                "Lubrication Issue", "Feed Roll Tension (FRT)", "Head (HED)",
                "Motor Issue Expander (MTE)", "Motor Issue Flattener (MTF)", "Motor Issue Rewinder (MTR)",
                "New Setup Dies (NSU)", "Replace Bevel and Pinion Gears (PNB)", "Pin/Sleeves/Ball Cages (PSB)",
                "Index Spring Tension (SPG)", "Stripper Plate (STP)", "Feed Timing (TIM)", 
                "Bearing Failure", "Unexpected Stop"

    ];

    issues.forEach((issue, index) => {
        const option = document.createElement('option');
        option.value = issue;
        option.textContent = issue;
        issueSelect.appendChild(option);
    });

    // Function to display messages - UNCHANGED
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // Function to show confirmation overlay - UPDATED to not logout after submission
    function showConfirmationOverlay(message = "Thank you for your submission!") {
        confirmationMessage.textContent = message;
        confirmationOverlay.style.display = 'flex';
        setTimeout(() => {
            confirmationOverlay.style.display = 'none';
            // Reset inactivity timer instead of logging out
            resetInactivityTimer();
        }, 3000);
    }
    

    // Handle Form Submission - MODIFIED TO USE FIRESTORE AND CURRENT DATA
    repairForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        showMessage('Submitting data...', 'info');

        // Get current date and time for submission
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        // Format date for database as YYYY-MM-DD
        const currentDate = `${year}-${month}-${day}`;
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hours}:${minutes}`;
        
        const mechanicName = sessionStorage.getItem(MECHANIC_NAME_SESSION_KEY);

        const formData = {
            date: currentDate,
            machineNum: document.getElementById('machineNum').value,
            issue: document.getElementById('issue').value,
            description: document.getElementById('description').value,
            actionTaken: document.getElementById('actionTaken').value,
            status: document.getElementById('status').value,
            mechanicNotes: document.getElementById('mechanicNotes').value,
            mechanicName: mechanicName,
            timeStartedMachine: currentTime,
            timestamp: new Date().toISOString() // Server-side timestamp for sorting
        };

        try {
            // Check if Firebase db is available from window object (initialized in index.html)
            if (!window.db || !window.collection || !window.addDoc) {
                throw new Error("Firebase SDK not initialized correctly or db not exposed.");
            }

            // ADD DATA TO FIRESTORE
            await window.addDoc(window.collection(window.db, "repair_logs"), formData); // "repair_logs" is your collection name

            showMessage('Repair log submitted successfully!', 'success');
            
            // Reset form but keep session active
            repairForm.reset();

            showConfirmationOverlay(); 
            
        } catch (error) {
            console.error('Error submitting form to Firestore:', error);
            showMessage('Failed to submit repair log. Please try again. (Check console for details)', 'error');
            // Don't logout on error, just reset the timer
            resetInactivityTimer();
        }
    });

     // NEW: Logout Button Event Listener
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // Dark Mode Toggle
    const darkToggleBtn = document.getElementById('darkModeToggle');
    if (darkToggleBtn) {
        darkToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const icon = darkToggleBtn.querySelector('i');
            if (document.body.classList.contains('dark-mode')) {
                icon.className = 'fas fa-sun';
                darkToggleBtn.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                darkToggleBtn.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
            }
        });
    }
});