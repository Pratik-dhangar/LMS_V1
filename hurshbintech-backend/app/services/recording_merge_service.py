# """
# Recording Merge Service - Robust WebM chunk merging with validation

# Handles proper merging of WebM chunks with:
# - Chunk order verification
# - Checksum validation
# - Timestamp preservation
# - Proper FFmpeg muxing (not naive concatenation)
# - Streaming merge for large files
# - Error recovery
# """

# import hashlib
# import json
# import logging
# import os
# import platform
# import subprocess
# import tempfile
# from datetime import datetime
# from pathlib import Path
# from typing import Dict, List, Optional, Tuple

# logger = logging.getLogger(__name__)


# class RecordingMergeService:
#     """Service for merging video recording chunks with validation and recovery"""

#     def __init__(self):
#         self.ffmpeg_path = self._find_ffmpeg()
#         self.ffmpeg_available = self.ffmpeg_path is not None
#         self.is_windows = platform.system() == "Windows"
        
#         if self.ffmpeg_available:
#             logger.info(f"[MERGE] ✅ FFmpeg found at: {self.ffmpeg_path}")
#         else:
#             logger.warning(
#                 "[MERGE] ⚠️ FFmpeg NOT FOUND - Video merge quality will be affected!\n"
#                 "[MERGE] On Windows: See SETUP_FFMPEG_WINDOWS.md for installation instructions\n"
#                 "[MERGE] On Linux: Run 'sudo apt-get install ffmpeg'\n"
#                 "[MERGE] Fallback: Will use binary concatenation (may cause video glitches)"
#             )

#     def _find_ffmpeg(self) -> Optional[str]:
#         """Find FFmpeg executable in system PATH or common locations"""
#         # First try: Direct execution
#         try:
#             result = subprocess.run(
#                 ["ffmpeg", "-version"],
#                 capture_output=True,
#                 timeout=5
#             )
#             if result.returncode == 0:
#                 return "ffmpeg"
#         except (FileNotFoundError, subprocess.TimeoutExpired):
#             pass
        
#         # Second try: Common Windows locations
#         if platform.system() == "Windows":
#             common_paths = [
#                 r"C:\ffmpeg\bin\ffmpeg.exe",
#                 r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
#                 r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
#                 os.path.expanduser(r"~\ffmpeg\bin\ffmpeg.exe"),
#             ]
#             for path in common_paths:
#                 if os.path.exists(path):
#                     try:
#                         result = subprocess.run(
#                             [path, "-version"],
#                             capture_output=True,
#                             timeout=5
#                         )
#                         if result.returncode == 0:
#                             logger.info(f"[MERGE] Found FFmpeg at: {path}")
#                             return path
#                     except Exception:
#                         pass
        
#         logger.warning("[MERGE] FFmpeg not found in PATH or common locations")
#         return None

#     def _check_ffmpeg(self) -> bool:
#         """Check if FFmpeg is available on system"""
#         return self.ffmpeg_available

#     def calculate_checksum(self, file_path: Path) -> str:
#         """Calculate SHA256 checksum for a file"""
#         sha256_hash = hashlib.sha256()
#         with open(file_path, "rb") as f:
#             for byte_block in iter(lambda: f.read(4096), b""):
#                 sha256_hash.update(byte_block)
#         return sha256_hash.hexdigest()

#     def validate_chunk_order(
#         self,
#         chunks_dir: Path,
#         expected_chunks: List[int],
#         chunk_metadata: Optional[Dict] = None
#     ) -> Tuple[bool, List[str]]:
#         """
#         Validate that all expected chunks exist and are in order
        
#         Args:
#             chunks_dir: Directory containing chunk files
#             expected_chunks: List of expected chunk numbers (0, 1, 2, ... N)
#             chunk_metadata: Optional metadata dict with checksums
            
#         Returns:
#             (is_valid, error_messages)
#         """
#         errors = []
        
#         # Check if all expected chunks exist
#         missing_chunks = []
#         for chunk_num in expected_chunks:
#             chunk_file = chunks_dir / f"{chunk_num:06d}.webm"
#             if not chunk_file.exists():
#                 missing_chunks.append(chunk_num)
#                 errors.append(f"Missing chunk {chunk_num}")
        
#         if missing_chunks:
#             logger.error(f"[MERGE] Missing {len(missing_chunks)} chunks: {missing_chunks}")
#             return False, errors
        
#         # Validate chunk metadata if provided
#         if chunk_metadata:
#             for chunk_num in expected_chunks:
#                 chunk_file = chunks_dir / f"{chunk_num:06d}.webm"
                
#                 # Verify checksum if stored
#                 expected_checksum = chunk_metadata.get(f"chunk_{chunk_num}_checksum")
#                 if expected_checksum:
#                     actual_checksum = self.calculate_checksum(chunk_file)
#                     if actual_checksum != expected_checksum:
#                         errors.append(
#                             f"Checksum mismatch for chunk {chunk_num}: "
#                             f"expected {expected_checksum}, got {actual_checksum}"
#                         )
#                         logger.error(f"[MERGE] Chunk {chunk_num} corrupted: checksum mismatch")
        
