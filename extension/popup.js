document.getElementById('batch-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.innerText = "Sending to NextGenDM...";
  statusEl.style.color = "#38bdf8";

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error("No active tab found");
    }
    const currentUrl = tabs[0].url;

    const response = await fetch("http://localhost:14200/intercept-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: currentUrl })
    });

    if (response.ok) {
      statusEl.innerText = "Sent! Check NextGenDM window.";
      statusEl.style.color = "#4ade80";
      setTimeout(() => window.close(), 2000);
    } else {
      throw new Error("Failed to send");
    }
  } catch (error) {
    statusEl.innerText = "Error: Is NextGenDM running?";
    statusEl.style.color = "#f87171";
  }
});
