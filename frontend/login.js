
function togglePassword(id) {
  const input = document.getElementById(id);
  const btn = input.nextElementSibling;
  if (input.type === "password") {
    input.type = "text";
    btn.innerText = "Hide";
  } else {
    input.type = "password";
    btn.innerText = "Show";
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");
  const loader = document.getElementById("loadingMsg");

  msg.innerText = "";
  loader.style.display = "block";

  try {
    const res = await fetch(`${config.API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    loader.style.display = "none";

    if (res.ok && data.token) {
      // ✅ Token validation
      try {
        const parts = data.token.split(".");
        if (parts.length !== 3) throw new Error("Invalid token format");
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.exp) throw new Error("Token missing expiration");

        localStorage.setItem("token", data.token);
        localStorage.setItem("email", data.email);
      } catch (err) {
        msg.innerText = "Login failed: Invalid token.";
        return;
      }

      msg.classList.add("ty-success");
      msg.innerText = "Login successful!";

      // ✅ Redirect smartly based on progress
      try {
        const progressRes = await fetch(`${config.API_BASE_URL}/api/user/progress`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.token}`
          }
        });

        const progress = await progressRes.json();

        if (!progressRes.ok) {
          msg.innerText = "Login failed: Could not fetch progress.";
          return;
        }

        const step = progress.current_step || "identity";
        const status = progress.status || "pending";

        if (status === "approved") {
          window.location.href = "dashboard_page.html";
        } else if (status === "disapproved") {
          window.location.href = "submission.html";
        } else {
          if (step === "identity") window.location.href = "identity-verification.html";
          else if (step === "personal") window.location.href = "personal.html";
          else if (step === "preferences") window.location.href = "preferences.html";
          else if (step === "submission") window.location.href = "submission.html";
          else window.location.href = "identity-verification.html";
        }
      } catch (err) {
        console.error("Progress fetch error:", err.message);
        msg.innerText = "Login succeeded, but failed to determine next step.";
      }

    } else {
      msg.classList.remove("ty-success");
      msg.innerText = data.error || "Login failed.";
    }
  } catch (err) {
    loader.style.display = "none";
    msg.innerText = "❌ Network error. Check your connection.";
  }
});

document.getElementById("forgotPasswordLink").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!email) {
    msg.innerText = "Please enter your email first.";
    return;
  }

  msg.innerText = "Checking account...";

  try {
    const res = await fetch(`${config.API_BASE_URL}/api/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (res.ok) {
      sessionStorage.setItem("resetEmail", email);
      window.location.href = "forgot-otp.html";
    } else {
      msg.innerText = data.error || "Account not found.";
    }
  } catch (err) {
    msg.innerText = "❌ Network error. Try again.";
  }
});
