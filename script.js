// REMOVED: GOOGLE_SHEET_WEB_APP_URL - We're no longer directly using Apps Script for submission
// REMOVED: MECHANICS - This is now hardcoded in the HTML as per your previous preference
const MECHANIC_SESSION_KEY = "mechanicLoggedIn";
const MECHANIC_NAME_SESSION_KEY = "mechanicNameSession";







document.addEventListener('DOMContentLoaded', function() {
    const machineNumSelect = document.getElementById('machineNum');
    const issueSelect = document.getElementById('issue');
    const repairForm = document.getElementById('repairForm');
    const messageDiv = document.getElementById('message');
    const mechanicNameInput = document.getElementById('mechanicName');
    const mechanicNotesInput = document.getElementById('mechanicNotes');
    const statusSelect = document.getElementById('status');
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


    // --- PIN LOGIC START --- (No changes here, it uses the global MECHANICS object)
    function showPinScreen(message = '', headerText = 'Enter PIN') {
        pinMessage.textContent = message;
        pinMessage.style.display = message ? 'block' : 'none';
        pinHeaderText.textContent = headerText;
        pinOverlay.style.display = 'flex';
        pinInput.value = '';
        pinInput.focus();
        sessionStorage.removeItem(MECHANIC_SESSION_KEY);
        sessionStorage.removeItem(MECHANIC_NAME_SESSION_KEY);
        mechanicNameInput.value = '';
        mechanicNameInput.readOnly = false;
    }

    function hidePinScreen(mechanicName) {
        pinOverlay.style.display = 'none';
        if (mechanicName) {
            mechanicNameInput.value = mechanicName;
            mechanicNameInput.readOnly = true;
        }
    }

    function showGreeting(name) {
        greetingText.textContent = `Welcome ${name}!`;
        greetingOverlay.style.display = 'flex';
        setTimeout(() => {
            greetingOverlay.style.display = 'none';
            // Show warning message after greeting
            showMessage('REMINDER: Don\'t forget to log out when you finish your shift!', 'warning');
        }, 1500);
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
                "Other...", "New Work Order (NWO)", "New Raw Material (NRM)", "New Work Order New Material (NWNM)",
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

    // Set current date as default for date field
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateInput = document.getElementById('date');
    dateInput.value = `${year}-${month}-${day}`;
    dateInput.readOnly = true; // Prevent user from changing the date

    // Set current time as default for time field
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    // return back if need change time - document.getElementById('timeStartedMachine').value = `${hours}:${minutes}`;

    // this need to coment or delete for changin time
    const timeInput = document.getElementById('timeStartedMachine');
    timeInput.value = `${hours}:${minutes}`;
    timeInput.readOnly = true; // Prevent user from changing the time

    // Function to display messages - UNCHANGED
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // Function to show confirmation overlay - MODIFIED TO NOT AUTO-LOGOUT
    function showConfirmationOverlay(message = "REPAIR LOG SUBMITTED SUCCESSFULLY!") {
        confirmationMessage.textContent = message;
        confirmationOverlay.style.display = 'flex';
        setTimeout(() => {
            confirmationOverlay.style.display = 'none';
            // Show reminder message instead of logging out
            showMessage('You are still logged in. Don\'t forget to log out after you finish your shift!', 'info');
        }, 2500);
    }
    

    // Handle Form Submission - MODIFIED TO USE FIRESTORE
    repairForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        showMessage('Submitting data...', 'info');

        const formData = {
            //shift: document.getElementById('shift').value,
            date: document.getElementById('date').value,
            machineNum: document.getElementById('machineNum').value,
            issue: document.getElementById('issue').value,
            description: document.getElementById('description').value,
            actionTaken: document.getElementById('actionTaken').value,
            status: statusSelect.value,
            mechanicNotes: mechanicNotesInput.value,
            mechanicName: mechanicNameInput.value,
            timeStartedMachine: document.getElementById('timeStartedMachine').value,
            timestamp: new Date().toISOString() // NEW: Add a server-side timestamp (for sorting/ordering)
        };

        try {
            // Check if Firebase db is available from window object (initialized in index.html)
            if (!window.db || !window.collection || !window.addDoc) {
                throw new Error("Firebase SDK not initialized correctly or db not exposed.");
            }

            // ADD DATA TO FIRESTORE
            await window.addDoc(window.collection(window.db, "repair_logs"), formData); // "repair_logs" is your collection name

            showMessage('Repair log submitted successfully!', 'success');
            
            repairForm.reset();
            document.getElementById('date').value = `${year}-${month}-${day}`;
            document.getElementById('timeStartedMachine').value = `${hours}:${minutes}`;

            showConfirmationOverlay(); 
            
        } catch (error) {
            console.error('Error submitting form to Firestore:', error);
            showMessage('Failed to submit repair log. Please try again. (Check console for details)', 'error');
            // Remove auto-logout on error, just show error message
            setTimeout(() => {
                showMessage('', '');
            }, 5000);
        }
    });

     // NEW: Logout Button Event Listener - Moved inside DOMContentLoaded
    if (logoutButton) { // Ensure button exists before adding listener
        logoutButton.addEventListener('click', function() {
            // Clear the form fields upon logout
            repairForm.reset();
            document.getElementById('date').value = `${year}-${month}-${day}`; // Reset date
            document.getElementById('timeStartedMachine').value = `${hours}:${minutes}`; // Reset time

            // Show the PIN screen, which also clears mechanic name input and sessionStorage
            showPinScreen();
            // Optionally show a "Logged out" message briefly
            showMessage('Successfully logged out.', 'success');
            setTimeout(() => messageDiv.style.display = 'none', 2000); // Hide after 2 seconds
        });
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