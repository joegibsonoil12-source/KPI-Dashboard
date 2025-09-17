#!/bin/bash

# FFmpeg MKV to MP4 Conversion Script
# Converts .mkv files to .mp4 format suitable for web playback
# Usage: ./convert_mkv_to_mp4.sh input.mkv [output.mp4]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    log_error "ffmpeg is not installed. Please install it first:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    exit 1
fi

# Check arguments
if [ $# -eq 0 ]; then
    log_error "Usage: $0 input.mkv [output.mp4]"
    echo ""
    echo "Examples:"
    echo "  $0 video.mkv                    # Creates video.mp4"
    echo "  $0 video.mkv converted.mp4      # Creates converted.mp4"
    echo "  $0 *.mkv                        # Converts all .mkv files"
    exit 1
fi

# Function to convert a single file
convert_file() {
    local input_file="$1"
    local output_file="$2"
    
    # Check if input file exists
    if [ ! -f "$input_file" ]; then
        log_error "Input file '$input_file' not found"
        return 1
    fi
    
    # Check if input is actually an MKV file
    if [[ ! "$input_file" =~ \.(mkv|MKV)$ ]]; then
        log_warn "Input file '$input_file' is not an .mkv file, skipping"
        return 1
    fi
    
    # Generate output filename if not provided
    if [ -z "$output_file" ]; then
        output_file="${input_file%.*}.mp4"
    fi
    
    # Check if output file already exists
    if [ -f "$output_file" ]; then
        log_warn "Output file '$output_file' already exists"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping '$input_file'"
            return 0
        fi
    fi
    
    log_info "Converting '$input_file' to '$output_file'..."
    
    # Get input file info
    local duration=$(ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input_file" 2>/dev/null || echo "unknown")
    local size=$(ls -lh "$input_file" | awk '{print $5}')
    
    log_info "Input: $size, Duration: ${duration}s"
    
    # FFmpeg conversion with web-optimized settings
    # -c:v libx264: Use H.264 codec for maximum compatibility
    # -preset medium: Balance between encoding speed and compression
    # -crf 23: Good quality/size balance (lower = better quality, larger file)
    # -c:a aac: Use AAC audio codec for web compatibility
    # -b:a 128k: Audio bitrate
    # -movflags +faststart: Optimize for web streaming (metadata at start)
    # -pix_fmt yuv420p: Ensure compatibility with older players
    
    local start_time=$(date +%s)
    
    if ffmpeg -i "$input_file" \
        -c:v libx264 \
        -preset medium \
        -crf 23 \
        -c:a aac \
        -b:a 128k \
        -movflags +faststart \
        -pix_fmt yuv420p \
        -y \
        "$output_file" 2>/dev/null; then
        
        local end_time=$(date +%s)
        local conversion_time=$((end_time - start_time))
        local output_size=$(ls -lh "$output_file" | awk '{print $5}')
        
        log_info "✓ Conversion completed successfully!"
        log_info "Output: $output_size, Time: ${conversion_time}s"
        log_info "File saved as: $output_file"
    else
        log_error "Conversion failed for '$input_file'"
        # Clean up partial file
        [ -f "$output_file" ] && rm "$output_file"
        return 1
    fi
}

# Handle multiple files or single file
if [ $# -eq 1 ] && [[ "$1" == *"*"* ]]; then
    # Handle glob pattern
    log_info "Converting multiple files matching pattern: $1"
    for file in $1; do
        if [ -f "$file" ]; then
            convert_file "$file"
        fi
    done
elif [ $# -gt 2 ]; then
    # Multiple input files, no output specified
    log_info "Converting multiple input files..."
    for file in "$@"; do
        convert_file "$file"
    done
else
    # Single file conversion
    convert_file "$1" "$2"
fi

log_info "All conversions completed!"