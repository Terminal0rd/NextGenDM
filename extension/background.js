chrome.downloads.onCreated.addListener((downloadItem) => {
  // Only intercept normal HTTP/HTTPS downloads
  if (downloadItem.url.startsWith("http://") || downloadItem.url.startsWith("https://")) {
    
    // Attempt to cancel the browser's built-in download immediately
    chrome.downloads.cancel(downloadItem.id, () => {
      
      // POST the URL and Filename to the NextGenDM local server
      fetch("http://localhost:14200/intercept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: downloadItem.url,
          filename: downloadItem.filename ? downloadItem.filename.split(/[\\/]/).pop() : undefined
        })
      })
      .then(res => {
        if (!res.ok) {
          console.error("NextGenDM local server rejected the request:", res.status);
        } else {
          console.log("Download successfully intercepted and sent to NextGenDM!");
        }
      })
      .catch(err => {
        console.error("NextGenDM is not running or unreachable:", err);
      });
      
    });
  }
});
