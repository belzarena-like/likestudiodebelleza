"""QR Code utilities with logo overlay support"""

import base64
import io
import os
from PIL import Image, ImageDraw, ImageOps
import qrcode
import qrcode.image.svg
from typing import Tuple

def load_logo_image() -> Image.Image:
    """Load the application logo"""
    # Get the backend/app directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try to load logo from assets
    logo_paths = [
        # From backend/app/resources (local resources folder)
        os.path.join(current_dir, 'resources', 'logo.png'),
        os.path.join(current_dir, 'resources', 'logo.jpg'),
        # From backend/app, go up to project root, then to assets
        os.path.join(current_dir, '..', '..', 'assets', 'imgs', 'logo.png'),
        os.path.join(current_dir, '..', '..', 'assets', 'imgs', 'logo.jpg'),
        # From backend directory (if running from backend/)
        os.path.join(current_dir, '..', 'assets', 'imgs', 'logo.png'),
        os.path.join(current_dir, '..', 'assets', 'imgs', 'logo.jpg'),
        # From project root (if running from project root)
        os.path.join(os.getcwd(), 'assets', 'imgs', 'logo.png'),
        os.path.join(os.getcwd(), 'assets', 'imgs', 'logo.jpg'),
    ]
    
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script directory: {current_dir}")
    
    for path in logo_paths:
        abs_path = os.path.abspath(path)
        print(f"Trying logo path: {abs_path}")
        if os.path.exists(abs_path):
            try:
                logo = Image.open(abs_path)
                # Convert to RGBA if needed
                if logo.mode != 'RGBA':
                    logo = logo.convert('RGBA')
                print(f"✓ Successfully loaded logo from: {abs_path}")
                return logo
            except Exception as e:
                print(f"✗ Error loading logo from {abs_path}: {e}")
    
    print("Warning: Could not load logo from any path, using fallback")
    # Create a simple fallback logo
    logo_size = 100
    logo = Image.new('RGBA', (logo_size, logo_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logo)
    
    # Draw a simple circle with LS initials
    draw.ellipse([10, 10, logo_size-10, logo_size-10], fill=(59, 130, 246, 255))
    draw.text((logo_size//2, logo_size//2), "LS", fill=(255, 255, 255, 255), 
              anchor="mm", font_size=30)
    
    return logo

def add_logo_to_qr(qr_img: Image.Image, logo: Image.Image, 
                   logo_size_percent: int = 20, position: str = "center") -> Image.Image:
    """Add logo overlay to QR code image"""
    # Calculate logo size based on QR code size
    qr_width, qr_height = qr_img.size
    logo_size = int(min(qr_width, qr_height) * (logo_size_percent / 100))
    
    # Resize logo
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Create a copy of QR code to modify
    qr_with_logo = qr_img.copy()
    
    # Calculate position
    if position == "center":
        x = (qr_width - logo_size) // 2
        y = (qr_height - logo_size) // 2
    elif position == "top-left":
        x = 10
        y = 10
    elif position == "top-right":
        x = qr_width - logo_size - 10
        y = 10
    elif position == "bottom-left":
        x = 10
        y = qr_height - logo_size - 10
    elif position == "bottom-right":
        x = qr_width - logo_size - 10
        y = qr_height - logo_size - 10
    else:
        x = (qr_width - logo_size) // 2
        y = (qr_height - logo_size) // 2
    
    # Create a white background for logo (optional, helps with QR readability)
    bg_size = logo_size + 8
    bg_x = x - 4
    bg_y = y - 4
    bg_img = Image.new('RGBA', (bg_size, bg_size), (255, 255, 255, 255))
    qr_with_logo.paste(bg_img, (bg_x, bg_y), bg_img)
    
    # Paste logo onto QR code
    qr_with_logo.paste(logo, (x, y), logo)
    
    return qr_with_logo

def generate_qr_image_with_logo(content: str, size: int = 300, format: str = "png",
                              error_correction: str = "M", color: str = "#000000",
                              background_color: str = "#FFFFFF", add_logo: bool = False,
                              logo_size_percent: int = 20, logo_position: str = "center") -> Tuple[bytes, str]:
    """Generate QR code image with optional logo overlay"""
    # Error correction mapping
    error_correction_map = {
        'L': qrcode.constants.ERROR_CORRECT_L,
        'M': qrcode.constants.ERROR_CORRECT_M,
        'Q': qrcode.constants.ERROR_CORRECT_Q,
        'H': qrcode.constants.ERROR_CORRECT_H
    }
    
    # Create QR code
    qr = qrcode.QRCode(
        version=None,
        error_correction=error_correction_map.get(error_correction, qrcode.constants.ERROR_CORRECT_M),
        box_size=10,
        border=4,
    )
    
    qr.add_data(content)
    qr.make(fit=True)
    
    # Generate image
    if format == "svg":
        factory = qrcode.image.svg.SvgImage
        img = qr.make_image(image_factory=factory, fill_color=color, back_color=background_color)
        output = io.BytesIO()
        img.save(output)
        mime_type = "image/svg+xml"
    else:
        img = qr.make_image(fill_color=color, back_color=background_color)
        img = img.resize((size, size))
        
        # Add logo if requested
        if add_logo and format != "svg":
            try:
                logo = load_logo_image()
                img = add_logo_to_qr(img, logo, logo_size_percent, logo_position)
            except Exception as e:
                print(f"Error adding logo to QR code: {e}")
                # Continue without logo if there's an error
        
        output = io.BytesIO()
        img.save(output, format=format.upper())
        mime_type = f"image/{format}"
    
    return output.getvalue(), mime_type