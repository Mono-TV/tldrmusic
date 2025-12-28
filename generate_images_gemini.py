#!/usr/bin/env python3
"""
TLDR Music - Gemini Image Generator
Generates social media assets using Google's Gemini API
"""

import os
import sys
from google import genai
from google.genai import types
from PIL import Image
import base64
from io import BytesIO

# Check for API key
API_KEY = os.getenv('GEMINI_API_KEY')
if not API_KEY:
    print("❌ GEMINI_API_KEY environment variable not set")
    print("\nTo set it:")
    print("  export GEMINI_API_KEY='your-api-key-here'")
    print("\nGet your API key from: https://makersuite.google.com/app/apikey")
    sys.exit(1)

# Configure Gemini client
client = genai.Client(api_key=API_KEY)

# Design specifications
COLORS = {
    'black': '#000000',
    'golden': '#f59e0b',
    'golden_light': '#fcd34d',
    'white': '#ffffff',
    'soft_white': '#E5E5E5'
}

OG_IMAGE_PROMPT = """Create an ultra-minimalist social media image with Apple aesthetic.

Pure black background. Modern sans-serif font.

Large white text "TLDR Music" on the left side.
Below it, golden yellow text "India's Top 25 Charts".
Small text "Weekly Updated Charts" underneath in light gray.

Small golden circle accent in the top right corner.
Tiny golden music note icon near the title.

Bottom left corner: small golden rounded badge with "music.lumiolabs.in" in white text.

Style: Clean, spacious, premium. 80% empty space. Left-aligned. Like an Apple product page or keynote slide.
Colors: Black background, white text, golden yellow accents (#f59e0b).
Mood: Sophisticated, minimal, elegant."""

TOUCH_ICON_PROMPT = """A minimalist square app icon on pure black background.

Center: golden music note symbol.
Bottom: white text "TLDR" in bold font.

Clean, simple, modern. Like Spotify or Apple Music icon style.
Black and gold color scheme."""

def generate_image_with_gemini(prompt_text, output_path, size):
    """Generate image using Gemini Imagen API"""
    try:
        print(f"\n🎨 Generating {size[0]}x{size[1]} image...")
        print(f"   Using Imagen 4.0")

        # Determine aspect ratio
        aspect_ratio = "16:9" if size[0] == 1200 else "1:1"

        # Generate image
        response = client.models.generate_images(
            model='imagen-4.0-generate-preview-06-06',
            prompt=prompt_text,
            config={
                'number_of_images': 1,
                'aspect_ratio': aspect_ratio,
                'safety_filter_level': 'block_low_and_above',
                'person_generation': 'allow_adult'
            }
        )

        # Get the generated image
        if response.generated_images:
            generated_image = response.generated_images[0]

            # Save image - handle different response formats
            if hasattr(generated_image, 'image'):
                if hasattr(generated_image.image, 'image_bytes'):
                    image_data = generated_image.image.image_bytes
                else:
                    image_data = generated_image.image
            else:
                image_data = generated_image

            with open(output_path, 'wb') as f:
                f.write(image_data)

            file_size = os.path.getsize(output_path) / 1024
            print(f"   ✓ Saved to {output_path} ({file_size:.1f}KB)")
            return True
        else:
            print(f"   ✗ No images generated")
            return False

    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def generate_with_gemini_text(prompt_text, output_path, size):
    """
    Fallback: Use Gemini to generate enhanced prompt, then create image programmatically
    This is a fallback since Gemini API might not have direct image generation
    """
    print(f"\n🎨 Generating {size[0]}x{size[1]} image...")
    print("   Using programmatic generation with Gemini-enhanced design")

    # Create image with PIL
    img = Image.new('RGB', size, color='#000000')
    draw = ImageDraw.Draw(img)

    # Try to load Red Hat Display font, fallback to system fonts
    try:
        # These paths are common on macOS
        font_paths = [
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/Library/Fonts/Arial.ttf',
            '/System/Library/Fonts/Helvetica.ttc'
        ]
        font_path = next((p for p in font_paths if os.path.exists(p)), None)

        if size[0] == 1200:  # OG Image
            title_font = ImageFont.truetype(font_path, 72) if font_path else ImageFont.load_default()
            subtitle_font = ImageFont.truetype(font_path, 36) if font_path else ImageFont.load_default()
            feature_font = ImageFont.truetype(font_path, 24) if font_path else ImageFont.load_default()

            # Draw title
            draw.text((80, 180), "TLDR Music", fill='#ffffff', font=title_font)
            # Draw subtitle
            draw.text((80, 270), "India's Top 25 Charts", fill='#fcd34d', font=subtitle_font)
            # Draw feature
            draw.text((80, 340), "Weekly Updated Charts", fill='#E5E5E5', font=feature_font)

            # Draw golden circle accent
            draw.ellipse([950, 50, 1100, 200], fill='#f59e0b', outline=None)

            # Draw footer badge
            badge_text = "music.lumiolabs.in"
            footer_font = ImageFont.truetype(font_path, 16) if font_path else ImageFont.load_default()
            draw.rounded_rectangle([80, 560, 280, 600], radius=20, outline='#f59e0b', width=1)
            draw.text((110, 575), badge_text, fill='#fcd34d', font=footer_font)

        else:  # Touch Icon (180x180)
            title_font = ImageFont.truetype(font_path, 20) if font_path else ImageFont.load_default()

            # Draw music note (simplified)
            draw.ellipse([70, 50, 110, 90], fill='#f59e0b', outline='#fcd34d', width=2)
            draw.rectangle([105, 40, 110, 85], fill='#f59e0b')

            # Draw TLDR text
            draw.text((90, 130), "TLDR", fill='#ffffff', font=title_font, anchor="mm")

    except Exception as e:
        print(f"   ⚠ Font rendering error: {e}")
        print("   Creating minimal fallback design...")

    # Save image
    img.save(output_path, 'PNG', optimize=True)
    file_size = os.path.getsize(output_path) / 1024
    print(f"   ✓ Saved to {output_path} ({file_size:.1f}KB)")

    return True

