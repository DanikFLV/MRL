const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyRtHrvRaWqI5HwE33LuiHkdmsouPXEXCsvdoq0Jw_Lpr12GF3sfmza242Bg2snQN4/exec';

const MECHANICS = {
    "2030": "Salvador Flores",
    "1500": "Ivand Adorno",
    "4040": "Dmitrii Kushnirenko",
    "7777": "Oleksii Kononenko",
    "5555": "Dominic Prichard",
    "6666": "Marice Caunty",
    "1010": "Cordero Clarke",
    // IMPORTANT: Add/Update your mechanics directly here as "PIN": "Full Name",
    // You will need to re-copy this file to tablets if you change this list.
};

const MECHANIC_SESSION_KEY = "mechanicLoggedIn";
const MECHANIC_NAME_SESSION_KEY = "mechanicNameSession";


document.addEventListener('DOMContentLoaded', function() {
    const machineNumSelect = document.getElementById('machineNum');
    const issueSelect = document.getElementById('issue');
    const repairForm = document.getElementById('repairForm');
    const messageDiv = document.getElementById('message');
    const mechanicNameInput = document.getElementById('mechanicName');
    const mechanicNotesInput = document.getElementById('mechanicNotes');
    const statusSelect = document.getElementById('status'); // NEW: Get reference to status dropdown

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


    // --- PIN LOGIC START ---
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
        greetingText.textContent = `Hello ${name}!`;
        greetingOverlay.style.display = 'flex';
        setTimeout(() => {
            greetingOverlay.style.display = 'none';
        }, 2000);
    }

    function checkPin() {
        const enteredPin = pinInput.value;
        const mechanicName = MECHANICS[enteredPin];

        if (mechanicName) {
            sessionStorage.setItem(MECHANIC_SESSION_KEY, "true");
            sessionStorage.setItem(MECHANIC_NAME_SESSION_KEY, mechanicName);
            hidePinScreen(mechanicName);
            showGreeting(mechanicName);

        } else {
            sessionStorage.removeItem(MECHANIC_SESSION_KEY);
            sessionStorage.removeItem(MECHANIC_NAME_SESSION_KEY);
            showPinScreen('Incorrect PIN. Please try again.');
        }
    }
    
    const isMechanicLoggedIn = sessionStorage.getItem(MECHANIC_SESSION_KEY);
    const rememberedMechanicName = sessionStorage.getItem(MECHANIC_NAME_SESSION_KEY);

    if (isMechanicLoggedIn === "true" && rememberedMechanicName) {
        hidePinScreen(rememberedMechanicName);
        showGreeting(rememberedMechanicName);
    } else {
        showPinScreen();
    }

    pinSubmitButton.addEventListener('click', checkPin);
    pinInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            checkPin();
        }
    });
    // --- PIN LOGIC END ---


    // 1. Populate Machine # dropdown (1 to 70) - UNCHANGED
    for (let i = 1; i <= 70; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Machine ${i}`;
        machineNumSelect.appendChild(option);
    }

    // 2. Populate Issue dropdown (placeholder issues for now)
            const issues = [
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
]

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
    document.getElementById('date').value = `${year}-${month}-${day}`;

    // Set current time as default for time field
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    document.getElementById('timeStartedMachine').value = `${hours}:${minutes}`;


    // Function to display messages - UNCHANGED
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // Function to show confirmation overlay - UNCHANGED
    function showConfirmationOverlay(message = "Thank you for your submission!") {
        confirmationMessage.textContent = message;
        confirmationOverlay.style.display = 'flex';
        setTimeout(() => {
            confirmationOverlay.style.display = 'none';
            showPinScreen();
        }, 3000);
    }

    // Handle Form Submission - MODIFIED to include status
    repairForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        showMessage('Submitting data...', 'info');

        const formData = {
            shift: document.getElementById('shift').value,
            date: document.getElementById('date').value,
            machineNum: document.getElementById('machineNum').value,
            issue: document.getElementById('issue').value,
            description: document.getElementById('description').value,
            actionTaken: document.getElementById('actionTaken').value,
            status: statusSelect.value, // NEW: Add status to formData
            mechanicNotes: mechanicNotesInput.value,
            mechanicName: mechanicNameInput.value,
            timeStartedMachine: document.getElementById('timeStartedMachine').value
        };

        try {
            const response = await fetch(GOOGLE_SHEET_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            showConfirmationOverlay(); 
            
            repairForm.reset();
            document.getElementById('date').value = `${year}-${month}-${day}`;
            document.getElementById('timeStartedMachine').value = `${hours}:${minutes}`;

        } catch (error) {
            console.error('Error submitting form:', error);
            showMessage('Failed to submit repair log. Please try again.', 'error');
            setTimeout(() => {
                showMessage('', '');
                showPinScreen();
            }, 5000);
        }
    });
});
