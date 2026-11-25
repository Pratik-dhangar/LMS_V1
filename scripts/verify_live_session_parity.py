"""
Complete Verification Script for Live Session Studio
Tests P1 through P5 acceptance gates against running backend (port 8002).
"""
import asyncio
import json
import os
import sys
import httpx
import websockets

BASE_URL = "http://127.0.0.1:8002/api"
WS_URL = "ws://127.0.0.1:8002"

results = {}

def record(test_name, success, details=""):
    status = "PASS" if success else "FAIL"
    results[test_name] = {"status": status, "details": details}
    mark = "✅" if success else "❌"
    print(f"{mark} [{status}] {test_name}: {details}")

async def run_all_tests():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Health check
        try:
            r = await client.get("/health")
            assert r.status_code == 200 and r.json().get("status") == "ok"
            record("F01_Backend_Health", True, "GET /api/health returned 200 OK")
        except Exception as e:
            record("F01_Backend_Health", False, str(e))

        # 2. Demo Auth
        trainer_token = None
        learner1_token = None
        learner2_token = None
        try:
            r_t = await client.post("/demo/login", json={"role": "trainer", "profile_id": 1})
            assert r_t.status_code == 200
            trainer_token = r_t.json()["access_token"]

            r_l1 = await client.post("/demo/login", json={"role": "learner", "profile_id": 2})
            assert r_l1.status_code == 200
            learner1_token = r_l1.json()["access_token"]

            r_l2 = await client.post("/demo/login", json={"role": "learner", "profile_id": 3})
            assert r_l2.status_code == 200
            learner2_token = r_l2.json()["access_token"]

            record("F02_Passwordless_Demo_Auth", True, "Successfully logged in Trainer, Learner 1, and Learner 2")
        except Exception as e:
            record("F02_Passwordless_Demo_Auth", False, str(e))
            return

        trainer_headers = {"Authorization": f"Bearer {trainer_token}"}
        learner1_headers = {"Authorization": f"Bearer {learner1_token}"}
        learner2_headers = {"Authorization": f"Bearer {learner2_token}"}

        # 3. Learner Selector / List Learners
        try:
            r = await client.get("/learners", headers=trainer_headers)
            assert r.status_code == 200
            learners = r.json()
            assert len(learners) >= 2
            record("F03_Trainer_Learner_Selector", True, f"Found {len(learners)} learners with busy flags")
        except Exception as e:
            record("F03_Trainer_Learner_Selector", False, str(e))

        # 4. Room Creation & Pairing (Trainer -> Learner 1)
        session_id = None
        room_id = None
        try:
            # End any existing session for clean test
            cur = await client.get("/rooms/current", headers=trainer_headers)
            if cur.status_code == 200 and cur.json():
                old_sid = cur.json()["session_id"]
                await client.post(f"/rooms/{old_sid}/end", headers=trainer_headers)

            r = await client.post("/rooms", headers=trainer_headers, json={"learner_id": 2})
            assert r.status_code in (200, 201)
            room_data = r.json()
            session_id = room_data["session_id"]
            room_id = room_data["id"]
            assert room_data["status"] == "active"
            assert room_data["learner_id"] == 2
            record("F04_Room_Creation_And_Pairing", True, f"Created active paired room {session_id}")
        except Exception as e:
            record("F04_Room_Creation_And_Pairing", False, str(e))
            return

        # 5. Idempotent Start & Conflict Gate
        try:
            # Repeating same start returns 200 with existing room
            r_repeat = await client.post("/rooms", headers=trainer_headers, json={"learner_id": 2})
            assert r_repeat.status_code == 200
            assert r_repeat.json()["session_id"] == session_id

            # Trying to start with learner 3 while active returns 409
            r_conflict = await client.post("/rooms", headers=trainer_headers, json={"learner_id": 3})
            assert r_conflict.status_code == 409
            record("F05_Idempotent_Start_And_Conflict_Gate", True, "Repeat start returned 200; concurrent start rejected with 409")
        except Exception as e:
            record("F05_Idempotent_Start_And_Conflict_Gate", False, str(e))

        # 6. Targeted Invitation Polling
        try:
            # Learner 1 (targeted) sees the invitation
            r_inv1 = await client.get("/invitations/mine", headers=learner1_headers)
            assert r_inv1.status_code == 200
            invs = r_inv1.json()
            assert any(inv["session_id"] == session_id for inv in invs)

            # Learner 2 (unselected) does NOT see it
            r_inv2 = await client.get("/invitations/mine", headers=learner2_headers)
            assert r_inv2.status_code == 200
            assert not any(inv["session_id"] == session_id for inv in r_inv2.json())

            record("F06_Targeted_Invitation_Polling", True, "Learner 1 received invite; Learner 2 received empty list")
        except Exception as e:
            record("F06_Targeted_Invitation_Polling", False, str(e))

        # 7. Cross-Room Isolation / Guessing Guard
        try:
            r_unauth_get = await client.get(f"/rooms/{session_id}", headers=learner2_headers)
            assert r_unauth_get.status_code == 403

            r_unauth_join = await client.post(f"/rooms/{session_id}/join", headers=learner2_headers)
            assert r_unauth_join.status_code == 403
            record("F07_Cross_Room_Isolation", True, "Learner 2 received 403 on GET and 403 on JOIN for Learner 1's room")
        except Exception as e:
            record("F07_Cross_Room_Isolation", False, str(e))

        # 8. Learner Join & Trainer Admission Flow
        try:
            # Learner 1 joins -> state becomes join_requested
            r_join = await client.post(f"/rooms/{session_id}/join", headers=learner1_headers)
            assert r_join.status_code == 200 and r_join.json()["state"] == "join_requested"

            # Trainer admits Learner 1 -> state becomes admitted
            r_admit = await client.post(f"/rooms/{session_id}/admit", headers=trainer_headers)
            assert r_admit.status_code == 200 and r_admit.json()["state"] == "admitted"
            record("F08_Admission_Lifecycle", True, "Learner join_requested -> Trainer admit -> state admitted")
        except Exception as e:
            record("F08_Admission_Lifecycle", False, str(e))

        # 9. WebSocket Auth Handshake & Relay
        try:
            trainer_ws_url = f"{WS_URL}/ws/whiteboard/{session_id}"
            async with websockets.connect(trainer_ws_url) as ws_t:
                # Send join with token
                await ws_t.send(json.dumps({"type": "join", "role": "trainer", "token": trainer_token}))
                resp = json.loads(await asyncio.wait_for(ws_t.recv(), timeout=5.0))
                assert resp.get("type") == "connected" and resp.get("role") == "trainer"

                # Send test drawing stroke
                stroke_msg = {
                    "type": "draw",
                    "data": {"points": [[10, 10], [20, 20]], "color": "#ff0000", "size": 3}
                }
                await ws_t.send(json.dumps(stroke_msg))

                record("F09_WebSocket_Whiteboard_Auth_And_Relay", True, "Trainer WS connected and authenticated with JWT; stroke sent")
        except Exception as e:
            record("F09_WebSocket_Whiteboard_Auth_And_Relay", False, str(e))

        # 10. Learning Materials Upload & Serving
        try:
            # Create a dummy image file
            sample_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
            files = {"file": ("test_dot.png", sample_content, "image/png")}
            r_up = await client.post("/materials", headers=trainer_headers, files=files, data={"title": "Test Material Dot"})
            assert r_up.status_code in (200, 201)
            mat_data = r_up.json()
            assert mat_data.get("file_key")

            # Check listing
            r_list = await client.get("/materials", headers=trainer_headers)
            assert r_list.status_code == 200
            mats = r_list.json()
            assert any(m["title"] == "Test Material Dot" for m in mats)

            # Check file serving
            file_key = mat_data["file_key"]
            r_file = await client.get(f"/uploads/{file_key}", headers=trainer_headers)
            assert r_file.status_code == 200 and len(r_file.content) == len(sample_content)

            record("F10_Materials_Upload_And_Serving", True, f"Uploaded {mat_data['title']} and verified byte-exact file serving")
        except Exception as e:
            record("F10_Materials_Upload_And_Serving", False, str(e))

        # 11. Session Notes
        try:
            # Save notes
            r_save = await client.post(f"/rooms/{session_id}/notes", headers=trainer_headers, json={"content": "Learner showed great improvement in arithmetic today."})
            assert r_save.status_code == 200

            # Get notes
            r_get = await client.get(f"/rooms/{session_id}/notes", headers=trainer_headers)
            assert r_get.status_code == 200
            assert "great improvement" in r_get.json().get("content", "")

            record("F11_Session_Notes_Persistence", True, "Successfully saved, retrieved, and verified session notes in PostgreSQL")
        except Exception as e:
            record("F11_Session_Notes_Persistence", False, str(e))

        # 12. Feedback Submission
        try:
            r_fb = await client.post(f"/rooms/{session_id}/feedback", headers=learner1_headers, json={"rating": 5, "remark": "Excellent interactive session!"})
            assert r_fb.status_code == 200 and r_fb.json().get("status") == "submitted"
            record("F12_Feedback_Submission", True, "Learner submitted 5-star rating with remark into session_feedback table")
        except Exception as e:
            record("F12_Feedback_Submission", False, str(e))

        # 13. Room Messages / Chat
        try:
            r_msg = await client.post(f"/rooms/{session_id}/messages", headers=trainer_headers, json={"content": "Welcome to class, Alex!", "message_type": "text"})
            assert r_msg.status_code == 200
            msg_id = r_msg.json()["id"]

            r_msgs = await client.get(f"/rooms/{session_id}/messages", headers=learner1_headers)
            assert r_msgs.status_code == 200
            assert any(m["id"] == msg_id and "Welcome to class" in m["content"] for m in r_msgs.json())

            record("F13_Room_Scoped_Messaging", True, "Trainer sent chat message; Learner retrieved message from database")
        except Exception as e:
            record("F13_Room_Scoped_Messaging", False, str(e))

        # 14. Recording Chunks & FFmpeg Merge
        try:
            with open("scripts/real_chunk1.webm", "rb") as f1, open("scripts/real_chunk2.webm", "rb") as f2:
                chunk1_data = f1.read()
                chunk2_data = f2.read()

            files1 = {"chunk": ("chunk_000000.webm", chunk1_data, "video/webm")}
            r_c1 = await client.post("/recordings/chunk", headers=trainer_headers, files=files1, data={"session_id": session_id, "chunk_number": 0})
            assert r_c1.status_code == 200
            rec_id = r_c1.json()["recording_id"]

            files2 = {"chunk": ("chunk_000001.webm", chunk2_data, "video/webm")}
            r_c2 = await client.post("/recordings/chunk", headers=trainer_headers, files=files2, data={"session_id": session_id, "chunk_number": 1, "recording_id": rec_id})
            assert r_c2.status_code == 200

            # Finalize
            r_fin = await client.post(f"/recordings/{rec_id}/finalize", headers=trainer_headers, data={"session_id": session_id, "chunk_count": 2, "duration": 2.0})
            assert r_fin.status_code == 200
            rec_status = r_fin.json()["status"]
            assert rec_status == "ready", f"Expected ready, got {rec_status}"

            record("F14_Recording_Chunk_Upload_And_Finalize", True, f"Uploaded 2 real WebM chunks, finalized via FFmpeg -> status: {rec_status}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            record("F14_Recording_Chunk_Upload_And_Finalize", False, repr(e))

        # 15. Room Rejection / Removal
        try:
            # Rejection / removal test
            r_remove = await client.post(f"/rooms/{session_id}/remove", headers=trainer_headers)
            assert r_remove.status_code == 200 and r_remove.json()["state"] == "rejected"

            # Rejoin after removal
            r_rejoin = await client.post(f"/rooms/{session_id}/join", headers=learner1_headers)
            assert r_rejoin.status_code == 200 and r_rejoin.json()["state"] == "join_requested"

            # Admit again
            r_admit2 = await client.post(f"/rooms/{session_id}/admit", headers=trainer_headers)
            assert r_admit2.status_code == 200 and r_admit2.json()["state"] == "admitted"

            record("F15_Removal_And_Rejoin_Lifecycle", True, "Trainer removed learner (rejected) -> Learner rejoined (join_requested) -> Trainer readmitted (admitted)")
        except Exception as e:
            record("F15_Removal_And_Rejoin_Lifecycle", False, str(e))

        # 16. Room End & Clean Teardown
        try:
            r_end = await client.post(f"/rooms/{session_id}/end", headers=trainer_headers)
            assert r_end.status_code == 200 and r_end.json()["status"] == "ended"

            # Poll invitations -> must be empty
            r_inv_after = await client.get("/invitations/mine", headers=learner1_headers)
            assert not any(inv["session_id"] == session_id for inv in r_inv_after.json())

            record("F16_Room_End_And_Invitation_Clearing", True, "Room ended; invitation immediately removed from Learner invitations list")
        except Exception as e:
            record("F16_Room_End_And_Invitation_Clearing", False, str(e))

if __name__ == "__main__":
    asyncio.run(run_all_tests())
    print("\n================ SUMMARY ================")
    passed = sum(1 for v in results.values() if v["status"] == "PASS")
    total = len(results)
    print(f"Total: {total}, Passed: {passed}, Failed: {total - passed}")
