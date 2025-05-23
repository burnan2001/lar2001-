// Authentication Logic

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('email-signup-form')) { // Check for signup specific element
        initSignupPage();
    } else if (document.getElementById('email-login-form')) { // Check for login specific element
        initLoginPage();
    } else if (document.getElementById('forgot-password-form')) { // Check for forgot password specific element
        initForgotPasswordPage();
    }
    // Add init for other pages later
});

// --- Initialize Forgot Password Page elements ---
function initForgotPasswordPage() {
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const messageContainer = document.getElementById('message-container'); // Ensure this ID matches your HTML

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!messageContainer) {
                console.error("Message container not found on forgot password page.");
                return;
            }
            messageContainer.textContent = ''; // Clear previous messages
            messageContainer.className = 'message-container'; // Reset class name

            const email = document.getElementById('reset-email').value;
            if (!email) {
                messageContainer.textContent = "Please enter your email address.";
                messageContainer.classList.add('error-message');
                return;
            }

            try {
                await auth.sendPasswordResetEmail(email);
                messageContainer.textContent = "Password reset email sent successfully! Please check your inbox (and spam folder).";
                messageContainer.classList.add('success-message');
                forgotPasswordForm.reset(); // Clear the form
            } catch (error) {
                console.error("Forgot Password Error:", error);
                messageContainer.textContent = `Error sending password reset email: ${error.message}`;
                messageContainer.classList.add('error-message');
            }
        });
    }
}

