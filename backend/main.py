from __future__ import annotations

import array
import io
import logging
import os
import re
import subprocess
import tempfile
import unicodedata
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - handled at runtime
    def load_dotenv(*args: Any, **kwargs: Any) -> bool:  # type: ignore[no-redef]
        return False

try:
    import ollama  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - handled at runtime
    ollama = None  # type: ignore[assignment]

try:
    import torch
except ImportError:  # pragma: no cover - handled at runtime
    torch = None  # type: ignore[assignment]

try:
    import imageio_ffmpeg
except ImportError:  # pragma: no cover - handled at runtime
    imageio_ffmpeg = None  # type: ignore[assignment]

try:
    import whisper  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - handled at runtime
    whisper = None  # type: ignore[assignment]


logger = logging.getLogger("mimic.align")


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str]
    ollama_host: str
    ollama_model: str
    ollama_keep_alive: str
    align_log_metrics: bool
    align_min_duration_sec: float
    align_min_speech_ratio: float
    align_min_rms: float
    whisper_model: str
    whisper_language: str


class TutorChatRequest(BaseModel):
    message: str = Field(min_length=1)
    target_language: str = Field(default="English", min_length=1)


class TutorChatResponse(BaseModel):
    response: str


class TutorUnloadResponse(BaseModel):
    status: str


class DefineWordRequest(BaseModel):
    word: str = Field(min_length=1)
    target_language: str = Field(default="English", min_length=1)
    context: str = Field(default="", min_length=0)


class DefineWordResponse(BaseModel):
    definition: str


def _load_settings() -> Settings:
    def _as_bool(name: str, default: bool) -> bool:
        value = os.getenv(name)
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    def _as_float(name: str, default: float) -> float:
        value = os.getenv(name)
        if value is None:
            return default
        try:
            return float(value)
        except ValueError:
            return default

    origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:8081,http://localhost:19006")
    cors_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]
    return Settings(
        cors_origins=cors_origins,
        ollama_host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        ollama_model=os.getenv("OLLAMA_MODEL", "hf.co/CohereLabs/tiny-aya-water-GGUF:Q8_0"),
        ollama_keep_alive=os.getenv("OLLAMA_KEEP_ALIVE", "5m"),
        align_log_metrics=_as_bool("ALIGN_LOG_METRICS", True),
        align_min_duration_sec=_as_float("ALIGN_MIN_DURATION_SEC", 0.2),
        align_min_speech_ratio=_as_float("ALIGN_MIN_SPEECH_RATIO", 0.05),
        align_min_rms=_as_float("ALIGN_MIN_RMS", 0.004),
        whisper_model=os.getenv("WHISPER_MODEL", "small"),
        whisper_language=os.getenv("WHISPER_LANGUAGE", "").strip().lower(),
    )


def _build_user_prompt(message: str, target_language: str) -> str:
    return (
        f"Target language: {target_language}\n"
        f"Learner message: {message}\n"
        "Reply as Hubert in a concise, learner-friendly way. "
        "Prefer examples in the target language."
    )


def _dedupe_repeated_text(content: str) -> str:
    cleaned = content.strip()
    if not cleaned:
        return cleaned

    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    deduped_lines: list[str] = []
    for line in lines:
        if not deduped_lines or deduped_lines[-1] != line:
            deduped_lines.append(line)

    cleaned = "\n".join(deduped_lines) if deduped_lines else cleaned

    half = len(cleaned) // 2
    if len(cleaned) > 40 and len(cleaned) % 2 == 0 and cleaned[:half].strip() == cleaned[half:].strip():
        cleaned = cleaned[:half].strip()

    return cleaned


def _sanitize_hubert_text(content: str) -> str:
    cleaned = re.sub(r"<[^>]*>", "", content)
    cleaned = cleaned.replace("*", "")
    cleaned = re.sub(r"(?im)^\s*hubert\s*:\s*", "", cleaned)
    cleaned = _dedupe_repeated_text(cleaned)
    return cleaned


def _chat_with_compat(client: Any, **kwargs: Any) -> Any:
    try:
        return client.chat(**kwargs)
    except TypeError:
        kwargs.pop("options", None)
        return client.chat(**kwargs)


