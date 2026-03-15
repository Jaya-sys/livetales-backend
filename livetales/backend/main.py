"""
LiveTales Backend Server

FastAPI + WebSocket server using ADK bidi-streaming for voice.
Matches the SaschaHeyer/gen-ai-livestream ADK reference pattern exactly.

Architecture:
  VOICE: Browser <-> WebSocket (base64 JSON) <-> ADK Runner + LiveRequestQueue <-> Gemini Live API
  STORY: Async pipeline (gemini-2.5-flash + Imagen 3) triggered on demand
  VIDEO: TTS narration (Gemini TTS) + animated video (Veo) triggered after story complete
"""

import asyncio
import json
import logging
import re
import base64
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from google import genai

from agents.orchestrator import root_agent
from config.settings import settings

# Configure logging
logging.basicConfig(level=getattr(logging, settings.log_level))
logger = logging.getLogger("livetales")

# Application name constant
APP_NAME = "livetales"

# Audio sample rates
SEND_SAMPLE_RATE = 16000  # Rate of audio sent to Gemini (from browser mic)


# --- ADK Setup (once at startup) ---
session_service = InMemorySessionService()
runner = Runner(app_name=APP_NAME, agent=root_agent, session_service=session_service)


# --- Vertex AI client for story + illustration (separate from live voice) ---
_vertex_client = None

def get_vertex_client():
    """Get a Vertex AI client for non-live calls (story text + illustrations)."""
    global _vertex_client
    if _vertex_client is None:
        _vertex_client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )
    return _vertex_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("LiveTales backend starting (ADK bidi-streaming)...")
    logger.info(f"   Environment: {settings.app_env}")
    logger.info(f"   Agent model: {root_agent.model}")
    yield
    logger.info("LiveTales backend shutting down...")


# --- FastAPI App ---
app = FastAPI(
    title="LiveTales API",
    description="Real-time AI storytelling backend for LiveTales",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health Check ---
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "livetales-backend",
        "version": "0.4.0",
    }


# --- Async Story + Illustration Pipeline ---

async def generate_story_and_illustration(
    canvas_frame: bytes | None,
    tali_context: str,
    page_number: int,
    session_id: str,
    websocket: WebSocket,
):
    """Generate a story page + illustration using non-live models.
    Runs as a background task, separate from the live voice stream.
    """
    logger.info(f"Generating story page {page_number}...")

    try:
        client = get_vertex_client()

        parts = []
        if canvas_frame:
            parts.append(types.Part(
                inline_data=types.Blob(
                    data=canvas_frame,
                    mime_type="image/jpeg",
                )
            ))

        parts.append(types.Part(text=f"""You are a children's story writer. Based on the child's drawing (image above if provided) and the conversation context below, generate ONE story page.

Conversation context (what Tali and the child discussed):
{tali_context or "The child just started drawing."}

Page number: {page_number} of 6

Story structure:
- Page 1: "Once upon a time..." — introduce the world from the drawing
- Page 2: Describe the setting based on drawn elements
- Page 3: Introduce the main character
- Page 4: A gentle challenge or adventure
- Page 5: Happy resolution
- Page 6: Warm, uplifting closing

Return ONLY valid JSON (no markdown, no code blocks):
{{"narrative_text": "2-3 simple sentences for a 5-year-old", "illustration_prompt": "detailed visual description for a children's storybook watercolor illustration"}}"""))

        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=types.Content(role="user", parts=parts),
        )

        response_text = response.text.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\s*", "", response_text)
            response_text = re.sub(r"\s*```$", "", response_text)

        story_data = json.loads(response_text)
        narrative_text = story_data.get("narrative_text", "")
        illustration_prompt = story_data.get("illustration_prompt", "")

        logger.info(f"Story page {page_number}: {narrative_text[:80]}...")

        # Store page data for later video generation
        if session_id not in session_page_store:
            session_page_store[session_id] = {}
        session_page_store[session_id][page_number] = {
            "narrative_text": narrative_text,
            "illustration_prompt": illustration_prompt,
        }

        # Send story text to frontend
        await websocket.send_text(json.dumps({
            "type": "story_page",
            "page_number": page_number,
            "narrative_text": narrative_text,
        }))

        # Generate illustration in background
        if illustration_prompt:
            asyncio.create_task(
                generate_illustration_async(
                    prompt=illustration_prompt,
                    page_number=page_number,
                    session_id=session_id,
                    websocket=websocket,
                )
            )

    except Exception as e:
        logger.error(f"Story generation failed for page {page_number}: {e}", exc_info=True)


