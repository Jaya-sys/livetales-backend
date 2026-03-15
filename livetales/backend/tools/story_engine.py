"""
Story Engine Tool — Generates story page text + illustration prompts.

Called by the Orchestrator when it's time to advance the story.
Returns structured output: narrative text + an image generation prompt.
"""

from google.adk.tools import FunctionTool
from pydantic import BaseModel


class StoryPage(BaseModel):
    page_number: int
    narrative_text: str
    illustration_prompt: str
    characters: list[str]
    mood: str


def generate_story_page(
    page_number: int,
    narrative_text: str,
    scene_description: str = "",
    child_input: str = "",
    previous_pages_summary: str = "",
    characters_so_far: str = "",
) -> dict:
    """Generate a story page for the storybook.

    The agent writes the narrative_text (2-3 sentences to be read aloud)
    and this tool records it for the frontend storybook viewer.

    Args:
        page_number: Which page of the story (1-6)
        narrative_text: The story text for this page (2-3 sentences, read aloud to child)
        scene_description: What's currently on the canvas (from vision analysis)
        child_input: What the child said (if anything)
        previous_pages_summary: Brief summary of the story so far
        characters_so_far: Characters already introduced

    Returns:
        Dict with page_number, narrative_text, and status
    """
    return {
        "page_number": page_number,
        "narrative_text": narrative_text,
        "scene_description": scene_description,
        "status": "completed",
    }

generate_story_page = FunctionTool(func=generate_story_page)
