"""
Illustrator Tool — Generates storybook illustrations via Imagen 3.

Uses google-genai SDK with Google AI Studio API key (no Vertex AI needed).
"""

import base64
import logging
from google import genai
from google.genai import types
from google.adk.tools import FunctionTool

logger = logging.getLogger("livetales.illustrator")

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def generate_illustration(
    illustration_prompt: str,
    page_number: int,
    style: str = "children's storybook illustration, watercolor style, warm colors, safe for children ages 3-8",
) -> dict:
    """Generate a storybook illustration for a story page.

    Args:
        illustration_prompt: Detailed description of what to illustrate
        page_number: Which page this illustration is for (1-6)
        style: Art style for the illustration

    Returns:
        Dict with status and image info (actual generation happens async)
    """
    full_prompt = f"{style}. {illustration_prompt}"
    logger.info(f"Generating illustration for page {page_number}: {full_prompt[:100]}...")

    try:
        client = _get_client()
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=full_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
                safety_filter_level="block_low_and_above",
                person_generation="allow_adult",
            ),
        )

        if response.generated_images and len(response.generated_images) > 0:
            image = response.generated_images[0].image
            if image and image.image_bytes:
                image_b64 = base64.b64encode(image.image_bytes).decode("utf-8")
                logger.info(f"Illustration generated for page {page_number} ({len(image.image_bytes)} bytes)")
                return {
                    "page_number": page_number,
                    "status": "completed",
                    "image_base64": image_b64,
                    "mime_type": image.mime_type or "image/png",
                }

        # Image was filtered or empty
        rai_reason = None
        if response.generated_images and len(response.generated_images) > 0:
            rai_reason = response.generated_images[0].rai_filtered_reason
        logger.warning(f"Image filtered for page {page_number}: {rai_reason}")
        return {
            "page_number": page_number,
            "status": "filtered",
            "reason": rai_reason or "Image was filtered by safety checks",
        }

    except Exception as e:
        logger.error(f"Illustration generation failed for page {page_number}: {e}")
        return {
            "page_number": page_number,
            "status": "error",
            "error": str(e),
        }


generate_illustration = FunctionTool(func=generate_illustration)