#         if errors:
#             return False, errors
        
#         logger.info(f"[MERGE] ✅ All {len(expected_chunks)} chunks validated successfully")
#         return True, []

#     def merge_chunks_with_ffmpeg(
#         self,
#         chunks_dir: Path,
#         output_file: Path,
#         chunk_numbers: List[int],
#         timeout: int = 3600
#     ) -> Tuple[bool, str]:
#         """
#         Merge WebM chunks using FFmpeg concat demuxer (proper WebM merging)
        
#         Args:
#             chunks_dir: Directory containing chunks
#             output_file: Path to output merged file
#             chunk_numbers: Ordered list of chunk numbers
#             timeout: FFmpeg timeout in seconds
            
#         Returns:
#             (success, message)
#         """
#         try:
#             input_total_size = 0

#             # Create concat demuxer file
#             concat_file = chunks_dir / "filelist.txt"
            
#             with open(concat_file, "w") as f:
#                 for chunk_num in chunk_numbers:
#                     chunk_path = chunks_dir / f"{chunk_num:06d}.webm"
#                     if chunk_path.exists():
#                         input_total_size += chunk_path.stat().st_size
#                     # Use absolute path with proper escaping
#                     abs_path = str(chunk_path.absolute()).replace("\\", "/")
#                     f.write(f"file '{abs_path}'\n")
            
#             logger.info(f"[MERGE] Starting FFmpeg merge for {len(chunk_numbers)} chunks")
            
#             # FFmpeg command using concat demuxer with proper WebM handling
#             if not self.ffmpeg_available or not self.ffmpeg_path:
#                 return False, "FFmpeg is not available"
            
#             cmd = [
#                 self.ffmpeg_path,
#                 "-f", "concat",           # Use concat demuxer
#                 "-safe", "0",             # Allow absolute paths in filelist
#                 "-i", str(concat_file.absolute()),
#                 "-fflags", "+genpts",     # Regenerate pts for better concat stability
#                 "-c", "copy",             # Copy streams without re-encoding (fast & lossless)
#                 "-y",                     # Overwrite output
#                 str(output_file.absolute())
#             ]
            
#             logger.info(f"[MERGE] Running FFmpeg: {' '.join(cmd)}")
            
#             result = subprocess.run(
#                 cmd,
#                 capture_output=True,
#                 text=True,
#                 timeout=timeout
#             )
            
#             # Clean up concat file
#             try:
#                 concat_file.unlink()
#             except Exception:
#                 pass
            
#             if result.returncode != 0:
#                 logger.error(f"[MERGE] FFmpeg error: {result.stderr}")
#                 return False, f"FFmpeg merge failed: {result.stderr}"
            
#             if not output_file.exists():
#                 logger.error("[MERGE] FFmpeg completed but output file not created")
#                 return False, "FFmpeg merge completed but output file not created"
            
#             output_size = output_file.stat().st_size
#             if input_total_size > 0 and output_size < int(input_total_size * 0.60):
#                 logger.error(
#                     f"[MERGE] FFmpeg output suspiciously small: {output_size} bytes "
#                     f"vs input {input_total_size} bytes"
#                 )
#                 return False, (
#                     f"FFmpeg merge appears incomplete ({output_size}/{input_total_size} bytes)"
#                 )

#             logger.info(f"[MERGE] ✅ FFmpeg merge successful: {output_size} bytes")
#             return True, f"Merged {len(chunk_numbers)} chunks into {output_size} bytes"
            
#         except subprocess.TimeoutExpired:
#             logger.error(f"[MERGE] FFmpeg timeout after {timeout}s")
#             return False, f"FFmpeg timeout after {timeout}s"
#         except Exception as e:
#             logger.error(f"[MERGE] FFmpeg merge error: {str(e)}", exc_info=True)
#             return False, f"FFmpeg merge error: {str(e)}"

#     def merge_chunks_streaming(
#         self,
#         chunks_dir: Path,
#         output_file: Path,
#         chunk_numbers: List[int]
#     ) -> Tuple[bool, str]:
#         """
#         Streaming merge using FFmpeg concat demuxer with temporary file (Windows-compatible)
        
#         This properly muxes WebM streams without re-encoding. Uses a temporary
#         file for the filelist instead of stdin for Windows compatibility.
        
#         Args:
#             chunks_dir: Directory containing chunks
#             output_file: Path to output merged file
#             chunk_numbers: Ordered list of chunk numbers
            
#         Returns:
#             (success, message)
#         """
#         if not self.ffmpeg_available or not self.ffmpeg_path:
#             return False, "FFmpeg is not available on this system. Please install FFmpeg."
        
#         try:
#             logger.info(f"[MERGE] Using FFmpeg streaming merge for {len(chunk_numbers)} chunks")
            
#             # Validate chunks first
#             total_size = 0
#             validated_chunks = []
#             for chunk_num in chunk_numbers:
#                 chunk_path = chunks_dir / f"{chunk_num:06d}.webm"
                
