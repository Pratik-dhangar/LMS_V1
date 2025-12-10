import requests
import urllib.parse

# Test the endpoint
learner_id = 14
program_name = "Yes/No Identification"
encoded_program = urllib.parse.quote(program_name, safe='')

url = f"http://127.0.0.1:8000/api/session-reports/learner/{learner_id}/program/{encoded_program}/sessions"

print(f"Testing URL: {url}")
print(f"Program name: {program_name}")
print(f"Encoded: {encoded_program}")

try:
    # Try without authentication first to see the error
    response = requests.get(url)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"\nError: {e}")
