import React, { useRef, useEffect } from 'react';

const SignaturePad = ({ consentId, onSignatureChange }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let drawing = false;
    let points = [];

    const start = (e) => {
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const point = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: 1,
      };
      points = [point];
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    };
    const move = (e) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const point = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: 1,
      };
      points.push(point);
      const curve = Math.min(points.length, 3);
      if (curve === 1) {
        ctx.moveTo(point.x, point.y);
      } else {
        const previous = points[points.length - 2];
        const controlX = (point.x + previous.x) / 2;
        const controlY = (point.y + previous.y) / 2;
        ctx.quadraticCurveTo(
          controlX,
          controlY,
          point.x,
          point.y
        );
      }
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    const end = () => {
      drawing = false;
      const dataURL = canvas.toDataURL('image/png');
      if (onSignatureChange) {
        onSignatureChange(dataURL);
      }
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
    };
  }, [canvasRef, onSignatureChange]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '150px' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', border: '1px solid #ccc' }}
      />
    </div>
  );
};

export default SignaturePad;