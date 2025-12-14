"""
OG Image Generation Worker
In-process async worker using asyncio for generating playlist OG images
"""

import asyncio
import aiohttp
from io import BytesIO
from typing import Optional, List, Dict, Tuple
from datetime import datetime
from bson import ObjectId
import os

from PIL import Image, ImageDraw, ImageFont

from storage import get_storage, url_to_path
from og_image_models import OGImageStatus, OGImageConfig


class OGImageWorker:
    """
    Async worker for generating OG images.
    Uses asyncio.Queue for task management with rate limiting.
    """

    def __init__(self, db):
        self.db = db
        self.storage = get_storage()
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.processing: set = set()  # Track currently processing playlist IDs
        self.rate_limit = asyncio.Semaphore(3)  # Max 3 concurrent generations
        self._worker_task: Optional[asyncio.Task] = None
        self._running = False

        # Font paths - try multiple locations
        self.font_paths = [
            os.path.join(os.path.dirname(__file__), "fonts"),
            "/usr/share/fonts/truetype",
            "/System/Library/Fonts",
        ]

    async def start(self):
        """Start the worker loop"""
        if self._running:
            return

        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        print("OG Image Worker started")

    async def stop(self):
        """Stop the worker gracefully"""
        self._running = False

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

        print("OG Image Worker stopped")

    async def _worker_loop(self):
        """Main worker loop - processes queue items"""
        while self._running:
            try:
                # Wait for items with timeout to allow graceful shutdown
                try:
                    playlist_id, template = await asyncio.wait_for(
                        self.queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Skip if already processing this playlist
                if playlist_id in self.processing:
                    self.queue.task_done()
                    continue

                # Process with rate limiting
                async with self.rate_limit:
                    self.processing.add(playlist_id)
                    try:
                        await self._generate_og_image(playlist_id, template)
                    except Exception as e:
                        print(f"OG Image generation failed for {playlist_id}: {e}")
                        await self._mark_failed(playlist_id, str(e))
                    finally:
                        self.processing.discard(playlist_id)
                        self.queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Worker loop error: {e}")
                await asyncio.sleep(1)

    async def enqueue(self, playlist_id: str, template: str = "default"):
        """Add playlist to generation queue"""
        # Update status to pending
        await self._update_status(playlist_id, OGImageStatus.PENDING)

        try:
            await asyncio.wait_for(
                self.queue.put((playlist_id, template)),
                timeout=5.0
            )
            print(f"Enqueued OG image generation for playlist {playlist_id}")
        except asyncio.TimeoutError:
            print(f"Queue full, could not enqueue {playlist_id}")
            await self._mark_failed(playlist_id, "Queue full")

    async def _generate_og_image(self, playlist_id: str, template: str):
        """Generate OG image for a playlist"""
        print(f"Generating OG image for playlist {playlist_id}")

        # Mark as generating
        await self._update_status(playlist_id, OGImageStatus.GENERATING)

        # Fetch playlist data
        playlist = await self.db.get_playlist_by_id(playlist_id, None)
        if not playlist:
            raise ValueError("Playlist not found")

        # Only generate for public playlists
        if not playlist.get("is_public"):
            raise ValueError("Playlist is not public")

        # Get owner info
        owner = await self.db.get_playlist_owner(playlist["owner_id"])
        owner_name = owner.get("name", "Unknown") if owner else "Unknown"

        # Download artwork images
        cover_urls = playlist.get("cover_urls", [])[:4]
        artworks = await self._download_artworks(cover_urls)

        # Generate composite image
        config = OGImageConfig()
        image = self._create_composite(
            artworks=artworks,
            playlist_name=playlist["name"],
            owner_name=owner_name,
            song_count=playlist.get("song_count", 0),
            template=template,
            config=config
        )

        # Convert to bytes
        img_buffer = BytesIO()
        image.save(img_buffer, format="PNG", optimize=True)
        img_bytes = img_buffer.getvalue()

        # Generate unique filename
        version = playlist.get("og_image_version", 0) + 1
        timestamp = int(datetime.utcnow().timestamp())
        filename = f"{playlist_id}/{timestamp}_v{version}.png"

        # Upload to cloud storage
        url = await self.storage.upload(img_bytes, filename, "image/png")

        # Delete old image if exists
        old_url = playlist.get("og_image_url")
        if old_url:
            try:
                old_path = url_to_path(old_url)
                if old_path:
                    await self.storage.delete(old_path)
            except Exception as e:
                print(f"Failed to delete old OG image: {e}")

        # Update database
        await self._update_success(playlist_id, url, version, template)
        print(f"OG image generated successfully for playlist {playlist_id}: {url}")

    async def _download_artworks(self, urls: List[str]) -> List[Image.Image]:
        """Download artwork images asynchronously"""
        images = []

        if not urls:
            return images

        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for url in urls[:4]:
                try:
                    async with session.get(url) as response:
                        if response.status == 200:
                            data = await response.read()
                            img = Image.open(BytesIO(data))
                            images.append(img.convert("RGBA"))
                except Exception as e:
                    print(f"Failed to download artwork {url}: {e}")

        return images

    def _load_font(self, size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
        """Load font with fallback to default"""
        font_names = [
            "RedHatDisplay-Bold.ttf" if bold else "RedHatDisplay-Medium.ttf",
            "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
            "Arial Bold.ttf" if bold else "Arial.ttf",
        ]

        for font_path in self.font_paths:
            for font_name in font_names:
                try:
                    full_path = os.path.join(font_path, font_name)
                    if os.path.exists(full_path):
                        return ImageFont.truetype(full_path, size)
                except Exception:
                    continue

        # Fallback to default font
        return ImageFont.load_default()

    def _create_composite(
        self,
        artworks: List[Image.Image],
        playlist_name: str,
        owner_name: str,
        song_count: int,
        template: str,
        config: OGImageConfig
    ) -> Image.Image:
        """Create the composite OG image"""

        # Create base image with gradient background
        img = Image.new("RGBA", (config.width, config.height))
        self._add_gradient_background(img, template, config)

        draw = ImageDraw.Draw(img)

        # Calculate artwork grid position (left side)
        grid_total_size = (config.artwork_size * 2) + config.artwork_gap
        grid_x = config.padding
        grid_y = (config.height - grid_total_size) // 2

        # Place artworks in 2x2 grid
        positions = [
            (grid_x, grid_y),
            (grid_x + config.artwork_size + config.artwork_gap, grid_y),
            (grid_x, grid_y + config.artwork_size + config.artwork_gap),
            (grid_x + config.artwork_size + config.artwork_gap,
             grid_y + config.artwork_size + config.artwork_gap)
        ]

        # Fill with placeholders first
        for i, pos in enumerate(positions):
            if i < len(artworks):
                resized = artworks[i].resize(
                    (config.artwork_size, config.artwork_size),
                    Image.LANCZOS
                )
                resized = self._add_rounded_corners(resized, config.artwork_radius)
                img.paste(resized, pos, resized)
            else:
                placeholder = self._create_placeholder(
                    config.artwork_size,
                    config.artwork_radius
                )
                img.paste(placeholder, pos, placeholder)

        # Text area (right side)
        text_x = grid_x + grid_total_size + 50
        text_area_width = config.width - text_x - config.padding

        # Load fonts
        title_font = self._load_font(52, bold=True)
        meta_font = self._load_font(28, bold=False)
        brand_font = self._load_font(24, bold=True)

        # Draw playlist name (with word wrap, max 2 lines)
        y_offset = config.height // 2 - 80
        wrapped_title = self._wrap_text(playlist_name, title_font, text_area_width)

        for i, line in enumerate(wrapped_title[:2]):
            if i == 1 and len(wrapped_title) > 2:
                line = line[:len(line)-3] + "..."
            draw.text((text_x, y_offset), line, font=title_font, fill=config.text_color)
            y_offset += 64

        # Draw owner name
        y_offset += 16
        by_text = f"by {owner_name}"
        draw.text((text_x, y_offset), by_text, font=meta_font, fill=config.secondary_text_color)

        # Draw song count
        y_offset += 40
        songs_text = f"{song_count} song{'s' if song_count != 1 else ''}"
        draw.text((text_x, y_offset), songs_text, font=meta_font, fill="#888888")

        # Add TLDR Music branding (bottom right)
        brand_y = config.height - config.padding - 30
        brand_x = text_x

        draw.text((brand_x, brand_y), "TLDR", font=brand_font, fill=config.text_color)

        # Measure "TLDR" width for positioning "Music"
        tldr_bbox = draw.textbbox((0, 0), "TLDR", font=brand_font)
        tldr_width = tldr_bbox[2] - tldr_bbox[0]

        draw.text(
            (brand_x + tldr_width + 8, brand_y),
            "Music",
            font=brand_font,
            fill=config.accent_color
        )

        return img.convert("RGB")

    def _add_gradient_background(
        self,
        img: Image.Image,
        template: str,
        config: OGImageConfig
    ):
        """Add gradient background based on template"""
        draw = ImageDraw.Draw(img)

        # Define gradient colors based on template
        gradients = {
            "default": [
                (26, 26, 46),    # Dark blue-gray
                (22, 33, 62),    # Slightly lighter
            ],
            "minimal": [
                (18, 18, 18),    # Near black
                (28, 28, 28),    # Dark gray
            ],
            "vibrant": [
                (88, 28, 135),   # Purple
                (15, 23, 42),    # Dark blue
            ],
            "dark": [
                (0, 0, 0),       # Black
                (20, 20, 30),    # Very dark blue
            ],
        }

        colors = gradients.get(template, gradients["default"])

        # Create horizontal gradient
        for x in range(config.width):
            ratio = x / config.width
            r = int(colors[0][0] * (1 - ratio) + colors[1][0] * ratio)
            g = int(colors[0][1] * (1 - ratio) + colors[1][1] * ratio)
            b = int(colors[0][2] * (1 - ratio) + colors[1][2] * ratio)
            draw.line([(x, 0), (x, config.height)], fill=(r, g, b, 255))

    def _add_rounded_corners(self, img: Image.Image, radius: int) -> Image.Image:
        """Add rounded corners to image"""
        # Create mask with rounded corners
        mask = Image.new("L", img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([(0, 0), img.size], radius, fill=255)

        # Apply mask
        result = img.copy()
        result.putalpha(mask)
        return result

    def _create_placeholder(self, size: int, radius: int) -> Image.Image:
        """Create placeholder image for missing artwork"""
        img = Image.new("RGBA", (size, size), (45, 45, 58, 255))

        # Add music note icon (simplified)
        draw = ImageDraw.Draw(img)
        center_x, center_y = size // 2, size // 2
        note_size = size // 4

        # Draw a simple music note shape
        draw.ellipse(
            [center_x - note_size, center_y,
             center_x + note_size // 2, center_y + note_size],
            fill=(80, 80, 100, 255)
        )
        draw.line(
            [center_x + note_size // 2 - 5, center_y + note_size // 2,
             center_x + note_size // 2 - 5, center_y - note_size],
            fill=(80, 80, 100, 255),
            width=4
        )

        # Add rounded corners
        return self._add_rounded_corners(img, radius)

    def _wrap_text(self, text: str, font, max_width: int) -> List[str]:
        """Wrap text to fit within max_width"""
        words = text.split()
        lines = []
        current_line = []

        # Create temporary draw context for measuring
        temp_img = Image.new("RGB", (1, 1))
        draw = ImageDraw.Draw(temp_img)

        for word in words:
            test_line = " ".join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            width = bbox[2] - bbox[0]

            if width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]

        if current_line:
            lines.append(" ".join(current_line))

        return lines

    async def _update_status(self, playlist_id: str, status: OGImageStatus):
        """Update OG image status in database"""
        await self.db.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": {"og_image_status": status.value}}
        )

    async def _update_success(
        self,
        playlist_id: str,
        url: str,
        version: int,
        template: str
    ):
        """Update database on successful generation"""
        now = int(datetime.utcnow().timestamp() * 1000)
        await self.db.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": {
                "og_image_url": url,
                "og_image_status": OGImageStatus.READY.value,
                "og_image_updated_at": now,
                "og_image_version": version,
                "og_image_template": template
            }}
        )

    async def _mark_failed(self, playlist_id: str, error: str):
        """Mark generation as failed"""
        await self.db.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": {
                "og_image_status": OGImageStatus.FAILED.value,
                "og_image_error": error
            }}
        )


# Singleton instance
_og_worker: Optional[OGImageWorker] = None


async def get_og_worker(db) -> OGImageWorker:
    """Get or create the OG image worker singleton"""
    global _og_worker

    if _og_worker is None:
        _og_worker = OGImageWorker(db)
        await _og_worker.start()

    return _og_worker


async def stop_og_worker():
    """Stop the OG image worker"""
    global _og_worker

    if _og_worker is not None:
        await _og_worker.stop()
        _og_worker = None
