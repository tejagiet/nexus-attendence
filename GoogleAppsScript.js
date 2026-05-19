/**
 * Google Apps Script for Photo Upload to Google Drive
 * 
 * 1. Go to script.google.com and create a new project.
 * 2. Paste this code.
 * 3. Click Deploy > New Deployment. 
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL and add it to your .env file as VITE_GOOGLE_SCRIPT_URL.
 */

function getOrCreateAttendanceFolder() {
  const folderName = "attendence";
  const folders = DriveApp.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { base64Data, filename, mimeType } = data;
    
    const cleanBase64 = base64Data.split(',')[1] || base64Data;
    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, mimeType, filename);
    
    const folder = getOrCreateAttendanceFolder();
    const file = folder.createFile(blob);
    
    // Set file so anyone can view it using the link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      url: file.getUrl(), // Default URL
      downloadUrl: file.getDownloadUrl(), // Download URL
      id: file.getId(),
      folderName: folder.getName()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const folder = getOrCreateAttendanceFolder();
    const filesIterator = folder.getFiles();
    const filesList = [];

    while (filesIterator.hasNext()) {
      const file = filesIterator.next();
      // Only return files that look like images based on mimeType
      if (file.getMimeType().indexOf('image') !== -1) {
        filesList.push({
          id: file.getId(),
          name: file.getName(),
          url: file.getUrl(),
          thumbnail: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w400",
          dateCreated: file.getDateCreated()
        });
      }
    }
    
    // Sort by date created descending
    filesList.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: filesList
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS preflight requests
function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
