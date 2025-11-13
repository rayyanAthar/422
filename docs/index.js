// index.js
document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const message = document.getElementById("message");

  async function sendRequest(endpoint) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    window.pubUsername = username;
    window.pubPassword = password;

    if (!username || !password) {
      message.textContent = "Please fill out all fields.";
      return;
    }

    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    message.textContent = data.message;

    if (data.success) {
      sessionStorage.setItem("user", username);
      window.location.href = "/app.html";
      sessionStorage.setItem("password", password);
      window.location.href = "/app.html";
    }
  }

  loginBtn.onclick = () => sendRequest("login");
  registerBtn.onclick = () => sendRequest("register");
});