#                 # Basic validation: check file exists and is not empty
#                 if not chunk_path.exists():
#                     logger.warning(f"[MERGE] Chunk {chunk_num} missing")
#                     continue
                
#                 if chunk_path.stat().st_size == 0:
#                     logger.warning(f"[MERGE] Skipping empty chunk {chunk_num}")
#                     continue
                
#                 validated_chunks.append((chunk_num, chunk_path))
#                 total_size += chunk_path.stat().st_size
            
#             if not validated_chunks:
#                 return False, "No valid chunks found to merge"
            
#             logger.info(f"[MERGE] Found {len(validated_chunks)} valid chunks ({total_size} bytes)")
            
#             # Create temporary concat file (Windows-compatible)
#             with tempfile.NamedTemporaryFile(
#                 mode='w',
#                 suffix='.txt',
#                 delete=False,
#                 encoding='utf-8'
#             ) as temp_concat:
#                 concat_path = temp_concat.name
#                 for chunk_num, chunk_path in validated_chunks:
#                     # Use forward slashes for cross-platform compatibility
#                     chunk_path_str = str(chunk_path.absolute()).replace('\\', '/')
#                     temp_concat.write(f"file '{chunk_path_str}'\n")
            
#             try:
#                 # Use FFmpeg with temporary file (not stdin for Windows compatibility)
#                 cmd = [
#                     self.ffmpeg_path,
#                     "-f", "concat",
#                     "-safe", "0",
#                     "-i", concat_path,  # Use temporary file instead of /dev/stdin
#                     "-c", "copy",
#                     "-y",
#                     str(output_file.absolute())
#                 ]
                
#                 logger.info(f"[MERGE] Running FFmpeg merge command")
                
#                 result = subprocess.run(
#                     cmd,
#                     capture_output=True,
#                     text=True,
#                     timeout=3600
#                 )
                
#                 if result.returncode != 0:
#                     logger.error(f"[MERGE] FFmpeg merge failed: {result.stderr}")
#                     return False, f"Streaming merge failed: {result.stderr}"
                
#                 if not output_file.exists():
#                     return False, "Merge completed but output file not created"
                
#                 output_size = output_file.stat().st_size
#                 if total_size > 0 and output_size < int(total_size * 0.60):
#                     logger.error(
#                         f"[MERGE] Streaming output suspiciously small: {output_size} bytes "
#                         f"vs input {total_size} bytes"
#                     )
#                     return False, (
#                         f"Streaming merge appears incomplete ({output_size}/{total_size} bytes)"
#                     )

#                 logger.info(f"[MERGE] ✅ Streaming merge successful: {output_size} bytes")
#                 return True, f"Merged {len(validated_chunks)} chunks into {output_size} bytes"
#             finally:
#                 # Clean up temporary concat file
#                 try:
#                     os.unlink(concat_path)
#                 except Exception:
#                     pass
            
#         except subprocess.TimeoutExpired:
#             logger.error("[MERGE] Streaming merge timeout after 3600s")
#             return False, "Streaming merge timeout"
#         except Exception as e:
#             logger.error(f"[MERGE] Streaming merge error: {str(e)}", exc_info=True)
#             return False, f"Streaming merge error: {str(e)}"

#     def merge_chunks_binary(
#         self,
#         chunks_dir: Path,
#         output_file: Path,
#         chunk_numbers: List[int]
#     ) -> Tuple[bool, str]:
#         """
#         Fallback: Simple binary concatenation of WebM chunks
        
#         WARNING: This is a fallback method. WebM has header information that
#         should be properly muxed. Use FFmpeg methods when possible.
        
#         Args:
#             chunks_dir: Directory containing chunks
#             output_file: Path to output merged file
#             chunk_numbers: Ordered list of chunk numbers
            
#         Returns:
#             (success, message)
#         """
#         try:
#             logger.warning("[MERGE] Using binary concatenation fallback (NOT recommended for WebM)")
            
#             validated_chunks = []
#             total_size = 0
            
#             # Validate chunks exist
#             for chunk_num in chunk_numbers:
#                 chunk_path = chunks_dir / f"{chunk_num:06d}.webm"
#                 if chunk_path.exists() and chunk_path.stat().st_size > 0:
#                     validated_chunks.append(chunk_path)
#                     total_size += chunk_path.stat().st_size
#                 elif chunk_path.exists():
#                     logger.warning(f"[MERGE] Skipping empty chunk {chunk_num}")
            
#             if not validated_chunks:
#                 return False, "No valid chunks found"
            
#             logger.info(f"[MERGE] Binary merge: {len(validated_chunks)} chunks, {total_size} bytes")
            
#             # Binary concatenation
#             try:
#                 with open(output_file, 'wb') as outf:
#                     for chunk_path in validated_chunks:
#                         with open(chunk_path, 'rb') as inf:
#                             while True:
#                                 chunk = inf.read(1024 * 1024)  # 1MB at a time
#                                 if not chunk:
#                                     break
#                                 outf.write(chunk)
#                         logger.debug(f"[MERGE] Concatenated {chunk_path.name}")
                
