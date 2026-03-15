"""Quick test: Does bidi-streaming connect to Gemini Live API?"""

import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents import LiveRequestQueue
from google.genai import types as genai_types


test_agent = Agent(
    name="tali_test",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    description="Test agent",
    instruction="You are Tali, a friendly Indian storyteller for kids. Respond in Hinglish in 1-2 sentences. Be warm and playful.",
)


async def test_connection():
    session_service = InMemorySessionService()
    
    # Create session first
    session = await session_service.create_session(
        app_name="livetales",
        user_id="test-user",
    )
    
    runner = Runner(
        agent=test_agent,
        app_name="livetales",
        session_service=session_service,
    )
    
    print("🔌 Connecting to Gemini Live API...")
    
    live_queue = LiveRequestQueue()
    
    live_events = runner.run_live(
        user_id=session.user_id,
        session_id=session.id,
        live_request_queue=live_queue,
    )
    
    # Send a message
    live_queue.send_content(
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text="Hi Tali! I want to draw something fun. Kya banau?")]
        )
    )
    
    print("📤 Message sent, waiting for Tali...")
    
    async for event in live_events:
        if hasattr(event, 'content') and event.content:
            for part in event.content.parts:
                if hasattr(part, 'text') and part.text:
                    print(f"🎭 Tali: {part.text}")
                    live_queue.close()
                    break
            break
    
    print("✅ Connection works!")

asyncio.run(test_connection())
