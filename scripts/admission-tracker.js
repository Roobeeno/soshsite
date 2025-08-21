import { db } from "./firebase-init.js";
import {
    collection,
    doc,
    addDoc,
    onSnapshot,
    setDoc,
    getDocs,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Import the membersList from the separate bandsmen-list.js file
import { membersList } from "./bandsmen-list.js";

// Import the one-time social membership fees
import { socialMemberFees } from "./social-member-fees.js";


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
        sober: 0,
        non_sober: 0
    },
    social_guest: {
        sober: 2.5,
        non_sober: 5
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
    publishBtn.style.display = 'block';
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
    document.getElementById('new-social-member-btn').addEventListener('click', () => renderNameDropdown('potential_social'));
    document.getElementById('social-guest-btn').addEventListener('click', () => handleSocialGuest());
}

// Renders a name dropdown based on member type
function renderNameDropdown(memberType) {
    const listToRender = membersList.filter(member => {
        if (memberType === 'regular') {
            return !member.isSocialMember;
        } else if (memberType === 'social_member') {
            return member.isSocialMember;
        } else if (memberType === 'potential_social') {
            return !member.isSocialMember;
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
                isSober: selectedMember.isSober
            };
            
            if (memberType === 'potential_social') {
                renderNewSocialMemberFeeButtons();
            } else {
                renderSoberButtons();
            }
        }
    });
}

// Renders buttons for the one-time social member fee dynamically
function renderNewSocialMemberFeeButtons() {
    let buttonsHTML = `<p>Select One-Time Social Member Fee for ${currentEntry.name}:</p>`;
    
    for (const [feeName, amount] of Object.entries(socialMemberFees)) {
        buttonsHTML += `<button class="tracker-button" data-fee-name="${feeName}">$${amount} (${feeName})</button>`;
    }
    buttonsHTML += `<button id="back-btn" class="tracker-button">Back</button>`;
    
    buttonTreeContainer.innerHTML = buttonsHTML;

    document.getElementById('back-btn').addEventListener('click', () => renderNameDropdown('potential_social'));

    buttonTreeContainer.querySelectorAll('button[data-fee-name]').forEach(button => {
        button.addEventListener('click', (event) => {
            const feeName = event.target.dataset.fee_name;
            currentEntry.type = 'new_social';
            currentEntry.subType = feeName;
            currentEntry.amount = socialMemberFees[feeName];
            
            renderPaymentButtons();
        });
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

    document.getElementById('back-btn').addEventListener('click', () => {
        if (currentEntry.type === 'potential_social') {
             renderNewSocialMemberFeeButtons();
        } else {
            renderSoberButtons();
        }
    });
    
    buttonTreeContainer.querySelectorAll('button[data-payment]').forEach(button => {
        button.addEventListener('click', (event) => {
            currentEntry.payment = event.target.dataset.payment;
            handleFinalEntry();
        });
    });
}

function handleFinalEntry() {
    if (currentEntry.type !== 'new_social') {
        const feeType = currentEntry.isSober ? 'sober' : 'non_sober';
        currentEntry.amount = calculateFee(currentEntry.type, feeType);
        currentEntry.subType = feeType;
    }

    const memberIndex = membersList.findIndex(m => m.name.toLowerCase() === currentEntry.name.toLowerCase());
    
    if (currentEntry.type === 'new_social') {
        if (memberIndex !== -1) {
            membersList[memberIndex].isSocialMember = true;
        } else {
            membersList.push({
                name: currentEntry.name,
                section: 'N/A', 
                band_year: 'N/A',
                isSocialMember: true,
                isSober: true
            });
        }
    }
    
    attendeeEntries.push(currentEntry);

    const row = document.createElement('tr');
    let typeDisplay = currentEntry.type;
    
    // NEW: Clean up the display text for "New Social Member"
    if (currentEntry.type === 'regular' || currentEntry.type === 'social_guest') {
        typeDisplay = `${currentEntry.type} (${currentEntry.subType})`;
    } else if (currentEntry.type === 'social_member' || currentEntry.type === 'new_social') {
        typeDisplay = `Social Member`;
    }

    row.innerHTML = `
        <td>${typeDisplay}</td>
        <td>${currentEntry.name}</td>
        <td>${currentEntry.section || 'N/A'}</td>
        <td>${(currentEntry.isSober) ? '✅ Yes' : '❌ No'}</td>
        <td>${currentEntry.payment}</td>
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

    // NEW: Use parseFloat to ensure numbers are being summed
    const totalIncome = attendeeEntries.reduce((sum, entry) => {
        const amount = parseFloat(entry.amount);
        return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

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
    // NEW: Use parseFloat to ensure numbers are being summed
    const totalIncome = attendeeEntries.reduce((sum, entry) => {
        const amount = parseFloat(entry.amount);
        return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    attendeeCountDisplay.textContent = attendeeEntries.length;
    totalIncomeDisplay.textContent = totalIncome.toFixed(2);
}

// Function to load and display all past gatherings
async function loadPastGatherings() {
    pastGatheringsTableBody.innerHTML = '';
    const querySnapshot = await getDocs(gatheringsRef);
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement('tr');
        row.dataset.id = doc.id;
        row.classList.add('past-gathering-row');
        row.innerHTML = `
            <td>${data.name}</td>
            <td>${new Date(data.date).toLocaleDateString()}</td>
            <td>${data.attendees.length}</td>
            <td>$${data.totalIncome.toFixed(2)}</td>
        `;
        pastGatheringsTableBody.appendChild(row);
    });

    document.querySelectorAll('.past-gathering-row').forEach(row => {
        row.addEventListener('click', () => {
            const gatheringId = row.dataset.id;
            displayPastGathering(gatheringId);
        });
    });
}

// Function to display the details of a past gathering
async function displayPastGathering(gatheringId) {
    const gatheringDoc = await getDoc(doc(gatheringsRef, gatheringId));
    if (gatheringDoc.exists()) {
        const data = gatheringDoc.data();
        currentGatheringTitle.textContent = `${data.name} (Archived)`;
        currentAttendanceTbody.innerHTML = '';
        
        data.attendees.forEach(entry => {
            const row = document.createElement('tr');
            
            let typeDisplay = entry.type;
            if (entry.type === 'regular' || entry.type === 'social_guest') {
                typeDisplay = `${entry.type} (${entry.subType})`;
            } else if (entry.type === 'social_member' || entry.type === 'new_social') {
                typeDisplay = `Social Member`;
            }

            row.innerHTML = `
                <td>${typeDisplay}</td>
                <td>${entry.name}</td>
                <td>${entry.section || 'N/A'}</td>
                <td>${entry.isSober ? '✅ Yes' : '❌ No'}</td>
                <td>${entry.payment}</td>
            `;
            currentAttendanceTbody.appendChild(row);
        });

        updateSummaryDisplay(data.attendees.length, data.totalIncome);
        publishBtn.style.display = 'none';
        buttonTreeContainer.innerHTML = `<button id="back-to-gatherings-btn" class="tracker-button">Back to Gatherings</button>`;
        document.getElementById('back-to-gatherings-btn').addEventListener('click', () => {
            showView('past-gatherings-view');
            loadPastGatherings();
        });
        showView('attendance-input-view');
    }
}

// A helper function to update summary fields for past gatherings
function updateSummaryDisplay(count, income) {
    attendeeCountDisplay.textContent = count;
    totalIncomeDisplay.textContent = income.toFixed(2);
}

// --- Initial setup ---
showView('past-gatherings-view');
loadPastGatherings();