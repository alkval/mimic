"""test_main.py — tests for Whisper-based pronunciation scoring."""

from __future__ import annotations

import math
import os
import unittest

os.environ.setdefault("MIMIC_SKIP_MODEL_LOAD", "1")

SAMPLE_RATE = 16_000


def _sine(duration: float = 1.0, amp: float = 0.3, freq: float = 200.0):
    import torch

    n = int(SAMPLE_RATE * duration)
    t = torch.linspace(0.0, duration, n)
    return (torch.sin(2 * math.pi * freq * t) * amp).unsqueeze(0)


def _silence(duration: float = 1.0):
    import torch

    return torch.zeros(1, int(SAMPLE_RATE * duration))


def _noise(duration: float = 1.0, amp: float = 0.1):
    import torch

    return torch.randn(1, int(SAMPLE_RATE * duration)) * amp


class TestCharMatchScores(unittest.TestCase):
    def _s(self, target: str, transcript: str):
        from main import _char_match_scores

        return _char_match_scores(target, transcript)

    def test_perfect_match_scores_high(self):
        scores = self._s("hi", "hi")
        self.assertTrue(all(s >= 0.75 for s in scores), f"Perfect match should score >= 0.75, got {scores}")

    def test_empty_transcript_all_zero(self):
        scores = self._s("hello", "")
        self.assertTrue(all(s == 0.0 for s in scores), f"Empty transcript must be all 0.0, got {scores}")

    def test_completely_wrong_scores_low(self):
        scores = self._s("hello", "zzzzz")
        self.assertTrue(all(s <= 0.55 for s in scores), f"Wrong transcript should score low, got {scores}")

    def test_output_length_matches_target_non_space_chars(self):
        from main import _non_space_chars

        target = "hi there"
        scores = self._s(target, "hi there")
        self.assertEqual(len(scores), len(_non_space_chars(target)))

    def test_good_beats_gibberish(self):
        good = self._s("hello world", "hello world")
        bad = self._s("hello world", "xkqzwp brtvy")
        good_mean = sum(good) / len(good)
        bad_mean = sum(bad) / len(bad)
        self.assertGreater(good_mean - bad_mean, 0.3)

    def test_gibberish_cannot_spike_single_char_to_near_perfect(self):
        # Transcript can accidentally share one character (for example 'i'),
        # but this should not yield a near-perfect isolated score.
        scores = self._s("hi there", "pis pis pis pis")
        self.assertLess(max(scores), 0.6, f"Unexpected gibberish spike: {scores}")

    def test_partial_match_between_good_and_bad(self):
        perfect = sum(self._s("hello", "hello")) / 5
        half = sum(self._s("hello", "hxlxo")) / 5
        zero = sum(self._s("hello", "")) / 5
        self.assertGreater(perfect, half)
        self.assertGreater(half, zero)

    def test_scores_bounded(self):
        for target, transcript in [("hi", "hi"), ("hi", ""), ("hi", "xyz"), ("hello world", "hello world")]:
            for s in self._s(target, transcript):
                self.assertGreaterEqual(s, 0.0)
                self.assertLessEqual(s, 1.0)

    def test_deterministic(self):
        from main import _char_match_scores

        r1 = _char_match_scores("pronunciation", "prononsiation")
        r2 = _char_match_scores("pronunciation", "prononsiation")
        self.assertEqual(r1, r2)

    def test_no_fixed_bucket(self):
        s1 = self._s("hi there", "hi there")
        s2 = self._s("hi there", "xq zyzyx")
        self.assertNotEqual(s1, s2)

    def test_first_char_not_zero_on_correct(self):
        scores = self._s("hello", "hello")
        self.assertGreater(scores[0], 0.5)

    def test_last_char_not_zero_on_correct(self):
        scores = self._s("hello", "hello")
        self.assertGreater(scores[-1], 0.5)

    def test_french_accents_normalised(self):
        scores = self._s("cafe", "cafe")
        mean = sum(scores) / len(scores)
        self.assertGreater(mean, 0.6)


