let currentPopup = null;

function createFloatingButton(video) {
  const btn = document.createElement('div');
  btn.className = 'ngdm-floating-btn';
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
    Download Video
  `;
  
  btn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (currentPopup) {
      currentPopup.el.remove();
      currentPopup.btn.style.borderBottomLeftRadius = '';
      currentPopup.btn.style.borderBottomRightRadius = '';
      currentPopup.btn.style.borderBottomColor = '';
      currentPopup.btn.style.zIndex = '';
      currentPopup = null;
      return;
    }
    
    btn.innerHTML = 'Loading...';
    
    // Fetch formats
    fetch(`http://localhost:14200/extract-media?url=${encodeURIComponent(window.location.href)}`)
      .then(res => res.json())
      .then(formats => {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download Video
        `;
        showPopup(btn, formats);
      })
      .catch(err => {
        btn.innerHTML = 'Error';
        setTimeout(() => {
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download Video
          `;
        }, 2000);
      });
  };

  return btn;
}

function showPopup(btn, formats) {
  const popup = document.createElement('div');
  popup.className = 'ngdm-popup';
  
  const title = document.createElement('div');
  title.className = 'ngdm-popup-title';
  title.innerText = formats.length > 0 && formats[0].title ? formats[0].title : 'Available Qualities';
  popup.appendChild(title);

  if (formats.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ngdm-popup-empty';
    empty.innerText = 'No formats found';
    popup.appendChild(empty);
  } else {
    const videos = formats.filter(f => f.format_type === 'video');
    const audios = formats.filter(f => f.format_type === 'audio');
    const subs = formats.filter(f => f.format_type === 'subtitle');
    
    let itemIndex = 0;

    const renderSection = (title, items) => {
      if (items.length === 0) return;

      const header = document.createElement('div');
      header.className = 'ngdm-popup-section-header';
      header.innerText = title;
      popup.appendChild(header);

      items.forEach(f => {
        const item = document.createElement('div');
        item.className = 'ngdm-popup-item';
        
        const titleStr = f.title || 'Video';
        const truncatedTitle = titleStr.length > 20 ? titleStr.substring(0, 20) + '...' : titleStr;
        
        const resText = f.resolution || 'Unknown';
        
        let sizeText = '-';
        if (f.filesize) {
          const mb = f.filesize / 1024 / 1024;
          if (mb >= 1000) {
            sizeText = `${(mb / 1024).toFixed(1)}GB`;
          } else {
            sizeText = `${mb.toFixed(1)}MB`;
          }
        }

        item.innerHTML = `
          <span class="ngdm-col-sr">${++itemIndex}</span>
          <span class="ngdm-col-name" title="${titleStr}">
            <span class="ngdm-name-text">${truncatedTitle}</span>
            <span class="ngdm-name-ext"> .${f.ext}</span>
          </span>
          <span class="ngdm-col-quality">${resText}</span>
          <span class="ngdm-col-size">${sizeText}</span>
        `;
        
        item.onclick = (e) => {
          e.stopPropagation();
          
          btn.innerHTML = `Loading...`;
          
          // Send intercept
          fetch("http://localhost:14200/intercept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: f.url,
              audio_url: f.audio_url || null,
              filename: f.title ? `${f.title.replace(/[/\\?%*:|"<>]/g, '-')}.${f.ext}` : undefined
            })
          });
          
          currentPopup.el.remove();
          currentPopup.btn.style.borderBottomLeftRadius = '';
          currentPopup.btn.style.borderBottomRightRadius = '';
          currentPopup.btn.style.borderBottomColor = '';
          currentPopup.btn.style.zIndex = '';
          currentPopup = null;
        };
        popup.appendChild(item);
      });
    };

    renderSection('Video', videos);
    renderSection('Audio', audios);
    renderSection('Subtitles', subs);
  }

  // Position popup below button
  document.body.appendChild(popup);
  const rect = btn.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY - 1}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
  
  // Make button look attached
  btn.style.borderBottomLeftRadius = '0';
  btn.style.borderBottomRightRadius = '0';
  btn.style.borderBottomColor = 'transparent';
  btn.style.zIndex = '2147483648'; // Above popup

  currentPopup = { el: popup, btn: btn };
}

// Close popup on outside click
document.addEventListener('click', () => {
  if (currentPopup) {
    currentPopup.el.remove();
    currentPopup.btn.style.borderBottomLeftRadius = '';
    currentPopup.btn.style.borderBottomRightRadius = '';
    currentPopup.btn.style.borderBottomColor = '';
    currentPopup.btn.style.zIndex = '';
    currentPopup = null;
  }
});

function attachToVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.dataset.ngdmAttached) {
      video.dataset.ngdmAttached = 'true';
      
      const btn = createFloatingButton(video);
      document.body.appendChild(btn);

      const updatePosition = () => {
        const rect = video.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          btn.style.display = 'flex';
          btn.style.top = `${rect.top + window.scrollY + 10}px`;
          btn.style.left = `${rect.right + window.scrollX - btn.offsetWidth - 10}px`;
        } else {
          btn.style.display = 'none';
        }
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      
      setInterval(updatePosition, 1000);
    }
  });
}

attachToVideos();
const observer = new MutationObserver(() => {
  attachToVideos();
});
observer.observe(document.body, { childList: true, subtree: true });
