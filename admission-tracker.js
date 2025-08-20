import { db } from "./firebase-init.js";
import {
    collection,
    doc,
    addDoc,
    onSnapshot,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// NEW: Import the membersList from the separate bandsmen-list.js file
import { membersList } from "./bandsmen-list.js";

// --- DOM elements ---
const pastGatheringsView = document.getElementById('past-gatherings-view');
const attendanceInputView = document.getElementById('attendance-input-view');
const newGatheringBtn = document.getElementById('new-gathering-btn');
const publishBtn = document.getElementById('publish-btn');
const buttonTreeContainer = document.getElementById('button-tree-container');
const pastGatheringsTableBody = document.getElementById('past-gatherings-table').querySelector('tbody');
const currentAttendanceTbody = document.getElementById('current-attendance-tbody');
const currentGatheringTitle = document.getElementById('current-gathering-title');
const attendeeCountDisplay = document.getElementById('attendee-count');
const totalIncomeDisplay = document.getElementById('total-income');
const currentEntryDisplay = document.getElementById('current-entry-display');

// --- State Variables ---
let currentEntry = {};
let currentGatheringId = '';
let currentGatheringName = '';
let attendeeEntries = [];
const gatheringsRef = collection(db, "gatherings");
const transactionsRef = collection(db, "transactions");

const fees = {
    regular: {
        sober: 5,
        non_sober: 10
    },
    social_member: {
        sober: 5,
        non_sober: 10
    },
    social_guest: {
        sober: 10,
        non_sober: 15
    }
};

// --- View and Button Handlers ---
function showView(viewId) {
    pastGatheringsView.style.display = 'none';
    attendanceInputView.style.display = 'none';
    document.getElementById(viewId).style.display = 'block';
}

newGatheringBtn.addEventListener('click', () => {
    const gatheringName = prompt("Enter the name for the new gathering:");
    if (gatheringName) {
        currentGatheringName = gatheringName;
        currentGatheringId = doc(gatheringsRef).id;
        currentGatheringTitle.textContent = currentGatheringName;
        resetAttendanceInput();
        showView('attendance-input-view');
    }
});

publishBtn.addEventListener('click', publishGathering);

function resetAttendanceInput() {
    currentEntry = {};
    attendeeEntries = [];
    renderInitialButtons();
    currentAttendanceTbody.innerHTML = '';
    updateSummary();
}

function renderInitialButtons() {
    let buttonsHTML = `
        <button id="regular-attendee-btn" class="tracker-button" data-type="regular">Regular Attendee</button>
        <button id="social-member-btn" class="tracker-button" data-type="social_member">Social Member</button>
        <button id="new-social-member-btn" class="tracker-button" data-type="new_social">New Social Member</button>
        <button id="social-guest-btn" class="tracker-button" data-type="social_guest">Social Guest</button>
    `;
    buttonTreeContainer.innerHTML = buttonsHTML;

    document.getElementById('regular-attendee-btn').addEventListener('click', () => renderNameDropdown('regular'));
    document.getElementById('social-member-btn').addEventListener('click', () => renderNameDropdown('social_member'));
    document.getElementById('new-social-member-btn').addEventListener('click', () => handleNewSocialMember());
    document.getElementById('social-guest-btn').addEventListener('click', () => handleSocialGuest());
}

function handleNewSocialMember() {
    const newName = prompt("Enter the name of the new social member:");
    if (newName) {
        // Find existing member, or create a new entry
        const existingMember = membersList.find(m => m.name.toLowerCase() === newName.toLowerCase());
        
        currentEntry = {
            type: 'social_member',
            name: newName,
            section: existingMember ? existingMember.section : 'N/A',
            band_year: existingMember ? existingMember.band_year : 'N/A'
        };

        // NOTE: This change is not permanent and will be lost on page refresh.
        // A more permanent solution would involve saving the change to a database like Firestore.
        if (existingMember) {
            existingMember.isSocialMember = true;
        } else {
            membersList.push({
                name: newName,
                section: 'N/A',
                band_year: 'N/A',
                isSocialMember: true,
                isSober: true
            });
        }
        
        renderSoberButtons();
    }
}

function handleSocialGuest() {
    currentEntry = {
        type: 'social_guest',
        name: 'Social Guest',
        section: 'N/A',
        band_year: 'N/A'
    };
    renderSoberButtons();
}

function renderNameDropdown(memberType) {
    const listToRender = membersList.filter(member => {
        if (memberType === 'regular') {
            return !member.isSocialMember;
        } else if (memberType === 'social_member') {
            return member.isSocialMember;
        }
    });

    const options = listToRender.map(member => `<option value="${member.name}">${member.name} (${member.section})</option>`).join('');
    
    buttonTreeContainer.innerHTML = `
        <select id="name-dropdown" class="name-dropdown">
            <option value="">Select a name...</option>
            ${options}
        </select>
        <button id="back-to-main-btn" class="tracker-button">Back</button>
    `;

    document.getElementById('back-to-main-btn').addEventListener('click', renderInitialButtons);
    
    document.getElementById('name-dropdown').addEventListener('change', (event) => {
        const selectedMember = listToRender.find(m => m.name === event.target.value);
        if (selectedMember) {
            currentEntry = {
                type: memberType,
                name: selectedMember.name,
                section: selectedMember.section,
                band_year: selectedMember.band_year,
                isSober: selectedMember.isSober // Grab existing sober status
            };
            renderSoberButtons();
        }
    });
}

function renderSoberButtons() {
    buttonTreeContainer.innerHTML = `
        <p>Selected: ${currentEntry.name}</p>
        <button class="tracker-button" data-sober="true">Sober</button>
        <button class="tracker-button" data-sober="false">Non-Sober</button>
        <button id="back-btn" class="tracker-button">Back</button>
    `;

    document.getElementById('back-btn').addEventListener('click', renderInitialButtons);

    buttonTreeContainer.querySelectorAll('button[data-sober]').forEach(button => {
        button.addEventListener('click', (event) => {
            currentEntry.isSober = event.target.dataset.sober === 'true';
            renderPaymentButtons();
        });
    });
}

function renderPaymentButtons() {
    buttonTreeContainer.innerHTML = `
        <p>Payment for: ${currentEntry.name}</p>
        <div class="payment-buttons">
            <button class="tracker-button" data-payment="cash">Cash</button>
            <button class="tracker-button" data-payment="venmo">Venmo</button>
        </div>
        <button id="back-btn" class="tracker-button">Back</button>
    `;

    document.getElementById('back-btn').addEventListener('click', renderSoberButtons);
    
    buttonTreeContainer.querySelectorAll('button[data-payment]').forEach(button => {
        button.addEventListener('click', (event) => {
            currentEntry.payment = event.target.dataset.payment;
            handleFinalEntry();
        });
    });
}

function handleFinalEntry() {
    const feeType = currentEntry.isSober ? 'sober' : 'non-sober';
    currentEntry.amount = calculateFee(currentEntry.type, feeType);
    currentEntry.subType = feeType;

    attendeeEntries.push(currentEntry);

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${currentEntry.type} (${currentEntry.subType})</td>
        <td>${currentEntry.name}</td>
        <td>${currentEntry.section}</td>
        <td>${(currentEntry.isSober) ? '✅ Yes' : '❌ No'}</td>
        <td>${currentEntry.payment === 'cash' ? '✅ Yes' : '❌ No'}</td>
    `;
    currentAttendanceTbody.appendChild(row);

    currentEntry = {};
    renderInitialButtons();
    updateSummary();
}

function calculateFee(memberType, feeType) {
    return fees[memberType][feeType];
}

async function publishGathering() {
    console.log("Attempting to publish gathering...");
    if (attendeeEntries.length === 0) {
        alert("Cannot publish an empty gathering.");
        return;
    }

    const totalIncome = attendeeEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const gatheringData = {
        name: currentGatheringName,
        date: new Date().toISOString(),
        attendees: attendeeEntries,
        totalIncome: totalIncome
    };
    await setDoc(doc(gatheringsRef, currentGatheringId), gatheringData);

    const transactionData = {
        event: currentGatheringName,
        date: new Date().toLocaleDateString('en-US'),
        amount: totalIncome,
        category: "GatheringIncome",
        description: `Income from ${currentGatheringName} attendance`
    };
    await addDoc(transactionsRef, transactionData);

    console.log("Gathering published successfully!");
    alert("Gathering published successfully!");
    showView('past-gatherings-view');
    loadPastGatherings();

    attendeeEntries = [];
}

function updateSummary() {
    const totalIncome = attendeeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    attendeeCountDisplay.textContent = attendeeEntries.length;
    totalIncomeDisplay.textContent = totalIncome.toFixed(2);
}

// ... (loadPastGatherings and other functions are assumed to be in the original code) ...

// --- Initial setup ---
showView('past-gatherings-view');
loadPastGatherings();