def _decode_pcm16_wav(content: bytes) -> Any:
    if torch is None:
        raise HTTPException(status_code=503, detail="Torch is unavailable")

    def _normalize_waveform(raw_waveform: Any, sample_rate: int) -> Any:
        waveform = raw_waveform
        if waveform.ndim == 1:
            waveform = waveform.unsqueeze(0)

        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)

        if sample_rate != 16000:
            raise HTTPException(status_code=400, detail="Audio sample rate must be 16kHz")

        return waveform.float()

    def _decode_with_ffmpeg(blob: bytes) -> Any:
        with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as src:
            src.write(blob)
            src_path = src.name
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as dst:
            dst_path = dst.name

        try:
            ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe() if imageio_ffmpeg is not None else "ffmpeg"
            proc = subprocess.run(
                [ffmpeg_bin, "-y", "-i", src_path, "-ac", "1", "-ar", "16000", "-f", "wav", dst_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            if proc.returncode != 0:
                stderr = proc.stderr.decode("utf-8", errors="ignore").strip()
                raise RuntimeError(stderr or "ffmpeg failed to decode audio")
        except FileNotFoundError as exc:
            raise RuntimeError("FFmpeg is not available in PATH and imageio-ffmpeg is not installed") from exc

        try:
            with open(dst_path, "rb") as converted:
                converted_bytes = converted.read()
            with wave.open(io.BytesIO(converted_bytes), "rb") as wav_file:
                frames = wav_file.readframes(wav_file.getnframes())
            samples = array.array("h")
            samples.frombytes(frames)
            waveform = torch.tensor(samples, dtype=torch.float32).unsqueeze(0) / 32768.0
            return _normalize_waveform(waveform, 16000)
        finally:
            try:
                os.remove(src_path)
            except OSError:
                pass
            try:
                os.remove(dst_path)
            except OSError:
                pass

    try:
        with wave.open(io.BytesIO(content), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            compression = wav_file.getcomptype()

            if compression != "NONE" or channels != 1 or sample_width != 2 or sample_rate != 16000:
                raise ValueError("wav requires ffmpeg normalization")

            frames = wav_file.readframes(wav_file.getnframes())
    except Exception:
        try:
            return _decode_with_ffmpeg(content)
        except Exception as ffmpeg_exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid WAV file and transcoding failed: {ffmpeg_exc}",
            ) from ffmpeg_exc

    samples = array.array("h")
    samples.frombytes(frames)
    waveform = torch.tensor(samples, dtype=torch.float32).unsqueeze(0) / 32768.0
    return _normalize_waveform(waveform, 16000)


def _trim_speech_region(
    waveform: Any,
    sample_rate: int = 16000,
    threshold: float = 0.008,
    padding_ms: int = 220,
    min_samples: int = 1600,
) -> Any | None:
    if torch is None:
        return waveform

    if waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)

    mono = waveform[0].float().cpu()
    active = (mono.abs() > threshold).nonzero(as_tuple=False).flatten()
    if active.numel() == 0:
        return None

    pad = int(sample_rate * (padding_ms / 1000.0))
    start = max(0, int(active[0].item()) - pad)
    end = min(int(mono.numel()), int(active[-1].item()) + pad + 1)

    trimmed = waveform[:, start:end]
    if trimmed.shape[-1] < min_samples:
        return None

    return trimmed


def _normalise(text: str) -> str:
    lowered = text.lower().strip()
    decomposed = unicodedata.normalize("NFKD", lowered)
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", without_marks)


def _non_space_chars(text: str) -> list[str]:
    return [ch for ch in _normalise(text) if not ch.isspace()]


def _speech_metrics(waveform: Any) -> tuple[float, float, float]:
    audio = waveform[0] if waveform.ndim > 1 else waveform
    raw = audio.float().cpu()
    n_samples = int(raw.numel())
    if n_samples <= 0:
        return 0.0, 0.0, 0.0

    abs_audio = raw.abs()
    rms = float(raw.pow(2).mean().sqrt().item())
    speech_ratio = float((abs_audio > 0.02).float().mean().item())
    duration_sec = n_samples / 16000.0
    return rms, speech_ratio, duration_sec


def _energy_presence(waveform: Any, n_chars: int) -> list[float]:
    if n_chars <= 0:
        return []

    audio = waveform[0] if waveform.ndim > 1 else waveform
    raw = audio.float().cpu().abs()
    n_samples = int(raw.numel())
    if n_samples <= 0:
        return [0.0 for _ in range(n_chars)]

    per_char: list[float] = []
    for i in range(n_chars):
        s_start = (i * n_samples) // n_chars
        s_end = ((i + 1) * n_samples) // n_chars
        if s_end <= s_start:
            s_end = min(s_start + 1, n_samples)
        seg = raw[s_start:s_end]
        energy = float(seg.mean().item()) if seg.numel() > 0 else 0.0
        per_char.append(energy)

    peak = max(per_char) if per_char else 0.0
    if peak <= 1e-6:
        return [0.0 for _ in per_char]

    floor = max(0.002, 0.10 * peak)
    values: list[float] = []
    for energy in per_char:
        if energy <= floor:
            values.append(0.0)
        else:
            values.append(float(max(0.0, min(1.0, (energy - floor) / max(peak - floor, 1e-6)))))

    if len(values) >= 2:
        smoothed = values[:]
        for i in range(len(values)):
            if i == 0:
                neighbor_avg = values[1]
            elif i == len(values) - 1:
                neighbor_avg = values[-2]
            else:
                neighbor_avg = (values[i - 1] + values[i + 1]) / 2.0
            smoothed[i] = float(max(values[i], 0.45 * neighbor_avg))
        return [float(max(0.0, min(1.0, v))) for v in smoothed]

    return values


def _char_match_scores(target_text: str, transcript_text: str) -> list[float]:
    target = _non_space_chars(target_text)
    spoken = _non_space_chars(transcript_text)

    if not target:
        return []
    if not spoken:
        return [0.0 for _ in target]

    n_target = len(target)
    n_spoken = len(spoken)

    dp: list[list[int]] = [[0] * (n_spoken + 1) for _ in range(n_target + 1)]
    for i in range(n_target + 1):
        dp[i][0] = i
    for j in range(n_spoken + 1):
        dp[0][j] = j
    for i in range(1, n_target + 1):
        for j in range(1, n_spoken + 1):
            cost = 0 if target[i - 1] == spoken[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )

    matched_positions = [False] * n_target
    i, j = n_target, n_spoken
    while i > 0 and j > 0:
        if target[i - 1] == spoken[j - 1] and dp[i][j] == dp[i - 1][j - 1]:
            matched_positions[i - 1] = True
            i -= 1
            j -= 1
            continue
        if dp[i][j] == dp[i - 1][j - 1] + 1:
            i -= 1
            j -= 1
        elif dp[i][j] == dp[i - 1][j] + 1:
            i -= 1
        else:
            j -= 1

    match_ratio = sum(1 for flag in matched_positions if flag) / max(1, n_target)

    base_half_window = max(1, int(0.20 * n_spoken))
    edge_half_window = max(base_half_window, int(0.33 * n_spoken))
    edge_cutoff = max(1, int(0.20 * n_target))

    scores: list[float] = []
    for idx, ch in enumerate(target):
        expected = int((idx + 0.5) * n_spoken / n_target)
        half_window = edge_half_window if idx < edge_cutoff or idx >= (n_target - edge_cutoff) else base_half_window
        start = max(0, expected - half_window)
        end = min(n_spoken, expected + half_window + 1)
        local = spoken[start:end]

        if matched_positions[idx]:
            score = 0.95
        elif ch in local:
            score = 0.55
        elif ch in spoken:
            score = 0.35
        else:
            score = 0.05

        if match_ratio < 0.35:
            score = min(score, 0.35)
        elif match_ratio < 0.60:
            score = min(score, 0.68)

        scores.append(score)

    return [float(max(0.0, min(1.0, value))) for value in scores]


class PronunciationScorer:
    def __init__(self) -> None:
        if torch is None:
            raise RuntimeError("torch must be installed for pronunciation scoring")
        if whisper is None:
            raise RuntimeError("openai-whisper package is unavailable")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.whisper = whisper.load_model(settings.whisper_model, device=self.device)

    def _transcribe(self, waveform: Any, target_text: str, language: str | None = None) -> str:
        audio = waveform[0] if waveform.ndim > 1 else waveform
        arr = audio.float().cpu().numpy()

        lang = (language or settings.whisper_language or "").strip().lower() or None
        kwargs: dict[str, Any] = {
            "fp16": self.device == "cuda",
            "initial_prompt": target_text,
            "temperature": 0.0,
        }
        if lang:
            kwargs["language"] = lang

        result = self.whisper.transcribe(arr, **kwargs)
        return str(result.get("text", "")).strip()

    def score(
        self,
        waveform: Any,
        target_text: str,
        language: str | None = None,
        use_gates: bool = True,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        chars = [ch for ch in target_text if not ch.isspace()]
        if not chars:
            return [], {
                "score_method": "empty",
                "transcript": "",
                "duration_sec": 0.0,
                "speech_ratio": 0.0,
                "rms": 0.0,
                "spread_pre_gate": 0.0,
                "spread_post_gate": 0.0,
                "gates_applied": bool(use_gates),
            }

        rms, speech_ratio, duration_sec = _speech_metrics(waveform)
        if (
            duration_sec < settings.align_min_duration_sec
            or speech_ratio < settings.align_min_speech_ratio
            or rms < settings.align_min_rms
        ):
            zeroed = [{"character": ch, "score": 0.0} for ch in chars]
            return zeroed, {
                "score_method": "silent",
                "transcript": "",
                "duration_sec": duration_sec,
                "speech_ratio": speech_ratio,
                "rms": rms,
                "spread_pre_gate": 0.0,
                "spread_post_gate": 0.0,
                "gates_applied": bool(use_gates),
            }

        transcript = self._transcribe(waveform, target_text, language)
        pre_scores = _char_match_scores(target_text, transcript)
        presence = _energy_presence(waveform, len(pre_scores))
        avg_pre = (sum(pre_scores) / len(pre_scores)) if pre_scores else 0.0

        gated_scores = pre_scores
        if use_gates:
            if avg_pre >= 0.90:
                gate_base = 0.70
                gate_weight = 0.30
            elif avg_pre >= 0.75:
                gate_base = 0.55
                gate_weight = 0.45
            else:
                gate_base = 0.30
                gate_weight = 0.70

            gated_scores = [
                float(max(0.0, min(1.0, base * (gate_base + (gate_weight * energy)))))
                for base, energy in zip(pre_scores, presence)
            ]

        spread_pre = (max(pre_scores) - min(pre_scores)) if pre_scores else 0.0
        spread_post = (max(gated_scores) - min(gated_scores)) if gated_scores else 0.0

        payload = [
            {"character": ch, "score": float(max(0.0, min(1.0, sc)))}
            for ch, sc in zip(chars, gated_scores)
        ]

        return payload, {
            "score_method": "whisper_energy",
            "transcript": transcript,
            "duration_sec": duration_sec,
            "speech_ratio": speech_ratio,
            "rms": rms,
            "spread_pre_gate": spread_pre,
            "spread_post_gate": spread_post,
            "gates_applied": bool(use_gates),
            "gate_profile": "strong" if avg_pre < 0.75 else ("balanced" if avg_pre < 0.90 else "light"),
        }


BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

settings = _load_settings()
app = FastAPI(title="Mimic Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    if os.getenv("MIMIC_SKIP_MODEL_LOAD", "0") == "1":
        app.state.scorer = None
        app.state.scorer_error = "model loading disabled"
        return

    if torch is not None:
        torch.set_float32_matmul_precision("high")

    try:
        app.state.scorer = PronunciationScorer()
        app.state.scorer_error = ""
    except Exception as exc:  # pragma: no cover - startup resilience
        app.state.scorer = None
        app.state.scorer_error = str(exc)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "persona": "Hubert"}


@app.post("/align")
async def align(
    target_text: str = Form(..., min_length=1),
    mode: str = Form("default"),
    debug: str = Form("0"),
    language: str = Form(""),
    audio_file: UploadFile = File(...),
) -> Any:
    scorer = getattr(app.state, "scorer", None)
    if scorer is None:
        raise HTTPException(
            status_code=503,
            detail=f"Alignment model unavailable: {getattr(app.state, 'scorer_error', 'not initialized')}",
        )

    content = await audio_file.read()
    waveform = _decode_pcm16_wav(content)

    mode_value = mode.strip().lower()
    use_gates = mode_value != "legacy"
    debug_mode = debug.strip().lower() in {"1", "true", "yes", "on"}

    waveform_trimmed = _trim_speech_region(waveform)
    if waveform_trimmed is None:
        chars = [ch for ch in target_text if not ch.isspace()]
        zeros = [{"character": ch, "score": 0.0} for ch in chars]
        if debug_mode:
            return {
                "scores": [dict(row, score_pre_gate=0.0) for row in zeros],
                "debug": {
                    "score_method": "silent",
                    "transcript": "",
                    "duration_sec": 0.0,
                    "speech_ratio": 0.0,
                    "rms": 0.0,
                    "spread_pre_gate": 0.0,
                    "spread_post_gate": 0.0,
                    "gates_applied": bool(use_gates),
                },
            }
        return {"scores": zeros, "transcript": ""}

    lang = language.strip().lower() or None

    if debug_mode:
        pre_scores, pre_info = scorer.score(waveform_trimmed, target_text, language=lang, use_gates=False)
        post_scores, post_info = scorer.score(waveform_trimmed, target_text, language=lang, use_gates=use_gates)

        pre_map = {row["character"]: row["score"] for row in pre_scores}
        payload_scores = [
            {
                "character": row["character"],
                "score": row["score"],
                "score_pre_gate": pre_map.get(row["character"], row["score"]),
            }
            for row in post_scores
        ]

        if settings.align_log_metrics:
            logger.info(
                "align method=%s gates=%s duration=%.3f speech_ratio=%.3f rms=%.6f spread_pre=%.3f spread_post=%.3f chars=%d",
                post_info.get("score_method", "unknown"),
                post_info.get("gates_applied", False),
                post_info.get("duration_sec", 0.0),
                post_info.get("speech_ratio", 0.0),
                post_info.get("rms", 0.0),
                pre_info.get("spread_post_gate", 0.0),
                post_info.get("spread_post_gate", 0.0),
                len(post_scores),
            )

        return {
            "scores": payload_scores,
            "debug": {
                "score_method": post_info.get("score_method", "unknown"),
                "transcript": post_info.get("transcript", ""),
                "duration_sec": post_info.get("duration_sec", 0.0),
                "speech_ratio": post_info.get("speech_ratio", 0.0),
                "rms": post_info.get("rms", 0.0),
                "spread_pre_gate": pre_info.get("spread_post_gate", 0.0),
                "spread_post_gate": post_info.get("spread_post_gate", 0.0),
                "gates_applied": bool(use_gates),
            },
        }

    scores, info = scorer.score(waveform_trimmed, target_text, language=lang, use_gates=use_gates)

    if settings.align_log_metrics:
        logger.info(
            "align method=%s gates=%s duration=%.3f speech_ratio=%.3f rms=%.6f spread=%.3f chars=%d",
            info.get("score_method", "unknown"),
            info.get("gates_applied", False),
            info.get("duration_sec", 0.0),
            info.get("speech_ratio", 0.0),
            info.get("rms", 0.0),
            info.get("spread_post_gate", 0.0),
            len(scores),
        )

    return {"scores": scores, "transcript": info.get("transcript", "")}


@app.post("/tutor_chat", response_model=TutorChatResponse)
def tutor_chat(payload: TutorChatRequest) -> TutorChatResponse:
    if ollama is None:
        raise HTTPException(status_code=503, detail="ollama package is unavailable")

    client = ollama.Client(host=settings.ollama_host)
    user_prompt = _build_user_prompt(payload.message, payload.target_language)

    try:
        response = _chat_with_compat(
            client,
            model=settings.ollama_model,
            messages=[{"role": "user", "content": user_prompt}],
            stream=False,
            keep_alive=settings.ollama_keep_alive,
            options={"temperature": 0.2},
        )
        content = response.get("message", {}).get("content", "")
        content = _sanitize_hubert_text(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {exc}") from exc

    return TutorChatResponse(response=content)


@app.post("/tutor_unload", response_model=TutorUnloadResponse)
def tutor_unload() -> TutorUnloadResponse:
    if ollama is None:
        raise HTTPException(status_code=503, detail="ollama package is unavailable")

    client = ollama.Client(host=settings.ollama_host)

    try:
        client.generate(model=settings.ollama_model, prompt="", keep_alive=0)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama unload failed: {exc}") from exc

    return TutorUnloadResponse(status="unloaded")


@app.post("/define_word", response_model=DefineWordResponse)
def define_word(payload: DefineWordRequest) -> DefineWordResponse:
    if ollama is None:
        raise HTTPException(status_code=503, detail="ollama package is unavailable")

    client = ollama.Client(host=settings.ollama_host)
    prompt = (
        f"What does this word mean in {payload.target_language}: {payload.word}?\n"
        f"Context: {payload.context}\n"
        "Give a short learner-friendly definition."
    )

    try:
        response = _chat_with_compat(
            client,
            model=settings.ollama_model,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            keep_alive=settings.ollama_keep_alive,
            options={"temperature": 0.2},
        )
        content = response.get("message", {}).get("content", "").strip()
        content = _sanitize_hubert_text(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {exc}") from exc

    return DefineWordResponse(definition=content or "No definition available.")