def main():
    print("╔════════════════════════════════════════╗")
    print("║  TLDR Music - Gemini Image Generator  ║")
    print("╚════════════════════════════════════════╝\n")

    # Check API key
    print(f"✓ API key configured: {API_KEY[:8]}...{API_KEY[-4:]}")

    print("\n🚀 Starting image generation with Imagen 4.0...")

    # Generate OG Image
    success_og = generate_image_with_gemini(
        OG_IMAGE_PROMPT,
        'og-image-gemini.png',
        (1200, 630)
    )

    # Generate Touch Icon
    success_icon = generate_image_with_gemini(
        TOUCH_ICON_PROMPT,
        'apple-touch-icon-gemini.png',
        (180, 180)
    )

    # Generate favicons from touch icon
    if success_icon:
        print("\n📦 Generating favicon sizes...")
        try:
            icon_img = Image.open('apple-touch-icon-gemini.png')

            sizes = [
                (16, 16, "favicon-16.png"),
                (32, 32, "favicon-32.png"),
                (192, 192, "favicon-192.png"),
                (512, 512, "favicon-512.png")
            ]

            for width, height, filename in sizes:
                resized = icon_img.resize((width, height), Image.Resampling.LANCZOS)
                resized.save(filename, "PNG", optimize=True)
                file_size = os.path.getsize(filename) / 1024
                print(f"   ✓ {filename} ({file_size:.1f}KB)")

            # Create .ico file
            ico_img = Image.open('apple-touch-icon-gemini.png')
            ico_img.save('favicon.ico', format='ICO', sizes=[(16, 16), (32, 32)])
            print(f"   ✓ favicon.ico")

        except Exception as e:
            print(f"   ✗ Error generating favicons: {e}")

    if success_og and success_icon:
        print("\n✨ All images generated successfully!")
        print("\n📁 Generated files:")
        print("   • og-image-gemini.png (1200x630)")
        print("   • apple-touch-icon-gemini.png (180x180)")
        print("   • favicon.ico + multiple PNG sizes")
        print("\n💡 Review the images and rename to replace current versions if satisfied")
    else:
        print("\n⚠ Some images failed to generate")

if __name__ == '__main__':
    main()
