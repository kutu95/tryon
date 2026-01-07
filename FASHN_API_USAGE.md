# FASHN Virtual Try-On v1.6 API Usage Guide

This document explains how to use the enhanced FASHN API integration with all optional parameters and the two-phase workflow.

## Overview

The FASHN integration now supports:
- **Two-phase workflow**: Fast Preview → Pick → Finalize
- **Advanced parameters**: category, mode, seed, num_samples, garment_photo_type, segmentation_free, moderation_level, output_format
- **Result caching**: Automatic caching of results for faster re-generation
- **Reproducibility**: Seed-based deterministic generation

## API Parameters

### Required Parameters
- `model_image`: URL or base64 string of the model/actor photo
- `garment_image`: URL or base64 string of the garment image

### Optional Parameters (with defaults)

#### `category` (default: `"auto"`)
- **Values**: `"auto"`, `"tops"`, `"bottoms"`, `"one-pieces"`
- **Usage**: Helps the API understand the garment type for better results
- **Recommendation**: Use `"auto"` unless you know the specific category

#### `mode` (default: `"balanced"`)
- **Values**: `"performance"`, `"balanced"`, `"quality"`
- **Usage**: 
  - `"performance"`: Fastest generation, lower quality (use for previews)
  - `"balanced"`: Good balance of speed and quality (default)
  - `"quality"`: Highest quality, slower generation (use for final results)
- **Workflow**: Use `"performance"` for Fast Preview, `"quality"` for Finalize

#### `seed` (default: auto-generated)
- **Type**: Integer (0 to 2,147,483,647)
- **Usage**: Controls randomness for reproducibility
- **Recommendation**: 
  - Leave empty for random results
  - Lock seed after finding a good preview to reproduce it exactly
  - Same seed + same params = same result

#### `num_samples` (default: `1`)
- **Type**: Integer (1 to 4)
- **Usage**: Number of variations to generate
- **Workflow**: Use `4` for Fast Preview to see multiple options

#### `garment_photo_type` (default: `"auto"`)
- **Values**: `"auto"`, `"model"`, `"flat-lay"`
- **Usage**: Helps API understand how the garment is photographed
- **Recommendation**: Use `"auto"` unless you know the photo type

#### `segmentation_free` (default: `true`)
- **Type**: Boolean
- **Usage**: Whether to use segmentation-free mode
- **Recommendation**: Keep enabled for better results

#### `moderation_level` (default: `"permissive"`)
- **Values**: `"permissive"`, `"conservative"`, `"none"`
- **Usage**: Content moderation strictness
- **Recommendation**: Use `"permissive"` for most cases

#### `output_format` (default: `"png"`)
- **Values**: `"png"`, `"jpg"`
- **Usage**: Output image format
- **Recommendation**: Use `"png"` for better quality, `"jpg"` for smaller files

#### `return_base64` (default: `false`)
- **Type**: Boolean
- **Usage**: Return image as base64 string instead of URL (privacy mode)
- **Note**: Only use if supported by your API endpoint

## Two-Phase Workflow: Preview → Pick → Finalize

### Step 1: Fast Preview
1. Click **"Fast Preview (4 samples)"**
2. System generates 4 variations with:
   - `mode: "performance"` (fast)
   - `num_samples: 4` (multiple options)
   - Unique seeds for each sample
3. Results appear in a selectable grid

### Step 2: Pick Your Favorite
1. Review the 4 preview results
2. Click on your favorite
3. System automatically finalizes with that selection

### Step 3: Finalize
1. System re-runs with:
   - `mode: "quality"` (high quality)
   - Same seed as selected preview (reproducibility)
   - `num_samples: 1` (single result)
2. Final high-quality result is displayed

### Additional Actions

#### Reroll
- Generates a new Fast Preview with new random seeds
- Use when you want to see different variations

#### Recreate
- Re-runs the finalization with the same seed
- Use to regenerate the exact same result (useful if result was lost)

## Reproducibility Guarantees

**Important**: The same seed + same parameters = same result

- Seeds are generated cryptographically random by default
- Lock a seed after finding a good preview to reproduce it
- Same seed ensures deterministic output (useful for comparisons)

**Example**:
```
Preview with seed 12345 → Select → Finalize with seed 12345 → Same result every time
```

## Result Caching

The system automatically caches results based on:
- Model image URL
- Garment image URL
- Seed
- All parameters (mode, category, etc.)

**Benefits**:
- Faster re-generation of same request
- Reduced API calls
- Better user experience

**Cache Key**: Generated from image URLs, seed, and all parameters

## Error Handling

The system handles various error cases:

### Missing Images
- **Error**: "Please select both an actor photo and a garment image"
- **Solution**: Select both images before generating

### Invalid Input
- **Error**: "Invalid request parameters"
- **Solution**: Check advanced settings for invalid values

### Moderation Rejection
- **Error**: "Content was rejected by moderation filters"
- **Solution**: Try different images or adjust moderation level

### API Timeout
- **Error**: "Request timed out. Please try again."
- **Solution**: Retry the request

### Rate Limit
- **Error**: "Rate limit exceeded. Please try again later."
- **Solution**: Wait a moment and try again

## Advanced Controls

All advanced parameters are available in the collapsed "Advanced Settings" section:

1. **Category**: Dropdown for garment category
2. **Mode**: Dropdown for performance/balanced/quality
3. **Seed**: Optional input (auto-generated if empty)
4. **Lock Seed**: Toggle to lock seed for reproducibility
5. **Number of Samples**: Stepper (1-4)
6. **Garment Photo Type**: Dropdown
7. **Segmentation Free**: Toggle
8. **Moderation Level**: Dropdown
9. **Output Format**: Dropdown (PNG/JPG)
10. **Privacy Mode**: Toggle for base64 return (if supported)

**Settings Persistence**: All advanced settings are saved to localStorage and restored on page load.

## Backward Compatibility

The original "Generate Try-On" button still works:
- Uses the old API route (`/api/tryon`)
- Supports basic settings via `settings` parameter
- Maintains compatibility with existing workflows

## API Route

### New Enhanced Route: `/api/tryon/v2`

**Request Format**:
```json
{
  "actor_photo_id": "uuid",
  "garment_image_id": "uuid",
  "category": "auto",
  "mode": "balanced",
  "seed": 12345,
  "num_samples": 1,
  "garment_photo_type": "auto",
  "segmentation_free": true,
  "moderation_level": "permissive",
  "output_format": "png",
  "return_base64": false
}
```

**Response Format**:
```json
{
  "results": [
    {
      "imageUrl": "https://...",
      "base64": null,
      "seed": 12345,
      "params": { ... },
      "createdAt": "2024-01-01T00:00:00Z",
      "requestId": "req_..."
    }
  ],
  "requestId": "req_...",
  "duration": 1234
}
```

## Best Practices

1. **Use Fast Preview first**: Get multiple options quickly
2. **Lock seed after preview**: Ensure reproducibility
3. **Use quality mode for final**: Best results for saved images
4. **Adjust category if needed**: Better results for specific garment types
5. **Cache is your friend**: Same requests are instant

## Troubleshooting

### Results look different than preview
- **Cause**: Preview uses `performance` mode, final uses `quality` mode
- **Solution**: This is expected - final should be higher quality

### Can't reproduce exact result
- **Cause**: Seed or parameters changed
- **Solution**: Ensure seed is locked and all parameters match

### Slow generation
- **Cause**: Using `quality` mode or high `num_samples`
- **Solution**: Use `performance` mode for previews, `quality` only for final

