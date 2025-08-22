import { db } from "../../firebase-init.js";
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { membersList } from "./bandsmen-list.js";

async function uploadBandsmenToFirestore() {
    console.log("Starting bandsmen list upload...");
    const bandsmenRef = collection(db, "bandsmen");

    for (const member of membersList) {
        try {
            const docId = member.name.replace(/\s/g, '_').replace(/"/g, '').replace(/\./g, '');
            await setDoc(doc(bandsmenRef, docId), {
                ...member
            });
            console.log(`Successfully uploaded: ${member.name}`);
        } catch (e) {
            console.error(`Error uploading ${member.name}: `, e);
        }
    }
    console.log("All bandsmen have been uploaded!");
}
// Automatically run the function when the script loads
uploadBandsmenToFirestore();