async def generate_illustration_async(
    prompt: str,
    page_number: int,
    session_id: str,
    websocket: WebSocket,
):
    """Generate an illustration using Imagen 3."""
    logger.info(f"Generating illustration for page {page_number}...")

    try:
        client = get_vertex_client()
        full_prompt = f"Children's storybook illustration, watercolor style, warm colors, safe for children ages 3-8. {prompt}"

        response = await asyncio.to_thread(
            client.models.generate_images,
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

                # Store image bytes for Veo video generation later
                if session_id in session_page_store and page_number in session_page_store[session_id]:
                    session_page_store[session_id][page_number]["image_bytes"] = image.image_bytes

                await websocket.send_text(json.dumps({
                    "type": "illustration",
                    "page_number": page_number,
                    "image_base64": image_b64,
                    "mime_type": image.mime_type or "image/png",
                }))
                return

        logger.warning(f"Illustration filtered for page {page_number}")

    except Exception as e:
        logger.error(f"Illustration generation failed for page {page_number}: {e}")


# --- Per-session store for illustration bytes (used by Veo video gen) ---
# Maps session_id -> {page_number: {"image_bytes": bytes, "narrative_text": str, "illustration_prompt": str}}
session_page_store: dict[str, dict[int, dict]] = {}


# --- TTS Narration Pipeline (Gemini TTS) ---

async def generate_narration(
    narrative_text: str,
    page_number: int,
    websocket: WebSocket,
):
    """Generate TTS voice-over narration for a story page using Gemini TTS."""
    logger.info(f"Generating narration for page {page_number}...")

    try:
        client = get_vertex_client()
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash-preview-tts",
            contents=f"Read this children's story page warmly and expressively, like a fun friend telling a bedtime story: {narrative_text}",
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Aoede",
                        )
                    )
                ),
            ),
        )

        audio_data = response.candidates[0].content.parts[0].inline_data.data
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")

        logger.info(f"Narration generated for page {page_number} ({len(audio_data)} bytes)")
        await websocket.send_text(json.dumps({
            "type": "narration",
            "page_number": page_number,
            "audio_base64": audio_b64,
        }))

    except Exception as e:
        logger.error(f"Narration generation failed for page {page_number}: {e}", exc_info=True)


# --- Veo Video Animation Pipeline ---