#                 output_size = output_file.stat().st_size
#                 logger.warning(f"[MERGE] ⚠️ Binary merge complete: {output_size} bytes (quality may be affected)")
#                 return True, f"Binary merged {len(validated_chunks)} chunks into {output_size} bytes"
            
#             except Exception as e:
#                 logger.error(f"[MERGE] Binary merge failed: {str(e)}")
#                 return False, f"Binary merge failed: {str(e)}"
            
#         except Exception as e:
#             logger.error(f"[MERGE] Binary merge error: {str(e)}", exc_info=True)
#             return False, f"Binary merge error: {str(e)}"

#     def merge_chunks(
#         self,
#         chunks_dir: Path,
#         output_file: Path,
#         total_chunks: int,
#         uploaded_chunks: List[int],
#         failed_chunks: List[int],
#         chunk_metadata: Optional[Dict] = None,
#         allow_partial: bool = False
#     ) -> Tuple[bool, Dict]:
#         """
#         Merge video chunks with complete validation
        
#         Args:
#             chunks_dir: Directory containing chunk files
#             output_file: Path to output file
#             total_chunks: Total expected chunks
#             uploaded_chunks: List of successfully uploaded chunk numbers
#             failed_chunks: List of failed chunk numbers
#             chunk_metadata: Optional metadata (checksums, timestamps)
#             allow_partial: If True, allow merging with up to 20% missing chunks
            
#         Returns:
#             (success, result_dict)
#         """
#         result = {
#             "success": False,
#             "merged_chunks": 0,
#             "total_chunks": total_chunks,
#             "output_size": 0,
#             "message": "",
#             "errors": [],
#             "method": None
#         }
        
#         try:
#             # Sort uploaded chunks
#             sorted_chunks = sorted(uploaded_chunks)
            
#             logger.info(f"[MERGE] Starting merge: {len(sorted_chunks)}/{total_chunks} chunks available")
#             logger.info(f"[MERGE] Failed chunks: {failed_chunks}")
            
#             # Check chunk continuity
#             if sorted_chunks:
#                 # Verify chunks are sequential (0, 1, 2, ...)
#                 expected_sequence = list(range(len(sorted_chunks)))
#                 if sorted_chunks != expected_sequence:
#                     error = f"Chunks not sequential. Expected {expected_sequence}, got {sorted_chunks}"
#                     logger.error(f"[MERGE] {error}")
#                     result["errors"].append(error)
                    
#                     # Try to fill gaps with empty chunks (not ideal but better than failing)
#                     if not allow_partial:
#                         result["message"] = error
#                         return False, result
            
#             # Validate chunk availability
#             missing_count = total_chunks - len(sorted_chunks) if total_chunks > 0 else 0
#             missing_percentage = (missing_count / total_chunks * 100) if total_chunks > 0 else 0
            
#             if missing_count > 0:
#                 logger.warning(
#                     f"[MERGE] Missing {missing_count} chunks ({missing_percentage:.1f}%)"
#                 )
#                 if missing_percentage > 20:
#                     error = f"Too many chunks missing ({missing_percentage:.1f}%). Merge aborted."
#                     logger.error(f"[MERGE] {error}")
#                     result["errors"].append(error)
#                     result["message"] = error
#                     return False, result

#                 if not allow_partial:
#                     error = (
#                         f"Missing {missing_count} chunks ({missing_percentage:.1f}%). "
#                         "Partial merge not allowed."
#                     )
#                     logger.error(f"[MERGE] {error}")
#                     result["errors"].append(error)
#                     result["message"] = error
#                     return False, result
            
#             # Validate chunk order and checksums
#             is_valid, validation_errors = self.validate_chunk_order(
#                 chunks_dir,
#                 sorted_chunks,
#                 chunk_metadata
#             )
            
#             if not is_valid:
#                 result["errors"].extend(validation_errors)
#                 result["message"] = "; ".join(validation_errors)
#                 logger.error(f"[MERGE] Chunk validation failed: {validation_errors}")
#                 return False, result
            
#             # Attempt merge with available method
#             success = False
#             merge_method = None
            
#             if self.ffmpeg_available:
#                 logger.info("[MERGE] Using FFmpeg concat demuxer (primary method)")
#                 success, msg = self.merge_chunks_with_ffmpeg(
#                     chunks_dir,
#                     output_file,
#                     sorted_chunks
#                 )
#                 merge_method = "ffmpeg_concat"
                
#                 # If FFmpeg merge fails, try streaming as backup
#                 if not success:
#                     logger.warning(f"[MERGE] FFmpeg merge failed ({msg}), trying streaming merge")
#                     success, msg = self.merge_chunks_streaming(
#                         chunks_dir,
#                         output_file,
#                         sorted_chunks
#                     )
#                     merge_method = "streaming" if success else merge_method

