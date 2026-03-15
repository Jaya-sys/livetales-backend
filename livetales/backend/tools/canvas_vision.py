"""
Canvas Vision Tool — Analyzes drawing canvas frames.

The Orchestrator calls this when it receives a new canvas frame
from the frontend via the bidi-streaming connection.
"""

from google.adk.tools import FunctionTool


def analyze_canvas(
    frame_description: str = "",
    previous_elements: str = "",
) -> dict:
    """Analyze what's currently drawn on the canvas.

    This tool helps the agent understand what the child is drawing.
    The actual vision analysis happens through Gemini's native multimodal
    capability — the canvas frame is sent as an image in the bidi-stream,
    and this tool structures the response.

    Args:
        frame_description: What the agent sees in the current frame
        previous_elements: Elements already identified in previous frames

    Returns:
        Dict with identified elements and whether anything new appeared
    """
    return {
        "frame_description": frame_description,
        "previous_elements": previous_elements,
        "status": "analyzed",
    }

analyze_canvas = FunctionTool(func=analyze_canvas)