function initSignupPage() {
    const emailSignupForm = document.getElementById('email-signup-form');
    const phoneSignupForm = document.getElementById('phone-signup-form');
    const googleSigninBtn = document.getElementById('google-signin-btn');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const otpSection = document.getElementById('otp-section');
    const errorMessageContainer = document.getElementById('error-message-container');

    // --- Helper to display errors ---
    function displayError(message) {
        if (errorMessageContainer) {
            errorMessageContainer.textContent = message;
        }
        console.error("Signup Error:", message);
    }

    function clearError() {
        if (errorMessageContainer) {
            errorMessageContainer.textContent = '';
        }
    }
    
    // --- Helper to get selected role ---
    function getSelectedRole() {
        const buyerRadio = document.getElementById('role-buyer');
        if (buyerRadio && buyerRadio.checked) {
            return 'buyer';
        }
        const vendorRadio = document.getElementById('role-vendor');
        if (vendorRadio && vendorRadio.checked) {
            return 'vendor';
        }
        return null; // Should not happen if one is checked by default
    }

    // --- Store User Data in Firestore ---
    async function storeUserData(user, role, additionalData = {}) {
        if (!user || !user.uid || !role) {
            displayError("User data or role is missing.");
            return;
        }
        try {
            const userRef = db.collection('users').doc(user.uid);
            const userData = {
                uid: user.uid,
                email: user.email || null,
                phoneNumber: user.phoneNumber || null,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isVerifiedVendor: false, // Default for all, relevant for vendors
                ...additionalData
            };
            await userRef.set(userData);
            console.log("User data stored in Firestore.");
            // Redirect based on role
            handleRedirect(role, false); // false for isVerifiedVendor initially
        } catch (error) {
            displayError(`Error storing user data: ${error.message}`);
            // Consider cleanup if user was created in Auth but not Firestore
        }
    }
    
    // --- Handle Post-Authentication Redirection ---
    function handleRedirect(role, isVerifiedVendor) {
        if (role === 'buyer') {
            window.location.href = 'buyer-home.html';
        } else if (role === 'vendor') {
            if (isVerifiedVendor) {
                window.location.href = 'vendor-dashboard.html';
            } else {
                window.location.href = 'vendor-verification.html';
            }
        } else {
            // Fallback or error
            window.location.href = 'index.html'; 
        }
    }

    // --- 1. Email/Password Signup ---
    if (emailSignupForm) {
        emailSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            const role = getSelectedRole();

            if (!role) {
                displayError("Please select a role (Buyer/Vendor).");
                return;
            }
            if (password !== confirmPassword) {
                displayError("Passwords do not match.");
                return;
            }

            // Password strength validation
            const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?]).{8,}$/;
            if (!passRegex.test(password)) {
                displayError("Password is too weak. Must be at least 8 characters and include uppercase, lowercase, number, and special character.");
                // More detailed error messages could be provided here based on what's missing,
                // but for now, a general message is fine.
                return;
            }
            
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                console.log("Email/Pass user signed up:", userCredential.user);
                await storeUserData(userCredential.user, role);
            } catch (error) {
                displayError(`Email signup failed: ${error.message}`);
            }
        });
    }

    // --- 2. Phone Number (OTP) Signup ---
    // Setup reCAPTCHA verifier
    window.recaptchaVerifier = null;
    function setupRecaptcha() {
        if (!window.recaptchaVerifier) {
             window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('send-otp-btn', { // Can also be an invisible div
                'size': 'invisible', // or 'normal'
                'callback': (response) => {
                    // reCAPTCHA solved, allow sendOtpBtn to proceed.
                    console.log("reCAPTCHA solved");
                },
                'expired-callback': () => {
                    // Response expired. Ask user to solve reCAPTCHA again.
                    displayError("reCAPTCHA verification expired. Please try again.");
                    if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => window.recaptchaVerifier.reset(widgetId));
                }
            });
            window.recaptchaVerifier.render().catch(err => displayError("reCAPTCHA render error: " + err.message)); // Render it
        }
    }
    
    // Call on page load if phone form exists
    if (phoneSignupForm) {
       setTimeout(setupRecaptcha, 1000); // Delay slightly to ensure button is in DOM and Firebase loaded
    }


    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            clearError();
            const phoneNumberInput = document.getElementById('phone-number');
            let phoneNumber = phoneNumberInput.value.trim();
            const role = getSelectedRole();

            if (!role) {
                displayError("Please select a role (Buyer/Vendor) before sending OTP.");
                return;
            }
            
            // Basic validation for Nigerian numbers (can be improved)
            if (!phoneNumber.startsWith('+234') && /^[0-9]{10}$/.test(phoneNumber)) { // e.g. 08012345678
                phoneNumber = '+234' + phoneNumber.substring(1);
            } else if (!/^\+234[7-9][01]\d{8}$/.test(phoneNumber)) { //e.g. +2348012345678
                 displayError("Invalid Nigerian phone number format. Expected: +234XXXXXXXXXX or 0XXXXXXXXXX.");
                 return;
            }
            
            console.log(`Sending OTP to: ${phoneNumber}`);

            try {
                // Ensure reCAPTCHA is reset if previously used
                if (window.recaptchaVerifier) {
                    // No explicit reset needed before signInWithPhoneNumber unless it failed multiple times
                } else {
                     setupRecaptcha(); // Setup if not already
                }

                const appVerifier = window.recaptchaVerifier;
                const confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, appVerifier);
                window.confirmationResult = confirmationResult; // Store for OTP verification
                
                if (otpSection) otpSection.style.display = 'block';
                phoneNumberInput.disabled = true; // Disable phone input after sending OTP
                sendOtpBtn.disabled = true; // Disable send OTP button
                displayError(''); // Clear previous errors
                alert("OTP sent successfully to " + phoneNumber + "! Please check your messages."); // Replace with better UI notification

            } catch (error) {
                displayError(`OTP send failed: ${error.message}. Make sure reCAPTCHA is working.`);
                // Reset reCAPTCHA if it exists, so user can try again
                if (window.recaptchaVerifier && typeof grecaptcha !== 'undefined' && window.recaptchaWidgetId) { // Check if grecaptcha and widgetId are available
                    grecaptcha.reset(window.recaptchaWidgetId); 
                } else {
                    // For invisible, it might reset itself or you might need to re-render
                    // If setupRecaptcha creates a new verifier each time, this might be okay.
                    // However, it's better to manage the existing verifier instance if possible.
                    // The current setupRecaptcha checks if window.recaptchaVerifier exists, so it won't create duplicates.
                    // If re-rendering is needed, ensure the old one is cleared or handled.
                    console.warn("Consider explicit reCAPTCHA reset logic for visible reCAPTCHA or complex failure cases.");
                    // Attempt to re-render if it failed badly.
                    if (window.recaptchaVerifier) {
                        window.recaptchaVerifier.render().catch(err => displayError("reCAPTCHA re-render error: " + err.message));
                    } else {
                         setupRecaptcha(); // If it was never set up or got nulled.
                    }
                }
            }
        });
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            clearError();
            const otpCode = document.getElementById('otp-code').value;
            const role = getSelectedRole(); // Role should still be selected

            if (!otpCode || otpCode.length !== 6) {
                displayError("Please enter a valid 6-digit OTP.");
                return;
            }
            if (!window.confirmationResult) {
                displayError("OTP not sent or session expired. Please try sending OTP again.");
                return;
            }
            if (!role) { // Should not happen if UI is designed well
                 displayError("Role not selected. Please refresh and try again.");
                 return;
            }

            try {
                const credential = await window.confirmationResult.confirm(otpCode);
                const user = credential.user;
                console.log("Phone user signed up/verified:", user);
                // User is signed in. Store data.
                // For phone auth, email might be null. You might need another step to collect email if required.
                await storeUserData(user, role, { phoneNumber: user.phoneNumber });
            } catch (error) {
                displayError(`OTP verification failed: ${error.message}`);
            }
        });
    }

    // --- 3. Google Sign-In ---
    if (googleSigninBtn) {
        googleSigninBtn.addEventListener('click', async () => {
            clearError();
            const role = getSelectedRole();
            if (!role) {
                displayError("Please select a role (Buyer/Vendor) before signing in with Google.");
                return;
            }

            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                console.log("Google user signed in:", user);
                // Check if user is new or returning for Google Sign-In
                // Firestore `set` with merge might be good, or check existence first
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().role && userDoc.data().role !== role) {
                    // User exists with a different role. This is a conflict.
                    // For now, we prevent this. Or decide on a strategy (e.g., first role wins, or ask user).
                    displayError(`You previously signed up as a ${userDoc.data().role}. You cannot switch roles.`);
                    await auth.signOut(); // Sign out the user
                    return;
                }
                
                await storeUserData(user, role, {
                    displayName: user.displayName || "",
                    photoURL: user.photoURL || ""
                });

            } catch (error) {
                displayError(`Google Sign-In failed: ${error.message}`);
                if (error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup, not really an "error" to display harshly
                    console.log("Google Sign-In popup closed by user.");
                    clearError();
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    displayError("An account already exists with this email address using a different sign-in method.");
                }
            }
        });
    }
}