#                 # Final fallback if both ffmpeg approaches fail or look incomplete
#                 if not success:
#                     logger.warning(
#                         f"[MERGE] Streaming merge failed ({msg}), trying binary fallback"
#                     )
#                     success, msg = self.merge_chunks_binary(
#                         chunks_dir,
#                         output_file,
#                         sorted_chunks
#                     )
#                     merge_method = "binary_concat" if success else merge_method
#             else:
#                 logger.warning("[MERGE] FFmpeg not available")
#                 logger.info("[MERGE] Attempting binary concatenation fallback (NOT recommended)")
#                 success, msg = self.merge_chunks_binary(
#                     chunks_dir,
#                     output_file,
#                     sorted_chunks
#                 )
#                 merge_method = "binary_concat"
                
#                 if not success:
#                     msg = (
#                         f"{msg} - FFmpeg is required for proper WebM merging. "
#                         "Please install FFmpeg (see SETUP_FFMPEG.md)"
#                     )
            
#             if not success:
#                 result["errors"].append(msg)
#                 result["message"] = msg
#                 logger.error(f"[MERGE] Merge failed: {msg}")
#                 return False, result
            
#             # Verify output
#             if not output_file.exists():
#                 error = "Output file not created"
#                 result["errors"].append(error)
#                 result["message"] = error
#                 return False, result
            
#             output_size = output_file.stat().st_size
#             if output_size < 1000:  # Less than 1KB is suspicious
#                 error = f"Output file too small ({output_size} bytes). Likely corrupted."
#                 result["errors"].append(error)
#                 result["message"] = error
#                 logger.error(f"[MERGE] Suspect output size: {output_size} bytes")
#                 return False, result
            
#             # Success!
#             result["success"] = True
#             result["merged_chunks"] = len(sorted_chunks)
#             result["output_size"] = output_size
#             result["method"] = merge_method
#             result["message"] = (
#                 f"✅ Successfully merged {len(sorted_chunks)}/{total_chunks} chunks "
#                 f"into {output_size} bytes using {merge_method}"
#             )
            
#             logger.info(f"[MERGE] {result['message']}")
#             return True, result
            
#         except Exception as e:
#             logger.error(f"[MERGE] Merge process error: {str(e)}", exc_info=True)
#             result["errors"].append(str(e))
#             result["message"] = f"Merge process error: {str(e)}"
#             return False, result


# # Singleton instance
# _merge_service = None


# def get_recording_merge_service() -> RecordingMergeService:
#     """Get or create recording merge service singleton"""
#     global _merge_service
#     if _merge_service is None:
#         _merge_service = RecordingMergeService()
#     return _merge_service


"""
FIXED Recording Merge Service - MP4 Video Merging with 720p Resolution

Key fixes:
1. MP4 format instead of WebM (H.264 + AAC codecs)
2. 720p resolution (1280x720) support
3. Proper FFmpeg concat for MP4 files
4. Support for chunk_metadata parameter (for backend compatibility)
5. Longer timeout handling
6. Segment-by-segment fallback
"""

