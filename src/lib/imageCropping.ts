/**
 * Image cropping utilities for profile pictures
 * Automatically crops images to square format with center positioning
 */

export const PROFILE_IMAGE_SIZE = 400; // Target size for profile images

/**
 * Loads an image from a File object
 */
export const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Crops an image to a square format using center cropping
 * @param image - The loaded image element
 * @param targetSize - The target square size (default: PROFILE_IMAGE_SIZE)
 * @returns Promise<Blob> - The cropped image as a blob
 */
export const cropImageToSquare = async (
  image: HTMLImageElement, 
  targetSize: number = PROFILE_IMAGE_SIZE
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Cannot get canvas context'));
      return;
    }

    // Set canvas dimensions to target square size
    canvas.width = targetSize;
    canvas.height = targetSize;

    const { naturalWidth, naturalHeight } = image;
    
    // Calculate crop dimensions for center cropping
    const minDimension = Math.min(naturalWidth, naturalHeight);
    const scale = targetSize / minDimension;
    
    // Calculate source crop area (center of the image)
    const cropX = (naturalWidth - minDimension) / 2;
    const cropY = (naturalHeight - minDimension) / 2;
    
    // Draw the cropped and scaled image onto the canvas
    ctx.drawImage(
      image,
      cropX, cropY, minDimension, minDimension, // Source crop area
      0, 0, targetSize, targetSize // Destination area
    );

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create cropped image blob'));
        }
      },
      'image/jpeg',
      0.9 // Good quality
    );
  });
};

/**
 * Complete workflow: takes a file, crops it to square, and returns the cropped file
 */
export const cropProfileImage = async (file: File): Promise<File> => {
  try {
    // Load the image
    const image = await loadImageFromFile(file);
    
    // Crop to square
    const croppedBlob = await cropImageToSquare(image);
    
    // Convert blob back to File with original name and type
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const croppedFile = new File(
      [croppedBlob], 
      `cropped_${file.name}`,
      { type: file.type || 'image/jpeg' }
    );
    
    // Clean up object URL
    URL.revokeObjectURL(image.src);
    
    return croppedFile;
  } catch (error) {
    console.error('Error cropping image:', error);
    throw error;
  }
};