import type { LogisticsWebshopImage } from './logisticsTypes';

export function hasIncompleteWebshopPhotos(image: LogisticsWebshopImage) {
  return Boolean(image.importWarnings?.length || (image.expectedPhotoCount && (image.importedPhotoCount || 0) < image.expectedPhotoCount));
}

/** Full, case-sensitive photo references: equal JPEG headers are not equal photos. */
export function webshopPhotoDuplicateKey(image: LogisticsWebshopImage) {
  return JSON.stringify([
    image.deliveryDate,
    image.matchedReceiptId || image.matchedReceiptNumber || image.orderNumber,
    image.customerName.trim().toLowerCase(),
    image.sourceLineId || '',
    image.fileName,
    image.productSummary || '',
    image.productQuantity ?? null,
    image.photoUrl,
  ]);
}
