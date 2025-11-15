#!/bin/bash

# Favicon Generation Script for Looqta
# This script helps generate favicon files from a source image

echo "Looqta Favicon Generator"
echo "========================"
echo ""
echo "This script requires ImageMagick to be installed."
echo "Install with: sudo apt-get install imagemagick"
echo ""
echo "Usage:"
echo "  ./generate-favicon.sh <source-image.png>"
echo ""
echo "The source image should be at least 512x512 pixels."
echo ""

if [ -z "$1" ]; then
    echo "Error: No source image provided"
    exit 1
fi

SOURCE_IMAGE="$1"
OUTPUT_DIR="../frontend/public"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found: $SOURCE_IMAGE"
    exit 1
fi

echo "Generating favicon files from: $SOURCE_IMAGE"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Generate favicon.ico (multi-size)
echo "Generating favicon.ico..."
convert "$SOURCE_IMAGE" -resize 16x16 "$OUTPUT_DIR/favicon-16x16-temp.png"
convert "$SOURCE_IMAGE" -resize 32x32 "$OUTPUT_DIR/favicon-32x32-temp.png"
convert "$SOURCE_IMAGE" -resize 48x48 "$OUTPUT_DIR/favicon-48x48-temp.png"
convert "$OUTPUT_DIR/favicon-16x16-temp.png" "$OUTPUT_DIR/favicon-32x32-temp.png" "$OUTPUT_DIR/favicon-48x48-temp.png" "$OUTPUT_DIR/favicon.ico"
rm "$OUTPUT_DIR/favicon-16x16-temp.png" "$OUTPUT_DIR/favicon-32x32-temp.png" "$OUTPUT_DIR/favicon-48x48-temp.png"

# Generate PNG favicons
echo "Generating favicon-16x16.png..."
convert "$SOURCE_IMAGE" -resize 16x16 "$OUTPUT_DIR/favicon-16x16.png"

echo "Generating favicon-32x32.png..."
convert "$SOURCE_IMAGE" -resize 32x32 "$OUTPUT_DIR/favicon-32x32.png"

echo "Generating apple-touch-icon.png..."
convert "$SOURCE_IMAGE" -resize 180x180 "$OUTPUT_DIR/apple-touch-icon.png"

echo ""
echo "✅ Favicon generation complete!"
echo ""
echo "Generated files:"
echo "  - $OUTPUT_DIR/favicon.ico"
echo "  - $OUTPUT_DIR/favicon-16x16.png"
echo "  - $OUTPUT_DIR/favicon-32x32.png"
echo "  - $OUTPUT_DIR/apple-touch-icon.png"
echo ""
echo "Next steps:"
echo "  1. Create og-image.jpg (1200x630) and place in $OUTPUT_DIR"
echo "  2. Create logo.png (at least 112x112) and place in $OUTPUT_DIR"
echo "  3. Rebuild the frontend: cd frontend && npm run build"