class TestNormalise(unittest.TestCase):
    def test_lowercase(self):
        from main import _normalise

        self.assertEqual(_normalise("Hello"), "hello")

    def test_strips_accents(self):
        from main import _normalise

        self.assertEqual(_normalise("cafe"), "cafe")
        self.assertEqual(_normalise("uber"), "uber")

    def test_collapses_whitespace(self):
        from main import _normalise

        self.assertEqual(_normalise("hi  there"), "hi there")


class TestSpeechMetrics(unittest.TestCase):
    def test_silence_low_rms(self):
        from main import _speech_metrics

        rms, ratio, dur = _speech_metrics(_silence(1.0))
        self.assertLess(rms, 0.001)
        self.assertLess(ratio, 0.01)
        self.assertAlmostEqual(dur, 1.0, places=1)

    def test_tone_nonzero_rms(self):
        from main import _speech_metrics

        rms, ratio, dur = _speech_metrics(_sine(1.0))
        self.assertGreater(rms, 0.1)
        self.assertGreaterEqual(ratio, 0.0)
        self.assertAlmostEqual(dur, 1.0, places=1)


class TestEnergyPresence(unittest.TestCase):
    def test_silence_all_zero(self):
        from main import _energy_presence

        p = _energy_presence(_silence(1.0), 5)
        self.assertTrue(all(v == 0.0 for v in p), f"Silence should be all 0, got {p}")

    def test_tone_has_nonzero_presence(self):
        from main import _energy_presence

        p = _energy_presence(_sine(1.0), 5)
        self.assertTrue(any(v > 0.0 for v in p), f"Tone should have nonzero values, got {p}")

    def test_length_matches_n_chars(self):
        from main import _energy_presence

        for n in [1, 3, 7, 12]:
            self.assertEqual(len(_energy_presence(_sine(1.0), n)), n)

    def test_output_bounded(self):
        from main import _energy_presence

        for v in _energy_presence(_sine(1.0), 8):
            self.assertGreaterEqual(v, 0.0)
            self.assertLessEqual(v, 1.0)


class TestSilenceGate(unittest.TestCase):
    def _make_scorer(self):
        import importlib
        import main as m

        importlib.reload(m)
        scorer = m.PronunciationScorer.__new__(m.PronunciationScorer)
        scorer.device = "cpu"
        scorer.whisper = None
        return scorer, m

    def test_silence_all_zero(self):
        scorer, m = self._make_scorer()

        def fake_transcribe(_waveform, _target, language=None):
            return "hi"

        scorer._transcribe = fake_transcribe
        wf = _silence(0.05)
        scores, info = scorer.score(wf, "hi")
        self.assertTrue(all(s["score"] == 0.0 for s in scores), f"Silent audio must be 0.0, got {scores}")
        self.assertEqual(info["score_method"], "silent")


class TestEndpoints(unittest.TestCase):
    def _wav_bytes(self, amplitude: int = 100, n_samples: int = 1600) -> bytes:
        import io
        import struct
        import wave

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(struct.pack("<" + "h" * n_samples, *([amplitude] * n_samples)))
        buf.seek(0)
        return buf.read()

    def setUp(self):
        from fastapi.testclient import TestClient
        from main import app

        self.client = TestClient(app)

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")

    def test_align_503_no_model(self):
        r = self.client.post(
            "/align",
            data={"target_text": "hi", "mode": "default", "debug": "0", "language": ""},
            files={"audio_file": ("t.wav", self._wav_bytes(), "audio/wav")},
        )
        self.assertEqual(r.status_code, 503)

    def test_align_debug_503_no_model(self):
        r = self.client.post(
            "/align",
            data={"target_text": "hi", "mode": "default", "debug": "1", "language": ""},
            files={"audio_file": ("t.wav", self._wav_bytes(), "audio/wav")},
        )
        self.assertEqual(r.status_code, 503)

    def test_align_accepts_language_param(self):
        r = self.client.post(
            "/align",
            data={"target_text": "bonjour", "language": "fr", "debug": "0"},
            files={"audio_file": ("t.wav", self._wav_bytes(), "audio/wav")},
        )
        self.assertNotEqual(r.status_code, 422, f"language param caused 422: {r.text}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
