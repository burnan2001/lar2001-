// Vendor Specific Logic
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('vendor-doc-upload-form')) {
        initVendorVerificationPage();
    }
});

function initVendorVerificationPage() {
    const uploadForm = document.getElementById('vendor-doc-upload-form');
    const ninFileInp = document.getElementById('doc-nin');
    const idFileInp = document.getElementById('doc-id');
    const utilityFileInp = document.getElementById('doc-utility');
    const messageContainer = document.getElementById('message-container'); // General messages
    const uploadSection = document.getElementById('upload-section');
    const pendingApprovalSection = document.getElementById('pending-approval-section');
    const checkStatusBtn = document.getElementById('check-status-btn');

    // Progress steps
    const stepUploadDocs = document.getElementById('step-upload-docs');
    const stepApproval = document.getElementById('step-approval');

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

    // --- Helper to display messages ---
    function displayMessage(text, type = 'error') {
        if (messageContainer) {
            messageContainer.textContent = text;
            messageContainer.className = 'message-container ' + (type === 'error' ? 'error-message' : 'status-message'); // Use status-message for success
        }
        console.log(`Vendor Verification Message (${type}):`, text);
    }

    // --- UI Update Functions ---
    function showUploadForm() {
        if (uploadSection) uploadSection.style.display = 'block';
        if (pendingApprovalSection) pendingApprovalSection.style.display = 'none';
        if (checkStatusBtn) checkStatusBtn.style.display = 'block'; // Show button to re-check
        if (stepUploadDocs) stepUploadDocs.classList.add('active');
        if (stepApproval) stepApproval.classList.remove('active', 'completed');
    }

    function showPendingApprovalUI(statusText = "Verification Pending") {
        if (uploadSection) uploadSection.style.display = 'none';
        if (pendingApprovalSection) {
            pendingApprovalSection.style.display = 'block';
            const statusElement = pendingApprovalSection.querySelector('.status-message');
            if (statusElement) statusElement.textContent = `Current Status: ${statusText}`;
        }
        if (checkStatusBtn) checkStatusBtn.style.display = 'block';
        if (stepUploadDocs) {
            stepUploadDocs.classList.remove('active');
            stepUploadDocs.classList.add('completed');
        }
        if (stepApproval) stepApproval.classList.add('active');
    }
    
    function showFullyVerifiedUI() {
        // This might redirect or show a different message if they land here once verified
        if (uploadSection) uploadSection.style.display = 'none';
        if (pendingApprovalSection) pendingApprovalSection.style.display = 'none';
        if (checkStatusBtn) checkStatusBtn.style.display = 'none';
        
        if (messageContainer) {
            messageContainer.textContent = "Your account is fully verified! Redirecting to dashboard...";
            messageContainer.className = 'message-container status-message';
        }
        // Update progress steps
        if (stepUploadDocs) stepUploadDocs.classList.add('completed');
        if (stepApproval) stepApproval.classList.add('completed');

        setTimeout(() => {
            window.location.href = 'vendor-dashboard.html';
        }, 3000);
    }


    // --- File Upload Logic ---
    async function uploadFile(userUid, file, documentType) {
        if (!file) throw new Error(`No file selected for ${documentType}`);
        if (file.size > MAX_FILE_SIZE) throw new Error(`${documentType} file size exceeds 5MB.`);
        if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`${documentType} file type not allowed. Use JPG, PNG, or PDF.`);

        const filePath = `vendor_verification_documents/${userUid}/${documentType}_${Date.now()}_${file.name}`;
        const fileRef = storage.ref().child(filePath);
        displayMessage(`Uploading ${documentType}...`, 'status');
        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        displayMessage(`${documentType} uploaded successfully.`, 'status');
        return { path: filePath, url: downloadURL };
    }

    // --- Form Submission Handler ---
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            displayMessage('Processing document upload...', 'status');

            const user = auth.currentUser;
            if (!user) {
                displayMessage('User not authenticated. Please login again.');
                // Potentially redirect to login: window.location.href = 'login.html';
                return;
            }

            const ninFile = ninFileInp.files[0];
            const idFile = idFileInp.files[0];
            const utilityFile = utilityFileInp.files[0];

            if (!ninFile || !idFile || !utilityFile) {
                displayMessage('Please select all three required documents.');
                return;
            }

            try {
                const ninUpload = await uploadFile(user.uid, ninFile, 'NIN');
                const idUpload = await uploadFile(user.uid, idFile, 'ID_Card');
                const utilityUpload = await uploadFile(user.uid, utilityFile, 'Utility_Bill');

                const userDocRef = db.collection('users').doc(user.uid);
                await userDocRef.update({
                    verificationStatus: 'pending_approval', // Or "documents_submitted"
                    uploadedDocuments: {
                        nin: { path: ninUpload.path, url: ninUpload.url, uploadedAt: firebase.firestore.FieldValue.serverTimestamp() },
                        idCard: { path: idUpload.path, url: idUpload.url, uploadedAt: firebase.firestore.FieldValue.serverTimestamp() },
                        utilityBill: { path: utilityUpload.path, url: utilityUpload.url, uploadedAt: firebase.firestore.FieldValue.serverTimestamp() }
                    },
                    documentsSubmittedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                displayMessage('All documents uploaded and records updated successfully!', 'status');
                showPendingApprovalUI("Verification Pending");

            } catch (error) {
                displayMessage(`Upload failed: ${error.message}`);
                console.error("Upload error details:", error);
            }
        });
    }

    // --- Check Current User's Verification Status on Page Load ---
    async function checkVerificationStatus() {
        const user = auth.currentUser;
        if (!user) {
            displayMessage('User not authenticated. Please login.');
            // Consider redirecting to login if no user, though they shouldn't reach this page without auth.
            // window.location.href = 'login.html'; 
            return;
        }

        try {
            const userDocRef = db.collection('users').doc(user.uid);
            const doc = await userDocRef.get();

            if (doc.exists) {
                const userData = doc.data();
                if (userData.role !== 'vendor') {
                     displayMessage('This page is for vendors only.', 'error');
                     // Redirect non-vendors away
                     setTimeout(() => window.location.href = 'index.html', 3000);
                     return;
                }
                
                // Update UI based on status
                if (userData.isVerifiedVendor === true) {
                    displayMessage('Your account is already verified.', 'status');
                    showFullyVerifiedUI();
                } else if (userData.verificationStatus === 'pending_approval' || (userData.uploadedDocuments && Object.keys(userData.uploadedDocuments).length > 0) ) {
                    displayMessage('Your documents are currently under review.', 'status');
                    showPendingApprovalUI(userData.verificationStatus === 'pending_approval' ? "Verification Pending" : "Documents Submitted");
                } else if (userData.verificationStatus === 'rejected') {
                    displayMessage(`Your previous submission was rejected. Reason: ${userData.rejectionReason || 'Not specified'}. Please re-upload.`, 'error');
                    showUploadForm(); // Allow re-upload
                }
                else {
                    // Default: show upload form
                    displayMessage('Please upload your verification documents.', 'status');
                    showUploadForm();
                }
            } else {
                displayMessage('User profile not found. Please contact support.');
                // This is an error state, user auth record exists but no Firestore doc
            }
        } catch (error) {
            displayMessage(`Error fetching verification status: ${error.message}`);
        }
    }
    
    // Listener for the check status button
    if(checkStatusBtn) {
        checkStatusBtn.addEventListener('click', () => {
            displayMessage('Checking status...', 'status');
            checkVerificationStatus();
        });
    }

    // Initial check when page loads
    auth.onAuthStateChanged(user => {
        if (user) {
            checkVerificationStatus();
        } else {
            // Not logged in, redirect to login.
            // This page should not be accessible without being logged in.
            displayMessage('You must be logged in to view this page.', 'error');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        }
    });
}

// Assumes firebase-config.js (for auth, db, storage) is loaded before this script.
