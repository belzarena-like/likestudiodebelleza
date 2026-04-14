/**
 * Signature Pad initialization for consent forms
 * Handles canvas drawing and captures signature as base64 PNG
 */
(function() {
  'use strict';

  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) {
    console.log('Signature canvas not found');
    return;
  }

  console.log('Signature pad initializing, canvas:', canvas);
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  // Set canvas to match container width and fixed height
  function resizeCanvas() {
    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Use 100% of container width
    canvas.width = rect.width || 300;
    // Fixed height as requested
    canvas.height = 150;
    
    // Draw white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    console.log('Canvas resized to:', canvas.width, 'x', canvas.height);
  }

  // Initialize canvas after a small delay to ensure DOM is ready
  setTimeout(resizeCanvas, 100);
  window.addEventListener('resize', resizeCanvas);

  // Get mouse/touch position relative to canvas
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // Start drawing
  function startDrawing(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  }

  // Draw
  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    
    const pos = getPos(e);
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    lastX = pos.x;
    lastY = pos.y;
  }

  // Stop drawing
  function stopDrawing() {
    drawing = false;
  }

  // Mouse events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  // Touch events
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);
  canvas.addEventListener('touchcancel', stopDrawing);

  // Expose method to get signature data
  window.getSignatureData = function() {
    return canvas.toDataURL('image/png');
  };

  // Expose method to clear signature
  window.clearSignature = function() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Expose method to load existing signature
  window.loadSignature = function(dataUrl) {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = function() {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  };

  // Load existing signature if present in consent data
  const existingSignature = window.LIKESTUDIO_CONSENT_SIGNATURE;
  if (existingSignature) {
    window.loadSignature(existingSignature);
  }
  
  console.log('Signature pad initialized successfully');
})();