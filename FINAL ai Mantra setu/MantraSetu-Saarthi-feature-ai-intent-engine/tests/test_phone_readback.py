import sys
import os
import unittest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.orchestrator.pandit_onboarding import (
    format_phone_for_speech,
    build_phone_confirmation_prompt,
    format_value_for_display,
    normalize_spoken_input,
    _validate_phone,
)

class TestPhoneReadbackConfirmation(unittest.TestCase):
    
    def test_phone_readback_all_cases(self):
        test_cases = [
            {
                "phone": "6123456789",
                "expected_formatted": "six, one, two, three, four, five, six, seven, eight, nine",
                "expected_prompt": "Maine suna — 6123456789. Kya ye sahi hai?"
            },
            {
                "phone": "7234567890",
                "expected_formatted": "seven, two, three, four, five, six, seven, eight, nine, zero",
                "expected_prompt": "Maine suna — 7234567890. Kya ye sahi hai?"
            },
            {
                "phone": "8318094577",
                "expected_formatted": "eight, three, one, eight, zero, nine, four, five, seven, seven",
                "expected_prompt": "Maine suna — 8318094577. Kya ye sahi hai?"
            },
            {
                "phone": "9456789012",
                "expected_formatted": "nine, four, five, six, seven, eight, nine, zero, one, two",
                "expected_prompt": "Maine suna — 9456789012. Kya ye sahi hai?"
            },
            {
                "phone": "8809876543",
                "expected_formatted": "eight, eight, zero, nine, eight, seven, six, five, four, three",
                "expected_prompt": "Maine suna — 8809876543. Kya ye sahi hai?"
            },
            {
                "phone": "7712345678",
                "expected_formatted": "seven, seven, one, two, three, four, five, six, seven, eight",
                "expected_prompt": "Maine suna — 7712345678. Kya ye sahi hai?"
            },
        ]
        
        for tc in test_cases:
            phone = tc["phone"]
            expected_fmt = tc["expected_formatted"]
            expected_prompt = tc["expected_prompt"]
            
            actual_fmt = format_phone_for_speech(phone)
            self.assertEqual(actual_fmt, expected_fmt)
            
            actual_prompt = build_phone_confirmation_prompt(phone)
            self.assertEqual(actual_prompt, expected_prompt)
            
            actual_disp = format_value_for_display(phone)
            self.assertEqual(actual_disp, phone)
            
            val_res = _validate_phone(phone, {})
            self.assertTrue(val_res.is_valid)
            self.assertEqual(val_res.cleaned_value, phone)

    def test_stt_acoustic_duplicate_recovery(self):
        stt_raw = "एट एट थ्री वन एट जीरो नाइन फोर फाइव सेवन सेवन।"
        normalized = normalize_spoken_input(stt_raw, "pandit-phone")
        self.assertEqual(normalized, "8318094577")
        
        val_res = _validate_phone("88318094577", {})
        self.assertTrue(val_res.is_valid)
        self.assertEqual(val_res.cleaned_value, "8318094577")

    def test_invalid_starting_digit_rejected(self):
        val_res = _validate_phone("5123456789", {})
        self.assertFalse(val_res.is_valid)
        self.assertIn("6, 7, 8 ya 9 se shuru hona chahiye", val_res.error_message)

if __name__ == "__main__":
    unittest.main()
