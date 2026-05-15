export const MAX_REFERENCE_IMAGES = 16;

export function getReferenceImageFiles(formData: FormData) {
  const imageFiles = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File);

  if (imageFiles.length > 0) {
    return imageFiles;
  }

  const legacyImageFile = formData.get("image");
  return legacyImageFile instanceof File ? [legacyImageFile] : [];
}

export function validateReferenceImageFiles(
  imageFiles: File[],
  maxUploadSize: number
) {
  if (imageFiles.length === 0) {
    return "请求参数不完整";
  }

  if (imageFiles.length > MAX_REFERENCE_IMAGES) {
    return `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张`;
  }

  for (const imageFile of imageFiles) {
    if (!imageFile.type.startsWith("image/")) {
      return "只支持图片文件";
    }

    if (imageFile.size <= 0 || imageFile.size > maxUploadSize) {
      return "图片大小不合法";
    }
  }

  return null;
}
