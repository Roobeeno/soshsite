// update-bandsmen-list.js

const fs = require('fs');
const path = require('path');

// Read the original membersList from the file
// This assumes your bandsmen-list.js file already has the "export const membersList = [ ... ];" format
// We'll extract just the array part to work with it.
const filePath = path.join(__dirname, 'bandsmen-list.js');
const fileContent = fs.readFileSync(filePath, 'utf-8');

// A simple way to extract the array content. Be careful with manual edits.
const listStartIndex = fileContent.indexOf('[');
const listEndIndex = fileContent.lastIndexOf(']');
const listString = fileContent.substring(listStartIndex, listEndIndex + 1);

// Parse the string into a JavaScript array
const membersList = eval(listString); 

// The core logic: add the new attributes to each member
const updatedList = membersList.map(member => ({
    ...member, // This copies all existing attributes
    isSocialMember: false,
    isSober: true
}));

// Format the updated list back into the correct file content format
const newFileContent = `export const membersList = ${JSON.stringify(updatedList, null, 2)};\n`;

// Overwrite the original file with the new content
fs.writeFileSync(filePath, newFileContent, 'utf-8');

console.log('Successfully updated bandsmen-list.js with isSocialMember and isSober attributes!');