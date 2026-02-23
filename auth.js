// Generate simulated JWT-like token
function generateToken() {
    return "JWT_" + Math.random().toString(36).substring(2) + "_" + Date.now();
}

// Handle Login
function loginUser(username, password) {
    if (username === "student" && password === "1234") {
        const token = generateToken();
        localStorage.setItem("authToken", token);
        window.location.href = "dashboard.html";
    } else {
        alert("Invalid credentials");
    }
}

// Protect Dashboard
function protectPage() {
    const token = localStorage.getItem("authToken");
    if (!token) {
        window.location.href = "login.html";
    } else {
        const tokenElement = document.getElementById("sessionToken");
        if (tokenElement) {
            tokenElement.innerText = token;
        }
    }
}

// Logout
function logout() {
    localStorage.removeItem("authToken");
    window.location.href = "login.html";
}