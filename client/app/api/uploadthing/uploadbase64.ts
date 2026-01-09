import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "./core"; 

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

function base64ToFile(base64String: string, filename = 'image.jpg', mimeType = 'image/jpeg'): File {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteArrays = [];
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArrays.push(byteCharacters.charCodeAt(i));
  }
  
  const blob = new Blob([new Uint8Array(byteArrays)], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

export function useUploadBase64() {
  const { startUpload } = useUploadThing("imageUploader");
  
  const uploadBase64 = async (base64String: string): Promise<string | undefined> => {
    const file = base64ToFile(base64String);
    
    try {
      const res = await startUpload([file]);
      if (res && res[0]) {
        console.log("File uploaded successfully. URL:", res[0].url);
        return res[0].url;
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  return uploadBase64;
}