async def generate_page_video(
    illustration_bytes: bytes,
    illustration_prompt: str,
    page_number: int,
    session_id: str,
    websocket: WebSocket,
):
    """Generate an animated video clip from a story illustration using Veo."""
    logger.info(f"Generating Veo video for page {page_number}...")

    try:
        from google.cloud import storage as gcs_storage

        # Upload illustration to GCS (Veo requires GCS URI for input)
        storage_client = gcs_storage.Client(project=settings.google_cloud_project)
        bucket = storage_client.bucket(settings.gcs_bucket)

        input_blob_path = f"livetales/{session_id}/page_{page_number}.png"
        blob = bucket.blob(input_blob_path)
        blob.upload_from_string(illustration_bytes, content_type="image/png")
        gcs_input_uri = f"gs://{settings.gcs_bucket}/{input_blob_path}"
        gcs_output_uri = f"gs://{settings.gcs_bucket}/livetales/{session_id}/video_page_{page_number}"

        logger.info(f"Uploaded illustration to {gcs_input_uri}")

        veo_client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

        operation = await asyncio.to_thread(
            veo_client.models.generate_videos,
            model="veo-2.0-generate-001",
            prompt=f"Gentle, dreamy animation of a children's storybook watercolor illustration. Slow subtle movement, nothing scary. {illustration_prompt}",
            image=types.Image(
                gcs_uri=gcs_input_uri,
                mime_type="image/png",
            ),
            config=types.GenerateVideosConfig(
                aspect_ratio="16:9",
                output_gcs_uri=gcs_output_uri,
                number_of_videos=1,
                duration_seconds=5,
            ),
        )

        # Poll for completion (Veo is async, can take 1-3 minutes)
        await websocket.send_text(json.dumps({
            "type": "video_progress",
            "page_number": page_number,
            "status": "generating",
        }))

        poll_count = 0
        while not operation.done:
            await asyncio.sleep(10)
            poll_count += 1
            operation = veo_client.operations.get(operation)
            # Send keepalive progress to prevent WebSocket timeout
            try:
                await websocket.send_text(json.dumps({
                    "type": "video_progress",
                    "page_number": page_number,
                    "status": "generating",
                    "message": f"Animating page {page_number}... ({poll_count * 10}s)",
                }))
            except Exception:
                logger.warning(f"WebSocket closed during video poll for page {page_number}")

        logger.info(f"Veo operation done for page {page_number}. result={operation.result}, error={getattr(operation, 'error', None)}")

        if operation.result and operation.result.generated_videos:
            video_uri = operation.result.generated_videos[0].video.uri
            logger.info(f"Veo video ready for page {page_number}: {video_uri}")

            # Download video from GCS
            video_blob_path = video_uri.replace(f"gs://{settings.gcs_bucket}/", "")
            video_blob = bucket.blob(video_blob_path)
            video_bytes = video_blob.download_as_bytes()
            video_b64 = base64.b64encode(video_bytes).decode("utf-8")

            try:
                await websocket.send_text(json.dumps({
                    "type": "page_video",
                    "page_number": page_number,
                    "video_base64": video_b64,
                    "mime_type": "video/mp4",
                }))
            except Exception:
                logger.warning(f"WebSocket closed, could not send page {page_number} video")
        else:
            logger.warning(f"Veo returned no video for page {page_number}")

    except ImportError:
        logger.error("google-cloud-storage not installed. Run: pip install google-cloud-storage")
    except Exception as e:
        logger.error(f"Video generation failed for page {page_number}: {e}", exc_info=True)


# --- Story Video Orchestration ---

async def generate_story_video(
    session_id: str,
    websocket: WebSocket,
):
    """Generate ONE combined story video + full narration for the entire story.
    Uses the first illustration as the starting frame for Veo, and combines
    all narrative text into a single TTS narration.
    """
    page_data = session_page_store.get(session_id, {})
    logger.info(f"Video generation requested for session={session_id}, pages in store: {list(session_page_store.keys())}, page_data keys: {list(page_data.keys()) if page_data else 'empty'}")
    if not page_data:
        logger.warning(f"No story pages found for video generation. session_id={session_id}")
        return

    logger.info(f"Generating combined story video from {len(page_data)} pages...")

    await websocket.send_text(json.dumps({
        "type": "video_progress",
        "status": "started",
        "message": "Creating your story video...",
    }))

    sorted_pages = sorted(page_data.items())
    full_story = " ".join(data.get("narrative_text", "") for _, data in sorted_pages if data.get("narrative_text"))

    tasks = []

    # 1. Generate full narration for the entire story (TTS)
    if full_story:
        tasks.append(generate_full_narration(full_story, websocket))

    # 2. Generate one Veo video per page (4 seconds each)
    if settings.gcs_bucket:
        for page_num, data in sorted_pages:
            if data.get("image_bytes"):
                tasks.append(generate_page_video(
                    illustration_bytes=data["image_bytes"],
                    illustration_prompt=data.get("illustration_prompt", ""),
                    page_number=page_num,
                    session_id=session_id,
                    websocket=websocket,
                ))

    # Run narration + all page videos in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            logger.error(f"Story video task failed: {r}")

    try:
        await websocket.send_text(json.dumps({
            "type": "video_progress",
            "status": "complete",
            "message": "Your story video is ready!",
        }))
    except Exception:
        logger.warning("WebSocket closed before sending video completion")