// Make sure firebase-config.js is loaded before this script.
// The auth, db, storage variables are expected to be globally available from firebase-config.js

// Add a new function to initialize login page elements
function initLoginPage() {
    const emailLoginForm = document.getElementById('email-login-form');
    const phoneLoginForm = document.getElementById('phone-login-form'); // Assuming this ID for the form
    const googleLoginBtn = document.getElementById('login-google-signin-btn');
    const loginSendOtpBtn = document.getElementById('login-send-otp-btn');
    const loginVerifyOtpBtn = document.getElementById('login-verify-otp-btn');
    const loginOtpSection = document.getElementById('login-otp-section');
    const loginErrorMessageContainer = document.getElementById('login-error-message-container');

    // --- Helper to display errors on login page ---
    function displayLoginError(message) {
        if (loginErrorMessageContainer) {
            loginErrorMessageContainer.textContent = message;
        }
        console.error("Login Error:", message);
    }

    function clearLoginError() {
        if (loginErrorMessageContainer) {
            loginErrorMessageContainer.textContent = '';
        }
    }

    // --- Fetch User Data and Redirect ---
    async function fetchUserDataAndRedirect(user) {
        if (!user || !user.uid) {
            displayLoginError("User not found after login.");
            return;
        }
        try {
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (doc.exists) {
                const userData = doc.data();
                console.log("User data fetched from Firestore:", userData);
                handleRedirect(userData.role, userData.isVerifiedVendor);
            } else {
                // This case should ideally not happen if signup always creates a user doc.
                // If it does, it might mean an auth record exists without a user profile.
                displayLoginError("User profile not found. Please contact support or try signing up again.");
                // Optionally, sign out the user
                // await auth.signOut(); 
            }
        } catch (error) {
            displayLoginError(`Error fetching user data: ${error.message}`);
        }
    }

    // --- 1. Email/Password Login ---
    if (emailLoginForm) {
        emailLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearLoginError();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                displayLoginError("Please enter both email and password.");
                return;
            }

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                console.log("Email/Pass user logged in:", userCredential.user);
                await fetchUserDataAndRedirect(userCredential.user);
            } catch (error) {
                displayLoginError(`Email login failed: ${error.message}`);
            }
        });
    }

    // --- 2. Phone Number (OTP) Login ---
    // Re-use window.recaptchaVerifier and setupRecaptcha from signup if on the same page load context
    // or re-initialize if they are separate pages causing full script reloads.
    // For simplicity, assuming setupRecaptcha is available globally from earlier script execution.
    // If login page has its own 'send OTP' button, it needs its own reCAPTCHA instance or to share one.
    // Let's assume `login-send-otp-btn` is the ID for the button on the login page.
    
    function setupLoginRecaptcha() { // Renamed to avoid conflict if both forms on one page (not current case)
        // If #login-send-otp-btn exists, set up reCAPTCHA for it
        if (document.getElementById('login-send-otp-btn')) {
            window.loginRecaptchaVerifier = new firebase.auth.RecaptchaVerifier('login-send-otp-btn', {
                'size': 'invisible',
                'callback': (response) => { console.log("Login reCAPTCHA solved"); },
                'expired-callback': () => { displayLoginError("reCAPTCHA verification expired."); }
            });
            window.loginRecaptchaVerifier.render().catch(err => displayLoginError("Login reCAPTCHA render error: " + err.message));
        }
    }
    if (document.getElementById('login-send-otp-btn')) {
       setTimeout(setupLoginRecaptcha, 1000); // Delay slightly
    }


    if (loginSendOtpBtn) {
        loginSendOtpBtn.addEventListener('click', async () => {
            clearLoginError();
            const phoneNumberInput = document.getElementById('login-phone-number');
            let phoneNumber = phoneNumberInput.value.trim();
            
            if (!phoneNumber.startsWith('+234') && /^[0-9]{10}$/.test(phoneNumber)) {
                phoneNumber = '+234' + phoneNumber.substring(1);
            } else if (!/^\+234[7-9][01]\d{8}$/.test(phoneNumber)) {
                 displayLoginError("Invalid Nigerian phone number format.");
                 return;
            }
            console.log(`Sending login OTP to: ${phoneNumber}`);

            try {
                if (!window.loginRecaptchaVerifier) {
                    setupLoginRecaptcha(); // Setup if not already
                }
                const appVerifier = window.loginRecaptchaVerifier;
                const confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, appVerifier);
                window.loginConfirmationResult = confirmationResult; // Store for OTP verification
                
                if (loginOtpSection) loginOtpSection.style.display = 'block';
                phoneNumberInput.disabled = true;
                loginSendOtpBtn.disabled = true;
                alert("Login OTP sent to " + phoneNumber); // Replace with better UI
            } catch (error) {
                displayLoginError(`Login OTP send failed: ${error.message}`);
                if (window.loginRecaptchaVerifier) {
                    // Consider how to reset reCAPTCHA for login form
                    // grecaptcha.reset(window.loginRecaptchaWidgetId);
                }
            }
        });
    }

    if (loginVerifyOtpBtn) {
        loginVerifyOtpBtn.addEventListener('click', async () => {
            clearLoginError();
            const otpCode = document.getElementById('login-otp-code').value;

            if (!otpCode || otpCode.length !== 6) {
                displayLoginError("Please enter a valid 6-digit OTP.");
                return;
            }
            if (!window.loginConfirmationResult) {
                displayLoginError("OTP not sent or session expired for login. Please try sending OTP again.");
                return;
            }

            try {
                const credential = await window.loginConfirmationResult.confirm(otpCode);
                const user = credential.user;
                console.log("Phone user logged in:", user);
                await fetchUserDataAndRedirect(user);
            } catch (error) {
                displayLoginError(`Login OTP verification failed: ${error.message}`);
            }
        });
    }

    // --- 3. Google Sign-In for Login ---
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            clearLoginError();
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                console.log("Google user logged in:", user);
                // With Google Sign-In, if the user exists, they are logged in.
                // If they don't exist in Auth, signInWithPopup can create them if "Create user after first sign in" is enabled in Firebase console for Google.
                // We must ensure a corresponding Firestore document exists or handle appropriately.
                
                const userRef = db.collection('users').doc(user.uid);
                const doc = await userRef.get();

                if (doc.exists) {
                    await fetchUserDataAndRedirect(user); // User exists, proceed to redirect
                } else {
                    // User authenticated with Google, but no profile in Firestore.
                    // This could happen if they signed up with Google but Firestore write failed,
                    // or if they are a new user via Google login on this page.
                    // The requirement "Prevent users from switching roles after account creation" is key.
                    // If they are truly new, we might need a role selection step here, which complicates login.
                    // For now, let's assume login means the user profile *should* exist.
                    // If not, it's an anomaly. We could sign them out and ask them to sign up.
                    displayLoginError("Your account profile is not fully set up. Please try signing up first or contact support.");
                    await auth.signOut(); 
                }

            } catch (error) {
                displayLoginError(`Google Sign-In failed: ${error.message}`);
                 if (error.code === 'auth/popup-closed-by-user') {
                    console.log("Google Sign-In popup closed by user.");
                    clearLoginError();
                }
            }
        });
    }
}