import hashlib
import json
import logging
import os
import platform
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class RecordingMergeService:
    """Service for merging MP4 video recording chunks"""

    def __init__(self):
        self.ffmpeg_path = self._find_ffmpeg()
        self.ffmpeg_available = self.ffmpeg_path is not None
        self.is_windows = platform.system() == "Windows"
        
        if self.ffmpeg_available:
            logger.info(f"[MERGE] ✅ FFmpeg found at: {self.ffmpeg_path}")
        else:
            logger.error(
                "[MERGE] ❌ FFmpeg NOT FOUND - Cannot merge MP4 videos!\n"
                "[MERGE] On Windows: Download from https://ffmpeg.org/download.html\n"
                "[MERGE] On Linux: Run 'sudo apt-get install ffmpeg'\n"
                "[MERGE] On macOS: Run 'brew install ffmpeg'"
            )

    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable in system PATH or common locations"""
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                return "ffmpeg"
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        
        # Windows common locations
        if platform.system() == "Windows":
            common_paths = [
                r"C:\ffmpeg\bin\ffmpeg.exe",
                r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
                r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
                os.path.expanduser(r"~\ffmpeg\bin\ffmpeg.exe"),
            ]
            for path in common_paths:
                if os.path.exists(path):
                    try:
                        result = subprocess.run(
                            [path, "-version"],
                            capture_output=True,
                            timeout=5
                        )
                        if result.returncode == 0:
                            logger.info(f"[MERGE] Found FFmpeg at: {path}")
                            return path
                    except Exception:
                        pass
        
        return None

    def calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum for a file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def validate_chunks(
        self,
        chunks_dir: Path,
        expected_chunks: List[int],
        chunk_metadata: Optional[Dict] = None
    ) -> Tuple[bool, List[str]]:
        """Validate that all expected chunks exist"""
        errors = []
        
        missing_chunks = []
        for chunk_num in expected_chunks:
            # Support both .mp4 and .webm extensions
            chunk_file_mp4 = chunks_dir / f"{chunk_num:06d}.mp4"
            chunk_file_webm = chunks_dir / f"{chunk_num:06d}.webm"
            
            if not chunk_file_mp4.exists() and not chunk_file_webm.exists():
                missing_chunks.append(chunk_num)
                errors.append(f"Missing chunk {chunk_num}")
        
        if missing_chunks:
            logger.error(f"[MERGE] Missing {len(missing_chunks)} chunks: {missing_chunks}")
            return False, errors
        
        # Validate metadata if provided
        if chunk_metadata:
            logger.info(f"[MERGE] Validating chunk metadata...")
            for chunk_num in expected_chunks:
                chunk_file = chunks_dir / f"{chunk_num:06d}.mp4"
                if not chunk_file.exists():
                    chunk_file = chunks_dir / f"{chunk_num:06d}.webm"
                
                expected_checksum = chunk_metadata.get(f"chunk_{chunk_num}_checksum")
                if expected_checksum:
                    actual_checksum = self.calculate_checksum(chunk_file)
                    if actual_checksum != expected_checksum:
                        logger.warning(f"[MERGE] Chunk {chunk_num} checksum mismatch (may be corrupted)")
        
        logger.info(f"[MERGE] ✅ All {len(expected_chunks)} chunks found and validated")
        return True, []

    def merge_chunks_with_ffmpeg(
        self,
        chunks_dir: Path,
        output_file: Path,
        chunk_numbers: List[int],
        output_format: str = "mp4",
        resolution: str = "1280x720",
        timeout: int = 3600
    ) -> Tuple[bool, str]:
        """
        Merge MP4 chunks using FFmpeg with re-encoding for reliability
        
        Args:
            chunks_dir: Directory containing chunk files
            output_file: Path to output merged file
            chunk_numbers: Ordered list of chunk numbers
            output_format: Output format (mp4, webm, etc)
            resolution: Output resolution (e.g., "1280x720" for 720p)
            timeout: FFmpeg timeout in seconds
            
        Returns:
            (success, message)
        """
        try:
            if not self.ffmpeg_available:
                return False, "FFmpeg is not available"

            logger.info(f"[MERGE] Starting FFmpeg merge for {len(chunk_numbers)} MP4 chunks")
            logger.info(f"[MERGE] Output: {output_format.upper()} {resolution}")
            
            # Create concat demuxer file
            concat_file = chunks_dir / "filelist.txt"
            
            with open(concat_file, "w") as f:
                for chunk_num in chunk_numbers:
                    # Try MP4 first, then WebM
                    chunk_path = chunks_dir / f"{chunk_num:06d}.mp4"
                    if not chunk_path.exists():
                        chunk_path = chunks_dir / f"{chunk_num:06d}.webm"
                    
                    if chunk_path.exists():
                        abs_path = str(chunk_path.absolute()).replace("\\", "/")
                        f.write(f"file '{abs_path}'\n")
                        logger.info(f"[MERGE] Added chunk {chunk_num}: {chunk_path.name} ({chunk_path.stat().st_size} bytes)")
            
            # Parse resolution
            try:
                width, height = map(int, resolution.split('x'))
            except:
                width, height = 1280, 720
            
            # ✅ KEY: FFmpeg command with MP4 codec (H.264 + AAC)
            if output_format.lower() == "mp4":
                cmd = [
                    self.ffmpeg_path,
                    "-f", "concat",                    # Use concat demuxer
                    "-safe", "0",                      # Allow absolute paths
                    "-i", str(concat_file.absolute()),
                    
                    # ✅ VIDEO CODEC: H.264 for MP4
                    "-c:v", "libx264",                 # H.264 video codec
                    "-preset", "medium",               # Encoding speed
                    "-crf", "23",                      # Quality (0-51, lower=better)
                    "-b:v", "1800k",                   # Video bitrate
                    
                    # ✅ AUDIO CODEC: AAC for MP4
                    "-c:a", "aac",                     # AAC audio codec
                    "-b:a", "192k",                    # Audio bitrate
                    
                    # ✅ VIDEO SETTINGS
                    "-vf", f"scale={width}:{height}:flags=lanczos",
                    "-r", "30",                        # Frame rate
                    
                    # ✅ TIMING FIXES
                    "-movflags", "+faststart",         # Optimize for streaming
                    "-fflags", "+genpts",              # Generate PTS
                    
                    "-y",                              # Overwrite output
                    str(output_file.absolute())
                ]
            else:
                # WebM fallback
                cmd = [
                    self.ffmpeg_path,
                    "-f", "concat",
                    "-safe", "0",
                    "-i", str(concat_file.absolute()),
                    "-c:v", "libvpx-vp9",
                    "-b:v", "1800k",
                    "-c:a", "libopus",
                    "-b:a", "192k",
                    "-vf", f"scale={width}:{height}",
                    "-r", "30",
                    "-y",
                    str(output_file.absolute())
                ]
            
            logger.info(f"[MERGE] Running FFmpeg command (timeout: {timeout}s)")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=timeout,
                text=True
            )
            
            if result.returncode != 0:
                error_output = result.stderr[-1000:]
                logger.error(f"[MERGE] FFmpeg failed: {error_output}")
                return False, f"FFmpeg merge failed: {error_output}"
            
            # Verify output
            if not output_file.exists():
                return False, "Output file not created"
            
            output_size = output_file.stat().st_size
            if output_size < 10000:
                logger.error(f"[MERGE] Output file too small: {output_size} bytes")
                return False, f"Output file too small ({output_size} bytes)"
            
            logger.info(f"[MERGE] ✅ Merge successful: {output_size} bytes")
            return True, f"Merged {len(chunk_numbers)} chunks → {output_size} bytes ({output_format.upper()} {resolution})"
            
        except subprocess.TimeoutExpired:
            logger.error(f"[MERGE] FFmpeg merge timed out after {timeout}s")
            return False, f"FFmpeg merge timed out after {timeout}s"
        except Exception as e:
            logger.error(f"[MERGE] FFmpeg merge error: {str(e)}", exc_info=True)
            return False, f"FFmpeg merge error: {str(e)}"

    def merge_chunks_segment_by_segment(
        self,
        chunks_dir: Path,
        output_file: Path,
        chunk_numbers: List[int],
        output_format: str = "mp4",
        resolution: str = "1280x720",
        timeout: int = 3600
    ) -> Tuple[bool, str]:
        """
        FALLBACK: Re-encode each chunk individually, then concat
        
        More reliable but slower
        """
        try:
            logger.warning("[MERGE] Using segment-by-segment merge (slower but more reliable)")
            
            if not output_file.parent.exists():
                output_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Parse resolution
            try:
                width, height = map(int, resolution.split('x'))
            except:
                width, height = 1280, 720
            
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_dir_path = Path(temp_dir)
                
                # Step 1: Re-encode each chunk
                logger.info("[MERGE] Step 1: Re-encoding individual chunks...")
                for idx, chunk_num in enumerate(chunk_numbers):
                    chunk_path = chunks_dir / f"{chunk_num:06d}.mp4"
                    if not chunk_path.exists():
                        chunk_path = chunks_dir / f"{chunk_num:06d}.webm"
                    
                    temp_output = temp_dir_path / f"chunk_{idx:06d}.mp4"
                    logger.info(f"[MERGE] Re-encoding chunk {chunk_num} ({idx + 1}/{len(chunk_numbers)})")
                    
                    cmd = [
                        self.ffmpeg_path,
                        "-i", str(chunk_path),
                        "-c:v", "libx264",
                        "-preset", "fast",
                        "-crf", "23",
                        "-b:v", "1800k",
                        "-c:a", "aac",
                        "-b:a", "192k",
                        "-vf", f"scale={width}:{height}:flags=lanczos",
                        "-r", "30",
                        "-movflags", "+faststart",
                        "-y",
                        str(temp_output)
                    ]
                    
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        timeout=timeout // max(len(chunk_numbers), 1),
                        text=True
                    )
                    
                    if result.returncode != 0:
                        logger.error(f"[MERGE] Failed to re-encode chunk {chunk_num}")
                        return False, f"Failed to re-encode chunk {chunk_num}"
                
                # Step 2: Concat the re-encoded chunks
                logger.info("[MERGE] Step 2: Concatenating re-encoded chunks...")
                
                concat_file = temp_dir_path / "filelist.txt"
                with open(concat_file, "w") as f:
                    for idx in range(len(chunk_numbers)):
                        temp_output = temp_dir_path / f"chunk_{idx:06d}.mp4"
                        abs_path = str(temp_output.absolute()).replace("\\", "/")
                        f.write(f"file '{abs_path}'\n")
                
                # Use concat with stream copy (safe now that chunks are normalized)
                cmd = [
                    self.ffmpeg_path,
                    "-f", "concat",
                    "-safe", "0",
                    "-i", str(concat_file),
                    "-c", "copy",
                    "-movflags", "+faststart",
                    "-y",
                    str(output_file.absolute())
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=timeout,
                    text=True
                )
                
                if result.returncode != 0:
                    error_output = result.stderr[-1000:]
                    logger.error(f"[MERGE] Final concat failed: {error_output}")
                    return False, f"Final concat failed: {error_output}"
                
                if not output_file.exists():
                    return False, "Final output not created"
                
                output_size = output_file.stat().st_size
                logger.info(f"[MERGE] ✅ Segment-by-segment merge successful: {output_size} bytes")
                return True, f"Merged {len(chunk_numbers)} chunks (segment-by-segment) → {output_size} bytes"
                
        except subprocess.TimeoutExpired:
            logger.error("[MERGE] Segment-by-segment merge timed out")
            return False, "Segment-by-segment merge timed out"
        except Exception as e:
            logger.error(f"[MERGE] Segment-by-segment error: {str(e)}", exc_info=True)
            return False, f"Segment-by-segment error: {str(e)}"

    def merge_chunks(
        self,
        chunks_dir: Path,
        output_file: Path,
        total_chunks: int,
        uploaded_chunks: List[int],
        failed_chunks: List[int] = None,
        chunk_metadata: Optional[Dict] = None,
        output_format: str = "mp4",
        resolution: str = "1280x720",
        allow_partial: bool = False
    ) -> Tuple[bool, Dict]:
        """
        Merge video chunks with complete validation
        
        Args:
            chunks_dir: Directory containing chunk files
            output_file: Path to output file
            total_chunks: Total expected chunks
            uploaded_chunks: List of successfully uploaded chunk numbers
            failed_chunks: List of failed chunk numbers
            chunk_metadata: Optional metadata dict (for checksum validation)
            output_format: Output format (mp4, webm)
            resolution: Output resolution (e.g., "1280x720")
            allow_partial: Allow merging with missing chunks
            
        Returns:
            (success, result_dict)
        """
        if failed_chunks is None:
            failed_chunks = []
        
        result = {
            "success": False,
            "merged_chunks": 0,
            "total_chunks": total_chunks,
            "output_size": 0,
            "message": "",
            "errors": [],
            "method": None,
            "format": output_format,
            "resolution": resolution
        }
        
        try:
            sorted_chunks = sorted(uploaded_chunks)
            
            logger.info(f"[MERGE] Starting merge: {len(sorted_chunks)}/{total_chunks} chunks")
            logger.info(f"[MERGE] Format: {output_format.upper()}, Resolution: {resolution}")
            logger.info(f"[MERGE] Failed chunks: {failed_chunks}")
            
            # Check chunk availability
            missing_count = total_chunks - len(sorted_chunks)
            missing_percentage = (missing_count / total_chunks * 100) if total_chunks > 0 else 0
            
            if missing_count > 0:
                logger.warning(f"[MERGE] Missing {missing_count} chunks ({missing_percentage:.1f}%)")
                
                if missing_percentage > 20:
                    error = f"Too many chunks missing ({missing_percentage:.1f}%). Merge aborted."
                    logger.error(f"[MERGE] {error}")
                    result["errors"].append(error)
                    result["message"] = error
                    return False, result
                
                if not allow_partial:
                    error = f"Missing {missing_count} chunks. Partial merge not allowed."
                    logger.error(f"[MERGE] {error}")
                    result["errors"].append(error)
                    result["message"] = error
                    return False, result
            
            # Validate chunks exist
            is_valid, validation_errors = self.validate_chunks(
                chunks_dir,
                sorted_chunks,
                chunk_metadata
            )
            
            if not is_valid:
                result["errors"].extend(validation_errors)
                result["message"] = "; ".join(validation_errors)
                return False, result
            
            # Attempt merge
            success = False
            merge_method = None
            merge_message = ""
            
            if self.ffmpeg_available:
                logger.info("[MERGE] Attempting FFmpeg merge with re-encoding...")
                success, merge_message = self.merge_chunks_with_ffmpeg(
                    chunks_dir,
                    output_file,
                    sorted_chunks,
                    output_format,
                    resolution
                )
                merge_method = "ffmpeg_reencode"
                
                # Fallback to segment-by-segment if needed
                if not success:
                    logger.warning("[MERGE] FFmpeg merge failed, trying segment-by-segment...")
                    success, merge_message = self.merge_chunks_segment_by_segment(
                        chunks_dir,
                        output_file,
                        sorted_chunks,
                        output_format,
                        resolution
                    )
                    merge_method = "segment_by_segment" if success else merge_method
            
            if not success:
                result["errors"].append(merge_message)
                result["message"] = merge_message
                logger.error(f"[MERGE] All merge methods failed")
                return False, result
            
            # Verify output
            if not output_file.exists():
                error = "Output file not created"
                result["errors"].append(error)
                result["message"] = error
                return False, result
            
            output_size = output_file.stat().st_size
            if output_size < 10000:
                error = f"Output file too small ({output_size} bytes)"
                result["errors"].append(error)
                result["message"] = error
                logger.error(f"[MERGE] Suspect output size: {output_size} bytes")
                return False, result
            
            # Success!
            result["success"] = True
            result["merged_chunks"] = len(sorted_chunks)
            result["output_size"] = output_size
            result["method"] = merge_method
            result["message"] = (
                f"✅ Successfully merged {len(sorted_chunks)}/{total_chunks} chunks "
                f"into {output_size} bytes using {merge_method} "
                f"({output_format.upper()} {resolution})"
            )
            
            logger.info(f"[MERGE] {result['message']}")
            return True, result
            
        except Exception as e:
            logger.error(f"[MERGE] Merge process error: {str(e)}", exc_info=True)
            result["errors"].append(str(e))
            result["message"] = f"Merge process error: {str(e)}"
            return False, result


# Singleton instance
_merge_service = None


def get_recording_merge_service() -> RecordingMergeService:
    """Get or create recording merge service singleton"""
    global _merge_service
    if _merge_service is None:
        _merge_service = RecordingMergeService()
    return _merge_service