async def generate_full_narration(full_story: str, websocket: WebSocket):
    """Generate ONE TTS narration for the entire story."""
    logger.info("Generating full story narration...")

    try:
        client = get_vertex_client()
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash-preview-tts",
            contents=f"Read this complete children's story warmly and expressively, like a fun friend telling a bedtime story. Add small pauses between pages: {full_story}",
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Aoede",
                        )
                    )
                ),
            ),
        )

        audio_data = response.candidates[0].content.parts[0].inline_data.data
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")

        logger.info(f"Full narration generated ({len(audio_data)} bytes)")
        await websocket.send_text(json.dumps({
            "type": "story_narration",
            "audio_base64": audio_b64,
        }))

    except Exception as e:
        logger.error(f"Full narration generation failed: {e}", exc_info=True)


async def generate_full_video(
    illustration_bytes: bytes,
    story_description: str,
    session_id: str,
    websocket: WebSocket,
):
    """Generate ONE animated story video using Veo from the first illustration."""
    logger.info("Generating full story video with Veo...")

    try:
        from google.cloud import storage as gcs_storage

        storage_client = gcs_storage.Client(project=settings.google_cloud_project)
        bucket = storage_client.bucket(settings.gcs_bucket)

        # Upload first illustration as starting frame
        input_blob_path = f"livetales/{session_id}/story_frame.png"
        blob = bucket.blob(input_blob_path)
        blob.upload_from_string(illustration_bytes, content_type="image/png")
        gcs_input_uri = f"gs://{settings.gcs_bucket}/{input_blob_path}"
        gcs_output_uri = f"gs://{settings.gcs_bucket}/livetales/{session_id}/story_video"

        veo_client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

        operation = await asyncio.to_thread(
            veo_client.models.generate_videos,
            model="veo-2.0-generate-001",
            prompt=f"A gentle, dreamy animated children's storybook coming to life. Watercolor style, warm colors, slow magical camera movement, safe for kids. Smoothly animate through the entire story: {story_description[:500]}",
            image=types.Image(
                gcs_uri=gcs_input_uri,
                mime_type="image/png",
            ),
            config=types.GenerateVideosConfig(
                aspect_ratio="16:9",
                output_gcs_uri=gcs_output_uri,
                number_of_videos=1,
                duration_seconds=8,
            ),
        )

        try:
            await websocket.send_text(json.dumps({
                "type": "video_progress",
                "status": "generating",
                "message": "Animating your story...",
            }))
        except Exception:
            pass

        poll_count = 0
        while not operation.done:
            await asyncio.sleep(10)
            poll_count += 1
            operation = veo_client.operations.get(operation)
            # Send keepalive progress to prevent WebSocket timeout
            try:
                await websocket.send_text(json.dumps({
                    "type": "video_progress",
                    "status": "generating",
                    "message": f"Animating your story... ({poll_count * 10}s)",
                }))
            except Exception:
                logger.warning("WebSocket closed during story video poll")

        if operation.result and operation.result.generated_videos:
            video_uri = operation.result.generated_videos[0].video.uri
            logger.info(f"Story video ready: {video_uri}")

            video_blob_path = video_uri.replace(f"gs://{settings.gcs_bucket}/", "")
            video_blob = bucket.blob(video_blob_path)
            video_bytes = video_blob.download_as_bytes()
            video_b64 = base64.b64encode(video_bytes).decode("utf-8")

            try:
                await websocket.send_text(json.dumps({
                    "type": "story_video",
                    "video_base64": video_b64,
                    "mime_type": "video/mp4",
                }))
            except Exception:
                logger.warning("WebSocket closed, could not send story video")
        else:
            logger.warning("Veo returned no video for story")

    except ImportError:
        logger.error("google-cloud-storage not installed. Run: pip install google-cloud-storage")
    except Exception as e:
        logger.error(f"Story video generation failed: {e}", exc_info=True)


# --- WebSocket Endpoint — ADK Bidi-Streaming ---
@app.websocket("/ws/story/{session_id}")
async def websocket_story_session(websocket: WebSocket, session_id: str):
    """
    Main WebSocket endpoint for a storytelling session.
    Uses ADK Runner + LiveRequestQueue for bidi-streaming.
    Matches the SaschaHeyer ADK reference pattern exactly.

    All messages are JSON text frames (including audio as base64).
    """
    await websocket.accept()
    logger.info(f"Client connected: session={session_id}")

    # Session state for story pipeline
    latest_canvas_frame: bytes | None = None
    transcription_buffer: str = ""
    current_page: int = 1

    try:
        # Create ADK session (pass session object directly to run_live)
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=f"user_{session_id}",
            session_id=session_id,
        )

        # RunConfig matching the SaschaHeyer reference
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede",
                    )
                ),
                language_code="en-IN",
            ),
            response_modalities=["AUDIO"],
            output_audio_transcription=types.AudioTranscriptionConfig(),
            input_audio_transcription=types.AudioTranscriptionConfig(),
        )

        live_request_queue = LiveRequestQueue()

        # Audio queue: decouples WebSocket receive from LiveRequestQueue send
        audio_queue: asyncio.Queue[bytes] = asyncio.Queue()

        # Send ready signal to client
        await websocket.send_text(json.dumps({"type": "ready"}))

        # Trigger Tali's greeting
        live_request_queue.send_content(types.Content(
            parts=[types.Part(text="A new friend just opened the app! Say hi like an excited kid friend in 1 short sentence.")]
        ))

        async def handle_websocket_messages():
            """Task 1: Receive messages from WebSocket, route to audio queue or handle control."""
            nonlocal latest_canvas_frame, current_page
            try:
                while True:
                    raw = await websocket.receive_text()
                    try:
                        msg = json.loads(raw)
                        msg_type = msg.get("type")

                        if msg_type == "audio":
                            # Decode base64 audio and put in queue
                            audio_bytes = base64.b64decode(msg.get("data", ""))
                            await audio_queue.put(audio_bytes)

                        elif msg_type == "text":
                            content = types.Content(
                                parts=[types.Part(text=msg["data"])]
                            )
                            live_request_queue.send_content(content)

                        elif msg_type == "canvas_frame":
                            frame_bytes = base64.b64decode(msg["data"])
                            latest_canvas_frame = frame_bytes

                        elif msg_type == "generate_story":
                            page = current_page
                            if page > 6:
                                logger.info("Story complete (6 pages)")
                                continue
                            current_page += 1
                            asyncio.create_task(
                                generate_story_and_illustration(
                                    canvas_frame=latest_canvas_frame,
                                    tali_context=transcription_buffer,
                                    page_number=page,
                                    session_id=session_id,
                                    websocket=websocket,
                                )
                            )

                        elif msg_type == "generate_video":
                            # Generate TTS narration + Veo video for all completed pages
                            task = asyncio.create_task(
                                generate_story_video(
                                    session_id=session_id,
                                    websocket=websocket,
                                )
                            )
                            task.set_name(f"video_{session_id}")

                        elif msg_type == "end":
                            logger.info("Received end signal from client")
                            break

                    except json.JSONDecodeError:
                        logger.error("Invalid JSON message received")
                    except Exception as e:
                        logger.error(f"Error processing message: {e}")

            except WebSocketDisconnect:
                logger.info(f"Client disconnected: session={session_id}")

        async def process_and_send_audio():
            """Task 2: Take audio from queue and send to Gemini via LiveRequestQueue."""
            while True:
                data = await audio_queue.get()
                live_request_queue.send_realtime(
                    types.Blob(
                        data=data,
                        mime_type=f"audio/pcm;rate={SEND_SAMPLE_RATE}",
                    )
                )
                audio_queue.task_done()

        async def receive_and_process_responses():
            """Task 3: Receive events from run_live() and send to WebSocket client."""
            nonlocal transcription_buffer
            interrupted = False

            try:
                async for event in runner.run_live(
                    session=session,
                    live_request_queue=live_request_queue,
                    run_config=run_config,
                ):
                    event_str = str(event)

                    # Handle audio + text content
                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            # Audio content — send as base64 JSON
                            if hasattr(part, "inline_data") and part.inline_data:
                                b64_audio = base64.b64encode(
                                    part.inline_data.data
                                ).decode("utf-8")
                                await websocket.send_text(json.dumps({
                                    "type": "audio",
                                    "data": b64_audio,
                                }))

                            # Text content — only send partial=True to avoid duplication
                            if hasattr(part, "text") and part.text:
                                if hasattr(event.content, "role") and event.content.role == "user":
                                    pass  # User text, don't send back
                                else:
                                    # Only process partial=True messages (streaming chunks)
                                    # Skip partial=None (final consolidated) to avoid duplication
                                    if "partial=True" in event_str:
                                        await websocket.send_text(json.dumps({
                                            "type": "text",
                                            "data": part.text,
                                        }))

                    # Handle interruption
                    if event.interrupted and not interrupted:
                        logger.info("INTERRUPTION DETECTED")
                        await websocket.send_text(json.dumps({
                            "type": "interrupted",
                            "data": "Response interrupted by user input",
                        }))
                        interrupted = True

                    # Handle turn completion
                    if event.turn_complete:
                        if not interrupted:
                            logger.info("Gemini done talking")
                            await websocket.send_text(json.dumps({
                                "type": "turn_complete",
                            }))

                        # Reset for next turn
                        interrupted = False

                    # Extract transcriptions for story context
                    # Capture Tali's speech
                    if hasattr(event, "output_transcription") and event.output_transcription:
                        text = event.output_transcription.text
                        if text:
                            transcription_buffer += f"Tali: {text} "
                            if len(transcription_buffer) > 4000:
                                transcription_buffer = transcription_buffer[-3000:]

                    # Capture child's speech
                    if hasattr(event, "input_transcription") and event.input_transcription:
                        text = event.input_transcription.text
                        if text:
                            transcription_buffer += f"Child: {text} "
                            if len(transcription_buffer) > 4000:
                                transcription_buffer = transcription_buffer[-3000:]

            except Exception as e:
                logger.error(f"Error in receive_and_process_responses: {e}", exc_info=True)

        # Run all 3 tasks concurrently using TaskGroup (matching reference)
        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(handle_websocket_messages())
                tg.create_task(process_and_send_audio())
                tg.create_task(receive_and_process_responses())
        except* WebSocketDisconnect:
            logger.info(f"Client disconnected: session={session_id}")
        except* Exception as eg:
            for exc in eg.exceptions:
                logger.error(f"Task error: {exc}", exc_info=True)
        finally:
            live_request_queue.close()

            # Wait for any background video generation tasks to complete
            # before closing the WebSocket
            pending = [t for t in asyncio.all_tasks() if t.get_name().startswith(f"video_{session_id}")]
            if pending:
                logger.info(f"Waiting for {len(pending)} video task(s) to complete before closing WebSocket...")
                try:
                    await asyncio.wait(pending, timeout=300)  # 5 min max
                except Exception as e:
                    logger.error(f"Error waiting for video tasks: {e}")

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: session={session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": str(e),
            }))
        except:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
